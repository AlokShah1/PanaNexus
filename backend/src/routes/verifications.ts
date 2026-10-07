import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { env } from '../config/env.js';
import { getUser, requireAuth } from '../middleware/auth.js';

const router = Router();

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;

function uploadDir(): string {
  const dir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir()),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_EXT.has(path.extname(file.originalname).toLowerCase())),
});

function handleUpload(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void {
  upload.array('files', MAX_FILES)(req, res, (err) => {
    if (err) {
      fail(res, 'UPLOAD_FAILED', 'Files must be images or PDFs up to 5 MB each.', 422);
      return;
    }
    next();
  });
}

function kindForRole(role: string): 'DOCTOR' | 'FACILITY' | 'AMBULANCE' | null {
  if (role === 'DOCTOR') return 'DOCTOR';
  if (role === 'FACILITY_STAFF') return 'FACILITY';
  if (role === 'AMBULANCE_OPERATOR') return 'AMBULANCE';
  return null;
}

async function latestRequest(userId: string) {
  const rows = await db.orm.public.VerificationRequest.where({ userId }).orderBy((r) => r.createdAt.desc()).limit(1).all();
  return rows[0] ?? null;
}

function viewRequest(r: {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  payload: string | null;
  documentUrls: readonly string[];
  createdAt: string;
  reviewedAt: string | null;
}) {
  let payload: unknown = null;
  if (r.payload) {
    try {
      payload = JSON.parse(r.payload);
    } catch {
      payload = null;
    }
  }
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    reason: r.reason,
    payload,
    documentUrls: r.documentUrls,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
  };
}

router.get('/me', requireAuth, async (req, res) => {
  const user = getUser(req);
  const request = await latestRequest(user.id);
  return ok(res, {
    verificationStatus: user.verificationStatus,
    role: user.role,
    request: request ? viewRequest(request) : null,
  });
});

router.post('/me/documents', requireAuth, handleUpload, async (req, res) => {
  const user = getUser(req);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return fail(res, 'NO_FILES', 'Upload at least one image or PDF file.', 422);
  }
  const kind = kindForRole(user.role);
  if (!kind) return fail(res, 'NOT_APPLICABLE', 'Verification is only needed for professional accounts.', 400);
  let request = await latestRequest(user.id);
  if (request && request.status === 'APPROVED') {
    for (const f of files) fs.rm(f.path, { force: true }, () => undefined);
    return fail(res, 'ALREADY_VERIFIED', 'Your account is already verified.', 409);
  }
  if (!request) {
    request = await db.orm.public.VerificationRequest.create({
      userId: user.id,
      kind,
      payload: null,
      documentUrls: [],
      status: 'PENDING',
    });
  }
  const names = files.map((f) => path.basename(f.path));
  const merged = [...new Set([...request.documentUrls, ...names])].slice(0, MAX_FILES);
  await db.orm.public.VerificationRequest.where({ id: request.id }).update({ documentUrls: merged });
  return ok(res, { documentUrls: merged }, 201);
});

router.get('/me/documents/:filename', requireAuth, async (req, res) => {
  const user = getUser(req);
  const filename = path.basename(req.params.filename);
  const request = await latestRequest(user.id);
  const isAdmin = user.role === 'ADMIN';
  if (!request && !isAdmin) return fail(res, 'NOT_FOUND', 'Document not found.', 404);
  if (request && !request.documentUrls.includes(filename) && !isAdmin) {
    return fail(res, 'NOT_FOUND', 'Document not found.', 404);
  }
  const filePath = path.join(uploadDir(), filename);
  if (!fs.existsSync(filePath)) return fail(res, 'NOT_FOUND', 'Document not found.', 404);
  return res.sendFile(filePath);
});

router.delete('/me/documents/:filename', requireAuth, async (req, res) => {
  const user = getUser(req);
  const filename = path.basename(req.params.filename);
  const request = await latestRequest(user.id);
  if (!request || !request.documentUrls.includes(filename)) return fail(res, 'NOT_FOUND', 'Document not found.', 404);
  if (request.status === 'APPROVED') return fail(res, 'ALREADY_VERIFIED', 'Your account is already verified.', 409);
  const merged = request.documentUrls.filter((f) => f !== filename);
  await db.orm.public.VerificationRequest.where({ id: request.id }).update({ documentUrls: merged });
  fs.rm(path.join(uploadDir(), filename), { force: true }, () => undefined);
  return ok(res, { documentUrls: merged });
});

router.post('/me/resubmit', requireAuth, async (req, res) => {
  const user = getUser(req);
  const kind = kindForRole(user.role);
  if (!kind) return fail(res, 'NOT_APPLICABLE', 'Verification is only needed for professional accounts.', 400);
  const body = req.body ?? {};
  const payload = body.payload && typeof body.payload === 'object' ? JSON.stringify(body.payload) : undefined;
  const request = await latestRequest(user.id);
  if (request && request.status === 'APPROVED') return fail(res, 'ALREADY_VERIFIED', 'Your account is already verified.', 409);
  if (!request) {
    const created = await db.orm.public.VerificationRequest.create({
      userId: user.id,
      kind,
      payload: payload ?? null,
      documentUrls: [],
      status: 'PENDING',
    });
    await db.orm.public.User.where({ id: user.id }).update({ verificationStatus: 'PENDING' });
    return ok(res, { request: viewRequest(created), verificationStatus: 'PENDING' }, 201);
  }
  if (request.status === 'PENDING' && !payload && request.reason == null) {
    return fail(res, 'UNDER_REVIEW', 'Your verification is already under review.', 409);
  }
  const patch: Record<string, unknown> = { status: 'PENDING', reason: null };
  if (payload) patch.payload = payload;
  await db.orm.public.VerificationRequest.where({ id: request.id }).update(patch as never);
  if (user.verificationStatus === 'REJECTED') {
    await db.orm.public.User.where({ id: user.id }).update({ verificationStatus: 'PENDING' });
  }
  const updated = await latestRequest(user.id);
  return ok(res, { request: updated ? viewRequest(updated) : null, verificationStatus: user.verificationStatus === 'REJECTED' ? 'PENDING' : user.verificationStatus });
});

export default router;
