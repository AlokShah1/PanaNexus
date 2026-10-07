import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { compatibleDonorGroups, matchScore } from '../lib/blood.js';
import { bloodRequestSchema, bloodUnitSchema } from '../validations/donors.js';
import { getUser, requireAuth, requireRole, requireVerified } from '../middleware/auth.js';
import { pageMeta, parsePage } from '../lib/pagination.js';
import { notify } from '../lib/notify.js';

const router = Router();

router.get('/availability', requireAuth, async (req, res) => {
  const bloodGroup = typeof req.query.bloodGroup === 'string' ? req.query.bloodGroup : undefined;
  const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
  const city = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : undefined;
  const limit = Math.min(200, Math.max(1, parseInt(typeof req.query.limit === 'string' ? req.query.limit : '100') || 100));
  const rows = await db.orm.public.BloodUnit.include('facility').all();
  const out = rows
    .filter((r) => r.units > 0)
    .filter((r) => (bloodGroup ? r.bloodGroup === bloodGroup : true))
    .filter((r) => (facilityId ? r.facilityId === facilityId : true))
    .filter((r) => (city ? (r.facility?.address ?? '').toLowerCase().includes(city) : true))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      bloodGroup: r.bloodGroup,
      units: r.units,
      facility: r.facility ? { id: r.facility.id, name: r.facility.name, address: r.facility.address } : null,
    }));
  return ok(res, out);
});

router.get('/requests', requireAuth, async (req, res) => {
  const user = getUser(req);
  if (user.role === 'ADMIN') {
    const p = parsePage(req.query as Record<string, unknown>, 20, 100);
    const rows = await db.orm.public.BloodRequest.orderBy((x) => x.createdAt.desc())
      .offset(p.offset)
      .limit(p.limit)
      .all();
    const total = await db.orm.public.BloodRequest.aggregate((a) => ({ total: a.count() }));
    return ok(res, { items: rows, meta: pageMeta(p, total.total) });
  }
  if (user.role !== 'FACILITY_STAFF') {
    return fail(res, 'FORBIDDEN', 'Only facility staff can view requests.', 403);
  }
  const p = parsePage(req.query as Record<string, unknown>, 20, 100);
  const byFacility = user.facilityId ? await db.orm.public.BloodRequest.where({ facilityId: user.facilityId }).all() : [];
  const own = await db.orm.public.BloodRequest.where({ requesterId: user.id }).all();
  const collected = new Map<string, (typeof byFacility)[number]>();
  for (const r of [...byFacility, ...own]) collected.set(r.id, r);
  const merged = [...collected.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = merged.slice(p.offset, p.offset + p.limit);
  return ok(res, { items: rows, meta: pageMeta(p, merged.length) });
});

router.post('/requests', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = bloodRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  let facilityId = parsed.data.facilityId ?? null;
  if (user.role === 'FACILITY_STAFF' && !facilityId) {
    facilityId = user.facilityId;
  }
  if (facilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: facilityId }).first();
    if (!f) {
      return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
    }
  }
  const reqRow = await db.orm.public.BloodRequest.create({
    requesterId: user.id,
    facilityId,
    bloodGroup: parsed.data.bloodGroup,
    units: parsed.data.units,
    status: 'PENDING',
  });
  const compatible = compatibleDonorGroups(parsed.data.bloodGroup);
  const units = (await db.orm.public.BloodUnit.include('facility').all())
    .filter((u) => u.units > 0 && compatible.includes(u.bloodGroup))
    .map((u) => ({ ...u, score: matchScore(u.bloodGroup, parsed.data.bloodGroup) }))
    .sort((a, b) => b.score - a.score || b.units - a.units)
    .slice(0, 10)
    .map((u) => ({ id: u.id, bloodGroup: u.bloodGroup, units: u.units, facility: u.facility ? { id: u.facility.id, name: u.facility.name } : null, score: u.score }));
  const donors = (await db.orm.public.BloodDonor.where({ isAvailable: true }).all())
    .filter((d) => compatible.includes(d.bloodGroup))
    .map((d) => ({ id: d.id, userId: d.userId, bloodGroup: d.bloodGroup, score: matchScore(d.bloodGroup, parsed.data.bloodGroup) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  await db.orm.public.AuditLog.create({ action: 'BLOOD_REQUEST_CREATED', entity: 'BloodRequest', entityId: reqRow.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { request: { id: reqRow.id, bloodGroup: reqRow.bloodGroup, units: reqRow.units, status: reqRow.status }, availability: units, donors }, 201);
});

router.patch('/requests/:id', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const request = await db.orm.public.BloodRequest.where({ id }).first();
  if (!request) {
    return fail(res, 'NOT_FOUND', 'Blood request not found.', 404);
  }
  const sameFacility = user.role === 'FACILITY_STAFF' && !!request.facilityId && request.facilityId === user.facilityId;
  if (user.role !== 'ADMIN' && request.requesterId !== user.id && !sameFacility) {
    return fail(res, 'FORBIDDEN', 'Cannot modify this request.', 403);
  }
  const body = req.body as any;
  if (!body || !['FULFILLED', 'PARTIALLY_FULFILLED', 'CANCELLED'].includes(body.status)) {
    return fail(res, 'VALIDATION_ERROR', 'Invalid status.', 422);
  }
  const oldStatus = request.status;
  await db.orm.public.BloodRequest.where({ id }).update({ status: body.status });
  await db.orm.public.AuditLog.create({ action: 'BLOOD_REQUEST_UPDATED', entity: 'BloodRequest', entityId: id, actorId: user.id }).catch(() => undefined);
  if (body.status !== oldStatus && request.requesterId !== user.id) {
    await notify(request.requesterId, {
      type: 'BLOOD',
      title: 'Blood request updated',
      body: `Your blood request is now ${body.status}.`,
      link: '/dashboard',
    });
  }
  return ok(res, { id, status: body.status });
});

router.get('/units', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), async (req, res) => {
  const user = getUser(req);
  const p = parsePage(req.query as Record<string, unknown>, 20, 100);
  let whereClause: any = {};
  if (user.role === 'FACILITY_STAFF') {
    if (!user.facilityId) {
      return fail(res, 'FORBIDDEN', 'Your account is not linked to a facility.', 403);
    }
    whereClause = { facilityId: user.facilityId };
  } else {
    const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
    if (facilityId) {
      whereClause = { facilityId };
    }
  }
  const rows = await db.orm.public.BloodUnit.where(whereClause)
    .include('facility')
    .orderBy((x) => x.createdAt.desc())
    .offset(p.offset)
    .limit(p.limit)
    .all();
  const total = await db.orm.public.BloodUnit.where(whereClause).aggregate((a) => ({ total: a.count() }));
  const items = rows.map((r) => ({
    id: r.id,
    bloodGroup: r.bloodGroup,
    units: r.units,
    facility: r.facility ? { id: r.facility.id, name: r.facility.name } : null,
  }));
  return ok(res, { items, meta: pageMeta(p, total.total) });
});

