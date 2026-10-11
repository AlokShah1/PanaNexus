import './asyncErrors.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';

describe('async error handling', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    app.get('/boom', async () => {
      throw new Error('kaboom');
    });
    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ handled: true, message: (err as Error).message });
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address() as AddressInfo;
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('forwards a rejected async handler to the error middleware (no crash)', async () => {
    const res = await fetch(`${base}/boom`);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { handled: boolean; message: string };
    expect(body.handled).toBe(true);
    expect(body.message).toBe('kaboom');
  });
});
