import { Router } from 'express';
import { fail, ok } from '../lib/api.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { clearDemoData, demoStatus, resetDemoData, seedDemoData } from '../lib/demoData.js';
import {
  activeSimulations,
  isDemoMode,
  pauseSimulation,
  resetSimulation,
  resumeSimulation,
  startSimulation,
  stopSimulation,
} from '../lib/demoSimulation.js';

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

router.post('/seed', async (_req, res) => {
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

function stringBody(body: unknown, key: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value : '';
}

router.get('/simulations', async (_req, res) => {
  if (!gate(res)) return;
  return ok(res, { simulations: activeSimulations() });
});

router.post('/simulate/start', async (req, res) => {
  if (!gate(res)) return;
  const emergencyRequestId = stringBody(req.body, 'emergencyRequestId');
  if (!emergencyRequestId) return fail(res, 'VALIDATION_ERROR', 'emergencyRequestId is required.', 422);
  const result = await startSimulation(emergencyRequestId);
  if (!result) return fail(res, 'SIMULATION_FAILED', 'Could not start a simulation for this request.', 409);
  return ok(res, {
    simulating: true,
    tripId: result.tripId,
    etaMinutes: result.etaMinutes ?? null,
    approximate: result.approximate,
    alreadyRunning: result.alreadyRunning,
  });
});

router.post('/simulate/pause', async (req, res) => {
  if (!gate(res)) return;
  const tripId = stringBody(req.body, 'tripId');
  if (!tripId) return fail(res, 'VALIDATION_ERROR', 'tripId is required.', 422);
  const paused = await pauseSimulation(tripId);
  if (!paused) return fail(res, 'SIMULATION_NOT_RUNNING', 'No running simulation for this trip.', 409);
  return ok(res, { paused: true });
});

router.post('/simulate/resume', async (req, res) => {
  if (!gate(res)) return;
  const tripId = stringBody(req.body, 'tripId');
  if (!tripId) return fail(res, 'VALIDATION_ERROR', 'tripId is required.', 422);
  const resumed = await resumeSimulation(tripId);
  if (!resumed) return fail(res, 'SIMULATION_NOT_PAUSED', 'No paused simulation for this trip.', 409);
  return ok(res, { resumed: true });
});

router.post('/simulate/stop', async (req, res) => {
  if (!gate(res)) return;
  const tripId = stringBody(req.body, 'tripId');
  if (!tripId) return fail(res, 'VALIDATION_ERROR', 'tripId is required.', 422);
  const stopped = await stopSimulation(tripId);
  return ok(res, { stopped });
});

router.post('/simulate/reset', async (req, res) => {
  if (!gate(res)) return;
  const tripId = stringBody(req.body, 'tripId');
  if (!tripId) return fail(res, 'VALIDATION_ERROR', 'tripId is required.', 422);
  const reset = await resetSimulation(tripId);
  return ok(res, { reset });
});

export default router;
