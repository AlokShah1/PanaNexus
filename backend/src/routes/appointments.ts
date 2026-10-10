import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getUser, requireAuth, requireRole, requireVerified } from '../middleware/auth.js';
import { slotTaken, isUniqueViolation } from '../lib/appointments.js';
import { createAppointmentSchema, updateAppointmentSchema, availabilitySchema } from '../validations/healthcare.js';
import { notify } from '../lib/notify.js';
import { pageMeta, parsePage } from '../lib/pagination.js';
import { istNow, istWallClockToUtc } from '../lib/hours.js';

const router = Router();

function getIstDateKey(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) {
    return istNow().day;
  }
  return istNow(d).day;
}

/**
 * A requested start time is bookable when it aligns with one of the doctor's
 * published IST consultation ranges for that weekday. Doctors with no published
 * availability accept any time (self-service).
 */
async function isSlotWithinAvailability(doctorId: string, startsAtDate: Date): Promise<boolean> {
  const weekday = istNow(startsAtDate).day;
  const availability = await db.orm.public.DoctorAvailability.where({ doctorId, weekday }).all();
  if (availability.length === 0) return true;
  const startMin = istNow(startsAtDate).minutes;
  return availability.some((av: any) => {
    const aligned = (startMin - av.startMinute) % av.slotMinutes === 0;
    return startMin >= av.startMinute && startMin < av.endMinute && aligned;
  });
}

router.get('/', requireAuth, async (req, res) => {
  const user = getUser(req);
  const p = parsePage(req.query as Record<string, unknown>, 20, 100);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  if (user.role === 'PATIENT') {
    const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
    if (patient) {
      const rows = await db.orm.public.Appointment.where({ patientId: patient.id })
        .include('doctor', (d: any) => d.include('user'))
        .include('patient', (p: any) => p.include('user'))
        .include('facility')
        .all();
      let filtered = rows;
      if (status) filtered = filtered.filter((r: any) => r.status === status);
      filtered.sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      const sliced = filtered.slice(p.offset, p.offset + p.limit);
      const items = sliced.map((r: any) => ({
        id: r.id,
        startsAt: r.startsAt,
        status: r.status,
        notes: r.notes,
        doctor: r.doctor
          ? {
              id: r.doctor.id,
              name: r.doctor.user?.name ?? null,
              specialization: r.doctor.specialization,
            }
          : null,
        patient: r.patient ? { id: r.patient.id, name: r.patient.user?.name ?? null } : null,
        facility: r.facility ? { id: r.facility.id, name: r.facility.name } : null,
      }));
      const total = filtered.length;
      return ok(res, { items, meta: pageMeta(p, total) });
    }
    return ok(res, { items: [], meta: pageMeta(p, 0) });
  }

  if (user.role === 'DOCTOR') {
    const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
    if (doctor) {
      const rows = await db.orm.public.Appointment.where({ doctorId: doctor.id })
        .include('doctor', (d: any) => d.include('user'))
        .include('patient', (p: any) => p.include('user'))
        .include('facility')
        .all();
      let filtered = rows;
      if (status) filtered = filtered.filter((r: any) => r.status === status);
      filtered.sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
      const sliced = filtered.slice(p.offset, p.offset + p.limit);
      const items = sliced.map((r: any) => ({
        id: r.id,
        startsAt: r.startsAt,
        status: r.status,
        notes: r.notes,
        doctor: r.doctor
          ? {
              id: r.doctor.id,
              name: r.doctor.user?.name ?? null,
              specialization: r.doctor.specialization,
            }
          : null,
        patient: r.patient ? { id: r.patient.id, name: r.patient.user?.name ?? null } : null,
        facility: r.facility ? { id: r.facility.id, name: r.facility.name } : null,
      }));
      const total = filtered.length;
      return ok(res, { items, meta: pageMeta(p, total) });
    }
    return ok(res, { items: [], meta: pageMeta(p, 0) });
  }

  if (user.role === 'FACILITY_STAFF') {
    if (!user.facilityId) {
      return fail(res, 'FORBIDDEN', 'You must be linked to a facility.', 403);
    }
    const rows = await db.orm.public.Appointment.where({ facilityId: user.facilityId })
      .include('doctor', (d: any) => d.include('user'))
      .include('patient', (p: any) => p.include('user'))
      .include('facility')
      .all();
    let filtered = rows;
    if (status) filtered = filtered.filter((r: any) => r.status === status);
    filtered.sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    const sliced = filtered.slice(p.offset, p.offset + p.limit);
    const items = sliced.map((r: any) => ({
      id: r.id,
      startsAt: r.startsAt,
      status: r.status,
      notes: r.notes,
      doctor: r.doctor
        ? {
            id: r.doctor.id,
            name: r.doctor.user?.name ?? null,
            specialization: r.doctor.specialization,
          }
        : null,
      patient: r.patient ? { id: r.patient.id, name: r.patient.user?.name ?? null } : null,
      facility: r.facility ? { id: r.facility.id, name: r.facility.name } : null,
    }));
    const total = filtered.length;
    return ok(res, { items, meta: pageMeta(p, total) });
  }

  // Every other role (donors, operators, etc.) must not enumerate appointments.
  if (user.role !== 'ADMIN') {
    return ok(res, { items: [], meta: pageMeta(p, 0) });
  }

  const rows = await db.orm.public.Appointment.include('doctor', (d: any) => d.include('user')).include('patient', (p: any) => p.include('user')).include('facility').all();
  let filtered = rows;
  if (status) filtered = filtered.filter((r: any) => r.status === status);
  filtered.sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const sliced = filtered.slice(p.offset, p.offset + p.limit);
  const items = sliced.map((r: any) => ({
    id: r.id,
    startsAt: r.startsAt,
    status: r.status,
    notes: r.notes,
    doctor: r.doctor
      ? {
          id: r.doctor.id,
          name: r.doctor.user?.name ?? null,
          specialization: r.doctor.specialization,
        }
      : null,
    patient: r.patient ? { id: r.patient.id, name: r.patient.user?.name ?? null } : null,
    facility: r.facility ? { id: r.facility.id, name: r.facility.name } : null,
  }));
  const total = filtered.length;
  return ok(res, { items, meta: pageMeta(p, total) });
});

