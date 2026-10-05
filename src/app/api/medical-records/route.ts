import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { medicalRecordSchema } from '@/validations/healthcare';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const patientId = new URL(request.url).searchParams.get('patientId');
  if (!patientId) return fail('VALIDATION_ERROR', 'patientId is required.', 422);

  if (session.role === 'PATIENT') {
    const patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
    if (!patient || patient.id !== patientId) return fail('FORBIDDEN', 'Cannot view these records.', 403);
  } else if (session.role !== 'DOCTOR' && session.role !== 'ADMIN') {
    return fail('FORBIDDEN', 'Cannot view these records.', 403);
  }

  const rows = await db.orm.public.MedicalRecord.where({ patientId }).include('doctor').all();
  return ok(rows.map((r) => ({ id: r.id, diagnosis: r.diagnosis, treatment: r.treatment, notes: r.notes, createdAt: r.createdAt, doctor: r.doctor })));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'DOCTOR') {
    return fail('FORBIDDEN', 'Only doctors can create medical records.', 403);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = medicalRecordSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  const doctor = await db.orm.public.Doctor.where({ userId: session.sub }).first();
  if (!doctor) return fail('DOCTOR_NOT_FOUND', 'Create a doctor profile first.', 404);
  const patient = await db.orm.public.Patient.where({ id: parsed.data.patientId }).first();
  if (!patient) return fail('PATIENT_NOT_FOUND', 'Patient not found.', 404);

  const record = await db.orm.public.MedicalRecord.create({
    patientId: patient.id,
    doctorId: doctor.id,
    diagnosis: parsed.data.diagnosis ?? null,
    treatment: parsed.data.treatment ?? null,
    notes: parsed.data.notes ?? null,
  });
  await db.orm.public.AuditLog.create({ action: 'MEDICAL_RECORD_CREATED', entity: 'MedicalRecord', entityId: record.id, actorId: session.sub }).catch(() => undefined);
  return ok({ id: record.id }, 201);
}
