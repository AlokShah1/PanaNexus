import { Router } from 'express';
import { fail, ok } from '../lib/api.js';
import { getSession } from '../lib/auth.js';
import { getAnalytics } from '../lib/analytics.js';

const router = Router();

router.get('/analytics', async (req, res) => {
  const session = getSession(req);
  if (!session) return fail(res, 'UNAUTHORIZED', 'Sign in required.', 401);
  if (session.role !== 'ADMIN') return fail(res, 'FORBIDDEN', 'Admin only.', 403);
  return ok(res, await getAnalytics());
});

export default router;
