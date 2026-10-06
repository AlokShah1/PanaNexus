import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { rankAmbulances } from '@/backend/lib/matching';
import { createEmergencySchema } from '@/backend/validations/emergency';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = createEmergencySchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  if (parsed.data.destinationFacilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: parsed.data.destinationFacilityId }).first();
    if (!f) return fail('FACILITY_NOT_FOUND', 'Destination facility not found.', 404);
  }

  const req = await db.orm.public.EmergencyRequest.create({
    requesterId: session.sub,
    destinationFacilityId: parsed.data.destinationFacilityId ?? null,
    pickupLatitude: parsed.data.pickupLatitude,
    pickupLongitude: parsed.data.pickupLongitude,
    category: parsed.data.category,
    priority: parsed.data.priority,
    status: 'PENDING',
  });

  const available = await db.orm.public.Ambulance.where({ status: 'AVAILABLE' }).all();
  const matches = rankAmbulances(available, {
    pickupLatitude: parsed.data.pickupLatitude,
    pickupLongitude: parsed.data.pickupLongitude,
    priority: parsed.data.priority,
    category: parsed.data.category,
  }).slice(0, 5);

  await db.orm.public.EmergencyRequest.where({ id: req.id }).update({ status: matches.length ? 'MATCHED' : 'PENDING' });
  await db.orm.public.AuditLog.create({ action: 'EMERGENCY_REQUEST_CREATED', entity: 'EmergencyRequest', entityId: req.id, actorId: session.sub }).catch(() => undefined);
  return ok({ request: { id: req.id, status: matches.length ? 'MATCHED' : 'PENDING', category: req.category, priority: req.priority }, matches }, 201);
}
