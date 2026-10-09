import { db } from '../../prisma/db.js';
import { generateSessionToken, hashSessionToken } from './auth-core.js';
import type { Role } from './auth-core.js';
import { env } from '../config/env.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Minimum gap between sliding-window writes. Avoids a database write on every
 * single request while still keeping an active session's idle timer fresh.
 */
const SLIDE_THRESHOLD_MS = 30_000;

export interface SessionTtl {
  idleMs: number;
  absoluteMs: number;
}

export function sessionTtlForRole(role: Role): SessionTtl {
  if (role === 'ADMIN') {
    return {
      idleMs: env.SESSION_ADMIN_IDLE_MINUTES * MINUTE,
      absoluteMs: env.SESSION_ADMIN_ABSOLUTE_HOURS * HOUR,
    };
  }
  return {
    idleMs: env.SESSION_IDLE_MINUTES * MINUTE,
    absoluteMs: env.SESSION_ABSOLUTE_HOURS * HOUR,
  };
}

export interface SessionRow {
  id: string;
  userId: string;
  role: Role;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
  rotatedFrom: string | null;
}

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
  rotatedFrom?: string | null;
}

export async function createSession(
  userId: string,
  role: Role,
  meta: SessionMeta = {},
): Promise<{ token: string; session: SessionRow }> {
  const token = generateSessionToken();
  const now = Date.now();
  const ttl = sessionTtlForRole(role);
  const session = (await db.orm.public.Session.create({
    userId,
    role,
    tokenHash: hashSessionToken(token),
    userAgent: meta.userAgent ? meta.userAgent.slice(0, 300) : null,
    ip: meta.ip ?? null,
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    idleExpiresAt: new Date(now + ttl.idleMs).toISOString(),
    absoluteExpiresAt: new Date(now + ttl.absoluteMs).toISOString(),
    revokedAt: null,
    rotatedFrom: meta.rotatedFrom ?? null,
  })) as unknown as SessionRow;
  return { token, session };
}

export type SessionResolution =
  | { status: 'valid'; session: SessionRow }
  | { status: 'missing' }
  | { status: 'revoked' }
  | { status: 'expired' };

function isExpired(session: SessionRow, now: number): boolean {
  return (
    now >= new Date(session.absoluteExpiresAt).getTime() ||
    now >= new Date(session.idleExpiresAt).getTime()
  );
}

/**
 * Validate a bearer token against the server-side session store. Expired or
 * revoked sessions are refused regardless of what the cookie still carries.
 * A valid session's idle window slides forward (throttled).
 */
export async function resolveSession(
  token: string | undefined | null,
): Promise<SessionResolution> {
  if (!token) return { status: 'missing' };
  const session = (await db.orm.public.Session.where({
    tokenHash: hashSessionToken(token),
  }).first()) as unknown as SessionRow | null;
  if (!session) return { status: 'missing' };
  if (session.revokedAt) return { status: 'revoked' };
  const now = Date.now();
  if (isExpired(session, now)) {
    await revokeSessionById(session.id).catch(() => undefined);
    return { status: 'expired' };
  }
  if (now - new Date(session.lastSeenAt).getTime() > SLIDE_THRESHOLD_MS) {
    await slideSession(session, now).catch(() => undefined);
  }
  return { status: 'valid', session };
}

async function slideSession(session: SessionRow, now: number): Promise<void> {
  const ttl = sessionTtlForRole(session.role);
  const absolute = new Date(session.absoluteExpiresAt).getTime();
  const idleExpiresAt = new Date(Math.min(now + ttl.idleMs, absolute)).toISOString();
  await db.orm.public.Session.where({ id: session.id }).update({
    lastSeenAt: new Date(now).toISOString(),
    idleExpiresAt,
  });
}

/** Force the idle window forward. Used by the client heartbeat / "continue". */
export async function touchSession(token: string | undefined | null): Promise<SessionRow | null> {
  const resolution = await resolveSession(token);
  if (resolution.status !== 'valid') return null;
  const now = Date.now();
  await slideSession(resolution.session, now).catch(() => undefined);
  return resolution.session;
}

export async function revokeSessionById(id: string): Promise<void> {
  await db.orm.public.Session.where({ id }).update({ revokedAt: new Date().toISOString() });
}

export async function revokeSessionByToken(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const session = (await db.orm.public.Session.where({
    tokenHash: hashSessionToken(token),
  }).first()) as unknown as SessionRow | null;
  if (session && !session.revokedAt) {
    await revokeSessionById(session.id);
  }
}

/**
 * Revoke every live session for a user — used on privilege changes, suspension,
 * password changes, and "sign out everywhere". `exceptId` spares the current
 * session when the user is simply rotating.
 */
export async function revokeUserSessions(userId: string, exceptId?: string): Promise<number> {
  const sessions = (await db.orm.public.Session.where({
    userId,
  }).all()) as unknown as SessionRow[];
  const live = sessions.filter((s) => !s.revokedAt && s.id !== exceptId);
  const now = new Date().toISOString();
  await Promise.all(
    live.map((s) => db.orm.public.Session.where({ id: s.id }).update({ revokedAt: now })),
  );
  return live.length;
}

export interface SessionInfo {
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  warningSeconds: number;
}

export function sessionInfo(session: SessionRow): SessionInfo {
  return {
    idleExpiresAt: session.idleExpiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    warningSeconds: env.SESSION_WARNING_SECONDS,
  };
}

export function sessionCookieMaxAge(role: Role): number {
  return Math.floor(sessionTtlForRole(role).absoluteMs / 1000);
}
