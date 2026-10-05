import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const { id } = await params;
  const req = await db.orm.public.EmergencyRequest.where({ id }).first();
  if (!req) return fail('NOT_FOUND', 'Request not found.', 404);
  if (req.requesterId !== session.sub && session.role !== 'ADMIN' && session.role !== 'AMBULANCE_OPERATOR') {
    return fail('FORBIDDEN', 'Cannot view this request.', 403);
  }
  const trip = await db.orm.public.Trip.where({ emergencyRequestId: id }).first();
  return ok({ request: { id: req.id, status: req.status, category: req.category, priority: req.priority, pickupLatitude: req.pickupLatitude, pickupLongitude: req.pickupLongitude }, trip: trip ? { id: trip.id, status: trip.status, ambulanceId: trip.ambulanceId, startedAt: trip.startedAt, endedAt: trip.endedAt } : null });
}
