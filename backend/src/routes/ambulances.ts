import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { haversineKm } from '../lib/matching';
import { acceptAmbulanceSchema, ambulanceStatusSchema } from '../validations/emergency';

const router = Router();

router.get('/nearby', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return fail(res, 'VALIDATION_ERROR', 'lat and lng are required.', 422);
  const rows = await db.orm.public.Ambulance.where({ status: 'AVAILABLE' }).all();
  const out = rows
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => ({ id: a.id, type: a.type, distanceKm: Number(haversineKm(a.latitude as number, a.longitude as number, lat, lng).toFixed(2)) }))
    .sort((x, y) => x.distanceKm - y.distanceKm)
    .slice(0, 10);
  return ok(res, out);
});

const TRIP_BY_AMB: Record<string, string> = { EN_ROUTE: 'EN_ROUTE', ARRIVED: 'ARRIVED', TRANSPORTING: 'TRANSPORTING', COMPLETED: 'COMPLETED', ASSIGNED: 'EN_ROUTE' };

router.post('/:id/accept', async (req, res) => {
  const session = getSession(req);
  if (!session || (session.role !== 'AMBULANCE_OPERATOR' && session.role !== 'ADMIN')) return fail(res, 'FORBIDDEN', 'Only ambulance operators can accept requests.', 403);
  const { id } = req.params;
  const parsed = acceptAmbulanceSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const ambulance = await db.orm.public.Ambulance.where({ id }).first();
  if (!ambulance) return fail(res, 'NOT_FOUND', 'Ambulance not found.', 404);
  if (ambulance.status !== 'AVAILABLE') return fail(res, 'NOT_AVAILABLE', 'Ambulance is not available.', 409);
  const reqRow = await db.orm.public.EmergencyRequest.where({ id: parsed.data.emergencyRequestId }).first();
  if (!reqRow) return fail(res, 'NOT_FOUND', 'Emergency request not found.', 404);
  if (reqRow.status !== 'PENDING' && reqRow.status !== 'MATCHED') return fail(res, 'INVALID_STATE', 'Request cannot be accepted.', 409);
  await db.orm.public.Ambulance.where({ id }).update({ status: 'ASSIGNED' });
  await db.orm.public.EmergencyRequest.where({ id: reqRow.id }).update({ status: 'ASSIGNED' });
  const trip = await db.orm.public.Trip.create({ emergencyRequestId: reqRow.id, ambulanceId: ambulance.id, status: 'EN_ROUTE' });
  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_ASSIGNED', entity: 'Trip', entityId: trip.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { trip: { id: trip.id, status: trip.status } }, 201);
});

router.patch('/:id/status', async (req, res) => {
  const session = getSession(req);
  if (!session || (session.role !== 'AMBULANCE_OPERATOR' && session.role !== 'ADMIN')) return fail(res, 'FORBIDDEN', 'Only ambulance operators can update status.', 403);
  const { id } = req.params;
  const parsed = ambulanceStatusSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const ambulance = await db.orm.public.Ambulance.where({ id }).first();
  if (!ambulance) return fail(res, 'NOT_FOUND', 'Ambulance not found.', 404);
  await db.orm.public.Ambulance.where({ id }).update({ status: parsed.data.status });
  const trips = await db.orm.public.Trip.where({ ambulanceId: id }).all();
  const trip = [...trips].reverse().find((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  if (trip) {
    const next = TRIP_BY_AMB[parsed.data.status];
    if (next) {
      const patch: Record<string, unknown> = { status: next };
      if (next === 'COMPLETED') patch.endedAt = new Date().toISOString();
      await db.orm.public.Trip.where({ id: trip.id }).update(patch as never);
      const reqRow = await db.orm.public.EmergencyRequest.where({ id: trip.emergencyRequestId }).first();
      if (reqRow) {
        await db.orm.public.EmergencyRequest.where({ id: reqRow.id }).update({ status: next === 'COMPLETED' ? 'COMPLETED' : (next as never) });
      }
    }
  }
  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_STATUS_UPDATED', entity: 'Ambulance', entityId: id, actorId: session.sub, metadata: parsed.data.status }).catch(() => undefined);
  return ok(res, { id, status: parsed.data.status });
});

export default router;
