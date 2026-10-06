import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { notificationCreateSchema } from '@/backend/validations/feedback';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const unread = new URL(request.url).searchParams.get('unread') === 'true';
  const rows = await db.orm.public.Notification.where({ userId: session.sub }).all();
  const out = (unread ? rows.filter((n) => !n.read) : rows).slice(0, 50);
  return ok(out);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return fail('FORBIDDEN', 'Only admins can create notifications.', 403);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = notificationCreateSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  const n = await db.orm.public.Notification.create(parsed.data);
  return ok({ id: n.id }, 201);
}
