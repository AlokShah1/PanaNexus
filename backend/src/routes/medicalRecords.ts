import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { getUser, requireAuth, requireRole, requireVerified } from '../middleware/auth.js';
import { pageMeta, parsePage } from '../lib/pagination.js';
import { medicalRecordSchema } from '../validations/healthcare.js';
import { notify } from '../lib/notify.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const user = getUser(req);
  const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
  let effectivePatientId = patientId;

  if (patientId) {
    if (user.role === 'PATIENT') {
      const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
      if (!patient || patient.id !== patientId) {
        return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
      }
    } else if (user.role === 'DOCTOR') {
      const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
      if (!doctor) {
        return fail(res, 'DOCTOR_NOT_FOUND', 'Create a doctor profile first.', 404);
      }
      const patient = await db.orm.public.Patient.where({ id: patientId }).first();
      if (!patient) {
        return fail(res, 'PATIENT_NOT_FOUND', 'Patient not found.', 404);
      }
      const hasAppointment = await db.orm.public.Appointment.where({
        doctorId: doctor.id,
        patientId: patient.id,
      })
        .first();
      const authored = await db.orm.public.MedicalRecord.where({
        patientId,
        doctorId: doctor.id,
      })
        .first();
      if (!hasAppointment && !authored) {
        return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
      }
    } else if (user.role === 'FACILITY_STAFF') {
      if (!user.facilityId) {
        return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
      }
      const patient = await db.orm.public.Patient.where({ id: patientId }).first();
      if (!patient) {
        return fail(res, 'PATIENT_NOT_FOUND', 'Patient not found.', 404);
      }
      // Check if records for this patient are at staff's facility
      const record = await db.orm.public.MedicalRecord.where({ patientId, facilityId: user.facilityId }).first();
      if (!record) {
        const anyRecord = await db.orm.public.MedicalRecord.where({ patientId }).first();
        if (anyRecord && anyRecord.facilityId !== user.facilityId) {
          return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
        }
      }
    } else if (user.role !== 'ADMIN') {
      return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
    }
  } else {
    if (user.role === 'PATIENT') {
      const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
      if (!patient) {
        return fail(res, 'PATIENT_NOT_FOUND', 'Create a patient profile first.', 404);
      }
      effectivePatientId = patient.id;
    } else if (user.role === 'FACILITY_STAFF') {
      if (!user.facilityId) {
        return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
      }
    } else if (user.role !== 'ADMIN') {
      return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
    }
  }

  const p = parsePage(req.query as Record<string, unknown>, 20, 100);
  const whereClause: any = effectivePatientId ? { patientId: effectivePatientId } : {};
  if (user.role === 'FACILITY_STAFF' && !effectivePatientId) {
    whereClause.facilityId = user.facilityId;
  }

  const rows = await db.orm.public.MedicalRecord.where(whereClause)
    .include('doctor')
    .include('patient', (p: any) => p.include('user'))
    .orderBy((x) => x.createdAt.desc())
    .offset(p.offset)
    .limit(p.limit)
    .all();

  const total = await db.orm.public.MedicalRecord.where(whereClause)
    .aggregate((a) => ({ total: a.count() }));

  const items = await Promise.all(
    rows.map(async (r) => {
      let doctorInfo = null;
      if (r.doctor) {
        const d = await db.orm.public.Doctor.where({ id: r.doctor.id }).include('user').first();
        doctorInfo = {
          id: d?.id ?? r.doctor.id,
          name: d?.user?.name ?? null,
          specialization: d?.specialization ?? null,
        };
      }
      return {
        id: r.id,
        recordType: r.recordType,
        diagnosis: r.diagnosis,
        treatment: r.treatment,
        notes: r.notes,
        prescriptions: r.prescriptions,
        attachments: r.attachments,
        facilityId: r.facilityId,
        createdAt: r.createdAt,
        doctor: doctorInfo,
        patient: r.patient
          ? { id: (r.patient as any).id, name: (r.patient as any).user?.name ?? null }
          : null,
      };
    }),
  );

  return ok(res, { items, meta: pageMeta(p, total.total) });
});

