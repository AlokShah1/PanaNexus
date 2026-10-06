import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { getAnalytics } from '@/backend/lib/analytics';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role !== 'ADMIN') return fail('FORBIDDEN', 'Admin only.', 403);
  const data = await getAnalytics();
  return ok(data);
}
