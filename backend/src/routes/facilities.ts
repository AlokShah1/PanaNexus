import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getUser, requireAuth, requireRole, requireVerified } from '../middleware/auth.js';
import { facilitySchema, bedCapacitySchema } from '../validations/healthcare.js';
import { isOpenNow } from '../lib/hours.js';
import { pageMeta, parsePage } from '../lib/pagination.js';
import { computeRating, summarizeBeds, viewBed, type BedRow } from '../lib/facility-view.js';

const router = Router();

router.get('/', async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : undefined;
  const open = typeof req.query.open === 'string' ? req.query.open : undefined;
  const emergency = typeof req.query.emergency === 'string' ? req.query.emergency : undefined;

  const p = parsePage(req.query as Record<string, unknown>, 100, 200);

  const rows = await db.orm.public.HealthcareFacility.include('feedback').all();

  let filtered = rows;
  if (type) {
    filtered = filtered.filter((f) => f.type === type);
  }
  if (q) {
    filtered = filtered.filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.address && f.address.toLowerCase().includes(q)),
    );
  }
  if (emergency === 'true') {
    filtered = filtered.filter((f) => f.emergencyAvailable === true);
  }
  if (open === 'true') {
    filtered = filtered.filter((f) => {
      const openNow = isOpenNow(f.operatingHours ?? null);
      return openNow === true;
    });
  }

  const allBeds = await db.orm.public.BedCapacity.all();
  const bedsByFacility = new Map<string, BedRow[]>();
  for (const b of allBeds) {
    const list = bedsByFacility.get(b.facilityId) ?? [];
    list.push(b as BedRow);
    bedsByFacility.set(b.facilityId, list);
  }

  const sliced = filtered.slice(p.offset, p.offset + p.limit);
  const result = sliced.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    address: f.address,
    phone: f.phone,
    operatingHours: f.operatingHours,
    emergencyAvailable: f.emergencyAvailable,
    services: f.services,
    latitude: f.latitude,
    longitude: f.longitude,
    rating: computeRating(f.feedback),
    beds: summarizeBeds(bedsByFacility.get(f.id) ?? []),
  }));
  return ok(res, result);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const f = await db.orm.public.HealthcareFacility.where({ id }).include('feedback').first();
  if (!f) return fail(res, 'NOT_FOUND', 'Facility not found.', 404);
  const staff = await db.orm.public.User.where({ facilityId: f.id }).all();
  const bedRows = (await db.orm.public.BedCapacity.where({ facilityId: f.id }).all()) as BedRow[];
  return ok(res, {
    id: f.id,
    name: f.name,
    type: f.type,
    address: f.address,
    phone: f.phone,
    operatingHours: f.operatingHours,
    emergencyAvailable: f.emergencyAvailable,
    services: f.services,
    latitude: f.latitude,
    longitude: f.longitude,
    rating: computeRating(f.feedback),
    staff: staff.length,
    beds: summarizeBeds(bedRows),
    wards: bedRows
      .map(viewBed)
      .sort((a, b) => a.ward.localeCompare(b.ward)),
  });
});

router.post('/', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = facilitySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  if (user.role === 'FACILITY_STAFF') {
    if (user.facilityId) {
      return fail(res, 'ALREADY_LINKED', 'You are already linked to a facility.', 409);
    }
  }
  const facility = await db.orm.public.HealthcareFacility.create(parsed.data);
  if (user.role === 'FACILITY_STAFF') {
    await db.orm.public.User.where({ id: user.id }).update({ facilityId: facility.id }).catch(() => undefined);
  }
  await db.orm.public.AuditLog.create({
    action: 'FACILITY_CREATED',
    entity: 'HealthcareFacility',
    entityId: facility.id,
    actorId: user.id,
  }).catch(() => undefined);
  return ok(res, { id: facility.id }, 201);
});

