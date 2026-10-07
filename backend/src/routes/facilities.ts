import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getUser, requireAuth, requireRole, requireVerified } from '../middleware/auth.js';
import { facilitySchema } from '../validations/healthcare.js';
import { isOpenNow } from '../lib/hours.js';
import { pageMeta, parsePage } from '../lib/pagination.js';

const router = Router();

function computeRating(feedbacks: Array<{ rating: number; status: string }> | undefined | null) {
  if (!feedbacks || feedbacks.length === 0) {
    return { avg: null, count: 0 };
  }
  const approved = feedbacks.filter((f) => f.status === 'APPROVED');
  if (approved.length === 0) {
    return { avg: null, count: 0 };
  }
  const sum = approved.reduce((s, f) => s + (f.rating || 0), 0);
  const avg = Math.round((sum / approved.length) * 10) / 10;
  return { avg, count: approved.length };
}

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
  }));
  return ok(res, result);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const f = await db.orm.public.HealthcareFacility.where({ id }).include('feedback').first();
  if (!f) return fail(res, 'NOT_FOUND', 'Facility not found.', 404);
  const staff = await db.orm.public.User.where({ facilityId: f.id }).all();
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

export default router;
