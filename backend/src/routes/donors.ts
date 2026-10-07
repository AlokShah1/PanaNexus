import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { bloodDonorProfileSchema, organDonorProfileSchema } from '../validations/donors.js';
import { getUser, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/blood', requireAuth, async (req, res) => {
  const user = getUser(req);
  const donor = await db.orm.public.BloodDonor.where({ userId: user.id }).first();
  if (!donor) {
    return ok(res, null);
  }
  return ok(res, { id: donor.id, bloodGroup: donor.bloodGroup, isAvailable: donor.isAvailable, lastDonationDate: donor.lastDonationDate });
});

router.post('/blood', requireAuth, async (req, res) => {
  const user = getUser(req);
  const parsed = bloodDonorProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  const existing = await db.orm.public.BloodDonor.where({ userId: user.id }).first();
  if (existing) {
    await db.orm.public.BloodDonor.where({ userId: user.id }).update(parsed.data);
    await db.orm.public.AuditLog.create({ action: 'BLOOD_DONOR_UPDATED', entity: 'BloodDonor', entityId: existing.id, actorId: user.id }).catch(() => undefined);
    return ok(res, { id: existing.id });
  }
  const donor = await db.orm.public.BloodDonor.create({ userId: user.id, ...parsed.data });
  await db.orm.public.AuditLog.create({ action: 'BLOOD_DONOR_REGISTERED', entity: 'BloodDonor', entityId: donor.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { id: donor.id }, 201);
});

router.post('/organ', requireAuth, async (req, res) => {
  const user = getUser(req);
  const parsed = organDonorProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  const existing = await db.orm.public.OrganDonor.where({ userId: user.id }).first();
  if (existing) {
    await db.orm.public.OrganDonor.where({ userId: user.id }).update(parsed.data);
    await db.orm.public.AuditLog.create({ action: 'ORGAN_DONOR_UPDATED', entity: 'OrganDonor', entityId: existing.id, actorId: user.id }).catch(() => undefined);
    return ok(res, { id: existing.id });
  }
  const donor = await db.orm.public.OrganDonor.create({ userId: user.id, ...parsed.data });
  await db.orm.public.AuditLog.create({ action: 'ORGAN_DONOR_REGISTERED', entity: 'OrganDonor', entityId: donor.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { id: donor.id }, 201);
});

router.post('/blood/availability', requireAuth, async (req, res) => {
  const user = getUser(req);
  const body = req.body as any;
  if (body === undefined || body.isAvailable === undefined) {
    return fail(res, 'VALIDATION_ERROR', 'isAvailable is required.', 422);
  }
  if (typeof body.isAvailable !== 'boolean') {
    return fail(res, 'VALIDATION_ERROR', 'isAvailable must be boolean.', 422);
  }
  const donor = await db.orm.public.BloodDonor.where({ userId: user.id }).first();
  if (!donor) {
    return fail(res, 'DONOR_NOT_FOUND', 'Complete your donor profile first.', 404);
  }
  await db.orm.public.BloodDonor.where({ userId: user.id }).update({ isAvailable: body.isAvailable });
  await db.orm.public.AuditLog.create({ action: 'BLOOD_DONOR_AVAILABILITY_UPDATED', entity: 'BloodDonor', entityId: donor.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { id: donor.id, isAvailable: body.isAvailable });
});

export default router;
