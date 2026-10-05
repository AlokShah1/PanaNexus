import { z } from 'zod';

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date-time');

export const createAppointmentSchema = z.object({
  doctorId: z.string().min(1),
  facilityId: z.string().min(1).optional(),
  startsAt: isoDateTime,
  notes: z.string().max(500).optional(),
});

export const updateAppointmentSchema = z.object({
  startsAt: isoDateTime.optional(),
  status: z.enum(['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  notes: z.string().max(500).optional(),
});

export const patientProfileSchema = z.object({
  phone: z.string().max(40).optional(),
  dateOfBirth: isoDateTime.optional(),
  bloodGroup: z.string().max(5).optional(),
  address: z.string().max(200).optional(),
});

export const doctorProfileSchema = z.object({
  specialization: z.string().max(80).optional(),
  licenseNumber: z.string().max(60).optional(),
  bio: z.string().max(500).optional(),
  facilityId: z.string().min(1).optional(),
});

export const facilitySchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(['HOSPITAL', 'HEALTH_POST']),
  address: z.string().min(4).max(200),
  phone: z.string().max(40).optional(),
  operatingHours: z.string().max(120).optional(),
});

export const medicalRecordSchema = z.object({
  patientId: z.string().min(1),
  diagnosis: z.string().max(500).optional(),
  treatment: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
