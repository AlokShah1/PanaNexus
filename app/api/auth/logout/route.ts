import { clearSessionCookie } from '@/backend/lib/auth';
import { ok } from '@/backend/lib/api';

export async function POST() {
  await clearSessionCookie();
  return ok({ loggedOut: true });
}
