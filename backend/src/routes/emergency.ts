import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { notify } from '../lib/notify.js';
import { emitToRoom, OPERATOR_ROOM, tripRoom } from '../lib/realtime.js';
import { getUser, requireAuth } from '../middleware/auth.js';
import { rankAmbulances } from '../lib/matching.js';
import { cancelEmergencySchema, createEmergencySchema } from '../validations/emergency.js';
import { pageMeta, parsePage } from '../lib/pagination.js';

const router = Router();

const STATE: Record<string, string> = {
  PENDING: 'REQUESTED',
  MATCHED: 'SEARCHING',
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  TRANSPORTING: 'TRANSPORTING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

function stateOf(status: string): string {
  return STATE[status] ?? status;
}

interface RequestRow {
  id: string;
  status: string;
  category: string;
  priority: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string | null;
  destinationAddress: string | null;
  notes: string | null;
  cancelReason: string | null;
  requesterId: string;
  destinationFacilityId: string | null;
  createdAt: string;
}

function publicRequest(r: RequestRow, extra: Record<string, unknown> = {}) {
  return {
    id: r.id,
    status: r.status,
    state: stateOf(r.status),
    category: r.category,
    priority: r.priority,
    pickupAddress: r.pickupAddress,
    destinationAddress: r.destinationAddress,
    notes: r.notes,
    cancelReason: r.cancelReason,
    createdAt: r.createdAt,
    ...extra,
  };
}

router.post('/', requireAuth, async (req, res) => {
  const user = getUser(req);
  const parsed = createEmergencySchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const data = parsed.data;
  if (data.destinationFacilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: data.destinationFacilityId }).first();
    if (!f) return fail(res, 'FACILITY_NOT_FOUND', 'Destination facility not found.', 404);
  }
  const reqRow = await db.orm.public.EmergencyRequest.create({
    requesterId: user.id,
    destinationFacilityId: data.destinationFacilityId ?? null,
    destinationAddress: data.destinationAddress ?? null,
    pickupLatitude: data.pickupLatitude,
    pickupLongitude: data.pickupLongitude,
    pickupAddress: data.pickupAddress ?? null,
    notes: data.notes ?? null,
    category: data.category,
    priority: data.priority,
    status: 'PENDING',
  });
  const available = await db.orm.public.Ambulance.where({ status: 'AVAILABLE' }).include('operator').all();
  const dispatchable = available.filter((a) => a.operator && a.operator.verificationStatus === 'VERIFIED');
  const ranked = rankAmbulances(dispatchable, {
    pickupLatitude: data.pickupLatitude,
    pickupLongitude: data.pickupLongitude,
    priority: data.priority,
    category: data.category,
  }).slice(0, 5);
  const byId = new Map(dispatchable.map((a) => [a.id, a]));
  const matches = ranked.map((m) => {
    const a = byId.get(m.id);
    return { ...m, registrationNumber: a?.registrationNumber ?? null, type: a?.type ?? null };
  });
  await db.orm.public.EmergencyRequest.where({ id: reqRow.id }).update({ status: matches.length ? 'MATCHED' : 'PENDING' });
  await db.orm.public.AuditLog.create({
    action: 'EMERGENCY_REQUEST_CREATED',
    entity: 'EmergencyRequest',
    entityId: reqRow.id,
    actorId: user.id,
    metadata: JSON.stringify({ category: data.category, priority: data.priority }),
  }).catch(() => undefined);
  emitToRoom(OPERATOR_ROOM, 'emergency:new', {
    id: reqRow.id,
    state: matches.length ? 'SEARCHING' : 'REQUESTED',
    category: data.category,
    priority: data.priority,
    pickupAddress: data.pickupAddress ?? null,
    createdAt: reqRow.createdAt,
  });
  for (const m of matches.slice(0, 3)) {
    const a = byId.get(m.id);
    if (a?.operatorId) {
      await notify(a.operatorId, {
        type: 'EMERGENCY',
        title: 'New emergency request',
        body: `${data.category.replace(/_/g, ' ').toLowerCase()} · ${Math.round(m.distanceKm)} km away`,
        link: '/ambulance',
      });
    }
  }
  return ok(
    res,
    {
      request: { id: reqRow.id, status: matches.length ? 'MATCHED' : 'PENDING', state: matches.length ? 'SEARCHING' : 'REQUESTED', category: reqRow.category, priority: reqRow.priority, pickupAddress: reqRow.pickupAddress },
      matches,
    },
    201,
  );
});

