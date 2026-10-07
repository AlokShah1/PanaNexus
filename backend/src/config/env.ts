import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  RATE_LIMIT: z.coerce.number().int().positive().default(900),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ADMIN_EMAIL: z.string().email().default('pananexusadmin@gmail.com'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  UPLOAD_DIR: z.string().default('uploads'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid backend environment:', parsed.error.issues[0]?.message ?? 'unknown');
  throw new Error('Backend env validation failed');
}
export const env = parsed.data;
