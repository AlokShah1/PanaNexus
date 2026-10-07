import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { patientProfileSchema } from '../validations/healthcare.js';
import { getUser, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, async (req, res) => {
  const user = getUser(req);
  const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
  if (!patient) {
    return ok(res, null);
  }
  return ok(res, { id: patient.id, phone: patient.phone, bloodGroup: patient.bloodGroup, address: patient.address, dateOfBirth: patient.dateOfBirth });
});

router.post('/me', requireAuth, async (req, res) => {
  const user = getUser(req);
  const parsed = patientProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  const data = { ...parsed.data, dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth).toISOString() : undefined };
  const existing = await db.orm.public.Patient.where({ userId: user.id }).first();
  if (existing) {
    await db.orm.public.Patient.where({ userId: user.id }).update(data);
    await db.orm.public.AuditLog.create({ action: 'PATIENT_PROFILE_UPDATED', entity: 'Patient', entityId: existing.id, actorId: user.id }).catch(() => undefined);
    return ok(res, { id: existing.id });
  }
  const patient = await db.orm.public.Patient.create({ userId: user.id, ...data });
  await db.orm.public.AuditLog.create({ action: 'PATIENT_PROFILE_CREATED', entity: 'Patient', entityId: patient.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { id: patient.id }, 201);
});

export default router;
