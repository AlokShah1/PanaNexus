import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { allocateAmbulances } from '@/backend/lib/intelligence';
import { allocateSchema } from '@/backend/validations/intelligence';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role !== 'ADMIN') return fail('FORBIDDEN', 'Admin only.', 403);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = allocateSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  return ok({ assignments: allocateAmbulances(parsed.data.candidates, parsed.data.requests) });
}
