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
  operatingHours: z.string().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  services: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  emergencyAvailable: z.boolean().default(false),
});

export const medicalRecordSchema = z.object({
  patientId: z.string().min(1),
  recordType: z.enum(['CONSULTATION', 'PRESCRIPTION', 'LAB_RESULT', 'IMAGING', 'VACCINATION', 'OTHER']).default('CONSULTATION'),
  diagnosis: z.string().max(500).optional(),
  treatment: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  prescriptions: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  attachments: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
});

export const availabilitySlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  slotMinutes: z.number().int().min(5).max(240).default(30),
});

export const availabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).min(1).max(21),
});

export const WARD_TYPES = [
  'GENERAL',
  'ICU',
  'PEDIATRIC',
  'MATERNITY',
  'EMERGENCY',
  'SURGICAL',
  'ISOLATION',
  'OTHER',
] as const;

export const bedCapacitySchema = z
  .object({
    ward: z.enum(WARD_TYPES),
    label: z.string().trim().max(80).optional(),
    totalBeds: z.number().int().min(0).max(10000),
    occupiedBeds: z.number().int().min(0).max(10000).default(0),
  })
  .refine((v) => v.occupiedBeds <= v.totalBeds, {
    message: 'Occupied beds cannot exceed total beds.',
    path: ['occupiedBeds'],
  });

export const MAX_MESSAGE_LENGTH = 2000;

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty.').max(MAX_MESSAGE_LENGTH, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`),
});

export const startConversationSchema = z
  .object({
    doctorId: z.string().min(1).optional(),
    patientId: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.doctorId) !== Boolean(v.patientId), {
    message: 'Provide exactly one of doctorId or patientId.',
  });
