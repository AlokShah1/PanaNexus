import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getSession } from '../lib/auth.js';
import { slotTaken } from '../lib/appointments.js';
import { createAppointmentSchema, updateAppointmentSchema } from '../validations/healthcare.js';

const router = Router();

router.get('/', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role === 'PATIENT') {
    const patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
    if (!patient) return ok(res, []);
    const rows = await db.orm.public.Appointment.where({ patientId: patient.id }).include('doctor').include('facility').all();
    return ok(res, rows.map((r) => ({ id: r.id, startsAt: r.startsAt, status: r.status, notes: r.notes, doctor: r.doctor, facility: r.facility })));
  }
  if (session.role === 'DOCTOR') {
    const doctor = await db.orm.public.Doctor.where({ userId: session.sub }).first();
    if (!doctor) return ok(res, []);
    const rows = await db.orm.public.Appointment.where({ doctorId: doctor.id }).include('patient').include('facility').all();
    return ok(res, rows.map((r) => ({ id: r.id, startsAt: r.startsAt, status: r.status, notes: r.notes, patient: r.patient, facility: r.facility })));
  }
  const rows = await db.orm.public.Appointment.include('doctor').include('patient').include('facility').all();
  return ok(res, rows.slice(0, 100).map((r) => ({ id: r.id, startsAt: r.startsAt, status: r.status, notes: r.notes, patient: r.patient, doctor: r.doctor, facility: r.facility })));
});

router.post('/', async (req, res) => {
  const session = getSession(req);
  if (!session || session.role !== 'PATIENT') return fail(res, 'FORBIDDEN', 'Only patients can book appointments.', 403);
  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const doctor = await db.orm.public.Doctor.where({ id: parsed.data.doctorId }).first();
  if (!doctor) return fail(res, 'DOCTOR_NOT_FOUND', 'Doctor not found.', 404);
  if (parsed.data.facilityId) {
    const facility = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!facility) return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }
  let patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
  if (!patient) patient = await db.orm.public.Patient.create({ userId: session.sub });
  const startsAt = new Date(parsed.data.startsAt).toISOString();
  const existing = await db.orm.public.Appointment.where({ doctorId: doctor.id }).all();
  if (slotTaken(existing.map((e) => ({ startsAt: e.startsAt, status: e.status })), startsAt)) {
    return fail(res, 'APPOINTMENT_CONFLICT', 'This appointment slot is no longer available.', 409);
  }
  const appointment = await db.orm.public.Appointment.create({
    patientId: patient.id, doctorId: doctor.id, facilityId: parsed.data.facilityId ?? null, startsAt, notes: parsed.data.notes ?? null,
  });
  await db.orm.public.AuditLog.create({ action: 'APPOINTMENT_BOOKED', entity: 'Appointment', entityId: appointment.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { id: appointment.id, status: appointment.status, startsAt: appointment.startsAt }, 201);
});

router.patch('/:id', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const { id } = req.params;
  const parsed = updateAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const appointment = await db.orm.public.Appointment.where({ id }).first();
  if (!appointment) return fail(res, 'NOT_FOUND', 'Appointment not found.', 404);
  const patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
  const doctor = await db.orm.public.Doctor.where({ userId: session.sub }).first();
  const isOwner = patient?.id === appointment.patientId || doctor?.id === appointment.doctorId || session.role === 'ADMIN';
  if (!isOwner) return fail(res, 'FORBIDDEN', 'You cannot modify this appointment.', 403);
  if (parsed.data.startsAt) {
    const startsAt = new Date(parsed.data.startsAt).toISOString();
    const existing = await db.orm.public.Appointment.where({ doctorId: appointment.doctorId }).all();
    if (slotTaken(existing.filter((e) => e.id !== id).map((e) => ({ startsAt: e.startsAt, status: e.status })), startsAt)) {
      return fail(res, 'APPOINTMENT_CONFLICT', 'This appointment slot is no longer available.', 409);
    }
    await db.orm.public.Appointment.where({ id }).update({ startsAt, ...(parsed.data.status ? { status: parsed.data.status } : {}), ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}) });
  } else {
    await db.orm.public.Appointment.where({ id }).update({ ...(parsed.data.status ? { status: parsed.data.status } : {}), ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}) });
  }
  await db.orm.public.AuditLog.create({ action: 'APPOINTMENT_UPDATED', entity: 'Appointment', entityId: id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { id });
});

export default router;
