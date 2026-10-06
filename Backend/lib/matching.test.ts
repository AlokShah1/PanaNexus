import { describe, expect, it } from 'vitest';
import { rankAmbulances } from './matching';

const ambs = [
  { id: 'a1', latitude: 27.7, longitude: 85.3, type: 'BASIC' as const, status: 'AVAILABLE' },
  { id: 'a2', latitude: 27.71, longitude: 85.31, type: 'ICU' as const, status: 'AVAILABLE' },
  { id: 'a3', latitude: 27.7, longitude: 85.3, type: 'ADVANCED' as const, status: 'OFFLINE' },
];

describe('rankAmbulances', () => {
  it('excludes non-available and locationless ambulances', () => {
    const out = rankAmbulances(ambs, { pickupLatitude: 27.7, pickupLongitude: 85.3, priority: 'MEDIUM', category: 'GENERAL' });
    expect(out.find((r) => r.id === 'a3')).toBeUndefined();
  });

  it('prefers a nearby ICU for CRITICAL requests', () => {
    const out = rankAmbulances(ambs, { pickupLatitude: 27.7, pickupLongitude: 85.3, priority: 'CRITICAL', category: 'CARDIAC' });
    expect(out[0]?.id).toBe('a2');
  });

  it('ranks nearer before farther for equal type suitability', () => {
    const out = rankAmbulances(
      [
        { id: 'x', latitude: 28.5, longitude: 85.9, type: 'BASIC' as const, status: 'AVAILABLE' },
        { id: 'y', latitude: 27.7, longitude: 85.3, type: 'BASIC' as const, status: 'AVAILABLE' },
      ],
      { pickupLatitude: 27.7, pickupLongitude: 85.3, priority: 'LOW', category: 'GENERAL' },
    );
    expect(out[0]?.id).toBe('y');
  });
});
