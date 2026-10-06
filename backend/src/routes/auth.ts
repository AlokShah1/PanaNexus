import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { setSessionCookie, clearSessionCookie, getSession, hashPassword, verifyPassword } from '../lib/auth';
import { registerSchema, loginSchema } from '../validations/auth';

const router = Router();

router.post('/register', async (req, res) => {
  let body: unknown;
  try { body = req.body ?? (await new Promise((r) => { let d=''; req.on('data',(c)=>d+=c); req.on('end',()=>r(d?JSON.parse(d):{})); })); } catch { return fail(res, 'INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const { name, email, password, role } = parsed.data;
  const existing = await db.orm.public.User.where({ email }).first();
  if (existing) return fail(res, 'EMAIL_TAKEN', 'An account with this email already exists.', 409);
  const passwordHash = await hashPassword(password);
  const user = await db.orm.public.User.create({ name, email, role, passwordHash });
  await db.orm.public.AuditLog.create({ action: 'USER_REGISTERED', entity: 'User', entityId: user.id, actorId: user.id }).catch(() => undefined);
  setSessionCookie(res, user.id, user.role);
  return ok(res, { id: user.id, email: user.email, name: user.name, role: user.role }, 201);
});

router.post('/login', async (req, res) => {
  let body: unknown;
  try { body = req.body ?? (await new Promise((r) => { let d=''; req.on('data',(c)=>d+=c); req.on('end',()=>r(d?JSON.parse(d):{})); })); } catch { return fail(res, 'INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const { email, password } = parsed.data;
  const user = await db.orm.public.User.where({ email }).first();
  if (!user || !(await verifyPassword(password, user.passwordHash))) return fail(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  await db.orm.public.AuditLog.create({ action: 'USER_LOGIN', entity: 'User', entityId: user.id, actorId: user.id }).catch(() => undefined);
  setSessionCookie(res, user.id, user.role);
  return ok(res, { id: user.id, email: user.email, name: user.name, role: user.role });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  return ok(res, { loggedOut: true });
});

export default router;

router.get('/me', (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  return ok(res, { id: session.sub, role: session.role });
});
