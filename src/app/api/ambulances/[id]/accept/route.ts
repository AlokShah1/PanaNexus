import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { acceptAmbulanceSchema } from '@/validations/emergency';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session || (session.role !== 'AMBULANCE_OPERATOR' && session.role !== 'ADMIN')) {
    return fail('FORBIDDEN', 'Only ambulance operators can accept requests.', 403);
  }
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = acceptAmbulanceSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  const ambulance = await db.orm.public.Ambulance.where({ id }).first();
  if (!ambulance) return fail('NOT_FOUND', 'Ambulance not found.', 404);
  if (ambulance.status !== 'AVAILABLE') return fail('NOT_AVAILABLE', 'Ambulance is not available.', 409);

  const req = await db.orm.public.EmergencyRequest.where({ id: parsed.data.emergencyRequestId }).first();
  if (!req) return fail('NOT_FOUND', 'Emergency request not found.', 404);
  if (req.status !== 'PENDING' && req.status !== 'MATCHED') return fail('INVALID_STATE', 'Request cannot be accepted.', 409);

  await db.orm.public.Ambulance.where({ id }).update({ status: 'ASSIGNED' });
  await db.orm.public.EmergencyRequest.where({ id: req.id }).update({ status: 'ASSIGNED' });
  const trip = await db.orm.public.Trip.create({ emergencyRequestId: req.id, ambulanceId: ambulance.id, status: 'EN_ROUTE' });
  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_ASSIGNED', entity: 'Trip', entityId: trip.id, actorId: session.sub }).catch(() => undefined);
  return ok({ trip: { id: trip.id, status: trip.status } }, 201);
}
