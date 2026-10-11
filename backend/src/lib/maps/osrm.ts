import { haversineKm } from '../geo.js';
import { fetchJson } from './fetch.js';
import type { RouteGeometry, RoutingProvider } from './types.js';

export interface RoutingOptions {
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
}

/** Honest fallback: straight-line estimate labelled approximate (never presented as a road route). */
export function createStraightLineRouter(speedKmh = 30): RoutingProvider {
  const straight = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) =>
    Number(haversineKm(from.lat, from.lng, to.lat, to.lng).toFixed(2));

  return {
    name: 'straight-line',
    async route({ from, to }) {
      const distanceKm = straight(from, to);
      return {
        provider: 'straight-line',
        distanceKm,
        durationMinutes: Math.max(1, Math.round((distanceKm / speedKmh) * 60)),
        straightLineKm: distanceKm,
        approximate: true,
      };
    },
    async geometry({ from, to }) {
      const distanceKm = straight(from, to);
      return {
        provider: 'straight-line',
        coordinates: [from, to],
        distanceKm,
        durationMinutes: Math.max(1, Math.round((distanceKm / speedKmh) * 60)),
        approximate: true,
      };
    },
  };
}

type OsrmGeoJson = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
};

export function createOsrmRouter(opts: RoutingOptions): RoutingProvider {
  async function request(from: { lat: number; lng: number }, to: { lat: number; lng: number }, overview: 'full' | 'false'): Promise<OsrmGeoJson> {
    const url =
      `${opts.baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=${overview}&alternatives=false` +
      (overview === 'full' ? '&geometries=geojson' : '');
    return fetchJson<OsrmGeoJson>(url, { timeoutMs: opts.timeoutMs, userAgent: opts.userAgent });
  }

  return {
    name: 'osrm',
    async route({ from, to }) {
      const data = await request(from, to, 'false');
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route || typeof route.distance !== 'number') {
        throw new Error('No route found');
      }
      const straightLineKm = Number(haversineKm(from.lat, from.lng, to.lat, to.lng).toFixed(2));
      return {
        provider: 'osrm',
        distanceKm: Number((route.distance / 1000).toFixed(2)),
        durationMinutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
        straightLineKm,
        approximate: false,
      };
    },
    async geometry({ from, to }) {
      const data = await request(from, to, 'full');
      const route = data.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (data.code !== 'Ok' || !route || typeof route.distance !== 'number' || !coords || coords.length < 2) {
        throw new Error('No route geometry found');
      }
      return {
        provider: 'osrm',
        coordinates: coords.map(([lng, lat]) => ({ lat, lng })),
        distanceKm: Number((route.distance / 1000).toFixed(2)),
        durationMinutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
        approximate: false,
      };
    },
  };
}
