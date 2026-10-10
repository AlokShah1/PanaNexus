import { Router } from 'express';
import { fail, ok } from '../lib/api.js';
import { getUser, requireAuth, requireRole } from '../middleware/auth.js';
import { clearDemoData, demoStatus, resetDemoData, seedDemoData } from '../lib/demoData.js';
import { isDemoMode, startSimulation, stopSimulation } from '../lib/demoSimulation.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

function gate(res: Parameters<typeof fail>[0]) {
  if (!isDemoMode()) {
    fail(res, 'DEMO_DISABLED', 'Demo mode is disabled. Set DEMO_MODE=true to use demo tooling.', 403);
    return false;
  }
  return true;
}

router.get('/status', async (_req, res) => {
  if (!gate(res)) return;
  return ok(res, { demoMode: isDemoMode(), ...(await demoStatus()) });
});

router.post('/seed', async (req, res) => {
  if (!gate(res)) return;
  const result = await seedDemoData();
  return ok(res, { seeded: true, ...result });
});

router.post('/clear', async (req, res) => {
  if (!gate(res)) return;
  const result = await clearDemoData();
  return ok(res, { cleared: true, ...result });
});

router.post('/reset', async (req, res) => {
  if (!gate(res)) return;
  const result = await resetDemoData();
  return ok(res, { reset: true, ...result });
});

router.post('/simulate/start', async (req, res) => {
  if (!gate(res)) return;
  const emergencyRequestId = typeof req.body?.emergencyRequestId === 'string' ? req.body.emergencyRequestId : '';
  if (!emergencyRequestId) return fail(res, 'VALIDATION_ERROR', 'emergencyRequestId is required.', 422);
  const result = await startSimulation(emergencyRequestId);
  if (!result) return fail(res, 'SIMULATION_FAILED', 'Could not start a simulation for this request.', 409);
  return ok(res, { simulating: true, tripId: result.tripId, etaMinutes: result.etaMinutes ?? null });
});

router.post('/simulate/stop', async (req, res) => {
  if (!gate(res)) return;
  const tripId = typeof req.body?.tripId === 'string' ? req.body.tripId : '';
  if (!tripId) return fail(res, 'VALIDATION_ERROR', 'tripId is required.', 422);
  const stopped = await stopSimulation(tripId);
  return ok(res, { stopped });
});

export default router;