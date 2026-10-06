import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { notificationCreateSchema } from '../validations/feedback';

const router = Router();

router.get('/', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const unread = req.query.unread === 'true';
  const rows = await db.orm.public.Notification.where({ userId: session.sub }).all();
  const out = (unread ? rows.filter((n) => !n.read) : rows).slice(0, 50);
  return ok(res, out);
});

router.post('/', async (req, res) => {
  const session = getSession(req);
  if (!session || session.role !== 'ADMIN') return fail(res, 'FORBIDDEN', 'Only admins can create notifications.', 403);
  const parsed = notificationCreateSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const n = await db.orm.public.Notification.create(parsed.data);
  return ok(res, { id: n.id }, 201);
});

router.post('/:id/read', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const { id } = req.params;
  const n = await db.orm.public.Notification.where({ id }).first();
  if (!n) return fail(res, 'NOT_FOUND', 'Notification not found.', 404);
  if (n.userId !== session.sub) return fail(res, 'FORBIDDEN', 'Cannot modify this notification.', 403);
  await db.orm.public.Notification.where({ id }).update({ read: true });
  return ok(res, { id });
});

export default router;
