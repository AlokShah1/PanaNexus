import { fail, ok } from '@/backend/lib/api';
import { getSession } from '@/backend/lib/auth';
import { predictEtaMinutes } from '@/backend/lib/intelligence';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return fail('UNAUTHORIZED', 'Sign in required.', 401);
  const url = new URL(request.url);
  const distanceKm = Number(url.searchParams.get('distanceKm'));
  const priority = url.searchParams.get('priority');
  if (Number.isNaN(distanceKm) || !priority || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
    return fail('VALIDATION_ERROR', 'distanceKm and priority are required.', 422);
  }
  return ok({ distanceKm, priority, etaMinutes: predictEtaMinutes(distanceKm, priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') });
}