router.post('/units', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = bloodUnitSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  let facilityId: string | null = null;
  if (user.role === 'FACILITY_STAFF') {
    if (!user.facilityId) {
      return fail(res, 'FORBIDDEN', 'Your account is not linked to a facility.', 403);
    }
    facilityId = user.facilityId;
  } else {
    if (!parsed.data.bloodGroup && !req.body.bloodGroup) {
      // bloodGroup is there; but facilityId required
    }
    facilityId = typeof req.body.facilityId === 'string' ? req.body.facilityId : null;
    if (!facilityId) {
      return fail(res, 'VALIDATION_ERROR', 'facilityId is required.', 422);
    }
    const f = await db.orm.public.HealthcareFacility.where({ id: facilityId }).first();
    if (!f) {
      return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
    }
  }
  const existing = await db.orm.public.BloodUnit.where({ facilityId: facilityId!, bloodGroup: parsed.data.bloodGroup }).first();
  if (existing) {
    const newUnits = Math.min(999, existing.units + parsed.data.units);
    await db.orm.public.BloodUnit.where({ id: existing.id }).update({ units: newUnits });
    await db.orm.public.AuditLog.create({ action: 'BLOOD_UNIT_UPSERTED', entity: 'BloodUnit', entityId: existing.id, actorId: user.id }).catch(() => undefined);
    return ok(res, { id: existing.id, bloodGroup: parsed.data.bloodGroup, units: newUnits }, 200);
  }
  const unit = await db.orm.public.BloodUnit.create({
    facilityId: facilityId!,
    bloodGroup: parsed.data.bloodGroup,
    units: parsed.data.units,
  });
  await db.orm.public.AuditLog.create({ action: 'BLOOD_UNIT_UPSERTED', entity: 'BloodUnit', entityId: unit.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { id: unit.id, bloodGroup: unit.bloodGroup, units: unit.units }, 201);
});

router.patch('/units/:id', requireAuth, requireRole('FACILITY_STAFF', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const unit = await db.orm.public.BloodUnit.where({ id }).first();
  if (!unit) {
    return fail(res, 'NOT_FOUND', 'Blood unit not found.', 404);
  }
  if (user.role === 'FACILITY_STAFF') {
    if (!user.facilityId || unit.facilityId !== user.facilityId) {
      return fail(res, 'FORBIDDEN', 'Cannot modify this unit.', 403);
    }
  }
  const body = req.body as any;
  if (!body || typeof body.units !== 'number' || body.units < 0 || body.units > 999 || !Number.isInteger(body.units)) {
    return fail(res, 'VALIDATION_ERROR', 'Invalid units.', 422);
  }
  await db.orm.public.BloodUnit.where({ id }).update({ units: body.units });
  await db.orm.public.AuditLog.create({ action: 'BLOOD_UNIT_UPDATED', entity: 'BloodUnit', entityId: id, actorId: user.id }).catch(() => undefined);
  const updated = await db.orm.public.BloodUnit.where({ id }).first();
  return ok(res, { id: updated?.id, bloodGroup: updated?.bloodGroup, units: updated?.units });
});

export default router;
