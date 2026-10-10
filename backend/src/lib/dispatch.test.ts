import { describe, expect, it } from 'vitest';
import {
  DispatchConflictError,
  ESCALATION_INTERVAL_MS,
  MAX_ESCALATIONS,
  dueForEscalation,
  resetDispatchState,
  roadEtaMinutes,
} from './dispatch.js';

describe('dueForEscalation', () => {
  it('is due on the first sweep for a brand new request', () => {
    expect(dueForEscalation(0, 0, 1_000_000)).toBe(true);
  });

  it('waits for the interval to elapse before the next round', () => {
    expect(dueForEscalation(1, 1_000_000, 1_000_000 + ESCALATION_INTERVAL_MS - 1)).toBe(false);
    expect(dueForEscalation(1, 1_000_000, 1_000_000 + ESCALATION_INTERVAL_MS)).toBe(true);
  });

  it('stops once the maximum number of rounds is reached', () => {
    expect(dueForEscalation(MAX_ESCALATIONS, 0, 10_000_000)).toBe(false);
  });
});

describe('resetDispatchState', () => {
  it('is callable and idempotent', () => {
    expect(() => resetDispatchState()).not.toThrow();
    expect(() => resetDispatchState()).not.toThrow();
  });
});

describe('DispatchConflictError', () => {
  it('carries a machine code and message', () => {
    const err = new DispatchConflictError('NOT_AVAILABLE', 'Ambulance is not available.');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DispatchConflictError');
    expect(err.code).toBe('NOT_AVAILABLE');
    expect(err.message).toBe('Ambulance is not available.');
  });
});

describe('roadEtaMinutes', () => {
  it('returns null when the origin is unknown', async () => {
    expect(await roadEtaMinutes(null, null, 27.7, 85.3)).toBeNull();
    expect(await roadEtaMinutes(27.7, null, 27.7, 85.3)).toBeNull();
    expect(await roadEtaMinutes(Number.NaN, 85.3, 27.7, 85.3)).toBeNull();
  });

  it('always yields a positive ETA and non-negative distance', async () => {
    const eta = await roadEtaMinutes(27.7, 85.3, 27.72, 85.32, 5);
    expect(eta).not.toBeNull();
    expect(eta!.minutes).toBeGreaterThanOrEqual(1);
    expect(eta!.distanceKm).toBeGreaterThanOrEqual(0);
    expect(typeof eta!.approximate).toBe('boolean');
  });

  it('falls back to a straight-line estimate when routing times out', async () => {
    const eta = await roadEtaMinutes(27.7, 85.3, 27.72, 85.32, 0);
    expect(eta).not.toBeNull();
    expect(eta!.minutes).toBeGreaterThanOrEqual(1);
  });
});
