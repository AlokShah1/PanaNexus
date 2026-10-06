import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { medicalRecordSchema } from '../validations/healthcare';

const router = Router();

router.get('/', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
  if (!patientId) return fail(res, 'VALIDATION_ERROR', 'patientId is required.', 422);
  if (session.role === 'PATIENT') {
    const patient = await db.orm.public.Patient.where({ userId: session.sub }).first();
    if (!patient || patient.id !== patientId) return fail(res, 'FORBIDDEN', 'Cannot view these records.', 403);
  } else if (session.role !== 'DOCTOR' && session.role !== 'ADMIN') {
    return fail(res, 'FORBIDDEN', 'Cannot view these records.', 403);
  }
  const rows = await db.orm.public.MedicalRecord.where({ patientId }).include('doctor').all();
  return ok(res, rows.map((r) => ({ id: r.id, diagnosis: r.diagnosis, treatment: r.treatment, notes: r.notes, createdAt: r.createdAt, doctor: r.doctor })));
});

router.post('/', async (req, res) => {
  const session = getSession(req);
  if (!session || session.role !== 'DOCTOR') return fail(res, 'FORBIDDEN', 'Only doctors can create medical records.', 403);
  const parsed = medicalRecordSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const doctor = await db.orm.public.Doctor.where({ userId: session.sub }).first();
  if (!doctor) return fail(res, 'DOCTOR_NOT_FOUND', 'Create a doctor profile first.', 404);
  const patient = await db.orm.public.Patient.where({ id: parsed.data.patientId }).first();
  if (!patient) return fail(res, 'PATIENT_NOT_FOUND', 'Patient not found.', 404);
  const record = await db.orm.public.MedicalRecord.create({ patientId: patient.id, doctorId: doctor.id, diagnosis: parsed.data.diagnosis ?? null, treatment: parsed.data.treatment ?? null, notes: parsed.data.notes ?? null });
  await db.orm.public.AuditLog.create({ action: 'MEDICAL_RECORD_CREATED', entity: 'MedicalRecord', entityId: record.id, actorId: session.sub }).catch(() => undefined);
  return ok(res, { id: record.id }, 201);
});

export default router;
