import { z } from 'zod';

export const bloodDonorProfileSchema = z.object({
  bloodGroup: z.string().min(1).max(5),
  isAvailable: z.boolean().default(true),
  lastDonationDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date').optional(),
});

export const organDonorProfileSchema = z.object({
  organs: z.array(z.string().min(1)).min(1),
  consent: z.boolean(),
  status: z.enum(['PLEDGED', 'VERIFIED', 'INACTIVE']).optional(),
});

export const bloodRequestSchema = z.object({
  bloodGroup: z.string().min(1).max(5),
  units: z.number().int().positive().max(1000),
  facilityId: z.string().min(1).optional(),
});
