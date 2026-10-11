import { describe, expect, it } from 'vitest';
import { cumulativeDistances, positionAlongPath } from './demoSimulation.js';

/**
 * The demo marker must move smoothly along the route path (constant-speed
 * interpolation), never jump randomly. These cover the pure maths so the
 * behaviour is verifiable without a database or socket.
 */
describe('demo simulation path interpolation', () => {
  const path = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 1, lng: 1 },
  ];

  it('builds cumulative distances starting at zero', () => {
    const cumulative = cumulativeDistances(path);
    expect(cumulative[0]).toBe(0);
    expect(cumulative).toHaveLength(path.length);
    // Second leg (1 degree of latitude) is slightly longer than the first (1 degree of longitude).
    expect(cumulative[1]).toBeGreaterThan(0);
    expect(cumulative[2]).toBeGreaterThan(cumulative[1]);
  });

  it('returns the start point at zero distance and the end point at full distance', () => {
    const cumulative = cumulativeDistances(path);
    const total = cumulative[cumulative.length - 1];
    expect(positionAlongPath(path, cumulative, 0)).toEqual(path[0]);
    expect(positionAlongPath(path, cumulative, total)).toEqual(path[path.length - 1]);
  });

  it('interpolates within a segment rather than snapping to a vertex', () => {
    const cumulative = cumulativeDistances(path);
    const midwayFirstLeg = cumulative[1] / 2;
    const point = positionAlongPath(path, cumulative, midwayFirstLeg);
    expect(point.lat).toBeCloseTo(0, 5);
    expect(point.lng).toBeCloseTo(0.5, 3);
  });

  it('handles degenerate paths without throwing', () => {
    expect(positionAlongPath([], [], 1)).toEqual({ lat: 0, lng: 0 });
    expect(positionAlongPath([{ lat: 5, lng: 6 }], [0], 1)).toEqual({ lat: 5, lng: 6 });
  });
});
