import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { facilitySchema } from '@/validations/healthcare';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const rows = await db.orm.public.HealthcareFacility.all();
  const filtered = type ? rows.filter((f) => f.type === type) : rows;
  return ok(
    filtered.slice(0, 100).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      address: f.address,
      phone: f.phone,
      operatingHours: f.operatingHours,
    })),
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'FACILITY_STAFF' && session.role !== 'ADMIN')) {
    return fail('FORBIDDEN', 'Only facility staff or admins can create facilities.', 403);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = facilitySchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const facility = await db.orm.public.HealthcareFacility.create(parsed.data);
  await db.orm.public.AuditLog.create({ action: 'FACILITY_CREATED', entity: 'HealthcareFacility', entityId: facility.id, actorId: session.sub }).catch(() => undefined);
  return ok({ id: facility.id }, 201);
}