router.get('/', requireAuth, async (req, res) => {
  const user = getUser(req);
  const p = parsePage(req.query as Record<string, unknown>, 20, 50);
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;

  let rows: RequestRow[];
  let total: number;

  if (user.role === 'AMBULANCE_OPERATOR') {
    const candidates = new Map<string, RequestRow>();
    const openStatuses = statusFilter ? [statusFilter] : ['PENDING', 'MATCHED'];
    for (const st of openStatuses) {
      for (const r of (await db.orm.public.EmergencyRequest.where({ status: st as never }).all()) as RequestRow[]) {
        candidates.set(r.id, r);
      }
    }
    const fleet = await db.orm.public.Ambulance.where({ operatorId: user.id }).all();
    for (const a of fleet) {
      const trips = await db.orm.public.Trip.where({ ambulanceId: a.id }).all();
      for (const t of trips) {
        const r = (await db.orm.public.EmergencyRequest.where({ id: t.emergencyRequestId }).first()) as RequestRow | null;
        if (r && (!statusFilter || r.status === statusFilter)) candidates.set(r.id, r);
      }
    }
    const merged = [...candidates.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    total = merged.length;
    rows = merged.slice(p.offset, p.offset + p.limit);
  } else {
    const where: Record<string, unknown> = {};
    if (user.role !== 'ADMIN') where.requesterId = user.id;
    if (statusFilter) where.status = statusFilter;
    const base = Object.keys(where).length
      ? db.orm.public.EmergencyRequest.where(where as never)
      : db.orm.public.EmergencyRequest;
    const count = await base.aggregate((a) => ({ total: a.count() }));
    total = count.total;
    rows = (await base
      .orderBy((r) => r.createdAt.desc())
      .limit(p.limit)
      .offset(p.offset)
      .all()) as RequestRow[];
  }

  const items = await Promise.all(
    rows.map(async (r) => {
      const trip = await db.orm.public.Trip.where({ emergencyRequestId: r.id }).first();
      let ambulance: { registrationNumber: string; type: string } | null = null;
      if (trip) {
        const a = await db.orm.public.Ambulance.where({ id: trip.ambulanceId }).first();
        if (a) ambulance = { registrationNumber: a.registrationNumber, type: a.type };
      }
      return publicRequest(r, { tripStatus: trip?.status ?? null, ambulance });
    }),
  );
  return ok(res, { items, meta: pageMeta(p, total) });
});

router.get('/:id', requireAuth, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const reqRow = await db.orm.public.EmergencyRequest.where({ id }).first();
  if (!reqRow) return fail(res, 'NOT_FOUND', 'Request not found.', 404);
  const allowed =
    reqRow.requesterId === user.id ||
    user.role === 'ADMIN' ||
    (user.role === 'AMBULANCE_OPERATOR' && user.verificationStatus === 'VERIFIED');
  if (!allowed) return fail(res, 'FORBIDDEN', 'Cannot view this request.', 403);

  const trip = await db.orm.public.Trip.where({ emergencyRequestId: id }).first();
  let ambulance: {
    id: string;
    registrationNumber: string;
    type: string;
    driver: string | null;
    driverPhone: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null = null;
  let locations: { latitude: number; longitude: number; recordedAt: string }[] = [];
  if (trip) {
    const a = await db.orm.public.Ambulance.where({ id: trip.ambulanceId }).first();
    if (a) {
      const operator = a.operatorId ? await db.orm.public.User.where({ id: a.operatorId }).first() : null;
      ambulance = {
        id: a.id,
        registrationNumber: a.registrationNumber,
        type: a.type,
        driver: a.driverName ?? operator?.name ?? null,
        driverPhone: a.driverPhone ?? operator?.phone ?? null,
        latitude: a.latitude,
        longitude: a.longitude,
      };
    }
    const ups = await db.orm.public.LocationUpdate.where({ tripId: trip.id }).orderBy((u) => u.recordedAt.desc()).limit(50).all();
    locations = ups.reverse().map((u) => ({ latitude: u.latitude, longitude: u.longitude, recordedAt: u.recordedAt }));
  }
  const destination = reqRow.destinationFacilityId
    ? await db.orm.public.HealthcareFacility.where({ id: reqRow.destinationFacilityId }).first()
    : null;

  return ok(res, {
    request: publicRequest(reqRow, {
      pickupLatitude: reqRow.pickupLatitude,
      pickupLongitude: reqRow.pickupLongitude,
      destination: destination ? { id: destination.id, name: destination.name, address: destination.address } : null,
    }),
    trip: trip
      ? { id: trip.id, status: trip.status, state: stateOf(trip.status), ambulanceId: trip.ambulanceId, startedAt: trip.startedAt, arrivedAt: trip.arrivedAt, completedAt: trip.completedAt, endedAt: trip.endedAt }
      : null,
    ambulance,
    locations,
  });
});

router.post('/:id/cancel', requireAuth, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const parsed = cancelEmergencySchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const reqRow = await db.orm.public.EmergencyRequest.where({ id }).first();
  if (!reqRow) return fail(res, 'NOT_FOUND', 'Request not found.', 404);
  if (reqRow.requesterId !== user.id && user.role !== 'ADMIN') return fail(res, 'FORBIDDEN', 'Cannot cancel this request.', 403);
  if (['COMPLETED', 'CANCELLED'].includes(reqRow.status)) {
    return fail(res, 'INVALID_STATE', 'This request is already closed.', 409);
  }
  await db.orm.public.EmergencyRequest.where({ id }).update({
    status: 'CANCELLED',
    cancelReason: parsed.data.reason ?? null,
  });
  const trip = await db.orm.public.Trip.where({ emergencyRequestId: id }).first();
  if (trip) {
    await db.orm.public.Trip.where({ id: trip.id }).update({ status: 'CANCELLED', endedAt: new Date().toISOString() });
    const a = await db.orm.public.Ambulance.where({ id: trip.ambulanceId }).first();
    if (a && ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRANSPORTING'].includes(a.status)) {
      await db.orm.public.Ambulance.where({ id: a.id }).update({ status: 'AVAILABLE' });
      if (a.operatorId) {
        await notify(a.operatorId, {
          type: 'TRIP',
          title: 'Emergency cancelled',
          body: 'The requester cancelled this trip. Your ambulance is available again.',
          link: '/ambulance',
        });
      }
    }
    emitToRoom(tripRoom(trip.id), 'trip:status', { tripId: trip.id, status: 'CANCELLED', state: 'CANCELLED' });
  }
  await db.orm.public.AuditLog.create({
    action: 'EMERGENCY_CANCELLED',
    entity: 'EmergencyRequest',
    entityId: id,
    actorId: user.id,
    metadata: parsed.data.reason ?? null,
  }).catch(() => undefined);
  return ok(res, { id, status: 'CANCELLED', state: 'CANCELLED' });
});

export default router;
