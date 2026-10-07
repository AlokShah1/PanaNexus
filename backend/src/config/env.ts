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
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  ADMIN_EMAIL: z.string().email().default('pananexusadmin@gmail.com'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  UPLOAD_DIR: z.string().default('uploads'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid backend environment:', parsed.error.issues[0]?.message ?? 'unknown');
  throw new Error('Backend env validation failed');
}
const env = parsed.data;

if (env.NODE_ENV === 'production') {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
    throw new Error(
      'Backend env validation failed: ADMIN_PASSWORD (min 8 characters) is required when NODE_ENV=production.',
    );
  }
  if (!process.env.FRONTEND_URL) {
    throw new Error(
      'Backend env validation failed: FRONTEND_URL is required when NODE_ENV=production. ' +
        'It is the CORS origin for browser requests (e.g. https://pananexus.vercel.app).',
    );
  }
  if (env.DEMO_MODE === 'true') {
    throw new Error('Backend env validation failed: DEMO_MODE must be false when NODE_ENV=production.');
  }
}

export const demoMode = env.DEMO_MODE === 'true';

export { env };
