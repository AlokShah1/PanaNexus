export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres (used for straight-line proximity + ordering). */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Axis-aligned box around a point for a given radius. Longitude is clamped near the poles. */
export function boundingBox(center: LatLng, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
  const lngDelta = radiusKm / (111.32 * cosLat);
  return {
    south: Math.max(-90, center.lat - latDelta),
    north: Math.min(90, center.lat + latDelta),
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  };
}

export function isWithinBBox(point: LatLng, box: BoundingBox): boolean {
  return point.lat >= box.south && point.lat <= box.north && point.lng >= box.west && point.lng <= box.east;
}

/** Nominatim viewbox order is left(lon),top(lat),right(lon),bottom(lat). */
export function boundingBoxToViewbox(box: BoundingBox): string {
  return [box.west, box.north, box.east, box.south].map((n) => n.toFixed(6)).join(',');
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
