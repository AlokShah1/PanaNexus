import { Router } from 'express';
import { db } from '../../prisma/db.js';
import { fail, ok } from '../lib/api.js';
import { boundingBox, haversineKm, isValidLatLng, type LatLng } from '../lib/geo.js';
import { OSM_ATTRIBUTION, categoryKeyword, getMapProvider, routeWithFallback } from '../lib/maps/index.js';
import type { ExternalPlace, GeocodeHit, RouteResult } from '../lib/maps/types.js';
import { mergeDiscovery, sortDiscovery, type DiscoveryItem, type RegisteredFacilityInput, type SortKey } from '../lib/discovery.js';
import { computeRating, summarizeBeds, type BedRow } from '../lib/facility-view.js';
import { isOpenNow } from '../lib/hours.js';
import { pageMeta, parsePage } from '../lib/pagination.js';

const router = Router();

const CATEGORIES = new Set(['HOSPITAL', 'HEALTH_POST', 'CLINIC', 'DOCTORS', 'PHARMACY']);
const SORTS: SortKey[] = ['relevance', 'distance', 'name', 'rating'];
const MAX_ROUTE_ENRICHED = 8;
const DEFAULT_RADIUS_KM = 15;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type DiscoveryResponseItem = DiscoveryItem & { route: RouteResult | null };

/** Unified healthcare discovery: registered PanaNexus facilities merged with external map results. */
router.get('/search', async (req, res) => {
  const q = str(req.query.q)?.slice(0, 120);
  const lat = num(req.query.lat);
  const lng = num(req.query.lng);
  let origin: LatLng | null = lat != null && lng != null && isValidLatLng(lat, lng) ? { lat, lng } : null;

  const typeParam = str(req.query.type)?.toUpperCase();
  const categoryFilter = typeParam && CATEGORIES.has(typeParam) ? typeParam : undefined;
  const facilityTypeFilter = categoryFilter === 'HOSPITAL' || categoryFilter === 'HEALTH_POST' ? categoryFilter : undefined;
  const externalOnly = Boolean(categoryFilter) && !facilityTypeFilter;

  const emergency = req.query.emergency === 'true';
  const openNow = req.query.openNow === 'true';
  const verifiedOnly = req.query.verified === 'true';
  const sourceFilter = str(req.query.source);
  const wantRoute = req.query.route === 'true';
  const sortRaw = str(req.query.sort) as SortKey | undefined;
  const sort: SortKey = sortRaw && SORTS.includes(sortRaw) ? sortRaw : origin ? 'distance' : 'relevance';
  const radiusKm = Math.min(Math.max(num(req.query.radiusKm) ?? DEFAULT_RADIUS_KM, 0.5), 100);

  const provider = getMapProvider();
  let placeHit: GeocodeHit | null = null;
  let placeUnresolved: string | null = null;
  let providerError: string | null = null;
  let externalText = categoryKeyword(categoryFilter);
  let bbox = origin ? boundingBox(origin, radiusKm) : null;

  if (q && !origin) {
    try {
      const hits = await provider.geocode({ query: q, limit: 1 });
      placeHit = hits[0] ?? null;
    } catch {
      placeHit = null;
      providerError = 'Place search is temporarily unavailable.';
    }
    if (placeHit) {
      origin = { lat: placeHit.lat, lng: placeHit.lng };
      bbox = placeHit.bbox ?? boundingBox(origin, radiusKm);
    } else if (!providerError) {
      placeUnresolved = q;
    }
  } else if (q && origin) {
    externalText = categoryFilter ? categoryKeyword(categoryFilter) : q;
  }

  /* ------------------------------------------------ registered facilities */
  const rows = await db.orm.public.HealthcareFacility.include('feedback').all();
  const bedsByFacility = new Map<string, BedRow[]>();
  if (!externalOnly) {
    const allBeds = (await db.orm.public.BedCapacity.all()) as BedRow[];
    for (const b of allBeds) {
      const list = bedsByFacility.get(b.facilityId) ?? [];
      list.push(b);
      bedsByFacility.set(b.facilityId, list);
    }
  }

  const qLower = q?.toLowerCase();
  const registered: RegisteredFacilityInput[] = [];
  if (!externalOnly) {
    for (const f of rows) {
      if (facilityTypeFilter && f.type !== facilityTypeFilter) continue;
      const hasCoords = typeof f.latitude === 'number' && typeof f.longitude === 'number';
      const textMatch = Boolean(
        qLower &&
          ((f.name && f.name.toLowerCase().includes(qLower)) || (f.address && f.address.toLowerCase().includes(qLower))),
      );
      const withinRadius =
        Boolean(origin && hasCoords) &&
        haversineKm(origin!.lat, origin!.lng, f.latitude as number, f.longitude as number) <= radiusKm;
      if (!(textMatch || withinRadius || (!q && !origin))) continue;
      registered.push({
        id: f.id,
        name: f.name,
        type: f.type as 'HOSPITAL' | 'HEALTH_POST',
        address: f.address,
        phone: f.phone,
        operatingHours: f.operatingHours,
        emergencyAvailable: f.emergencyAvailable === true,
        services: [...(f.services ?? [])],
        latitude: hasCoords ? (f.latitude as number) : null,
        longitude: hasCoords ? (f.longitude as number) : null,
        rating: computeRating(f.feedback),
        beds: summarizeBeds(bedsByFacility.get(f.id) ?? []),
      });
    }
  }

  /* ------------------------------------------------ external map results */
  let external: ExternalPlace[] = [];
  let providerErrorOut = providerError;
  if (origin) {
    try {
      external = await getMapProvider().searchHealthcare({
        text: externalText,
        near: origin,
        bbox: bbox ?? undefined,
        limit: 40,
      });
    } catch {
      providerErrorOut = 'Live map search is temporarily unavailable. Showing PanaNexus facilities only.';
    }
  }

  /* ------------------------------------------------ merge, filter, sort */
  let items = mergeDiscovery(registered, external, origin);

  if (emergency) items = items.filter((i) => i.emergencyAvailable === true);
  if (verifiedOnly) items = items.filter((i) => i.verified);
  if (sourceFilter === 'pananexus') items = items.filter((i) => i.source === 'pananexus');
  if (sourceFilter === 'map') items = items.filter((i) => i.source === 'map');
  if (openNow) {
    items = items.filter((i) =>
      i.source === 'pananexus' ? isOpenNow(i.operatingHours ?? null) === true : false,
    );
  }

  items = sortDiscovery(items, sort);

  const p = parsePage(req.query as Record<string, unknown>, 30, 100);
  const page = items.slice(p.offset, p.offset + p.limit);

  let pageItems: DiscoveryResponseItem[] = page.map((i) => ({ ...i, route: null }));
  if (wantRoute && origin) {
    const targets = pageItems.slice(0, MAX_ROUTE_ENRICHED);
    await Promise.all(
      targets.map(async (item) => {
        item.route = await routeWithFallback(origin as LatLng, { lat: item.latitude, lng: item.longitude });
      }),
    );
  }

  return ok(res, {
    origin,
    place: placeHit
      ? { label: placeHit.label, lat: placeHit.lat, lng: placeHit.lng, bbox: placeHit.bbox, type: placeHit.type }
      : null,
    placeUnresolved,
    providerError: providerErrorOut,
    externalUsed: Boolean(origin) && !providerErrorOut,
    attribution: external.length ? OSM_ATTRIBUTION : null,
    counts: {
      total: items.length,
      registered: items.filter((i) => i.source === 'pananexus').length,
      external: items.filter((i) => i.source === 'map').length,
    },
    items: pageItems,
    meta: pageMeta(p, items.length),
  });
});

