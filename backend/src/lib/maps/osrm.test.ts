import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOsrmRouter, createStraightLineRouter } from './osrm.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('straight-line router', () => {
  it('returns an honestly-labelled straight-line estimate', async () => {
    const result = await createStraightLineRouter().route({ from: { lat: 26.73, lng: 85.90 }, to: { lat: 26.74, lng: 85.92 } });
    expect(result.approximate).toBe(true);
    expect(result.provider).toBe('straight-line');
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.straightLineKm).toBe(result.distanceKm);
    expect(result.durationMinutes).toBeGreaterThanOrEqual(1);
  });
});

describe('osrm router', () => {
  it('converts metres/seconds into km/minutes', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 'Ok', routes: [{ distance: 3139.7, duration: 187.3 }] }),
    })) as unknown as typeof fetch;

    const result = await createOsrmRouter({ baseUrl: 'https://osrm.example', userAgent: 'PanaNexus/test', timeoutMs: 1000 }).route({
      from: { lat: 26.73, lng: 85.90 },
      to: { lat: 26.74, lng: 85.92 },
    });
    expect(result.provider).toBe('osrm');
    expect(result.approximate).toBe(false);
    expect(result.distanceKm).toBeCloseTo(3.14, 1);
    expect(result.durationMinutes).toBe(3);
    expect(result.straightLineKm).toBeGreaterThan(0);
  });

  it('throws when no route is returned', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 'NoRoute', routes: [] }),
    })) as unknown as typeof fetch;

    await expect(
      createOsrmRouter({ baseUrl: 'https://osrm.example', userAgent: 'PanaNexus/test', timeoutMs: 1000 }).route({
        from: { lat: 26.73, lng: 85.90 },
        to: { lat: 26.74, lng: 85.92 },
      }),
    ).rejects.toThrow();
  });
});
