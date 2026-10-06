import 'server-only';
import { cookies } from 'next/headers';
import {
  Role,
  SessionPayload,
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from './auth-core';

export { createSessionToken, hashPassword, verifyPassword, verifySessionToken };
export type { Role, SessionPayload };

const SESSION_COOKIE = 'hc_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function setSessionCookie(userId: string, role: Role): Promise<void> {
  const token = createSessionToken(userId, role);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
