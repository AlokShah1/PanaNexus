import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb);

export type Role =
  | 'PATIENT'
  | 'DOCTOR'
  | 'FACILITY_STAFF'
  | 'AMBULANCE_OPERATOR'
  | 'BLOOD_DONOR'
  | 'ORGAN_DONOR'
  | 'ADMIN';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split(':');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * An opaque, high-entropy bearer token. Only the SHA-256 hash of this value is
 * ever persisted, so a database read cannot be replayed as a live session.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
