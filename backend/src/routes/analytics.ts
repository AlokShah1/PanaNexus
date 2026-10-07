import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { forecastBloodDemand, predictEtaMinutes, allocateAmbulances } from '../lib/intelligence.js';
import { allocateSchema } from '../validations/intelligence.js';
import { getUser, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/eta', requireAuth, async (req, res) => {
  const distanceKm = Number(req.query.distanceKm);
  const priority = req.query.priority;
  if (Number.isNaN(distanceKm) || typeof priority !== 'string' || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
    return fail(res, 'VALIDATION_ERROR', 'distanceKm and priority are required.', 422);
  }
  return ok(res, { distanceKm, priority, etaMinutes: predictEtaMinutes(distanceKm, priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') });
});

router.get('/blood-forecast', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const user = getUser(req);
  const rows = await db.orm.public.BloodRequest.all();
  const history = rows.map((r) => ({ date: r.createdAt, bloodGroup: r.bloodGroup, units: r.units }));
  return ok(res, { forecast: forecastBloodDemand(history, 3), basedOn: history.length });
});

router.post('/allocate', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const user = getUser(req);
  const parsed = allocateSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input.', 422);
  }
  return ok(res, { assignments: allocateAmbulances(parsed.data.candidates, parsed.data.requests) });
});

export default router;
