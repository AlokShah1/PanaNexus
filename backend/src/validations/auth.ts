import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(160),
    password: z.string().min(8).max(128),
    role: z
      .enum(['PATIENT', 'DOCTOR', 'FACILITY_STAFF', 'AMBULANCE_OPERATOR', 'BLOOD_DONOR', 'ORGAN_DONOR'])
      .default('PATIENT'),
    phone: z.string().trim().max(30).optional(),
    specialization: z.string().trim().max(80).optional(),
    licenseNumber: z.string().trim().max(60).optional(),
    bio: z.string().trim().max(500).optional(),
    facilityName: z.string().trim().max(120).optional(),
    facilityAddress: z.string().trim().max(240).optional(),
    facilityPhone: z.string().trim().max(30).optional(),
    facilityType: z.enum(['HOSPITAL', 'HEALTH_POST']).optional(),
    operatingHours: z.string().trim().max(300).optional(),
    driverName: z.string().trim().max(60).optional(),
    driverPhone: z.string().trim().max(30).optional(),
  })
  .refine((d) => d.role !== 'DOCTOR' || (d.licenseNumber && d.licenseNumber.length >= 3), {
    message: 'License number is required for doctors.',
    path: ['licenseNumber'],
  })
  .refine((d) => d.role !== 'DOCTOR' || (d.specialization && d.specialization.length >= 2), {
    message: 'Specialization is required for doctors.',
    path: ['specialization'],
  })
  .refine((d) => d.role !== 'FACILITY_STAFF' || (d.facilityName && d.facilityName.length >= 2), {
    message: 'Facility name is required.',
    path: ['facilityName'],
  })
  .refine((d) => d.role !== 'FACILITY_STAFF' || (d.facilityAddress && d.facilityAddress.length >= 3), {
    message: 'Facility address is required.',
    path: ['facilityAddress'],
  })
  .refine((d) => d.role !== 'AMBULANCE_OPERATOR' || (d.driverName && d.driverName.length >= 2), {
    message: 'Driver name is required for ambulance providers.',
    path: ['driverName'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
