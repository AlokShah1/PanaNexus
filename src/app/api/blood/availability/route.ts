import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const url = new URL(request.url);
  const bloodGroup = url.searchParams.get('bloodGroup');
  const facilityId = url.searchParams.get('facilityId');
  const rows = await db.orm.public.BloodUnit.include('facility').all();
  const out = rows
    .filter((r) => r.units > 0)
    .filter((r) => (bloodGroup ? r.bloodGroup === bloodGroup : true))
    .filter((r) => (facilityId ? r.facilityId === facilityId : true))
    .slice(0, 100)
    .map((r) => ({ id: r.id, bloodGroup: r.bloodGroup, units: r.units, facility: r.facility ? { id: r.facility.id, name: r.facility.name } : null }));
  return ok(out);
}
