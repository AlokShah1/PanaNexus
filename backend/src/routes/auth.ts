import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { asyncRoute, fail, ok } from '../lib/api.js';
import { clearSessionCookie, hashPassword, readSessionToken, setSessionCookie, verifyPassword } from '../lib/auth.js';
import {
  createSession,
  revokeSessionByToken,
  sessionInfo,
  touchSession,
  type SessionRow,
} from '../lib/session.js';
import { DEMO_EMAIL_DOMAIN } from '../lib/demoData.js';
import { notify } from '../lib/notify.js';
import { env } from '../config/env.js';
import { loginSchema, registerSchema } from '../validations/auth.js';

const router = Router();

const PRO_ROLES = new Set(['DOCTOR', 'FACILITY_STAFF', 'AMBULANCE_OPERATOR']);

function kindForRole(role: string): 'DOCTOR' | 'FACILITY' | 'AMBULANCE' | null {
  if (role === 'DOCTOR') return 'DOCTOR';
  if (role === 'FACILITY_STAFF') return 'FACILITY';
  if (role === 'AMBULANCE_OPERATOR') return 'AMBULANCE';
  return null;
}

function profile(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  verificationStatus: string;
  phone: string | null;
  facilityId: string | null;
  createdAt: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    verificationStatus: user.verificationStatus,
    phone: user.phone,
    facilityId: user.facilityId,
    createdAt: user.createdAt,
  };
}

async function startSession(
  req: Parameters<typeof readSessionToken>[0],
  res: Parameters<typeof setSessionCookie>[0],
  userId: string,
  role: SessionRow['role'],
  rotatedFrom?: string | null,
): Promise<SessionRow> {
  const { token, session } = await createSession(userId, role, {
    userAgent: req.headers['user-agent'] ?? null,
    ip: req.ip ?? null,
    rotatedFrom: rotatedFrom ?? null,
  });
  setSessionCookie(res, token, session.absoluteExpiresAt);
  return session;
}

router.post('/register', asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const data = parsed.data;
  if (data.email === env.ADMIN_EMAIL.trim().toLowerCase()) {
    return fail(res, 'EMAIL_RESERVED', 'This email cannot be used to register.', 403);
  }
  if (data.email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
    return fail(res, 'EMAIL_RESERVED', 'This email domain is reserved for demo data.', 403);
  }
  const existing = await db.orm.public.User.where({ email: data.email }).first();
  if (existing) return fail(res, 'EMAIL_TAKEN', 'An account with this email already exists.', 409);
  if (data.role === 'DOCTOR' && data.licenseNumber) {
    const dup = await db.orm.public.Doctor.where({ licenseNumber: data.licenseNumber }).first();
    if (dup) return fail(res, 'LICENSE_TAKEN', 'A doctor is already registered with this license number.', 409);
  }
  const passwordHash = await hashPassword(data.password);
  const verificationStatus = PRO_ROLES.has(data.role) ? 'PENDING' : 'VERIFIED';
  let user;
  try {
    user = await db.orm.public.User.create({
      name: data.name,
      email: data.email,
      role: data.role,
      passwordHash,
      phone: data.phone ?? null,
      verificationStatus,
    });
  } catch {
    return fail(res, 'EMAIL_TAKEN', 'An account with this email already exists.', 409);
  }
  if (data.role === 'DOCTOR') {
    await db.orm.public.Doctor.create({
      userId: user.id,
      specialization: data.specialization ?? null,
      licenseNumber: data.licenseNumber ?? null,
      bio: data.bio ?? null,
    });
  }
  const kind = kindForRole(data.role);
  if (kind) {
    const payload =
      kind === 'DOCTOR'
        ? { specialization: data.specialization ?? null, licenseNumber: data.licenseNumber ?? null, bio: data.bio ?? null }
        : kind === 'FACILITY'
          ? {
              facilityName: data.facilityName,
              facilityAddress: data.facilityAddress,
              facilityPhone: data.facilityPhone ?? null,
              facilityType: data.facilityType ?? 'HOSPITAL',
              operatingHours: data.operatingHours ?? null,
            }
          : {
              phone: data.phone ?? null,
              driverName: data.driverName ?? null,
              driverPhone: data.driverPhone ?? null,
            };
    await db.orm.public.VerificationRequest.create({
      userId: user.id,
      kind,
      payload: JSON.stringify(payload),
      documentUrls: [],
      status: 'PENDING',
    });
  }
  await db.orm.public.AuditLog.create({
    action: 'USER_REGISTERED',
    entity: 'User',
    entityId: user.id,
    actorId: user.id,
    metadata: JSON.stringify({ role: user.role }),
  }).catch(() => undefined);
  const session = await startSession(req, res, user.id, user.role as SessionRow['role']);
  await notify(user.id, {
    type: 'SYSTEM',
    title: 'Welcome to PanaNexus',
    body: PRO_ROLES.has(user.role)
      ? 'Your account is pending verification. Upload your credentials so an admin can review them.'
      : 'Your account is ready. Explore hospitals, appointments, blood banks and more.',
    link: PRO_ROLES.has(user.role) ? '/verification' : '/dashboard',
  });
  return ok(res, { profile: profile(user), session: sessionInfo(session) }, 201);
}));

router.post('/login', asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const { email, password } = parsed.data;
  const user = await db.orm.public.User.where({ email }).first();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }
  if (user.verificationStatus === 'SUSPENDED') {
    return fail(res, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support.', 403);
  }
  // Session fixation defence: discard any pre-authentication session token.
  const prior = readSessionToken(req);
  if (prior) await revokeSessionByToken(prior).catch(() => undefined);
  await db.orm.public.AuditLog.create({ action: 'USER_LOGIN', entity: 'User', entityId: user.id, actorId: user.id }).catch(() => undefined);
  const session = await startSession(req, res, user.id, user.role);
  return ok(res, { profile: profile(user), session: sessionInfo(session) });
}));

router.post('/logout', asyncRoute(async (req, res) => {
  const token = readSessionToken(req);
  await revokeSessionByToken(token).catch(() => undefined);
  clearSessionCookie(res);
  return ok(res, { loggedOut: true });
}));

router.get('/me', asyncRoute(async (req, res) => {
  const token = readSessionToken(req);
  const session = await touchSession(token);
  if (!session) {
    clearSessionCookie(res);
    return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  }
  const user = await db.orm.public.User.where({ id: session.userId }).first();
  if (!user) {
    clearSessionCookie(res);
    return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  }
  if (user.verificationStatus === 'SUSPENDED') {
    clearSessionCookie(res);
    return fail(res, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support.', 403);
  }
  return ok(res, { profile: profile(user), session: sessionInfo(session) });
}));

/**
 * Touch the active session so the idle timer resets while the user works.
 * Also returns the refreshed expiry so the client can re-arm its warning.
 */
router.post('/heartbeat', asyncRoute(async (req, res) => {
  const session = await touchSession(readSessionToken(req));
  if (!session) {
    clearSessionCookie(res);
    return fail(res, 'SESSION_EXPIRED', 'Your session has ended. Please sign in again.', 401);
  }
  return ok(res, { session: sessionInfo(session) });
}));

export default router;
