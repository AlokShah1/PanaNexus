import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { hashPassword, setSessionCookie } from '@/backend/lib/auth';
import { registerSchema } from '@/backend/validations/auth';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }

  const { name, email, password, role } = parsed.data;

  const existing = await db.orm.public.User.where({ email }).first();
  if (existing) {
    return fail('EMAIL_TAKEN', 'An account with this email already exists.', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await db.orm.public.User.create({ name, email, role, passwordHash });

  await db.orm.public.AuditLog.create({
    action: 'USER_REGISTERED',
    entity: 'User',
    entityId: user.id,
    actorId: user.id,
  }).catch(() => undefined);

  await setSessionCookie(user.id, user.role);
  return ok({ id: user.id, email: user.email, name: user.name, role: user.role }, 201);
}
