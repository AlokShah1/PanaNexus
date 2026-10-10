import { boundingBoxToViewbox, type BoundingBox } from '../geo.js';
import { fetchJson } from './fetch.js';
import { TtlCache } from './cache.js';
import {
  OSM_ATTRIBUTION,
  type ExternalPlace,
  type GeocodeHit,
  type GeocodeQuery,
  type HealthcareSearchQuery,
  type MapProvider,
  type PlaceCategory,
} from './types.js';

interface NominatimRecord {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  boundingbox?: [string, string, string, string];
  class?: string;
  type?: string;
  importance?: number;
  display_name?: string;
  name?: string;
  namedetails?: Record<string, string>;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
}

const HEALTHCARE_TYPES: Record<string, PlaceCategory> = {
  hospital: 'HOSPITAL',
  clinic: 'CLINIC',
  doctors: 'DOCTORS',
  doctor: 'DOCTORS',
  pharmacy: 'PHARMACY',
  health_post: 'HEALTH_POST',
  health_centre: 'HEALTH_POST',
};

/** Map an OpenStreetMap class/type pair onto a healthcare category. Returns null for unrelated places. */
export function toPlaceCategory(record: Pick<NominatimRecord, 'class' | 'type'>): PlaceCategory | null {
  const type = record.type?.toLowerCase();
  if (type && HEALTHCARE_TYPES[type]) return HEALTHCARE_TYPES[type];
  if (record.class === 'healthcare' && type) return 'OTHER';
  return null;
}

function bboxFromStrings(box: [string, string, string, string] | undefined): BoundingBox | null {
  if (!box || box.length !== 4) return null;
  const [south, north, west, east] = box.map(Number);
  if ([south, north, west, east].some((n) => !Number.isFinite(n))) return null;
  return { south, north, west, east };
}

function externalRef(record: NominatimRecord): string {
  return `nominatim:${record.osm_type ?? 'node'}:${record.osm_id ?? record.place_id ?? 'unknown'}`;
}

function placeName(record: NominatimRecord): string {
  const named = record.namedetails?.name;
  const raw = record.name || named || record.display_name || 'Unnamed place';
  return raw.split(',')[0]?.trim() || raw;
}

export interface NominatimOptions {
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
  cacheTtlMs: number;
  /** Minimum gap between outbound requests; Nominatim's usage policy asks for <= 1 req/sec. */
  minIntervalMs: number;
}

export function createNominatimProvider(opts: NominatimOptions): MapProvider {
  const cache = new TtlCache(opts.cacheTtlMs);

  // Serialise outbound calls so we never hammer the public endpoint.
  let chain: Promise<unknown> = Promise.resolve();
  async function throttled<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const started = Date.now();
      try {
        return await fn();
      } finally {
        const wait = opts.minIntervalMs - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    });
    chain = run.catch(() => undefined);
    return run;
  }

  async function search(params: URLSearchParams): Promise<NominatimRecord[]> {
    const url = `${opts.baseUrl.replace(/\/+$/, '')}/search?${params.toString()}`;
    const key = url;
    return cache.getOrLoad(key, () => throttled(() => fetchJson<NominatimRecord[]>(url, { timeoutMs: opts.timeoutMs, userAgent: opts.userAgent })));
  }

  return {
    name: 'nominatim',

    async geocode(query: GeocodeQuery): Promise<GeocodeHit[]> {
      const limit = Math.min(Math.max(query.limit ?? 5, 1), 10);
      const params = new URLSearchParams({
        q: query.query,
        format: 'jsonv2',
        limit: String(limit),
        addressdetails: '0',
        'accept-language': 'en',
      });
      if (query.near) {
        const box = { south: query.near.lat - 0.5, north: query.near.lat + 0.5, west: query.near.lng - 0.5, east: query.near.lng + 0.5 };
        params.set('viewbox', boundingBoxToViewbox(box));
      }
      const records = await search(params);
      return records
        .map((r) => ({
          label: r.display_name ?? r.name ?? query.query,
          lat: Number(r.lat),
          lng: Number(r.lon),
          bbox: bboxFromStrings(r.boundingbox),
          type: r.class && r.type ? `${r.class}/${r.type}` : (r.type ?? null),
          importance: typeof r.importance === 'number' ? r.importance : null,
        }))
        .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
    },

    async reverse(point): Promise<string | null> {
      const url = `${opts.baseUrl.replace(/\/+$/, '')}/reverse?format=jsonv2&zoom=17&addressdetails=0&accept-language=en&lat=${point.lat}&lon=${point.lng}`;
      try {
        const record = await cache.getOrLoad(url, () => throttled(() => fetchJson<NominatimRecord>(url, { timeoutMs: opts.timeoutMs, userAgent: opts.userAgent })));
        return record.display_name ?? null;
      } catch {
        return null;
      }
    },

    async searchHealthcare(query: HealthcareSearchQuery): Promise<ExternalPlace[]> {
      const limit = Math.min(Math.max(query.limit ?? 30, 1), 50);
      const params = new URLSearchParams({
        q: query.text,
        format: 'jsonv2',
        limit: String(limit),
        addressdetails: '1',
        extratags: '1',
        namedetails: '1',
        'accept-language': 'en',
      });
      const box = query.bbox ?? (query.near ? { south: query.near.lat - 0.15, north: query.near.lat + 0.15, west: query.near.lng - 0.15, east: query.near.lng + 0.15 } : null);
      if (box) {
        params.set('viewbox', boundingBoxToViewbox(box));
        params.set('bounded', '1');
      }
      const records = await search(params);
      const places: ExternalPlace[] = [];
      for (const r of records) {
        const category = toPlaceCategory(r);
        if (!category) continue;
        const lat = Number(r.lat);
        const lng = Number(r.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const extra = r.extratags ?? {};
        const emergency = extra.emergency === 'yes' ? true : extra.emergency === 'no' ? false : null;
        places.push({
          ref: externalRef(r),
          name: placeName(r),
          category,
          address: r.display_name ?? '',
          phone: extra.phone ?? extra['contact:phone'] ?? null,
          website: extra.website ?? extra['contact:website'] ?? null,
          openingHours: extra.opening_hours ?? null,
          emergency,
          lat,
          lng,
          attribution: OSM_ATTRIBUTION,
        });
      }
      return places;
    },
  };
}
