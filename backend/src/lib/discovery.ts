import { haversineKm, type LatLng } from './geo.js';
import { CATEGORY_LABELS, OSM_ATTRIBUTION } from './maps/index.js';
import type { BedSummary } from './facility-view.js';
import type { ExternalPlace, PlaceCategory } from './maps/types.js';

export type DiscoverySource = 'pananexus' | 'map';
export type SortKey = 'relevance' | 'distance' | 'name' | 'rating';
export type { BedSummary };

export interface RegisteredFacilityInput {
  id: string;
  name: string;
  type: 'HOSPITAL' | 'HEALTH_POST';
  address: string;
  phone: string | null;
  operatingHours: string | null;
  emergencyAvailable: boolean;
  services: string[];
  latitude: number | null;
  longitude: number | null;
  rating: { avg: number | null; count: number };
  beds: BedSummary | null;
}

export interface DiscoveryItem {
  id: string;
  externalRef: string | null;
  name: string;
  category: PlaceCategory;
  categoryLabel: string;
  source: DiscoverySource;
  verified: boolean;
  onMap: boolean;
  address: string;
  phone: string | null;
  website: string | null;
  operatingHours: string | null;
  openingHoursRaw: string | null;
  emergencyAvailable: boolean | null;
  services: string[];
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  rating: { avg: number | null; count: number };
  beds: BedSummary | null;
  sourceLabel: string;
  attribution: string | null;
}

/** Merge registered PanaNexus facilities with external provider results, de-duplicating overlap. */
export function mergeDiscovery(
  registered: RegisteredFacilityInput[],
  externalInput: ExternalPlace[],
  origin: LatLng | null,
  mergeRadiusKm = 0.3,
): DiscoveryItem[] {
  const items: DiscoveryItem[] = [];
  const usedExternal = new Set<number>();
  const round = (n: number) => Number(n.toFixed(2));

  // Providers (especially OpenStreetMap) often carry the same venue as both a
  // node and a way; collapse those near-identical, same-named listings.
  const external: ExternalPlace[] = [];
  for (const e of externalInput) {
    const dupe = external.some(
      (k) => normalizeName(k.name) === normalizeName(e.name) && haversineKm(k.lat, k.lng, e.lat, e.lng) <= 0.15,
    );
    if (!dupe) external.push(e);
  }

  for (const f of registered) {
    const hasCoords = typeof f.latitude === 'number' && typeof f.longitude === 'number';
    let matchIdx = -1;
    if (hasCoords && mergeRadiusKm > 0) {
      for (let i = 0; i < external.length; i += 1) {
        if (usedExternal.has(i)) continue;
        const e = external[i];
        if (normalizeName(e.name) !== normalizeName(f.name)) continue;
        const d = haversineKm(f.latitude as number, f.longitude as number, e.lat, e.lng);
        if (d <= mergeRadiusKm) {
          matchIdx = i;
          break;
        }
      }
    }
    const match = matchIdx >= 0 ? external[matchIdx] : null;
    if (matchIdx >= 0) usedExternal.add(matchIdx);

    const distanceKm =
      origin && hasCoords
        ? round(haversineKm(origin.lat, origin.lng, f.latitude as number, f.longitude as number))
        : null;

    items.push({
      id: `facility:${f.id}`,
      externalRef: match?.ref ?? null,
      name: f.name,
      category: f.type,
      categoryLabel: CATEGORY_LABELS[f.type],
      source: 'pananexus',
      verified: true,
      onMap: Boolean(match),
      address: f.address,
      phone: f.phone ?? match?.phone ?? null,
      website: match?.website ?? null,
      operatingHours: f.operatingHours,
      openingHoursRaw: match?.openingHours ?? null,
      emergencyAvailable: f.emergencyAvailable || match?.emergency === true,
      services: f.services ?? [],
      latitude: f.latitude as number,
      longitude: f.longitude as number,
      distanceKm,
      rating: f.rating,
      beds: f.beds,
      sourceLabel: match ? 'PanaNexus verified partner · also on OpenStreetMap' : 'PanaNexus verified partner',
      attribution: match ? OSM_ATTRIBUTION : null,
    });
  }

  external.forEach((e, i) => {
    if (usedExternal.has(i)) return;
    const distanceKm = origin ? round(haversineKm(origin.lat, origin.lng, e.lat, e.lng)) : null;
    items.push({
      id: e.ref,
      externalRef: e.ref,
      name: e.name,
      category: e.category,
      categoryLabel: CATEGORY_LABELS[e.category],
      source: 'map',
      verified: false,
      onMap: true,
      address: e.address,
      phone: e.phone,
      website: e.website,
      operatingHours: null,
      openingHoursRaw: e.openingHours,
      emergencyAvailable: e.emergency,
      services: [],
      latitude: e.lat,
      longitude: e.lng,
      distanceKm,
      rating: { avg: null, count: 0 },
      beds: null,
      sourceLabel: 'Listed on OpenStreetMap — not verified by PanaNexus',
      attribution: OSM_ATTRIBUTION,
    });
  });

  return items;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function sortDiscovery(items: DiscoveryItem[], sort: SortKey): DiscoveryItem[] {
  const byName = (a: DiscoveryItem, b: DiscoveryItem) => a.name.localeCompare(b.name);
  const byDistance = (a: DiscoveryItem, b: DiscoveryItem) => {
    if (a.distanceKm == null && b.distanceKm == null) return byName(a, b);
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  };
  const copy = [...items];
  switch (sort) {
    case 'distance':
      return copy.sort(byDistance);
    case 'name':
      return copy.sort(byName);
    case 'rating':
      return copy.sort((a, b) => {
        const ra = a.rating.avg ?? -1;
        const rb = b.rating.avg ?? -1;
        return rb - ra || byDistance(a, b);
      });
    case 'relevance':
    default:
      return copy.sort((a, b) => Number(b.verified) - Number(a.verified) || byDistance(a, b));
  }
}
