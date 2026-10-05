import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { slotTaken } from '@/lib/appointments';
import { createAppointmentSchema } from '@/validations/healthcare';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);

  if (session.role === 'PATIENT') {
    const patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
    if (!patient) return ok([]);
    const rows = await db.orm.public.Appointment.where({ patientId: patient.id }).include('doctor').include('facility').all();
    return ok(rows.map((r) => ({ id: r.id, startsAt: r.startsAt, status: r.status, notes: r.notes, doctor: r.doctor, facility: r.facility })));
  }
  if (session.role === 'DOCTOR') {
    const doctor = await db.orm.public.Doctor.where({ userId: session.sub }).first();
    if (!doctor) return ok([]);
    const rows = await db.orm.public.Appointment.where({ doctorId: doctor.id }).include('patient').include('facility').all();
    return ok(rows.map((r) => ({ id: r.id, startsAt: r.startsAt, status: r.status, notes: r.notes, patient: r.patient, facility: r.facility })));
  }
  const rows = await db.orm.public.Appointment.include('doctor').include('patient').include('facility').all();
  return ok(rows.slice(0, 100).map((r) => ({ id: r.id, startsAt: r.startsAt, status: r.status, notes: r.notes, patient: r.patient, doctor: r.doctor, facility: r.facility })));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'PATIENT') {
    return fail('FORBIDDEN', 'Only patients can book appointments.', 403);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  const doctor = await db.orm.public.Doctor.where({ id: parsed.data.doctorId }).first();
  if (!doctor) return fail('DOCTOR_NOT_FOUND', 'Doctor not found.', 404);
  if (parsed.data.facilityId) {
    const facility = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!facility) return fail('FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }

  let patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
  if (!patient) patient = await db.orm.public.Patient.create({ userId: session.sub });

  const startsAt = new Date(parsed.data.startsAt).toISOString();
  const existing = await db.orm.public.Appointment.where({ doctorId: doctor.id }).all();
  if (slotTaken(existing.map((e) => ({ startsAt: e.startsAt, status: e.status })), startsAt)) {
    return fail('APPOINTMENT_CONFLICT', 'This appointment slot is no longer available.', 409);
  }

  const appointment = await db.orm.public.Appointment.create({
    patientId: patient.id,
    doctorId: doctor.id,
    facilityId: parsed.data.facilityId ?? null,
    startsAt,
    notes: parsed.data.notes ?? null,
  });
  await db.orm.public.AuditLog.create({ action: 'APPOINTMENT_BOOKED', entity: 'Appointment', entityId: appointment.id, actorId: session.sub }).catch(() => undefined);
  return ok({ id: appointment.id, status: appointment.status, startsAt: appointment.startsAt }, 201);
}
