import { apiGet, type PageMeta } from './api';

export type PlaceCategory = 'HOSPITAL' | 'HEALTH_POST' | 'CLINIC' | 'DOCTORS' | 'PHARMACY' | 'OTHER';
export type DiscoverySource = 'pananexus' | 'map';
export type SortKey = 'relevance' | 'distance' | 'name' | 'rating';

export interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface RouteInfo {
  provider: string;
  distanceKm: number;
  durationMinutes: number;
  straightLineKm: number;
  approximate: boolean;
}

export interface BedSummary {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  wards: number;
}

export interface HealthcarePlace {
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
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  rating: { avg: number | null; count: number };
  beds: BedSummary | null;
  sourceLabel: string;
  attribution: string | null;
  route: RouteInfo | null;
}

export interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
  bbox: BoundingBox | null;
  type: string | null;
  importance: number | null;
}

export interface HealthcareSearchResponse {
  origin: { lat: number; lng: number } | null;
  place: { label: string; lat: number; lng: number; bbox: BoundingBox | null; type: string | null } | null;
  placeUnresolved: string | null;
  providerError: string | null;
  externalUsed: boolean;
  attribution: string | null;
  counts: { total: number; registered: number; external: number };
  items: HealthcarePlace[];
  meta: PageMeta;
}

export interface HealthcareSearchParams {
  q?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  type?: string;
  emergency?: boolean;
  openNow?: boolean;
  verified?: boolean;
  source?: string;
  sort?: SortKey;
  route?: boolean;
  page?: number;
  limit?: number;
}

export const HEALTHCARE_CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All care' },
  { value: 'HOSPITAL', label: 'Hospitals' },
  { value: 'CLINIC', label: 'Clinics' },
  { value: 'HEALTH_POST', label: 'Health posts' },
  { value: 'PHARMACY', label: 'Pharmacies' },
];

export const HEALTHCARE_SORTS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'distance', label: 'Nearest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'rating', label: 'Top rated' },
];

function buildQuery(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export function searchHealthcare(params: HealthcareSearchParams, signal?: AbortSignal) {
  const query = buildQuery({
    q: params.q,
    lat: params.lat,
    lng: params.lng,
    radiusKm: params.radiusKm,
    type: params.type,
    emergency: params.emergency ? 'true' : undefined,
    openNow: params.openNow ? 'true' : undefined,
    verified: params.verified ? 'true' : undefined,
    source: params.source,
    sort: params.sort,
    route: params.route ? 'true' : undefined,
    page: params.page,
    limit: params.limit,
  });
  return apiGet<HealthcareSearchResponse>(`/healthcare/search?${query}`, signal ? { signal } : undefined);
}

export function geocodePlaces(query: string, near?: { lat: number; lng: number } | null) {
  const params = buildQuery({ q: query, lat: near?.lat, lng: near?.lng });
  return apiGet<{ results: GeocodeHit[]; attribution: string }>(`/healthcare/geocode?${params}`);
}

export function reversePlace(lat: number, lng: number) {
  return apiGet<{ label: string | null; attribution: string }>(`/healthcare/reverse?lat=${lat}&lng=${lng}`);
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
