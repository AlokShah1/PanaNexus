import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { rankAmbulances } from '../lib/matching';
import { createEmergencySchema } from '../validations/emergency';

const router = Router();

router.post('/', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const parsed = createEmergencySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  if (parsed.data.destinationFacilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: parsed.data.destinationFacilityId }).first();
    if (!f) return fail(res, 'FACILITY_NOT_FOUND', 'Destination facility not found.', 404);
  }
  const reqRow = await db.orm.public.EmergencyRequest.create({
    requesterId: session.sub, destinationFacilityId: parsed.data.destinationFacilityId ?? null, pickupLatitude: parsed.data.pickupLatitude, pickupLongitude: parsed.data.pickupLongitude, category: parsed.data.category, priority: parsed.data.priority, status: 'PENDING',
  });
  const available = await db.orm.public.Ambulance.where({ status: 'AVAILABLE' }).all();
  const matches = rankAmbulances(available, { pickupLatitude: parsed.data.pickupLatitude, pickupLongitude: parsed.data.pickupLongitude, priority: parsed.data.priority, category: parsed.data.category }).slice(0, 5);
  await db.orm.public.EmergencyRequest.where({ id: reqRow.id }).update({ status: matches.length ? 'MATCHED' : 'PENDING' });
  await db.orm.public.AuditLog.create({ action: 'EMERGENCY_REQUEST_CREATED', entity: 'EmergencyRequest', entityId: reqRow.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { request: { id: reqRow.id, status: matches.length ? 'MATCHED' : 'PENDING', category: reqRow.category, priority: reqRow.priority }, matches }, 201);
});

router.get('/:id', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const { id } = req.params;
  const reqRow = await db.orm.public.EmergencyRequest.where({ id }).first();
  if (!reqRow) return fail(res, 'NOT_FOUND', 'Request not found.', 404);
  if (reqRow.requesterId !== session.sub && session.role !== 'ADMIN' && session.role !== 'AMBULANCE_OPERATOR') return fail(res, 'FORBIDDEN', 'Cannot view this request.', 403);
  const trip = await db.orm.public.Trip.where({ emergencyRequestId: id }).first();
  return ok(res, { request: { id: reqRow.id, status: reqRow.status, category: reqRow.category, priority: reqRow.priority, pickupLatitude: reqRow.pickupLatitude, pickupLongitude: reqRow.pickupLongitude }, trip: trip ? { id: trip.id, status: trip.status, ambulanceId: trip.ambulanceId, startedAt: trip.startedAt, endedAt: trip.endedAt } : null });
});

export default router;
