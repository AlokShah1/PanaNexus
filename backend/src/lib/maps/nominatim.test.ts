import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNominatimProvider, toPlaceCategory } from './nominatim.js';

const originalFetch = globalThis.fetch;

function mockFetch(payload: unknown, ok = true) {
  const fn = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  }));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function provider() {
  return createNominatimProvider({
    baseUrl: 'https://nominatim.example',
    userAgent: 'PanaNexus/test',
    timeoutMs: 1000,
    cacheTtlMs: 0,
    minIntervalMs: 0,
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('toPlaceCategory', () => {
  it('maps OSM healthcare amenity types', () => {
    expect(toPlaceCategory({ class: 'amenity', type: 'hospital' })).toBe('HOSPITAL');
    expect(toPlaceCategory({ class: 'amenity', type: 'clinic' })).toBe('CLINIC');
    expect(toPlaceCategory({ class: 'amenity', type: 'doctors' })).toBe('DOCTORS');
    expect(toPlaceCategory({ class: 'amenity', type: 'pharmacy' })).toBe('PHARMACY');
  });

  it('returns null for unrelated amenities', () => {
    expect(toPlaceCategory({ class: 'amenity', type: 'atm' })).toBeNull();
    expect(toPlaceCategory({ class: 'highway', type: 'tertiary' })).toBeNull();
  });
});

describe('nominatim provider', () => {
  it('maps geocode hits with coordinates and bounding box', async () => {
    mockFetch([
      {
        place_id: 1,
        lat: '26.7284541',
        lon: '85.9249005',
        boundingbox: ['26.70', '26.76', '85.88', '85.97'],
        class: 'place',
        type: 'city',
        importance: 0.62,
        display_name: 'Janakpur, Nepal',
      },
    ]);
    const [hit] = await provider().geocode({ query: 'janakpur' });
    expect(hit?.lat).toBeCloseTo(26.7284541);
    expect(hit?.lng).toBeCloseTo(85.9249005);
    expect(hit?.bbox).toEqual({ south: 26.7, north: 26.76, west: 85.88, east: 85.97 });
    expect(hit?.type).toBe('place/city');
  });

  it('returns real healthcare places with provenance and no fabricated fields', async () => {
    mockFetch([
      {
        osm_type: 'way',
        osm_id: 253152629,
        lat: '26.7332979',
        lon: '85.9234270',
        class: 'amenity',
        type: 'hospital',
        display_name: 'Janakpur Zonal Hospital, Janki Road, Janakpur',
        name: 'Janakpur Zonal Hospital',
        extratags: { phone: '+977-41-520000', opening_hours: '24/7', emergency: 'yes' },
      },
      {
        osm_type: 'node',
        osm_id: 999,
        lat: '26.74',
        lon: '85.93',
        class: 'amenity',
        type: 'atm',
        display_name: 'Some ATM',
      },
    ]);
    const places = await provider().searchHealthcare({ text: 'hospital', bbox: { south: 26.7, north: 26.76, west: 85.88, east: 85.97 } });
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      ref: 'nominatim:way:253152629',
      name: 'Janakpur Zonal Hospital',
      category: 'HOSPITAL',
      phone: '+977-41-520000',
      openingHours: '24/7',
      emergency: true,
    });
    expect(places[0].attribution).toContain('OpenStreetMap');
  });

  it('leaves unknown fields null rather than inventing them', async () => {
    mockFetch([
      { osm_type: 'node', osm_id: 7, lat: '26.7', lon: '85.9', class: 'amenity', type: 'clinic', display_name: 'Clinic' },
    ]);
    const [place] = await provider().searchHealthcare({ text: 'clinic' });
    expect(place?.phone).toBeNull();
    expect(place?.openingHours).toBeNull();
    expect(place?.emergency).toBeNull();
  });

  it('rejects when the provider responds with an error', async () => {
    mockFetch([], false);
    await expect(provider().searchHealthcare({ text: 'hospital' })).rejects.toThrow();
  });
});
