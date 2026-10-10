import type { Request, Response } from 'express';
import { hashPassword, verifyPassword } from './auth-core.js';
import type { Role } from './auth-core.js';

export const SESSION_COOKIE = 'hc_session';

function readTokenFromHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) return rest.join('=');
  }
  return undefined;
}

export function readSessionToken(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (cookies && cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
  return readTokenFromHeader(req.headers?.cookie);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'none' as const,
    secure: true,
    path: '/',
  };
}

/**
 * Set the session cookie so its browser lifetime matches the server-side
 * session expiry exactly. Express interprets `maxAge` as **milliseconds** (it
 * derives `Expires` from `Date.now() + maxAge`), so we always pass milliseconds
 * derived from the session's absolute expiry rather than a raw TTL.
 */
export function setSessionCookie(res: Response, token: string, expiresAt: Date | string): void {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const maxAgeMs = Math.max(0, expiry.getTime() - Date.now());
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: maxAgeMs });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export { hashPassword, verifyPassword };
export type { Role };
