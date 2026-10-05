import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { doctorProfileSchema } from '@/validations/healthcare';

export async function GET() {
  const rows = await db.orm.public.Doctor.include('user').include('facility').all();
  return ok(
    rows.map((d) => ({
      id: d.id,
      specialization: d.specialization,
      licenseNumber: d.licenseNumber,
      facilityId: d.facilityId,
      name: d.user?.name ?? null,
      facility: d.facility ? { id: d.facility.id, name: d.facility.name, type: d.facility.type } : null,
    })),
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'DOCTOR' && session.role !== 'ADMIN')) {
    return fail('FORBIDDEN', 'Only doctors can create a doctor profile.', 403);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = doctorProfileSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  const existing = await db.orm.public.Doctor.where({ userId: session.sub }).first();
  if (existing) return fail('PROFILE_EXISTS', 'Doctor profile already exists.', 409);

  const doctor = await db.orm.public.Doctor.create({ userId: session.sub, ...parsed.data });
  await db.orm.public.AuditLog.create({ action: 'DOCTOR_PROFILE_CREATED', entity: 'Doctor', entityId: doctor.id, actorId: session.sub }).catch(() => undefined);
  return ok({ id: doctor.id }, 201);
}
