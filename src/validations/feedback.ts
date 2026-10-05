import { z } from 'zod';

export const feedbackSchema = z.object({
  facilityId: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const notificationCreateSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional(),
});
