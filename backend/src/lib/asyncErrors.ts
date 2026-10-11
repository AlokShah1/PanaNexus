/**
 * Express 4 does not forward rejected promises returned by `async` route
 * handlers to the error middleware. Since Node 15 an unhandled rejection
 * terminates the process, so a single rejected database call inside any
 * handler would crash the whole API instead of returning a 500.
 *
 * Express 5 handles this natively; until we upgrade, this adapts the widely
 * used `express-async-errors` technique: wrap the router layer's request
 * dispatch so a rejected promise from a handler is passed to `next(err)`.
 *
 * Import this module before any routes are registered (see `app.ts`), otherwise
 * already-registered layers keep the unwrapped dispatcher.
 */
import { createRequire } from 'node:module';
import type { NextFunction, Request, Response } from 'express';

const require = createRequire(import.meta.url);

type LayerHandle = (req: Request, res: Response, next: NextFunction) => unknown;
type LayerProto = {
  handle_request: (this: { handle: LayerHandle }, req: Request, res: Response, next: NextFunction) => void;
  __pnAsyncWrapped?: boolean;
};

const Layer = require('express/lib/router/layer.js') as { prototype: LayerProto };

if (!Layer.prototype.__pnAsyncWrapped) {
  Layer.prototype.handle_request = function handleRequestWithAsync(
    this: { handle: LayerHandle },
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const fn = this.handle;
    if (fn.length > 3) {
      // Not a standard request handler (e.g. error middleware): leave it be.
      next();
      return;
    }
    try {
      const ret = fn(req, res, next);
      if (ret && typeof (ret as Promise<unknown>).then === 'function') {
        (ret as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
  Layer.prototype.__pnAsyncWrapped = true;
}

export {};
