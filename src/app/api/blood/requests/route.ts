import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { compatibleDonorGroups, matchScore } from '@/lib/blood';
import { bloodRequestSchema } from '@/validations/donors';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role === 'ADMIN') {
    const rows = await db.orm.public.BloodRequest.all();
    return ok(rows.slice(0, 100));
  }
  if (session.role !== 'FACILITY_STAFF') return fail('FORBIDDEN', 'Only facility staff can view requests.', 403);
  const rows = await db.orm.public.BloodRequest.where({ requesterId: session.sub }).all();
  return ok(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'FACILITY_STAFF' && session.role !== 'ADMIN')) {
    return fail('FORBIDDEN', 'Only facility staff can create blood requests.', 403);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = bloodRequestSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  if (parsed.data.facilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!f) return fail('FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }

  const req = await db.orm.public.BloodRequest.create({
    requesterId: session.sub,
    facilityId: parsed.data.facilityId ?? null,
    bloodGroup: parsed.data.bloodGroup,
    units: parsed.data.units,
    status: 'PENDING',
  });

  const compatible = compatibleDonorGroups(parsed.data.bloodGroup);
  const units = (await db.orm.public.BloodUnit.include('facility').all())
    .filter((u) => u.units > 0 && compatible.includes(u.bloodGroup))
    .map((u) => ({ ...u, score: matchScore(u.bloodGroup, parsed.data.bloodGroup) }))
    .sort((a, b) => b.score - a.score || b.units - a.units)
    .slice(0, 10)
    .map((u) => ({ id: u.id, bloodGroup: u.bloodGroup, units: u.units, facility: u.facility ? { id: u.facility.id, name: u.facility.name } : null, score: u.score }));

  const donors = (await db.orm.public.BloodDonor.where({ isAvailable: true }).all())
    .filter((d) => compatible.includes(d.bloodGroup))
    .map((d) => ({ id: d.id, userId: d.userId, bloodGroup: d.bloodGroup, score: matchScore(d.bloodGroup, parsed.data.bloodGroup) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  await db.orm.public.AuditLog.create({ action: 'BLOOD_REQUEST_CREATED', entity: 'BloodRequest', entityId: req.id, actorId: session.sub }).catch(() => undefined);
  return ok({ request: { id: req.id, bloodGroup: req.bloodGroup, units: req.units, status: req.status }, availability: units, donors }, 201);
}
