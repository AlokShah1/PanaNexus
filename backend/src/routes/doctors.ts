import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';

import { getUser, optionalUser, requireAuth, requireRole, requireVerified, withOptionalAuth } from '../middleware/auth.js';
import { doctorProfileSchema } from '../validations/healthcare.js';

const router = Router();

router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : undefined;
  const specialization = typeof req.query.specialization === 'string' ? req.query.specialization : undefined;
  const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;

  const defaultLimit = 50;
  const maxLimit = 100;
  const pageNum = Math.max(1, parseInt(typeof req.query.page === 'string' ? req.query.page : '1') || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(typeof req.query.limit === 'string' ? req.query.limit : String(defaultLimit)) || defaultLimit));

  const rows = await db.orm.public.Doctor.include('user').include('facility').all();
  let filtered = rows.filter((d) => d.user?.verificationStatus === 'VERIFIED');
  if (q) {
    filtered = filtered.filter((d) => {
      const name = d.user?.name?.toLowerCase() ?? '';
      const spec = d.specialization?.toLowerCase() ?? '';
      return name.includes(q) || spec.includes(q);
    });
  }
  if (specialization) {
    filtered = filtered.filter((d) => d.specialization === specialization);
  }
  if (facilityId) {
    filtered = filtered.filter((d) => d.facilityId === facilityId);
  }

  const offset = (pageNum - 1) * limitNum;
  const sliced = filtered.slice(offset, offset + limitNum);
  const result = sliced.map((d) => ({
    id: d.id,
    name: d.user?.name ?? null,
    specialization: d.specialization,
    bio: d.bio,
    facility: d.facility ? { id: d.facility.id, name: d.facility.name, type: d.facility.type } : null,
  }));
  return ok(res, result);
});

router.get('/me', requireAuth, requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  const user = getUser(req);
  const doctor = await db.orm.public.Doctor.where({ userId: user.id }).include('user').include('facility').first();
  if (!doctor) {
    return fail(res, 'DOCTOR_NOT_FOUND', 'Create a doctor profile first.', 404);
  }
  const availability = await db.orm.public.DoctorAvailability.where({ doctorId: doctor.id }).all();
  availability.sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.endMinute - b.endMinute;
  });
  return ok(res, { ...doctor, availability });
});

router.get('/:id', withOptionalAuth, async (req, res) => {
  const { id } = req.params;
  const d = await db.orm.public.Doctor.where({ id }).include('user').include('facility').first();
  if (!d) return fail(res, 'NOT_FOUND', 'Doctor not found.', 404);
  const session = optionalUser(req);
  const isSelfOrAdmin = session && (session.id === d.userId || session.role === 'ADMIN');
  const result: any = {
    id: d.id,
    name: d.user?.name ?? null,
    specialization: d.specialization,
    bio: d.bio,
    facility: d.facility ? { id: d.facility.id, name: d.facility.name, type: d.facility.type } : null,
  };
  if (isSelfOrAdmin) {
    result.licenseNumber = d.licenseNumber;
  }
  return ok(res, result);
});

router.post('/profile', requireAuth, requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  const user = getUser(req);
  const parsed = doctorProfileSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const existing = await db.orm.public.Doctor.where({ userId: user.id }).first();
  if (existing) return fail(res, 'PROFILE_EXISTS', 'Doctor profile already exists.', 409);
  if (parsed.data.facilityId) {
    const facility = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!facility) return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }
  const licenseDup = await db.orm.public.Doctor.where({ licenseNumber: parsed.data.licenseNumber }).first();
  if (licenseDup) {
    return fail(res, 'LICENSE_TAKEN', 'A doctor is already registered with this license number.', 409);
  }
  const doctor = await db.orm.public.Doctor.create({ userId: user.id, ...parsed.data });
  await db.orm.public.AuditLog.create({ action: 'DOCTOR_PROFILE_CREATED', entity: 'Doctor', entityId: doctor.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { id: doctor.id }, 201);
});

router.patch('/me', requireAuth, requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  const user = getUser(req);
  const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
  if (!doctor) return fail(res, 'DOCTOR_NOT_FOUND', 'Create a doctor profile first.', 404);
  const parsed = doctorProfileSchema.partial().safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const data: any = parsed.data;
  if (data.facilityId) {
    const facility = await db.orm.public.HealthcareFacility.where({ id: data.facilityId }).first();
    if (!facility) return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }
  if (data.licenseNumber && data.licenseNumber !== doctor.licenseNumber) {
    const licenseDup = await db.orm.public.Doctor.where({ licenseNumber: data.licenseNumber }).first();
    if (licenseDup) {
      return fail(res, 'LICENSE_TAKEN', 'A doctor is already registered with this license number.', 409);
    }
  }
  await db.orm.public.Doctor.where({ id: doctor.id }).update(data);
  await db.orm.public.AuditLog.create({ action: 'DOCTOR_PROFILE_UPDATED', entity: 'Doctor', entityId: doctor.id, actorId: user.id }).catch(() => undefined);
  const updated = await db.orm.public.Doctor.where({ id: doctor.id }).first();
  return ok(res, updated);
});

export default router;
