import type { NextFunction, Request, Response } from 'express';
import { db } from '../../prisma/db.js';
import { fail } from '../lib/api.js';
import { clearSessionCookie, readSessionToken } from '../lib/auth.js';
import { resolveSession } from '../lib/session.js';
import type { Role } from '../lib/auth-core.js';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  verificationStatus: VerificationStatus;
  facilityId: string | null;
  phone: string | null;
}

export interface AuthedRequest extends Request {
  user?: SessionUser;
}

export function getUser(req: Request): SessionUser {
  const user = (req as AuthedRequest).user;
  if (!user) throw new Error('getUser() called without requireAuth');
  return user;
}

export function optionalUser(req: Request): SessionUser | null {
  return (req as AuthedRequest).user ?? null;
}

type LoadResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: 'missing' | 'expired' | 'revoked' | 'suspended' };

async function loadSessionUser(req: Request): Promise<LoadResult> {
  const resolution = await resolveSession(readSessionToken(req));
  if (resolution.status !== 'valid') {
    return { ok: false, reason: resolution.status };
  }
  const user = await db.orm.public.User.where({ id: resolution.session.userId }).first();
  if (!user) return { ok: false, reason: 'missing' };
  if (user.verificationStatus === 'SUSPENDED') return { ok: false, reason: 'suspended' };
  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
      verificationStatus: user.verificationStatus as VerificationStatus,
      facilityId: user.facilityId,
      phone: user.phone,
    },
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    const result = await loadSessionUser(req);
    if (!result.ok) {
      if (result.reason === 'expired' || result.reason === 'revoked') {
        clearSessionCookie(res);
        fail(res, 'SESSION_EXPIRED', 'Your session has ended. Please sign in again.', 401);
        return;
      }
      if (result.reason === 'suspended') {
        clearSessionCookie(res);
        fail(res, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support.', 403);
        return;
      }
      fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
      return;
    }
    (req as AuthedRequest).user = result.user;
    next();
  })().catch(next);
}

/**
 * Attach the authenticated user when a valid session is present, but never
 * reject the request. Used by public routes that reveal more to signed-in users.
 */
export function withOptionalAuth(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const result = await loadSessionUser(req);
      if (result.ok) (req as AuthedRequest).user = result.user;
    } catch {
      /* treat unexpected failures as anonymous */
    }
    next();
  })().catch(next);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthedRequest).user;
    if (!user) {
      fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
      return;
    }
    if (!roles.includes(user.role)) {
      fail(res, 'FORBIDDEN', 'You do not have access to this resource.', 403);
      return;
    }
    next();
  };
}

export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  const user = (req as AuthedRequest).user;
  if (!user) {
    fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
    return;
  }
  if (user.verificationStatus !== 'VERIFIED') {
    fail(res, 'VERIFICATION_REQUIRED', 'Your account must be verified to use this feature.', 403);
    return;
  }
  next();
}
