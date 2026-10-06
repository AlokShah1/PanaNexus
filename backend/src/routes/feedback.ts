import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { feedbackSchema } from '../validations/feedback';

const router = Router();

router.get('/', async (req, res) => {
  const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
  const rows = await db.orm.public.Feedback.all();
  const out = rows
    .filter((f) => (facilityId ? f.facilityId === facilityId : true))
    .slice(0, 100)
    .map((f) => ({ id: f.id, rating: f.rating, comment: f.comment, facilityId: f.facilityId, createdAt: f.createdAt }));
  return ok(res, out);
});

router.post('/', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  if (parsed.data.facilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!f) return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }
  const feedback = await db.orm.public.Feedback.create({ authorId: session.sub, facilityId: parsed.data.facilityId ?? null, rating: parsed.data.rating, comment: parsed.data.comment ?? null });
  await db.orm.public.AuditLog.create({ action: 'FEEDBACK_SUBMITTED', entity: 'Feedback', entityId: feedback.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { id: feedback.id }, 201);
});

export default router;
