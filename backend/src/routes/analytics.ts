import { Router } from 'express';
import { db } from '../../prisma/db';
import { fail, ok } from '../lib/api';
import { getSession } from '../lib/auth';
import { forecastBloodDemand, predictEtaMinutes, allocateAmbulances } from '../lib/intelligence';
import { allocateSchema } from '../validations/intelligence';

const router = Router();

router.get('/eta', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  const distanceKm = Number(req.query.distanceKm);
  const priority = req.query.priority;
  if (Number.isNaN(distanceKm) || typeof priority !== 'string' || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
    return fail(res, 'VALIDATION_ERROR', 'distanceKm and priority are required.', 422);
  }
  return ok(res, { distanceKm, priority, etaMinutes: predictEtaMinutes(distanceKm, priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') });
});

router.get('/blood-forecast', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role !== 'ADMIN') return fail(res, 'FORBIDDEN', 'Admin only.', 403);
  const rows = await db.orm.public.BloodRequest.all();
  const history = rows.map((r) => ({ date: r.createdAt, bloodGroup: r.bloodGroup, units: r.units }));
  return ok(res, { forecast: forecastBloodDemand(history, 3), basedOn: history.length });
});

router.post('/allocate', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role !== 'ADMIN') return fail(res, 'FORBIDDEN', 'Admin only.', 403);
  const parsed = allocateSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  return ok(res, { assignments: allocateAmbulances(parsed.data.candidates, parsed.data.requests) });
});

export default router;
