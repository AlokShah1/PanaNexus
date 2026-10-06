import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { slotTaken } from '@/backend/lib/appointments';
import { updateAppointmentSchema } from '@/backend/validations/healthcare';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = updateAppointmentSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  const appointment = await db.orm.public.Appointment.where({ id }).first();
  if (!appointment) return fail('NOT_FOUND', 'Appointment not found.', 404);

  const patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
  const doctor = await db.orm.public.Doctor.where({ userId: session.sub }).first();
  const isOwner = patient?.id === appointment.patientId || doctor?.id === appointment.doctorId || session.role === 'ADMIN';
  if (!isOwner) return fail('FORBIDDEN', 'You cannot modify this appointment.', 403);

  if (parsed.data.startsAt) {
    const startsAt = new Date(parsed.data.startsAt).toISOString();
    const existing = await db.orm.public.Appointment.where({ doctorId: appointment.doctorId }).all();
    if (slotTaken(existing.filter((e) => e.id !== id).map((e) => ({ startsAt: e.startsAt, status: e.status })), startsAt)) {
      return fail('APPOINTMENT_CONFLICT', 'This appointment slot is no longer available.', 409);
    }
    await db.orm.public.Appointment.where({ id }).update({ startsAt, ...(parsed.data.status ? { status: parsed.data.status } : {}), ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}) });
  } else {
    await db.orm.public.Appointment.where({ id }).update({ ...(parsed.data.status ? { status: parsed.data.status } : {}), ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}) });
  }

  await db.orm.public.AuditLog.create({ action: 'APPOINTMENT_UPDATED', entity: 'Appointment', entityId: id, actorId: session.sub }).catch(() => undefined);
  return ok({ id });
}
