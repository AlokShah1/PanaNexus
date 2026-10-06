import type { Request, Response } from 'express';
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from './auth-core';
import type { Role, SessionPayload } from './auth-core';

const SESSION_COOKIE = 'hc_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function readToken(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (cookies && cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
  const header = req.headers?.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) return rest.join('=');
  }
  return undefined;
}

export function getSession(req: Request): SessionPayload | null {
  return verifySessionToken(readToken(req));
}

export function setSessionCookie(res: Response, userId: string, role: Role): void {
  res.cookie(SESSION_COOKIE, createSessionToken(userId, role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, path: '/' });
}

export { createSessionToken, hashPassword, verifyPassword, verifySessionToken };
export type { Role, SessionPayload };
