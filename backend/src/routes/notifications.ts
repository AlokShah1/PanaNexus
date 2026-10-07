import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { notificationCreateSchema } from '../validations/feedback.js';
import { getUser, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const user = getUser(req);
  const unread = req.query.unread === 'true';
  const limit = Math.min(100, Math.max(1, parseInt(typeof req.query.limit === 'string' ? req.query.limit : '30') || 30));
  const rows = await db.orm.public.Notification.where({ userId: user.id })
    .orderBy((x) => x.createdAt.desc())
    .all();
  const out = (unread ? rows.filter((n) => !n.read) : rows).slice(0, limit);
  return ok(res, out);
});

router.get('/unread-count', requireAuth, async (req, res) => {
  const user = getUser(req);
  const rows = await db.orm.public.Notification.where({ userId: user.id, read: false }).all();
  return ok(res, { count: rows.length });
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = notificationCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  const n = await db.orm.public.Notification.create({
    userId: parsed.data.userId,
    type: parsed.data.type,
    title: parsed.data.title,
    body: parsed.data.body ?? null,
    link: parsed.data.link ?? null,
    read: false,
  });
  return ok(res, { id: n.id }, 201);
});

router.post('/:id/read', requireAuth, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const n = await db.orm.public.Notification.where({ id }).first();
  if (!n) {
    return fail(res, 'NOT_FOUND', 'Notification not found.', 404);
  }
  if (n.userId !== user.id) {
    return fail(res, 'FORBIDDEN', 'Cannot modify this notification.', 403);
  }
  await db.orm.public.Notification.where({ id }).update({ read: true });
  return ok(res, { id });
});

router.post('/read-all', requireAuth, async (req, res) => {
  const user = getUser(req);
  const unread = await db.orm.public.Notification.where({ userId: user.id, read: false }).all();
  await Promise.all(unread.map((n) => db.orm.public.Notification.where({ id: n.id }).update({ read: true })));
  return ok(res, { updated: unread.length });
});

export default router;
