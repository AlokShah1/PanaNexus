import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { notify } from '../lib/notify.js';
import { emitToRoom, emitToUser, tripRoom } from '../lib/realtime.js';
import { getUser, requireAuth, requireRole, requireVerified, type SessionUser } from '../middleware/auth.js';
import { haversineKm } from '../lib/matching.js';
import { isUniqueViolation } from '../lib/appointments.js';
import { DispatchConflictError, roadEtaMinutes } from '../lib/dispatch.js';
import { acceptAmbulanceSchema, ambulanceLocationSchema, ambulanceStatusSchema } from '../validations/emergency.js';
import { isDemoMode } from '../lib/demoSimulation.js';

const router = Router();

type AmbRow = {
  id: string;
  registrationNumber: string;
  type: string;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  operatorId: string | null;
  latitude: number | null;
  longitude: number | null;
};

async function findAmbulance(id: string): Promise<AmbRow | null> {
  return (await db.orm.public.Ambulance.where({ id }).first()) as AmbRow | null;
}

async function ownAmbulance(id: string, user: SessionUser): Promise<{ row: AmbRow } | { code: string; message: string; status: number }> {
  const row = await findAmbulance(id);
  if (!row) return { code: 'NOT_FOUND', message: 'Ambulance not found.', status: 404 };
  if (user.role !== 'ADMIN' && row.operatorId !== user.id) {
    return { code: 'FORBIDDEN', message: 'This ambulance does not belong to your fleet.', status: 403 };
  }
  return { row };
}