router.get('/slots', async (req, res) => {
  const doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : undefined;
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  if (!doctorId || !date) {
    return fail(res, 'VALIDATION_ERROR', 'doctorId and date are required.', 422);
  }
  const doctor = await db.orm.public.Doctor.where({ id: doctorId }).first();
  if (!doctor) return fail(res, 'DOCTOR_NOT_FOUND', 'Doctor not found.', 404);
  const weekday = getIstDateKey(date);
  const availability = await db.orm.public.DoctorAvailability.where({ doctorId, weekday }).all();
  const slots: Array<{ startsAt: string; endsAt: string }> = [];
  if (availability.length === 0) {
    return ok(res, { doctorId, date, slots: [] });
  }
  const allAppts = await db.orm.public.Appointment.where({ doctorId }).all();
  const bookedMinuteStarts = allAppts
    .filter((a: any) => a.status === 'REQUESTED' || a.status === 'CONFIRMED')
    .filter((a: any) => istNow(new Date(a.startsAt)).day === weekday)
    .map((a: any) => istNow(new Date(a.startsAt)).minutes);

  const [y, mo, da] = date.split('-');
  const baseYear = Number(y);
  const baseMonth = Number(mo) - 1;
  const baseDay = Number(da);

  for (const av of availability.sort((a: any, b: any) => a.startMinute - b.startMinute)) {
    let m = av.startMinute;
    const slotMin = av.slotMinutes;
    while (m + slotMin <= av.endMinute) {
      if (!bookedMinuteStarts.includes(m)) {
        const startD = istWallClockToUtc(baseYear, baseMonth, baseDay, m);
        const endD = new Date(startD.getTime() + slotMin * 60000);
        slots.push({ startsAt: startD.toISOString(), endsAt: endD.toISOString() });
      }
      m += slotMin;
    }
  }
  return ok(res, { doctorId, date, slots });
});

router.get('/availability', async (req, res) => {
  const doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : undefined;
  if (!doctorId) return fail(res, 'VALIDATION_ERROR', 'doctorId is required.', 422);
  const doctor = await db.orm.public.Doctor.where({ id: doctorId }).first();
  if (!doctor) return fail(res, 'NOT_FOUND', 'Doctor not found.', 404);
  const rows = await db.orm.public.DoctorAvailability.where({ doctorId }).all();
  rows.sort((a: any, b: any) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.endMinute - b.endMinute;
  });
  return ok(res, rows.map((r: any) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute, slotMinutes: r.slotMinutes })));
});

