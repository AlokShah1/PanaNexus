import { describe, expect, it } from 'vitest';
import { boundingBox, boundingBoxToViewbox, haversineKm, isWithinBBox, isValidLatLng } from './geo.js';

describe('haversineKm', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineKm(26.728, 85.925, 26.728, 85.924)).toBeLessThan(0.2);
  });

  it('measures a known distance (Janakpur to Kathmandu ~ 123 km straight line)', () => {
    const d = haversineKm(26.7285, 85.9249, 27.7172, 85.324);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(135);
  });
});

describe('boundingBox', () => {
  it('surrounds the centre by roughly the radius', () => {
    const box = boundingBox({ lat: 26.73, lng: 85.92 }, 5);
    expect(box.south).toBeLessThan(26.73);
    expect(box.north).toBeGreaterThan(26.73);
    expect(box.west).toBeLessThan(85.92);
    expect(box.east).toBeGreaterThan(85.92);
  });

  it('clamps latitude at the poles', () => {
    const box = boundingBox({ lat: 89.9, lng: 0 }, 100);
    expect(box.north).toBeLessThanOrEqual(90);
  });

  it('serialises to left,top,right,bottom for Nominatim viewbox', () => {
    expect(boundingBoxToViewbox({ south: 10, north: 20, west: 30, east: 40 })).toBe('30.000000,20.000000,40.000000,10.000000');
  });
});

describe('isWithinBBox / isValidLatLng', () => {
  it('detects points inside and outside', () => {
    const box = { south: 10, north: 20, west: 30, east: 40 };
    expect(isWithinBBox({ lat: 15, lng: 35 }, box)).toBe(true);
    expect(isWithinBBox({ lat: 25, lng: 35 }, box)).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(isValidLatLng(23.1, 85.4)).toBe(true);
    expect(isValidLatLng(200, 85.4)).toBe(false);
    expect(isValidLatLng(NaN, 85.4)).toBe(false);
    expect(isValidLatLng('23' as unknown as number, 85.4)).toBe(false);
  });
});
