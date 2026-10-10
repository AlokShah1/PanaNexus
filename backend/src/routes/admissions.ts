import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getUser, requireAuth, requireRole, requireVerified } from '../middleware/auth.js';
import { admissionCreateSchema, admissionTransferSchema } from '../validations/admission.js';

const router = Router();

function canManageFacility(user: any, facilityId: string): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'FACILITY_STAFF' && user.facilityId === facilityId) return true;
  if (user.role === 'DOCTOR' && user.facilityId === facilityId) return true;
  return false;
}

/* ---------------------------------------------------------- list */
router.get('/', requireAuth, requireRole('ADMIN', 'FACILITY_STAFF', 'DOCTOR'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;

  const where: any = {};
  if (facilityId) where.facilityId = facilityId;
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;

  if (user.role === 'FACILITY_STAFF' && user.facilityId) {
    where.facilityId = user.facilityId;
  } else if (user.role === 'DOCTOR' && user.facilityId) {
    where.facilityId = user.facilityId;
  } else if (user.role !== 'ADMIN') {
    return fail(res, 'FORBIDDEN', 'Access denied.', 403);
  }

  const rows = await db.orm.public.Admission.where(where).all();
  return ok(res, { items: rows.map((a) => ({
    id: a.id,
    patientId: a.patientId,
    facilityId: a.facilityId,
    ward: a.ward,
    status: a.status,
    staffId: a.staffId,
    admittedAt: a.admittedAt,
    dischargedAt: a.dischargedAt,
    notes: a.notes,
  })) });
});

/* ---------------------------------------------------------- admit */
router.post('/', requireAuth, requireRole('ADMIN', 'FACILITY_STAFF', 'DOCTOR'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = admissionCreateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const data = parsed.data;

  const patient = await db.orm.public.Patient.where({ id: data.patientId }).first();
  if (!patient) return fail(res, 'NOT_FOUND', 'Patient not found.', 404);

  const facility = await db.orm.public.HealthcareFacility.where({ id: data.facilityId }).first();
  if (!facility) return fail(res, 'NOT_FOUND', 'Facility not found.', 404);

  if (!canManageFacility(user, data.facilityId)) {
    return fail(res, 'FORBIDDEN', 'You cannot admit to this facility.', 403);
  }

  const bed = await db.orm.public.BedCapacity.where({ facilityId: data.facilityId, ward: data.ward as any }).first();
  if (!bed) return fail(res, 'NOT_FOUND', 'Bed category not configured for this facility.', 404);
  if (bed.totalBeds <= 0) return fail(res, 'CAPACITY_INVALID', 'No beds configured.', 400);

  const activeCountRaw = await db.orm.public.Admission.where({
    facilityId: data.facilityId,
    ward: data.ward as any,
    status: 'ADMITTED',
  }).count();
  const activeCount = typeof activeCountRaw === 'number' ? activeCountRaw : 0;
  if (activeCount >= bed.totalBeds) return fail(res, 'CAPACITY_EXHAUSTED', 'No available beds in this category.', 409);

  const existing = await db.orm.public.Admission.where({
    patientId: data.patientId,
    facilityId: data.facilityId,
    ward: data.ward as any,
    status: 'ADMITTED',
  }).first();
  if (existing) return fail(res, 'DUPLICATE_ADMISSION', 'This patient already has an active admission here.', 409);

  const admission = await db.orm.public.Admission.create({
    patientId: data.patientId,
    facilityId: data.facilityId,
    ward: data.ward as any,
    status: 'ADMITTED',
    staffId: user.id,
    notes: data.notes ?? null,
  });

  await db.orm.public.AuditLog.create({
    action: 'ADMISSION_CREATED',
    entity: 'Admission',
    entityId: admission.id,
    actorId: user.id,
    metadata: JSON.stringify({ facilityId: data.facilityId, ward: data.ward }),
  }).catch(() => undefined);

  return ok(res, { admission: { id: admission.id, status: admission.status, admittedAt: admission.admittedAt, ward: admission.ward } }, 201);
});

