import { z } from 'zod';

export const allocateSchema = z.object({
  requests: z.array(z.object({ id: z.string(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) })),
  candidates: z.array(z.object({ id: z.string(), type: z.enum(['BASIC', 'ADVANCED', 'ICU']), distanceKm: z.number(), status: z.string() })),
});
