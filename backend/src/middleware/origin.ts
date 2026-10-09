import type { NextFunction, Request, Response } from 'express';
import { fail } from '../lib/api.js';
import { env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigins(): string[] {
  const origins = new Set<string>();
  origins.add(env.FRONTEND_URL.replace(/\/+$/, ''));
  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:3300');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://127.0.0.1:3300');
  }
  return [...origins];
}

/**
 * CSRF mitigation for cookie-authenticated, state-changing requests.
 *
 * The production cookie is `SameSite=None; Secure` (frontend and backend live on
 * different origins), so a cross-site browser request would carry the cookie.
 * Browsers always attach `Origin` to cross-origin non-GET requests, so we reject
 * any mutating request whose `Origin` is present and not allow-listed. Requests
 * with no `Origin` (server-to-server, curl, health checks) are left untouched.
 */
export function originGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  if (allowedOrigins().includes(origin.replace(/\/+$/, ''))) return next();
  fail(res, 'CSRF_ORIGIN_REJECTED', 'Request origin is not allowed.', 403);
}
