import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { feedbackSchema } from '@/validations/feedback';

export async function GET(request: Request) {
  const facilityId = new URL(request.url).searchParams.get('facilityId');
  const rows = await db.orm.public.Feedback.all();
  const out = rows
    .filter((f) => (facilityId ? f.facilityId === facilityId : true))
    .slice(0, 100)
    .map((f) => ({ id: f.id, rating: f.rating, comment: f.comment, facilityId: f.facilityId, createdAt: f.createdAt }));
  return ok(out);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  if (parsed.data.facilityId) {
    const f = await db.orm.public.HealthcareFacility.where({ id: parsed.data.facilityId }).first();
    if (!f) return fail('FACILITY_NOT_FOUND', 'Facility not found.', 404);
  }
  const feedback = await db.orm.public.Feedback.create({
    authorId: session.sub,
    facilityId: parsed.data.facilityId ?? null,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });
  await db.orm.public.AuditLog.create({ action: 'FEEDBACK_SUBMITTED', entity: 'Feedback', entityId: feedback.id, actorId: session.sub }).catch(() => undefined);
  return ok({ id: feedback.id }, 201);
}
