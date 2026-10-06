import { z } from 'zod';

export const createEmergencySchema = z.object({
  pickupLatitude: z.number().min(-90).max(90),
  pickupLongitude: z.number().min(-180).max(180),
  category: z.enum(['ACCIDENT', 'CARDIAC', 'GENERAL', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  destinationFacilityId: z.string().min(1).optional(),
});

export const acceptAmbulanceSchema = z.object({
  emergencyRequestId: z.string().min(1),
});

export const ambulanceStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRANSPORTING', 'COMPLETED', 'OFFLINE']),
});
