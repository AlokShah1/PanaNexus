import type { BoundingBox, LatLng } from '../geo.js';

export type PlaceCategory = 'HOSPITAL' | 'HEALTH_POST' | 'CLINIC' | 'DOCTORS' | 'PHARMACY' | 'OTHER';

export interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
  bbox: BoundingBox | null;
  /** Provider place class/type, e.g. "place/city", "amenity/hospital". */
  type: string | null;
  importance: number | null;
}

export interface ExternalPlace {
  /** Stable provider reference, e.g. "nominatim:way:253152629". */
  ref: string;
  name: string;
  category: PlaceCategory;
  address: string;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  emergency: boolean | null;
  lat: number;
  lng: number;
  attribution: string;
}

export interface RouteResult {
  provider: string;
  distanceKm: number;
  durationMinutes: number;
  straightLineKm: number;
  /** True when the route is a straight-line estimate rather than a road network route. */
  approximate: boolean;
}

export interface RouteGeometry {
  /** Ordered path from origin to destination. Two points when approximated. */
  coordinates: LatLng[];
  /** True when this is a straight-line fallback rather than road-network geometry. */
  approximate: boolean;
  provider: string;
  distanceKm: number;
  durationMinutes: number;
}

export interface GeocodeQuery {
  query: string;
  limit?: number;
  near?: LatLng | null;
}

export interface HealthcareSearchQuery {
  text: string;
  near?: LatLng | null;
  bbox?: BoundingBox | null;
  limit?: number;
}

export interface RouteQuery {
  from: LatLng;
  to: LatLng;
  mode?: 'driving' | 'walking';
}

export interface MapProvider {
  readonly name: string;
  geocode(query: GeocodeQuery): Promise<GeocodeHit[]>;
  reverse(point: LatLng): Promise<string | null>;
  searchHealthcare(query: HealthcareSearchQuery): Promise<ExternalPlace[]>;
}

export interface RoutingProvider {
  readonly name: string;
  route(query: RouteQuery): Promise<RouteResult>;
  /** Ordered path used by map animation; may be an explicitly-labelled straight line. */
  geometry(query: RouteQuery): Promise<RouteGeometry>;
}

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