router.patch('/:id', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const facility = await db.orm.public.HealthcareFacility.where({ id }).first();
  if (!facility) return fail(res, 'NOT_FOUND', 'Facility not found.', 404);
  if (user.role === 'FACILITY_STAFF') {
    if (user.facilityId !== facility.id) {
      return fail(res, 'FORBIDDEN', 'You cannot modify this facility.', 403);
    }
  }
  const parsed = facilitySchema.partial().safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  await db.orm.public.HealthcareFacility.where({ id }).update(parsed.data as any);
  await db.orm.public.AuditLog.create({
    action: 'FACILITY_UPDATED',
    entity: 'HealthcareFacility',
    entityId: id,
    actorId: user.id,
  }).catch(() => undefined);
  const updated = await db.orm.public.HealthcareFacility.where({ id }).first();
  return ok(res, updated);
});

/* ---------------------------------------------------------- bed capacity */

router.get('/:id/beds', async (req, res) => {
  const { id } = req.params;
  const facility = await db.orm.public.HealthcareFacility.where({ id }).first();
  if (!facility) return fail(res, 'NOT_FOUND', 'Facility not found.', 404);
  const rows = (await db.orm.public.BedCapacity.where({ facilityId: id }).all()) as BedRow[];
  const wards = rows.map(viewBed).sort((a, b) => a.ward.localeCompare(b.ward));
  return ok(res, { facilityId: id, summary: summarizeBeds(rows), wards });
});

router.put('/:id/beds', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const facility = await db.orm.public.HealthcareFacility.where({ id }).first();
  if (!facility) return fail(res, 'NOT_FOUND', 'Facility not found.', 404);
  if (user.role === 'FACILITY_STAFF' && user.facilityId !== facility.id) {
    return fail(res, 'FORBIDDEN', 'You cannot update beds for this facility.', 403);
  }
  const parsed = bedCapacitySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const { ward, label, totalBeds, occupiedBeds } = parsed.data;

  const existing = await db.orm.public.BedCapacity.where({ facilityId: id, ward: ward as never }).first();
  if (existing) {
    await db.orm.public.BedCapacity.where({ id: existing.id }).update({
      label: label ?? null,
      totalBeds,
      occupiedBeds,
      updatedById: user.id,
    });
  } else {
    await db.orm.public.BedCapacity.create({
      facilityId: id,
      ward: ward as never,
      label: label ?? null,
      totalBeds,
      occupiedBeds,
      updatedById: user.id,
    });
  }
  await db.orm.public.AuditLog.create({
    action: 'BED_CAPACITY_UPDATED',
    entity: 'BedCapacity',
    entityId: id,
    actorId: user.id,
    metadata: JSON.stringify({ ward, totalBeds, occupiedBeds }),
  }).catch(() => undefined);
  const fresh = (await db.orm.public.BedCapacity.where({ facilityId: id, ward: ward as never }).first()) as BedRow;
  return ok(res, viewBed(fresh));
});

router.delete('/:id/beds/:ward', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const ward = String(req.params.ward).toUpperCase();
  const facility = await db.orm.public.HealthcareFacility.where({ id }).first();
  if (!facility) return fail(res, 'NOT_FOUND', 'Facility not found.', 404);
  if (user.role === 'FACILITY_STAFF' && user.facilityId !== facility.id) {
    return fail(res, 'FORBIDDEN', 'You cannot update beds for this facility.', 403);
  }
  const existing = await db.orm.public.BedCapacity.where({ facilityId: id, ward: ward as never }).first();
  if (!existing) return fail(res, 'NOT_FOUND', 'Ward not found.', 404);
  await db.orm.public.BedCapacity.where({ id: existing.id }).delete();
  await db.orm.public.AuditLog.create({
    action: 'BED_CAPACITY_REMOVED',
    entity: 'BedCapacity',
    entityId: id,
    actorId: user.id,
    metadata: JSON.stringify({ ward }),
  }).catch(() => undefined);
  return ok(res, { deleted: true, ward });
});

export default router;