router.post('/', requireAuth, requireRole('PATIENT'), async (req, res) => {
  const user = getUser(req);
  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const doctor = await db.orm.public.Doctor.where({ id: parsed.data.doctorId }).include('user').first();
  if (!doctor) return fail(res, 'DOCTOR_NOT_FOUND', 'Doctor not found.', 404);
  if ((doctor as any).user?.verificationStatus !== 'VERIFIED') {
    return fail(res, 'VERIFICATION_REQUIRED', 'This doctor is not verified yet.', 403);
  }
  if (parsed.data.facilityId) {
    const facility = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!facility) return fail(res, 'FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }
  const facilityId = parsed.data.facilityId ?? (doctor as any).facilityId ?? null;
  const startsAtDate = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAtDate.getTime()) || startsAtDate.getTime() < Date.now()) {
    return fail(res, 'VALIDATION_ERROR', 'Pick a future time.', 422);
  }
  let patient: any = await db.orm.public.Patient.where({ userId: user.id }).include('user').first();
  if (!patient) patient = await db.orm.public.Patient.create({ userId: user.id });
  const startsAt = startsAtDate.toISOString();
  if (!(await isSlotWithinAvailability(doctor.id, startsAtDate))) {
    return fail(res, 'OUTSIDE_HOURS', 'That time is outside the doctor’s consultation hours.', 409);
  }
  const existing = await db.orm.public.Appointment.where({ doctorId: doctor.id }).all();
  if (slotTaken(existing.map((e: any) => ({ startsAt: e.startsAt, status: e.status })), startsAt)) {
    return fail(res, 'APPOINTMENT_CONFLICT', 'This appointment slot is no longer available.', 409);
  }
  let appointment: any;
  try {
    appointment = await db.orm.public.Appointment.create({
      patientId: patient.id,
      doctorId: doctor.id,
      facilityId,
      startsAt,
      notes: parsed.data.notes ?? null,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail(res, 'APPOINTMENT_CONFLICT', 'This appointment slot is no longer available.', 409);
    }
    throw err;
  }
  await db.orm.public.AuditLog.create({ action: 'APPOINTMENT_BOOKED', entity: 'Appointment', entityId: appointment.id, actorId: user.id }).catch(() => undefined);
  const patientName = (patient as any).user?.name ?? 'A patient';
  const timeStr = startsAtDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  if ((doctor as any).userId) {
    await notify((doctor as any).userId, {
      type: 'APPOINTMENT',
      title: 'New appointment request',
      body: `${patientName} requested ${timeStr}`,
      link: '/doctor',
    }).catch(() => undefined);
  }
  return ok(res, { id: appointment.id, status: appointment.status, startsAt: appointment.startsAt }, 201);
});

router.get('/availability', requireAuth, async (req, res) => {
  const user = getUser(req);
  // A doctor reads their own saved availability; anyone may read a doctor's by id.
  let doctorId = typeof req.query.doctorId === 'string' ? req.query.doctorId : undefined;
  if (!doctorId && user.role === 'DOCTOR') {
    const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
    doctorId = (doctor as any)?.id;
  }
  if (!doctorId) return fail(res, 'VALIDATION_ERROR', 'doctorId is required.', 422);
  const doctor = await db.orm.public.Doctor.where({ id: doctorId }).first();
  if (!doctor) return fail(res, 'NOT_FOUND', 'Doctor not found.', 404);
  const rows = await db.orm.public.DoctorAvailability.where({ doctorId }).all();
  rows.sort((a: any, b: any) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.endMinute - b.endMinute;
  });
  return ok(res, rows.map((r: any) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute, slotMinutes: r.slotMinutes })));
});

router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const user = getUser(req);
  const appointment = await db.orm.public.Appointment.where({ id })
    .include('doctor', (d: any) => d.include('user'))
    .include('patient', (p: any) => p.include('user'))
    .include('facility')
    .first();
  if (!appointment) return fail(res, 'NOT_FOUND', 'Appointment not found.', 404);
  const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
  const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
  const isOwner =
    (patient as any)?.id === (appointment as any).patientId ||
    (doctor as any)?.id === (appointment as any).doctorId ||
    user.role === 'ADMIN' ||
    (user.role === 'FACILITY_STAFF' && user.facilityId === (appointment as any).facilityId);
  if (!isOwner) return fail(res, 'FORBIDDEN', 'You cannot view this appointment.', 403);
  return ok(res, appointment);
});

