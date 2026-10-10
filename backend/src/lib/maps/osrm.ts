import { haversineKm } from '../geo.js';
import { fetchJson } from './fetch.js';
import type { RoutingProvider } from './types.js';

export interface RoutingOptions {
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
}

/** Honest fallback: straight-line estimate labelled approximate (never presented as a road route). */
export function createStraightLineRouter(speedKmh = 30): RoutingProvider {
  return {
    name: 'straight-line',
    async route(query) {
      const straight = Number(haversineKm(query.from.lat, query.from.lng, query.to.lat, query.to.lng).toFixed(2));
      return {
        provider: 'straight-line',
        distanceKm: straight,
        durationMinutes: Math.max(1, Math.round((straight / speedKmh) * 60)),
        straightLineKm: straight,
        approximate: true,
      };
    },
  };
}

export function createOsrmRouter(opts: RoutingOptions): RoutingProvider {
  return {
    name: 'osrm',
    async route(query) {
      const mode = query.mode ?? 'driving';
      const coords = `${query.from.lng},${query.from.lat};${query.to.lng},${query.to.lat}`;
      const url = `${opts.baseUrl.replace(/\/+$/, '')}/route/v1/${mode}/${coords}?overview=false&alternatives=false`;
      const data = await fetchJson<{ code?: string; routes?: Array<{ distance?: number; duration?: number }> }>(url, {
        timeoutMs: opts.timeoutMs,
        userAgent: opts.userAgent,
      });
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route || typeof route.distance !== 'number') {
        throw new Error('No route found');
      }
      const straight = Number(haversineKm(query.from.lat, query.from.lng, query.to.lat, query.to.lng).toFixed(2));
      return {
        provider: 'osrm',
        distanceKm: Number((route.distance! / 1000).toFixed(2)),
        durationMinutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
        straightLineKm: straight,
        approximate: false,
      };
    },
  };
}
