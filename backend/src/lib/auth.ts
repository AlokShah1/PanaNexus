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
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    secure: isProd,
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string, maxAgeSeconds: number): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: maxAgeSeconds });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export { hashPassword, verifyPassword };
export type { Role };
