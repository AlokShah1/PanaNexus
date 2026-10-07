import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

export function fail(res: Response, code: string, message: string, status = 400): Response {
  return res.status(status).json({ success: false, error: { code, message } });
}

export function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
