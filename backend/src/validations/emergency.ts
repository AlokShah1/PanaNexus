import { z } from 'zod';

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date');

export const createEmergencySchema = z.object({
  pickupLatitude: z.number().min(-90).max(90),
  pickupLongitude: z.number().min(-180).max(180),
  pickupAccuracy: z.number().min(0).max(10000).optional(),
  pickupObtainedAt: isoDate.optional(),
  pickupAddress: z.string().trim().max(300).optional(),
  destinationFacilityId: z.string().min(1).optional(),
  destinationAddress: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
  category: z.enum(['MEDICAL', 'ACCIDENT', 'INJURY', 'PREGNANCY', 'BREATHING', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});

export const cancelEmergencySchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const acceptAmbulanceSchema = z.object({
  emergencyRequestId: z.string().min(1),
});

export const ambulanceStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRANSPORTING', 'COMPLETED', 'OFFLINE']),
});

export const ambulanceLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10000).optional(),
  timestamp: isoDate.optional(),
});

export const cancelSimulationSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
