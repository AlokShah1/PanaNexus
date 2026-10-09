import fs from 'node:fs';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

export type StorageDriver = 'local' | 's3';

export type PresignGetOptions = {
  /** Lifetime of the signed URL in seconds. */
  expiresInSeconds: number;
  /** Value for the Content-Disposition attachment filename. */
  downloadFilename?: string;
  /** Explicit response content type (falls back to the stored object type). */
  contentType?: string;
  /** Public origin used to build absolute URLs for the local driver. */
  baseUrl?: string;
};

export type ObjectHead = {
  exists: boolean;
  sizeBytes?: number;
  contentType?: string;
};

export interface StorageAdapter {
  readonly driver: StorageDriver;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  head(key: string): Promise<ObjectHead>;
  presignGet(key: string, opts: PresignGetOptions): Promise<string>;
}

/** Error thrown when a stored object is unexpectedly absent. */
export class ObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Storage object not found: ${key}`);
    this.name = 'ObjectNotFoundError';
  }
}

function safeJoin(root: string, key: string): string {
  const resolved = path.resolve(root, key);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error('Refusing to touch a path outside the storage root.');
  }
  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Local filesystem driver (development / self-hosted)                        */
/* -------------------------------------------------------------------------- */

export function localReportsDir(): string {
  return path.resolve(process.cwd(), env.UPLOAD_DIR, 'reports');
}

function signLocalToken(key: string, exp: number, name: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(`${key}|${exp}|${name}`).digest('hex');
}

export type LocalDownloadToken = { key: string; exp: number; name: string; sig: string };

export function buildLocalDownloadToken(key: string, exp: number, name: string): LocalDownloadToken {
  return { key, exp, name, sig: signLocalToken(key, exp, name) };
}

export function verifyLocalDownloadToken(token: LocalDownloadToken, nowSeconds = Math.floor(Date.now() / 1000)): 'ok' | 'expired' | 'invalid' {
  if (!token.key || !token.name || !token.sig) return 'invalid';
  if (!Number.isFinite(token.exp)) return 'invalid';
  if (token.exp <= nowSeconds) return 'expired';
  const expected = signLocalToken(token.key, token.exp, token.name);
  const a = Buffer.from(expected);
  const b = Buffer.from(token.sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'invalid';
  return 'ok';
}

export function readLocalObject(key: string): Buffer | null {
  const full = safeJoin(localReportsDir(), key);
  try {
    return fs.readFileSync(full);
  } catch {
    return null;
  }
}

class LocalStorageAdapter implements StorageAdapter {
  readonly driver = 'local' as const;

  async put(key: string, body: Buffer): Promise<void> {
    const full = safeJoin(localReportsDir(), key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, body);
  }

  async remove(key: string): Promise<void> {
    await fs.promises.rm(safeJoin(localReportsDir(), key), { force: true });
  }

  async head(key: string): Promise<ObjectHead> {
    try {
      const stat = await fs.promises.stat(safeJoin(localReportsDir(), key));
      return { exists: stat.isFile(), sizeBytes: stat.size };
    } catch {
      return { exists: false };
    }
  }

  async presignGet(key: string, opts: PresignGetOptions): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + opts.expiresInSeconds;
    const name = opts.downloadFilename ?? path.basename(key);
    const token = buildLocalDownloadToken(key, exp, name);
    const params = new URLSearchParams({
      key: token.key,
      exp: String(token.exp),
      name: token.name,
      sig: token.sig,
    });
    const base = (opts.baseUrl ?? '').replace(/\/$/, '');
    return `${base}/api/v1/reports/file?${params.toString()}`;
  }
}

/* -------------------------------------------------------------------------- */
/* S3-compatible private object storage (production)                          */
/* -------------------------------------------------------------------------- */

class S3StorageAdapter implements StorageAdapter {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    if (!env.AWS_REGION || !env.AWS_S3_BUCKET) {
      throw new Error('S3 storage requires AWS_REGION and AWS_S3_BUCKET.');
    }
    this.bucket = env.AWS_S3_BUCKET;
    const credentials =
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
        : undefined;
    this.client = new S3Client({ region: env.AWS_REGION, credentials });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async head(key: string): Promise<ObjectHead> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { exists: true, sizeBytes: res.ContentLength, contentType: res.ContentType };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (status === 404) return { exists: false };
      throw err;
    }
  }

  async presignGet(key: string, opts: PresignGetOptions): Promise<string> {
    const disposition = opts.downloadFilename
      ? `attachment; filename="${opts.downloadFilename.replace(/"/g, '')}"`
      : undefined;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: disposition,
        ResponseContentType: opts.contentType,
      }),
      { expiresIn: opts.expiresInSeconds },
    );
  }
}

let cached: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (cached) return cached;
  cached = env.STORAGE_DRIVER === 's3' ? new S3StorageAdapter() : new LocalStorageAdapter();
  return cached;
}