router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const user = getUser(req);
  const parsed = updateAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const appointment: any = await db.orm.public.Appointment.where({ id })
    .include('doctor', (d: any) => d.include('user'))
    .include('patient', (p: any) => p.include('user'))
    .first();
  if (!appointment) return fail(res, 'NOT_FOUND', 'Appointment not found.', 404);
  const patient: any = await db.orm.public.Patient.where({ userId: user.id }).first();
  const doctor: any = await db.orm.public.Doctor.where({ userId: user.id }).first();
  const isOwner =
    patient?.id === appointment.patientId ||
    doctor?.id === appointment.doctorId ||
    user.role === 'ADMIN' ||
    (user.role === 'FACILITY_STAFF' && user.facilityId === appointment.facilityId);
  if (!isOwner) return fail(res, 'FORBIDDEN', 'You cannot modify this appointment.', 403);

  const updates: any = {};
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.status && parsed.data.status !== appointment.status) {
    const cur = appointment.status as string;
    const next = parsed.data.status as string;
    const isDoctor = user.role === 'DOCTOR' || doctor?.id === appointment.doctorId;
    const isPatient = user.role === 'PATIENT' || patient?.id === appointment.patientId;
    let allowed: boolean;
    if (user.role === 'ADMIN') {
      allowed = true;
    } else if (isPatient) {
      allowed = next === 'CANCELLED' && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(cur);
    } else if (isDoctor) {
      allowed =
        (cur === 'REQUESTED' && ['CONFIRMED', 'CANCELLED'].includes(next)) ||
        (cur === 'CONFIRMED' && ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(next));
    } else if (user.role === 'FACILITY_STAFF') {
      allowed =
        (cur === 'REQUESTED' && ['CONFIRMED', 'CANCELLED'].includes(next)) ||
        (cur === 'CONFIRMED' && ['CANCELLED', 'COMPLETED'].includes(next));
    } else {
      allowed = false;
    }
    if (!allowed) {
      return fail(res, 'INVALID_TRANSITION', 'That status change is not allowed for your account.', 422);
    }
    updates.status = next;
  }
  if (parsed.data.startsAt) {
    const startsAtDate = new Date(parsed.data.startsAt);
    if (Number.isNaN(startsAtDate.getTime()) || startsAtDate.getTime() < Date.now()) {
      return fail(res, 'VALIDATION_ERROR', 'Pick a future time.', 422);
    }
    if (!(await isSlotWithinAvailability(appointment.doctorId, startsAtDate))) {
      return fail(res, 'OUTSIDE_HOURS', 'That time is outside the doctor’s consultation hours.', 409);
    }
    const startsAt = startsAtDate.toISOString();
    const existing = await db.orm.public.Appointment.where({ doctorId: appointment.doctorId }).all();
    if (slotTaken(existing.filter((e: any) => e.id !== id).map((e: any) => ({ startsAt: e.startsAt, status: e.status })), startsAt)) {
      return fail(res, 'APPOINTMENT_CONFLICT', 'This appointment slot is no longer available.', 409);
    }
    updates.startsAt = startsAt;
  }
  try {
    await db.orm.public.Appointment.where({ id }).update(updates);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail(res, 'APPOINTMENT_CONFLICT', 'This appointment slot is no longer available.', 409);
    }
    throw err;
  }
  await db.orm.public.AuditLog.create({ action: 'APPOINTMENT_UPDATED', entity: 'Appointment', entityId: id, actorId: user.id }).catch(() => undefined);

  try {
    if (user.role === 'DOCTOR' || doctor?.id === appointment.doctorId) {
      if (appointment.patient?.userId) {
        await notify(appointment.patient.userId, {
          type: 'APPOINTMENT',
          title: 'Appointment updated',
          body: 'Your appointment was updated',
          link: '/dashboard',
        });
      }
    } else if (user.role === 'PATIENT' || patient?.id === appointment.patientId) {
      if (appointment.doctor?.userId) {
        await notify(appointment.doctor.userId, {
          type: 'APPOINTMENT',
          title: 'Appointment updated',
          body: 'An appointment was updated/cancelled',
          link: '/doctor',
        });
      }
    }
  } catch {}

  return ok(res, { id });
});

router.post('/availability', requireAuth, requireRole('DOCTOR', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  let doctorId = '';
  if (user.role === 'DOCTOR') {
    const d: any = await db.orm.public.Doctor.where({ userId: user.id }).first();
    if (!d) return fail(res, 'DOCTOR_NOT_FOUND', 'Create a doctor profile first.', 404);
    doctorId = d.id;
  } else {
    const d: any = await db.orm.public.Doctor.where({ userId: user.id }).first();
    if (d) doctorId = d.id;
    else doctorId = user.id;
  }
  const slots = parsed.data.slots;
  for (const s of slots) {
    if (s.startMinute >= s.endMinute) {
      return fail(res, 'VALIDATION_ERROR', 'startMinute must be less than endMinute.', 422);
    }
  }
  const existingAv = await db.orm.public.DoctorAvailability.where({ doctorId }).all();
  for (const ea of existingAv) {
    await db.orm.public.DoctorAvailability.where({ id: ea.id }).delete().catch(() => {});
  }
  for (const s of slots) {
    await db.orm.public.DoctorAvailability.create({
      doctorId,
      weekday: s.weekday,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
      slotMinutes: s.slotMinutes,
    });
  }
  await db.orm.public.AuditLog.create({ action: 'AVAILABILITY_UPDATED', entity: 'DoctorAvailability', entityId: doctorId, actorId: user.id }).catch(() => undefined);
  return ok(res, { slots });
});

export default router;
