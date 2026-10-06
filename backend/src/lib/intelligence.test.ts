import { describe, expect, it } from 'vitest';
import { allocateAmbulances, forecastBloodDemand, predictEtaMinutes } from './intelligence.js';

describe('predictEtaMinutes', () => {
  it('returns a positive integer estimate', () => {
    expect(predictEtaMinutes(10, 'HIGH')).toBe(12);
    expect(predictEtaMinutes(0.1, 'LOW')).toBe(1);
  });
});

describe('forecastBloodDemand', () => {
  it('averages the most recent points per group', () => {
    const out = forecastBloodDemand([
      { date: '2026-10-01', bloodGroup: 'O+', units: 4 },
      { date: '2026-10-02', bloodGroup: 'O+', units: 8 },
      { date: '2026-10-03', bloodGroup: 'O+', units: 2 },
      { date: '2026-10-01', bloodGroup: 'A-', units: 6 },
    ]);
    expect(out['O+']).toBe(Math.round((8 + 2 + 4) / 3));
    expect(out['A-']).toBe(6);
  });
});

describe('allocateAmbulances', () => {
  it('assigns critical requests to ICU first', () => {
    const out = allocateAmbulances(
      [
        { id: 'b1', type: 'BASIC', distanceKm: 1, status: 'AVAILABLE' },
        { id: 'icu1', type: 'ICU', distanceKm: 5, status: 'AVAILABLE' },
      ],
      [{ id: 'r1', priority: 'CRITICAL' }],
    );
    expect(out[0].ambulanceId).toBe('icu1');
  });
});
