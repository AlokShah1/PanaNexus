import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getSession } from '../lib/auth.js';
import { compatibleDonorGroups, matchScore } from '../lib/blood.js';
import { bloodRequestSchema } from '../validations/donors.js';

const router = Router();

router.get('/availability', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const bloodGroup = typeof req.query.bloodGroup === 'string' ? req.query.bloodGroup : undefined;
  const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
  const rows = await db.orm.public.BloodUnit.include('facility').all();
  const out = rows
    .filter((r) => r.units > 0)
    .filter((r) => (bloodGroup ? r.bloodGroup === bloodGroup : true))
    .filter((r) => (facilityId ? r.facilityId === facilityId : true))
    .slice(0, 100)
    .map((r) => ({ id: r.id, bloodGroup: r.bloodGroup, units: r.units, facility: r.facility ? { id: r.facility.id, name: r.facility.name } : null }));
  return ok(res, out);
});

router.get('/requests', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role === 'ADMIN') {
    const rows = await db.orm.public.BloodRequest.all();
    return ok(res, rows.slice(0, 100));
  }
  if (session.role !== 'FACILITY_STAFF') return fail(res, 'FORBIDDEN', 'Only facility staff can view requests.', 403);
  const rows = await db.orm.public.BloodRequest.where({ requesterId: session.sub }).all();
  return ok(res, rows);
});

router.post('/requests', async (req, res) => {
  const session = getSession(req);
  if (!session || (session.role !== 'FACILITY_STAFF' && session.role !== 'ADMIN')) return fail(res, 'FORBIDDEN', 'Only facility staff can create blood requests.', 403);
  const parsed = bloodRequestSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  if (parsed.data.facilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!f) return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }
  const reqRow = await db.orm.public.BloodRequest.create({ requesterId: session.sub, facilityId: parsed.data.facilityId ?? null, bloodGroup: parsed.data.bloodGroup, units: parsed.data.units, status: 'PENDING' });
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
  await db.orm.public.AuditLog.create({ action: 'BLOOD_REQUEST_CREATED', entity: 'BloodRequest', entityId: reqRow.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { request: { id: reqRow.id, bloodGroup: reqRow.bloodGroup, units: reqRow.units, status: reqRow.status }, availability: units, donors }, 201);
});

export default router;
