import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getUser, requireAuth } from '../middleware/auth.js';
import { feedbackSchema } from '../validations/feedback.js';
import { pageMeta, parsePage } from '../lib/pagination.js';

const router = Router();

router.get('/', async (req, res) => {
  const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
  const limit = Math.min(200, Math.max(1, parseInt(typeof req.query.limit === 'string' ? req.query.limit : '100') || 100));
  const rows = await db.orm.public.Feedback.all();
  let filtered = rows.filter((f) => f.status === 'APPROVED');
  filtered = filtered.filter((f) => (facilityId ? f.facilityId === facilityId : true));
  filtered = filtered.slice(0, limit);
  const out = await Promise.all(
    filtered.map(async (f) => {
      const author = await db.orm.public.User.where({ id: f.authorId }).first();
      return {
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        facilityId: f.facilityId,
        createdAt: f.createdAt,
        author: author ? { id: author.id, name: author.name } : null,
      };
    }),
  );
  return ok(res, out);
});

router.post('/', requireAuth, async (req, res) => {
  const user = getUser(req);
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  if (parsed.data.facilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!f) {
      return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
    }
  }
  const facilityId = parsed.data.facilityId ?? null;
  const existing = await db.orm.public.Feedback.all();
  const duplicate = existing.find((x) => x.authorId === user.id && ((x.facilityId ?? null) === facilityId));
  if (duplicate) {
    return fail(res, 'DUPLICATE_FEEDBACK', 'You have already submitted feedback for this place.', 409);
  }
  const feedback = await db.orm.public.Feedback.create({
    authorId: user.id,
    facilityId,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
    status: 'PENDING',
  });
  await db.orm.public.AuditLog.create({ action: 'FEEDBACK_SUBMITTED', entity: 'Feedback', entityId: feedback.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { id: feedback.id, status: 'PENDING', message: 'Thanks — your feedback will appear after review.' }, 201);
});

router.get('/mine', requireAuth, async (req, res) => {
  const user = getUser(req);
  const p = parsePage(req.query as Record<string, unknown>, 20, 100);
  const rows = await db.orm.public.Feedback.where({ authorId: user.id })
    .orderBy((x) => x.createdAt.desc())
    .offset(p.offset)
    .limit(p.limit)
    .all();
  const total = await db.orm.public.Feedback.where({ authorId: user.id }).aggregate((a) => ({ total: a.count() }));
  const items = await Promise.all(
    rows.map(async (f) => {
      const facility = f.facilityId ? await db.orm.public.HealthcareFacility.where({ id: f.facilityId }).first() : null;
      return {
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        facilityId: f.facilityId,
        facility: facility ? { name: facility.name } : null,
        status: f.status,
        createdAt: f.createdAt,
      };
    }),
  );
  return ok(res, { items, meta: pageMeta(p, total.total) });
});

export default router;
