import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { doctorProfileSchema } from '../validations/healthcare';

const router = Router();

router.get('/', async (_req, res) => {
  const rows = await db.orm.public.Doctor.include('user').include('facility').all();
  return ok(res, rows.map((d) => ({ id: d.id, specialization: d.specialization, licenseNumber: d.licenseNumber, facilityId: d.facilityId, name: d.user?.name ?? null, facility: d.facility ? { id: d.facility.id, name: d.facility.name, type: d.facility.type } : null })));
});

router.post('/profile', async (req, res) => {
  const session = getSession(req);
  if (!session || (session.role !== 'DOCTOR' && session.role !== 'ADMIN')) return fail(res, 'FORBIDDEN', 'Only doctors can create a doctor profile.', 403);
  const parsed = doctorProfileSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const existing = await db.orm.public.Doctor.where({ userId: session.sub }).first();
  if (existing) return fail(res, 'PROFILE_EXISTS', 'Doctor profile already exists.', 409);
  const doctor = await db.orm.public.Doctor.create({ userId: session.sub, ...parsed.data });
  await db.orm.public.AuditLog.create({ action: 'DOCTOR_PROFILE_CREATED', entity: 'Doctor', entityId: doctor.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { id: doctor.id }, 201);
});

export default router;