/* ---------------------------------------------------------- discharge */
router.post('/:id/discharge', requireAuth, requireRole('ADMIN', 'FACILITY_STAFF', 'DOCTOR'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const admission = await db.orm.public.Admission.where({ id: req.params.id }).first();
  if (!admission) return fail(res, 'NOT_FOUND', 'Admission not found.', 404);

  if (!canManageFacility(user, admission.facilityId)) {
    return fail(res, 'FORBIDDEN', 'You do not have access to this admission.', 403);
  }
  if (admission.status === 'DISCHARGED') return fail(res, 'ALREADY_DISCHARGED', 'This admission is already discharged.', 409);
  if (admission.status === 'TRANSFERRED') return fail(res, 'ALREADY_TRANSFERRED', 'This admission was transferred.', 409);

  const updated = await db.orm.public.Admission.where({ id: admission.id }).update({
    status: 'DISCHARGED',
    dischargedAt: new Date().toISOString(),
  });
  await db.orm.public.AuditLog.create({
    action: 'ADMISSION_DISCHARGED',
    entity: 'Admission',
    entityId: admission.id,
    actorId: user.id,
  }).catch(() => undefined);
  return ok(res, { id: admission.id, status: 'DISCHARGED' });
});

/* ---------------------------------------------------------- transfer */
router.post('/:id/transfer', requireAuth, requireRole('ADMIN', 'FACILITY_STAFF', 'DOCTOR'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const admission = await db.orm.public.Admission.where({ id: req.params.id }).first();
  if (!admission) return fail(res, 'NOT_FOUND', 'Admission not found.', 404);
  if (admission.status !== 'ADMITTED') return fail(res, 'INVALID_STATE', 'Only active admissions can be transferred.', 409);

  const parsed = admissionTransferSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const data = parsed.data;
  const targetFacility = data.facilityId ?? admission.facilityId;
  const targetWard = data.ward ?? admission.ward;

  if (!canManageFacility(user, admission.facilityId)) {
    return fail(res, 'FORBIDDEN', 'No access to original admission.', 403);
  }
  if (targetFacility !== admission.facilityId || targetWard !== admission.ward) {
    if (!canManageFacility(user, targetFacility)) return fail(res, 'FORBIDDEN', 'No access to target facility.', 403);
    const bed = await db.orm.public.BedCapacity.where({ facilityId: targetFacility, ward: targetWard as any }).first();
    if (!bed) return fail(res, 'NOT_FOUND', 'Target bed category not found.', 404);
    const countRaw = await db.orm.public.Admission.where({ facilityId: targetFacility, ward: targetWard as any, status: 'ADMITTED' }).count();
    const count = typeof countRaw === 'number' ? countRaw : 0;
    if (count >= bed.totalBeds) return fail(res, 'CAPACITY_EXHAUSTED', 'Target category has no capacity.', 409);
    const duplicate = await db.orm.public.Admission.where({ patientId: admission.patientId, facilityId: targetFacility, ward: targetWard as any, status: 'ADMITTED' }).first();
    if (duplicate && duplicate.id !== admission.id) return fail(res, 'DUPLICATE_ADMISSION', 'Active admission already exists at target.', 409);
  }

  await db.transaction(async (tx) => {
    await tx.orm.public.Admission.where({ id: admission.id }).update({ status: 'TRANSFERRED', dischargedAt: new Date().toISOString(), notes: data.notes ? (admission.notes ? admission.notes + ' | ' + data.notes : data.notes) : admission.notes });
    await tx.orm.public.Admission.create({
      patientId: admission.patientId,
      facilityId: targetFacility,
      ward: targetWard as any,
      status: 'ADMITTED',
      staffId: user.id,
      notes: data.notes ?? null,
    });
  });

  await db.orm.public.AuditLog.create({
    action: 'ADMISSION_TRANSFERRED',
    entity: 'Admission',
    entityId: admission.id,
    actorId: user.id,
    metadata: JSON.stringify({ targetFacility, targetWard }),
  }).catch(() => undefined);

  return ok(res, { id: admission.id, status: 'TRANSFERRED', targetFacility, targetWard });
});

export default router;
