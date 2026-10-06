import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { forecastBloodDemand } from '@/backend/lib/intelligence';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role !== 'ADMIN') return fail('FORBIDDEN', 'Admin only.', 403);
  const rows = await db.orm.public.BloodRequest.all();
  const history = rows.map((r) => ({ date: r.createdAt, bloodGroup: r.bloodGroup, units: r.units }));
  return ok({ forecast: forecastBloodDemand(history, 3), basedOn: history.length });
}
