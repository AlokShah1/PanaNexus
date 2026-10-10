import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SESSION_COOKIE, setSessionCookie } from './auth.js';

async function cookieFor(expiresAt: Date | string): Promise<string> {
  const app = express();
  app.get('/set', (_req, res) => {
    setSessionCookie(res, 'test-token', expiresAt);
    res.status(204).end();
  });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/set`);
  const header = res.headers.getSetCookie?.().find((c) => c.startsWith(`${SESSION_COOKIE}=`)) ?? '';
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return header;
}

function maxAgeSeconds(header: string): number {
  const match = /Max-Age=(\d+)/i.exec(header);
  if (!match) throw new Error(`No Max-Age in cookie: ${header}`);
  return Number(match[1]);
}

describe('session cookie', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('lives for the full session expiry (hours), not ~28 seconds', async () => {
    process.env.NODE_ENV = 'test';
    const header = await cookieFor(new Date(Date.now() + 8 * 60 * 60 * 1000));
    const maxAge = maxAgeSeconds(header);
    // Regression guard for the seconds-vs-milliseconds bug: 28800s became 28s.
    expect(maxAge).toBeGreaterThan(7 * 60 * 60);
    expect(maxAge).toBeLessThanOrEqual(8 * 60 * 60 + 5);
    expect(maxAge).not.toBeLessThan(60);
  });

  it('scales short expiries down instead of exploding to milliseconds', async () => {
    process.env.NODE_ENV = 'test';
    const header = await cookieFor(new Date(Date.now() + 10_000));
    const maxAge = maxAgeSeconds(header);
    expect(maxAge).toBeGreaterThanOrEqual(9);
    expect(maxAge).toBeLessThanOrEqual(10);
  });

  it('sets HttpOnly, SameSite=None, and Secure in all environments', async () => {
    process.env.NODE_ENV = 'development';
    const header = await cookieFor(new Date(Date.now() + 60_000));
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=None');
    expect(header).toContain('Secure');
  });
});
