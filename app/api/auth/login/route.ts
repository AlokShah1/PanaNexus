import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { setSessionCookie, verifyPassword } from '@/backend/lib/auth';
import { loginSchema } from '@/backend/validations/auth';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }

  const { email, password } = parsed.data;
  const user = await db.orm.public.User.where({ email }).first();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }

  await db.orm.public.AuditLog.create({
    action: 'USER_LOGIN',
    entity: 'User',
    entityId: user.id,
    actorId: user.id,
  }).catch(() => undefined);

  await setSessionCookie(user.id, user.role);
  return ok({ id: user.id, email: user.email, name: user.name, role: user.role });
}
