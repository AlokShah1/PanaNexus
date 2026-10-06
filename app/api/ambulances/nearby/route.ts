import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { haversineKm } from '@/backend/lib/matching';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return fail('VALIDATION_ERROR', 'lat and lng are required.', 422);

  const rows = await db.orm.public.Ambulance.where({ status: 'AVAILABLE' }).all();
  const out = rows
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => ({ id: a.id, type: a.type, distanceKm: Number(haversineKm(a.latitude as number, a.longitude as number, lat, lng).toFixed(2)) }))
    .sort((x, y) => x.distanceKm - y.distanceKm)
    .slice(0, 10);
  return ok(out);
}
