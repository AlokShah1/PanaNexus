import type { LatLng } from '../geo.js';
import { env } from '../../config/env.js';
import { createNominatimProvider } from './nominatim.js';
import { createOsrmRouter, createStraightLineRouter } from './osrm.js';
import type { MapProvider, PlaceCategory, RouteResult, RoutingProvider } from './types.js';

export { OSM_ATTRIBUTION } from './types.js';

let provider: MapProvider | null = null;
let routing: RoutingProvider | null = null;

export function getMapProvider(): MapProvider {
  if (!provider) {
    provider = createNominatimProvider({
      baseUrl: env.MAP_BASE_URL,
      userAgent: env.MAP_USER_AGENT,
      timeoutMs: env.MAP_TIMEOUT_MS,
      cacheTtlMs: env.MAP_CACHE_TTL_SECONDS * 1000,
      minIntervalMs: env.MAP_MIN_INTERVAL_MS,
    });
  }
  return provider;
}

export function getRoutingProvider(): RoutingProvider {
  if (!routing) {
    routing =
      env.ROUTING_PROVIDER === 'straight-line'
        ? createStraightLineRouter()
        : createOsrmRouter({ baseUrl: env.OSRM_BASE_URL, userAgent: env.MAP_USER_AGENT, timeoutMs: env.MAP_TIMEOUT_MS });
  }
  return routing;
}

/** Reset memoised providers — used by tests. */
export function resetMapProviders(): void {
  provider = null;
  routing = null;
}

/** Road route when the provider answers, otherwise an honestly-labelled straight-line estimate. */
export async function routeWithFallback(from: LatLng, to: LatLng): Promise<RouteResult> {
  try {
    return await getRoutingProvider().route({ from, to, mode: 'driving' });
  } catch {
    return createStraightLineRouter().route({ from, to, mode: 'driving' });
  }
}

/** Human-readable category labels used in API responses and the UI. */
export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  HOSPITAL: 'Hospital',
  HEALTH_POST: 'Health post',
  CLINIC: 'Clinic',
  DOCTORS: 'Doctors',
  PHARMACY: 'Pharmacy',
  OTHER: 'Healthcare',
};

/** Search keyword used to query the external provider for a category. */
export function categoryKeyword(category: string | undefined): string {
  switch (category) {
    case 'HOSPITAL':
      return 'hospital';
    case 'HEALTH_POST':
      return 'health post';
    case 'CLINIC':
      return 'clinic';
    case 'DOCTORS':
      return 'doctors';
    case 'PHARMACY':
      return 'pharmacy';
    default:
      return 'hospital';
  }
}
