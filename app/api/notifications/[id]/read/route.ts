import { db } from '@/backend/prisma/db';
import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const { id } = await params;
  const n = await db.orm.public.Notification.where({ id }).first();
  if (!n) return fail('NOT_FOUND', 'Notification not found.', 404);
  if (n.userId !== session.sub) return fail('FORBIDDEN', 'Cannot modify this notification.', 403);
  await db.orm.public.Notification.where({ id }).update({ read: true });
  return ok({ id });
}