router.get('/:id', requireAuth, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const record = await db.orm.public.MedicalRecord.where({ id }).first();
  if (!record) {
    return fail(res, 'NOT_FOUND', 'Medical record not found.', 404);
  }

  const patientId = record.patientId;
  if (user.role === 'PATIENT') {
    const patient = await db.orm.public.Patient.where({ userId: user.id }).first();
    if (!patient || patient.id !== patientId) {
      return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
    }
  } else if (user.role === 'DOCTOR') {
    const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
    if (!doctor) {
      return fail(res, 'DOCTOR_NOT_FOUND', 'Create a doctor profile first.', 404);
    }
    const hasAppointment = await db.orm.public.Appointment.where({
      doctorId: doctor.id,
      patientId: patientId,
    })
      .first();
    const authored = record.doctorId === doctor.id;
    if (!hasAppointment && !authored) {
      return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
    }
  } else if (user.role === 'FACILITY_STAFF') {
    if (!user.facilityId || record.facilityId !== user.facilityId) {
      return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
    }
  } else if (user.role !== 'ADMIN') {
    return fail(res, 'FORBIDDEN', 'You cannot view these records.', 403);
  }

  let doctorInfo = null;
  if (record.doctorId) {
    const d = await db.orm.public.Doctor.where({ id: record.doctorId }).include('user').first();
    doctorInfo = {
      id: d?.id ?? record.doctorId,
      name: d?.user?.name ?? null,
      specialization: d?.specialization ?? null,
    };
  }

  return ok(res, {
    id: record.id,
    recordType: record.recordType,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    notes: record.notes,
    prescriptions: record.prescriptions,
    attachments: record.attachments,
    facilityId: record.facilityId,
    createdAt: record.createdAt,
    doctor: doctorInfo,
  });
});

router.post('/', requireAuth, requireRole('DOCTOR'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const parsed = medicalRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
  if (!doctor) {
    return fail(res, 'DOCTOR_NOT_FOUND', 'Create a doctor profile first.', 404);
  }
  const patient = await db.orm.public.Patient.where({ id: parsed.data.patientId }).first();
  if (!patient) {
    return fail(res, 'PATIENT_NOT_FOUND', 'Patient not found.', 404);
  }
  const record = await db.orm.public.MedicalRecord.create({
    patientId: patient.id,
    doctorId: doctor.id,
    facilityId: doctor.facilityId,
    recordType: parsed.data.recordType,
    diagnosis: parsed.data.diagnosis ?? null,
    treatment: parsed.data.treatment ?? null,
    notes: parsed.data.notes ?? null,
    prescriptions: parsed.data.prescriptions ?? [],
    attachments: parsed.data.attachments ?? [],
  });
  await db.orm.public.AuditLog.create({
    action: 'MEDICAL_RECORD_CREATED',
    entity: 'MedicalRecord',
    entityId: record.id,
    actorId: user.id,
  }).catch(() => undefined);
  await notify(patient.userId, {
    type: 'MEDICAL_RECORD',
    title: 'New medical record',
    body: 'A doctor added a record to your file.',
    link: '/dashboard',
  });
  return ok(res, { id: record.id }, 201);
});

router.patch('/:id', requireAuth, requireRole('DOCTOR', 'ADMIN'), requireVerified, async (req, res) => {
  const user = getUser(req);
  const { id } = req.params;
  const record = await db.orm.public.MedicalRecord.where({ id }).first();
  if (!record) {
    return fail(res, 'NOT_FOUND', 'Medical record not found.', 404);
  }

  if (user.role !== 'ADMIN') {
    const doctor = await db.orm.public.Doctor.where({ userId: user.id }).first();
    if (!doctor || record.doctorId !== doctor.id) {
      return fail(res, 'FORBIDDEN', 'You cannot modify this record.', 403);
    }
  }

  const parsed = medicalRecordSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }

  await db.orm.public.MedicalRecord.where({ id }).update({
    diagnosis: parsed.data.diagnosis !== undefined ? (parsed.data.diagnosis ?? null) : record.diagnosis,
    treatment: parsed.data.treatment !== undefined ? (parsed.data.treatment ?? null) : record.treatment,
    notes: parsed.data.notes !== undefined ? (parsed.data.notes ?? null) : record.notes,
    recordType: parsed.data.recordType ?? record.recordType,
    prescriptions: parsed.data.prescriptions !== undefined ? parsed.data.prescriptions : record.prescriptions,
    attachments: parsed.data.attachments !== undefined ? parsed.data.attachments : record.attachments,
  });

  const updated = await db.orm.public.MedicalRecord.where({ id }).first();
  await db.orm.public.AuditLog.create({
    action: 'MEDICAL_RECORD_UPDATED',
    entity: 'MedicalRecord',
    entityId: id,
    actorId: user.id,
  }).catch(() => undefined);

  let doctorInfo = null;
  if (updated?.doctorId) {
    const d = await db.orm.public.Doctor.where({ id: updated.doctorId }).include('user').first();
    doctorInfo = {
      id: d?.id ?? updated.doctorId,
      name: d?.user?.name ?? null,
      specialization: d?.specialization ?? null,
    };
  }

  return ok(res, {
    id: updated?.id,
    recordType: updated?.recordType,
    diagnosis: updated?.diagnosis,
    treatment: updated?.treatment,
    notes: updated?.notes,
    prescriptions: updated?.prescriptions,
    attachments: updated?.attachments,
    facilityId: updated?.facilityId,
    createdAt: updated?.createdAt,
    doctor: doctorInfo,
  });
});

export default router;
