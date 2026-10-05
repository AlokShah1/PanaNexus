import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { patientProfileSchema } from '@/validations/healthcare';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
  if (!patient) return ok(null);
  return ok({ id: patient.id, phone: patient.phone, bloodGroup: patient.bloodGroup, address: patient.address, dateOfBirth: patient.dateOfBirth });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = patientProfileSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const data = { ...parsed.data, dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth).toISOString() : undefined };

  const existing = await db.orm.public.Patient.where({ userId: session.sub }).first();
  if (existing) {
    const updated = await db.orm.public.Patient.where({ userId: session.sub }).update(data);
    await db.orm.public.AuditLog.create({ action: 'PATIENT_PROFILE_UPDATED', entity: 'Patient', entityId: existing.id, actorId: session.sub }).catch(() => undefined);
    return ok({ id: existing.id, updated: Boolean(updated) });
  }
  const patient = await db.orm.public.Patient.create({ userId: session.sub, ...data });
  await db.orm.public.AuditLog.create({ action: 'PATIENT_PROFILE_CREATED', entity: 'Patient', entityId: patient.id, actorId: session.sub }).catch(() => undefined);
  return ok({ id: patient.id }, 201);
}
