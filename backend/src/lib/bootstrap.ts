import { db } from '../../prisma/db.js';
import { hashPassword } from './auth-core.js';
import { env } from '../config/env.js';

export async function ensureAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const existing = await db.orm.public.User.where({ email }).first();
  if (existing) {
    if (existing.role !== 'ADMIN' || existing.verificationStatus !== 'VERIFIED') {
      await db.orm.public.User.where({ id: existing.id }).update({ role: 'ADMIN', verificationStatus: 'VERIFIED' });
      await db.orm.public.AuditLog.create({
        action: 'ADMIN_BOOTSTRAPPED',
        entity: 'User',
        entityId: existing.id,
        metadata: JSON.stringify({ email, previousRole: existing.role }),
      }).catch(() => undefined);
      console.log(`Admin role granted to existing account ${email}`);
    }
    return;
  }
  if (!env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD must be set (min 8 chars) to create the admin account');
  }
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  const user = await db.orm.public.User.create({
    email,
    name: 'Platform Admin',
    role: 'ADMIN',
    verificationStatus: 'VERIFIED',
    passwordHash,
  });
  await db.orm.public.AuditLog.create({
    action: 'ADMIN_CREATED',
    entity: 'User',
    entityId: user.id,
    metadata: JSON.stringify({ email }),
  }).catch(() => undefined);
  console.log(`Admin account created for ${email}`);
}
