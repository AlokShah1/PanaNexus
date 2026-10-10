import { describe, expect, it } from 'vitest';
import { mergeDiscovery, normalizeName, sortDiscovery, type RegisteredFacilityInput } from './discovery.js';
import type { ExternalPlace } from './maps/types.js';

const facility: RegisteredFacilityInput = {
  id: 'f1',
  name: 'Janakpur Zonal Hospital',
  type: 'HOSPITAL',
  address: 'Janki Road, Janakpur',
  phone: '+977-41-520000',
  operatingHours: 'Open 24 hours',
  emergencyAvailable: true,
  services: ['Emergency'],
  latitude: 26.7333,
  longitude: 85.9234,
  rating: { avg: 4.5, count: 12 },
  beds: { totalBeds: 50, occupiedBeds: 20, availableBeds: 30, wards: 3 },
};

const externalSame: ExternalPlace = {
  ref: 'nominatim:way:253152629',
  name: 'Janakpur Zonal Hospital',
  category: 'HOSPITAL',
  address: 'Janakpur Zonal Hospital, Janki Road, Janakpur',
  phone: null,
  website: 'https://example.org',
  openingHours: '24/7',
  emergency: true,
  lat: 26.7332,
  lng: 85.9235,
  attribution: '© OpenStreetMap contributors',
};

const externalOther: ExternalPlace = {
  ref: 'nominatim:node:42',
  name: 'Ram Janaki Hospital',
  category: 'HOSPITAL',
  address: 'Janakpur',
  phone: null,
  website: null,
  openingHours: null,
  emergency: null,
  lat: 26.74,
  lng: 85.93,
  attribution: '© OpenStreetMap contributors',
};

describe('normalizeName', () => {
  it('ignores case and punctuation', () => {
    expect(normalizeName('Janakpur  Zonal-Hospital')).toBe('janakpur zonal hospital');
  });
});

describe('mergeDiscovery', () => {
  it('keeps a registered facility as the canonical entry when the map provider lists the same place', () => {
    const items = mergeDiscovery([facility], [externalSame], { lat: 26.73, lng: 85.92 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'pananexus', verified: true, onMap: true, externalRef: externalSame.ref });
    expect(items[0].sourceLabel).toContain('also on OpenStreetMap');
    expect(items[0].website).toBe('https://example.org');
  });

  it('keeps a differently-named external place as its own unverified entry', () => {
    const items = mergeDiscovery([facility], [externalOther], { lat: 26.7333, lng: 85.9234 });
    expect(items).toHaveLength(2);
    const map = placesSource(items, 'map');
    expect(map?.externalRef).toBe('nominatim:node:42');
    expect(map?.name).toBe('Ram Janaki Hospital');
    expect(map?.verified).toBe(false);
    expect(map?.sourceLabel).toContain('not verified');
  });

  it('does not merge same-named places that are far apart', () => {
    const far = { ...externalSame, lat: 27.5, lng: 86.5 };
    const items = mergeDiscovery([facility], [far], null);
    expect(items).toHaveLength(2);
    expect(placesSource(items, 'map')?.externalRef).toBe('nominatim:way:253152629');
    expect(placesSource(items, 'pananexus')?.onMap).toBe(false);
  });

  it('collapses the same venue listed twice by the provider (node + way)', () => {
    const duplicate = { ...externalOther, ref: 'nominatim:way:43', lat: 26.7401, lng: 85.9301 };
    const items = mergeDiscovery([], [externalOther, duplicate], null);
    expect(items).toHaveLength(1);
  });

  it('computes straight-line distance from the origin', () => {
    const items = mergeDiscovery([facility], [], { lat: 26.73, lng: 85.92 });
    expect(placesSource(items, 'pananexus')?.distanceKm).toBeGreaterThan(0);
  });
});

describe('sortDiscovery', () => {
  const items = mergeDiscovery([facility], [externalOther], { lat: 26.73, lng: 85.92 });

  it('puts verified facilities first for relevance', () => {
    expect(sortDiscovery(items, 'relevance')[0]?.source).toBe('pananexus');
  });

  it('sorts by distance ascending', () => {
    const sorted = sortDiscovery(items, 'distance');
    const a = sorted[0]?.distanceKm ?? 0;
    const b = sorted[1]?.distanceKm ?? 0;
    expect(a).toBeLessThanOrEqual(b);
  });
});

function placesSource(items: ReturnType<typeof mergeDiscovery>, source: 'pananexus' | 'map') {
  return items.find((i) => i.source === source);
}
