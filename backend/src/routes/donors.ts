import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { bloodDonorProfileSchema, organDonorProfileSchema } from '../validations/donors';

const router = Router();

router.get('/blood', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const donor = await db.orm.public.BloodDonor.where({ userId: session.sub }).first();
  if (!donor) return ok(res, null);
  return ok(res, { id: donor.id, bloodGroup: donor.bloodGroup, isAvailable: donor.isAvailable, lastDonationDate: donor.lastDonationDate });
});

router.post('/blood', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const parsed = bloodDonorProfileSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const existing = await db.orm.public.BloodDonor.where({ userId: session.sub }).first();
  if (existing) {
    await db.orm.public.BloodDonor.where({ userId: session.sub }).update(parsed.data);
    await db.orm.public.AuditLog.create({ action: 'BLOOD_DONOR_UPDATED', entity: 'BloodDonor', entityId: existing.id, actorId: session.sub }).catch(() => undefined);
    return ok(res, { id: existing.id });
  }
  const donor = await db.orm.public.BloodDonor.create({ userId: session.sub, ...parsed.data });
  await db.orm.public.AuditLog.create({ action: 'BLOOD_DONOR_REGISTERED', entity: 'BloodDonor', entityId: donor.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { id: donor.id }, 201);
});

router.post('/organ', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const parsed = organDonorProfileSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const existing = await db.orm.public.OrganDonor.where({ userId: session.sub }).first();
  if (existing) {
    await db.orm.public.OrganDonor.where({ userId: session.sub }).update(parsed.data);
    await db.orm.public.AuditLog.create({ action: 'ORGAN_DONOR_UPDATED', entity: 'OrganDonor', entityId: existing.id, actorId: session.sub }).catch(() => undefined);
    return ok(res, { id: existing.id });
  }
  const donor = await db.orm.public.OrganDonor.create({ userId: session.sub, ...parsed.data });
  await db.orm.public.AuditLog.create({ action: 'ORGAN_DONOR_REGISTERED', entity: 'OrganDonor', entityId: donor.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { id: donor.id }, 201);
});

export default router;
