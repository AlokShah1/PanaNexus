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
  SESSION_IDLE_MINUTES: z.coerce.number().positive().default(15),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().positive().default(8),
  SESSION_ADMIN_IDLE_MINUTES: z.coerce.number().positive().default(10),
  SESSION_ADMIN_ABSOLUTE_HOURS: z.coerce.number().positive().default(4),
  SESSION_WARNING_SECONDS: z.coerce.number().int().nonnegative().default(120),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  ADMIN_EMAIL: z.string().email().default('pananexusadmin@gmail.com'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  AWS_REGION: z.string().min(1).optional(),
  AWS_S3_BUCKET: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  REPORT_MAX_FILE_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  REPORT_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
}).superRefine((value, ctx) => {
  if (value.STORAGE_DRIVER !== 's3') return;
  for (const key of ['AWS_REGION', 'AWS_S3_BUCKET'] as const) {
    if (!value[key]) {
      ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required when STORAGE_DRIVER=s3.` });
    }
  }
  if (Boolean(value.AWS_ACCESS_KEY_ID) !== Boolean(value.AWS_SECRET_ACCESS_KEY)) {
    ctx.addIssue({
      code: 'custom',
      path: ['AWS_ACCESS_KEY_ID'],
      message: 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together.',
    });
  }
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

if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
  console.warn(
    '[storage] STORAGE_DRIVER=local in production. Private medical reports should use ' +
      'S3-compatible storage (set STORAGE_DRIVER=s3 plus AWS_* variables).',
  );
}

export const demoMode = env.DEMO_MODE === 'true';

export { env };