/** Convert a free-text place name/landmark to coordinates. */
router.get('/geocode', async (req, res) => {
  const q = str(req.query.q)?.slice(0, 120);
  if (!q) return fail(res, 'VALIDATION_ERROR', 'A search term (q) is required.', 422);
  const lat = num(req.query.lat);
  const lng = num(req.query.lng);
  const near = lat != null && lng != null && isValidLatLng(lat, lng) ? { lat, lng } : null;
  try {
    const results = await getMapProvider().geocode({ query: q, limit: 5, near });
    return ok(res, { results, attribution: OSM_ATTRIBUTION });
  } catch {
    return fail(res, 'PROVIDER_UNAVAILABLE', 'Place search is temporarily unavailable.', 503);
  }
});

/** Reverse geocode a coordinate to a human-readable address. */
router.get('/reverse', async (req, res) => {
  const lat = num(req.query.lat);
  const lng = num(req.query.lng);
  if (lat == null || lng == null || !isValidLatLng(lat, lng)) {
    return fail(res, 'VALIDATION_ERROR', 'Valid lat and lng are required.', 422);
  }
  const label = await getMapProvider().reverse({ lat, lng });
  return ok(res, { label, attribution: OSM_ATTRIBUTION });
});

/** Road-network route between two points, with an honest straight-line fallback. */
router.get('/route', async (req, res) => {
  const fromLat = num(req.query.fromLat);
  const fromLng = num(req.query.fromLng);
  const toLat = num(req.query.toLat);
  const toLng = num(req.query.toLng);
  if (
    fromLat == null ||
    fromLng == null ||
    toLat == null ||
    toLng == null ||
    !isValidLatLng(fromLat, fromLng) ||
    !isValidLatLng(toLat, toLng)
  ) {
    return fail(res, 'VALIDATION_ERROR', 'Valid from/to coordinates are required.', 422);
  }
  const result = await routeWithFallback({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
  return ok(res, { ...result, attribution: result.approximate ? null : OSM_ATTRIBUTION });
});

export default router;
