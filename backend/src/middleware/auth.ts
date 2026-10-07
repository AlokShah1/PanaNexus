import type { NextFunction, Request, Response } from 'express';
import { db } from '../../prisma/db.js';
import { fail } from '../lib/api.js';
import { clearSessionCookie, getSession } from '../lib/auth.js';
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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    const session = getSession(req);
    if (!session) {
      fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
      return;
    }
    const user = await db.orm.public.User.where({ id: session.sub }).first();
    if (!user) {
      clearSessionCookie(res);
      fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
      return;
    }
    if (user.verificationStatus === 'SUSPENDED') {
      clearSessionCookie(res);
      fail(res, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support.', 403);
      return;
    }
    (req as AuthedRequest).user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      verificationStatus: user.verificationStatus,
      facilityId: user.facilityId,
      phone: user.phone,
    };
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
