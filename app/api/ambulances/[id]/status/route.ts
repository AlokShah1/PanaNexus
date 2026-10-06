import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { ambulanceStatusSchema } from '@/backend/validations/emergency';

type Ctx = { params: Promise<{ id: string }> };

const TRIP_BY_AMB: Record<string, string> = {
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  TRANSPORTING: 'TRANSPORTING',
  COMPLETED: 'COMPLETED',
  ASSIGNED: 'EN_ROUTE',
};

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session || (session.role !== 'AMBULANCE_OPERATOR' && session.role !== 'ADMIN')) {
    return fail('FORBIDDEN', 'Only ambulance operators can update status.', 403);
  }
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = ambulanceStatusSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  const ambulance = await db.orm.public.Ambulance.where({ id }).first();
  if (!ambulance) return fail('NOT_FOUND', 'Ambulance not found.', 404);
  await db.orm.public.Ambulance.where({ id }).update({ status: parsed.data.status });

  const trips = await db.orm.public.Trip.where({ ambulanceId: id }).all();
  const trip = [...trips].reverse().find((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  if (trip) {
    const next = TRIP_BY_AMB[parsed.data.status];
    if (next) {
      const patch: Record<string, unknown> = { status: next };
      if (next === 'COMPLETED') patch.endedAt = new Date().toISOString();
      await db.orm.public.Trip.where({ id: trip.id }).update(patch as never);
      if (next === 'COMPLETED') {
        const req = await db.orm.public.EmergencyRequest.where({ id: trip.emergencyRequestId }).first();
        if (req) await db.orm.public.EmergencyRequest.where({ id: req.id }).update({ status: 'COMPLETED' });
      } else {
        const req = await db.orm.public.EmergencyRequest.where({ id: trip.emergencyRequestId }).first();
        if (req) await db.orm.public.EmergencyRequest.where({ id: req.id }).update({ status: next as never });
      }
    }
  }
  await db.orm.public.AuditLog.create({ action: 'AMBULANCE_STATUS_UPDATED', entity: 'Ambulance', entityId: id, actorId: session.sub, metadata: parsed.data.status }).catch(() => undefined);
  return ok({ id, status: parsed.data.status });
}
