import { db } from '@/prisma/db';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { bloodDonorProfileSchema } from '@/validations/donors';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const donor = await db.orm.public.BloodDonor.where({ userId: session.sub }).first();
  if (!donor) return ok(null);
  return ok({ id: donor.id, bloodGroup: donor.bloodGroup, isAvailable: donor.isAvailable, lastDonationDate: donor.lastDonationDate });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_JSON', 'Request body must be valid JSON.', 400); }
  const parsed = bloodDonorProfileSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);

  const existing = await db.orm.public.BloodDonor.where({ userId: session.sub }).first();
  if (existing) {
    await db.orm.public.BloodDonor.where({ userId: session.sub }).update(parsed.data);
    await db.orm.public.AuditLog.create({ action: 'BLOOD_DONOR_UPDATED', entity: 'BloodDonor', entityId: existing.id, actorId: session.sub }).catch(() => undefined);
    return ok({ id: existing.id });
  }
  const donor = await db.orm.public.BloodDonor.create({ userId: session.sub, ...parsed.data });
  await db.orm.public.AuditLog.create({ action: 'BLOOD_DONOR_REGISTERED', entity: 'BloodDonor', entityId: donor.id, actorId: session.sub }).catch(() => undefined);
  return ok({ id: donor.id }, 201);
}