async function activeTripFor(ambulanceId: string) {
  const trips = await db.orm.public.Trip.where({ ambulanceId }).all();
  return [...trips].reverse().find((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED') ?? null;
}

function fleetView(a: AmbRow) {
  return {
    id: a.id,
    registrationNumber: a.registrationNumber,
    type: a.type,
    status: a.status,
    driverName: a.driverName,
    driverPhone: a.driverPhone,
    latitude: a.latitude,
    longitude: a.longitude,
    online: a.status !== 'OFFLINE',
  };
}

router.get('/nearby', requireAuth, async (req, res) => {
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

router.get('/me', requireAuth, requireRole('AMBULANCE_OPERATOR', 'ADMIN'), async (req, res) => {
  const user = getUser(req);
  const rows =
    user.role === 'ADMIN'
      ? await db.orm.public.Ambulance.all()
      : await db.orm.public.Ambulance.where({ operatorId: user.id }).all();
  return ok(res, { items: rows.map((r) => fleetView(r as AmbRow)), demoMode: isDemoMode() });
});

router.post('/me', requireAuth, requireRole('AMBULANCE_OPERATOR', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const body = req.body ?? {};
  const registrationNumber = typeof body.registrationNumber === 'string' ? body.registrationNumber.trim() : '';
  const type = body.type;
  if (!registrationNumber || registrationNumber.length < 3) return fail(res, 'VALIDATION_ERROR', 'Registration number is required.', 422);
  if (!['BASIC', 'ADVANCED', 'ICU'].includes(type)) return fail(res, 'VALIDATION_ERROR', 'Ambulance type must be BASIC, ADVANCED or ICU.', 422);
  const dup = await db.orm.public.Ambulance.where({ registrationNumber }).first();
  if (dup) return fail(res, 'REGISTRATION_TAKEN', 'An ambulance with this registration number already exists.', 409);
  const row = await db.orm.public.Ambulance.create({
    registrationNumber,
    type: type as 'BASIC' | 'ADVANCED' | 'ICU',
    status: 'OFFLINE',
    operatorId: user.role === 'ADMIN' ? null : user.id,
    driverName: typeof body.driverName === 'string' && body.driverName.trim() ? body.driverName.trim() : null,
    driverPhone: typeof body.driverPhone === 'string' && body.driverPhone.trim() ? body.driverPhone.trim() : null,
    latitude: typeof body.latitude === 'number' ? body.latitude : null,
    longitude: typeof body.longitude === 'number' ? body.longitude : null,
  });
  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_ADDED', entity: 'Ambulance', entityId: row.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { ambulance: fleetView(row as AmbRow) }, 201);
});

router.patch('/me/:id', requireAuth, requireRole('AMBULANCE_OPERATOR', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const owned = await ownAmbulance(req.params.id, user);
  if ('code' in owned) return fail(res, owned.code, owned.message, owned.status);
  const body = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (typeof body.type === 'string' && ['BASIC', 'ADVANCED', 'ICU'].includes(body.type)) patch.type = body.type;
  if (typeof body.driverName === 'string') patch.driverName = body.driverName.trim() || null;
  if (typeof body.driverPhone === 'string') patch.driverPhone = body.driverPhone.trim() || null;
  if (typeof body.latitude === 'number') patch.latitude = body.latitude;
  if (typeof body.longitude === 'number') patch.longitude = body.longitude;
  if (Object.keys(patch).length === 0) return fail(res, 'VALIDATION_ERROR', 'Nothing to update.', 422);
  await db.orm.public.Ambulance.where({ id: owned.row.id }).update(patch as never);
  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_UPDATED', entity: 'Ambulance', entityId: owned.row.id, actorId: user.id }).catch(() => undefined);
  const updated = await findAmbulance(owned.row.id);
  return ok(res, { ambulance: fleetView(updated as AmbRow) });
});

router.delete('/me/:id', requireAuth, requireRole('AMBULANCE_OPERATOR', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const owned = await ownAmbulance(req.params.id, user);
  if ('code' in owned) return fail(res, owned.code, owned.message, owned.status);
  const active = await activeTripFor(owned.row.id);
  if (active) return fail(res, 'ACTIVE_TRIP', 'This ambulance has an active trip and cannot be removed.', 409);
  const trips = await db.orm.public.Trip.where({ ambulanceId: owned.row.id }).all();
  if (trips.length > 0) return fail(res, 'HAS_HISTORY', 'This ambulance has trip history and cannot be removed.', 409);
  await db.orm.public.Ambulance.where({ id: owned.row.id }).delete();
  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_REMOVED', entity: 'Ambulance', entityId: owned.row.id, actorId: user.id }).catch(() => undefined);
  return ok(res, { id: owned.row.id, removed: true });
});

for (const [suffix, target] of [
  ['online', 'AVAILABLE'],
  ['offline', 'OFFLINE'],
] as const) {
  router.post(`/me/:id/${suffix}`, requireAuth, requireRole('AMBULANCE_OPERATOR', 'ADMIN'), requireVerified, async (req, res) => {
    const user = getUser(req);
    const owned = await ownAmbulance(req.params.id, user);
    if ('code' in owned) return fail(res, owned.code, owned.message, owned.status);
    if (target === 'OFFLINE' && ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRANSPORTING'].includes(owned.row.status)) {
      return fail(res, 'ACTIVE_TRIP', 'Finish the current trip before going offline.', 409);
    }
    await db.orm.public.Ambulance.where({ id: owned.row.id }).update({ status: target });
    return ok(res, { id: owned.row.id, status: target, online: target !== 'OFFLINE' });
  });
}

const TRIP_BY_AMB: Record<string, string> = {
  ASSIGNED: 'EN_ROUTE',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  TRANSPORTING: 'TRANSPORTING',
  COMPLETED: 'COMPLETED',
};

const REQUESTER_MESSAGES: Record<string, string> = {
  EN_ROUTE: 'Your ambulance is on the way.',
  ARRIVED: 'Your ambulance has arrived at the pickup point.',
  TRANSPORTING: 'Transport to the hospital is in progress.',
  COMPLETED: 'Your trip is complete. Take care.',
};

router.post('/:id/accept', requireAuth, requireRole('AMBULANCE_OPERATOR', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = acceptAmbulanceSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const owned = await ownAmbulance(req.params.id, user);
  if ('code' in owned) return fail(res, owned.code, owned.message, owned.status);
  if (owned.row.status !== 'AVAILABLE') return fail(res, 'NOT_AVAILABLE', 'Ambulance is not available.', 409);
  const reqRow = await db.orm.public.EmergencyRequest.where({ id: parsed.data.emergencyRequestId }).first();
  if (!reqRow) return fail(res, 'NOT_FOUND', 'Emergency request not found.', 404);
  if (reqRow.status !== 'PENDING' && reqRow.status !== 'MATCHED') return fail(res, 'INVALID_STATE', 'Request cannot be accepted.', 409);

  // Claim the ambulance and the request atomically. Unique indexes on an active
  // trip per ambulance and per emergency request are the real guard against two
  // operators racing to accept the same request (or one unit taking two trips).
  let trip;
  try {
    trip = await db.transaction(async (tx) => {
      const freshAmb = await tx.orm.public.Ambulance.where({ id: owned.row.id }).first();
      if (!freshAmb || freshAmb.status !== 'AVAILABLE') {
        throw new DispatchConflictError('NOT_AVAILABLE', 'Ambulance is not available.');
      }
      const freshReq = await tx.orm.public.EmergencyRequest.where({ id: reqRow.id }).first();
      if (!freshReq || (freshReq.status !== 'PENDING' && freshReq.status !== 'MATCHED')) {
        throw new DispatchConflictError('INVALID_STATE', 'This request has already been assigned.');
      }
      await tx.orm.public.Ambulance.where({ id: owned.row.id }).update({ status: 'ASSIGNED' });
      await tx.orm.public.EmergencyRequest.where({ id: reqRow.id }).update({ status: 'ASSIGNED' });
      return await tx.orm.public.Trip.create({ emergencyRequestId: reqRow.id, ambulanceId: owned.row.id, status: 'EN_ROUTE' });
    });
  } catch (err) {
    if (err instanceof DispatchConflictError) return fail(res, err.code, err.message, 409);
    if (isUniqueViolation(err)) {
      return fail(res, 'INVALID_STATE', 'This request has already been assigned.', 409);
    }
    throw err;
  }

  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_ASSIGNED', entity: 'Trip', entityId: trip.id, actorId: user.id }).catch(() => undefined);
  await notify(reqRow.requesterId, {
    type: 'EMERGENCY',
    title: 'Ambulance assigned',
    body: `${owned.row.registrationNumber} is on the way to you.`,
    link: '/emergency',
  });
  const eta = await roadEtaMinutes(owned.row.latitude, owned.row.longitude, reqRow.pickupLatitude, reqRow.pickupLongitude);
  const payload = {
    tripId: trip.id,
    emergencyRequestId: reqRow.id,
    status: trip.status,
    state: 'EN_ROUTE',
    ambulance: fleetView(owned.row),
    isSimulation: false,
    etaMinutes: eta?.minutes ?? null,
    etaApproximate: eta?.approximate ?? null,
  };
  emitToUser(reqRow.requesterId, 'trip:status', payload);
  emitToRoom(tripRoom(trip.id), 'trip:status', payload);
  return ok(res, { trip: { id: trip.id, status: trip.status, state: 'EN_ROUTE', etaMinutes: eta?.minutes ?? null, etaApproximate: eta?.approximate ?? null } }, 201);
});

router.patch('/:id/status', requireAuth, requireRole('AMBULANCE_OPERATOR', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = ambulanceStatusSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const owned = await ownAmbulance(req.params.id, user);
  if ('code' in owned) return fail(res, owned.code, owned.message, owned.status);
  const nextAmb = parsed.data.status;
  const patch: Record<string, unknown> = { status: nextAmb };
  if (nextAmb === 'AVAILABLE' || nextAmb === 'OFFLINE') patch.status = nextAmb;
  await db.orm.public.Ambulance.where({ id: owned.row.id }).update(patch as never);

  const trip = await activeTripFor(owned.row.id);
  if (trip) {
    const nextTrip = TRIP_BY_AMB[nextAmb];
    if (nextTrip) {
      const tripPatch: Record<string, unknown> = { status: nextTrip };
      const nowIso = new Date().toISOString();
      if (nextTrip === 'ARRIVED' && !trip.arrivedAt) tripPatch.arrivedAt = nowIso;
      if (nextTrip === 'COMPLETED') {
        tripPatch.completedAt = nowIso;
        tripPatch.endedAt = nowIso;
      }
      await db.orm.public.Trip.where({ id: trip.id }).update(tripPatch as never);
      const reqRow = await db.orm.public.EmergencyRequest.where({ id: trip.emergencyRequestId }).first();
      if (reqRow) {
        await db.orm.public.EmergencyRequest.where({ id: reqRow.id }).update({ status: nextTrip as never });
      }
      if (nextTrip === 'COMPLETED') {
        await db.orm.public.Ambulance.where({ id: owned.row.id }).update({ status: 'AVAILABLE' });
      }
      if (reqRow) {
        const state = { EN_ROUTE: 'EN_ROUTE', ARRIVED: 'ARRIVED', TRANSPORTING: 'TRANSPORTING', COMPLETED: 'COMPLETED' }[nextTrip];
        if (state && REQUESTER_MESSAGES[nextTrip]) {
          await notify(reqRow.requesterId, {
            type: 'TRIP',
            title: state === 'COMPLETED' ? 'Trip completed' : 'Ambulance update',
            body: REQUESTER_MESSAGES[nextTrip],
            link: '/emergency',
          });
        }
        const payload = { tripId: trip.id, emergencyRequestId: trip.emergencyRequestId, status: nextTrip, state: nextTrip, ambulanceStatus: (await findAmbulance(owned.row.id))?.status ?? nextAmb };
        emitToUser(reqRow.requesterId, 'trip:status', payload);
        emitToRoom(tripRoom(trip.id), 'trip:status', payload);
      }
    }
  }
  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_STATUS_UPDATED', entity: 'Ambulance', entityId: owned.row.id, actorId: user.id, metadata: nextAmb }).catch(() => undefined);
  return ok(res, { id: owned.row.id, status: (await findAmbulance(owned.row.id))?.status ?? nextAmb });
});

interface LocThrottleState {
  atMs: number;
  lat: number;
  lng: number;
}
const lastLocationAt = new Map<string, LocThrottleState>();

/** Road-ETA is recomputed at most once every 20s per trip to spare the provider. */
const lastEtaAt = new Map<string, number>();

/** Only publish a GPS point every ~2.5s AND when it moves meaningfully (>15 m). */
function shouldPublish(id: string, lat: number, lng: number): boolean {
  const now = Date.now();
  const prev = lastLocationAt.get(id);
  if (!prev) {
    lastLocationAt.set(id, { atMs: now, lat, lng });
    return true;
  }
  const timeOk = now - prev.atMs >= 2500;
  const moved = prev.lat === lat && prev.lng === lng ? 0 : haversineKm(prev.lat, prev.lng, lat, lng);
  if (!timeOk) return false;
  if (moved < 0.015) return false; // <15 m, skip
  lastLocationAt.set(id, { atMs: now, lat, lng });
  return true;
}

router.post('/:id/location', requireAuth, requireRole('AMBULANCE_OPERATOR', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = ambulanceLocationSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const owned = await ownAmbulance(req.params.id, user);
  if ('code' in owned) return fail(res, owned.code, owned.message, owned.status);
  if (!shouldPublish(owned.row.id, parsed.data.latitude, parsed.data.longitude)) {
    return ok(res, { accepted: true, throttled: true });
  }
  await db.orm.public.Ambulance.where({ id: owned.row.id }).update({
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
  });
  const trip = await activeTripFor(owned.row.id);
  if (trip) {
    const update = await db.orm.public.LocationUpdate.create({
      tripId: trip.id,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
    });
    const reqRow = await db.orm.public.EmergencyRequest.where({ id: trip.emergencyRequestId }).first();
    const lastEta = lastEtaAt.get(trip.id) ?? 0;
    let eta: Awaited<ReturnType<typeof roadEtaMinutes>> = null;
    if (reqRow && Date.now() - lastEta >= 20_000) {
      eta = await roadEtaMinutes(parsed.data.latitude, parsed.data.longitude, reqRow.pickupLatitude, reqRow.pickupLongitude);
      lastEtaAt.set(trip.id, Date.now());
    }
    const event = {
      tripId: trip.id,
      latitude: update.latitude,
      longitude: update.longitude,
      accuracy: update.accuracy ?? null,
      recordedAt: update.recordedAt,
      isSimulation: trip.isSimulation,
      etaMinutes: eta?.minutes ?? null,
      etaApproximate: eta?.approximate ?? null,
    };
    emitToRoom(tripRoom(trip.id), 'trip:location', event);
    if (reqRow) {
      emitToUser(reqRow.requesterId, 'trip:location', event);
    }
  }
  return ok(res, { accepted: true, throttled: false });
});

export default router;
