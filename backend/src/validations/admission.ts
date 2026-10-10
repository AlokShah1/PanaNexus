import { z } from 'zod';
import { WARD_TYPES } from './healthcare.js';

export const admissionCreateSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient ID is required.'),
  facilityId: z.string().trim().min(1, 'Facility ID is required.'),
  ward: z.enum(WARD_TYPES as unknown as [string, ...string[]]),
  notes: z.string().trim().max(1000).optional(),
});

export const admissionTransferSchema = z.object({
  ward: z.enum(WARD_TYPES as unknown as [string, ...string[]]).optional(),
  facilityId: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(1000).optional(),
});
