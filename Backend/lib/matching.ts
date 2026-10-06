export type AmbulanceType = 'BASIC' | 'ADVANCED' | 'ICU';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AmbulanceCandidate {
  id: string;
  latitude: number | null;
  longitude: number | null;
  type: AmbulanceType;
  status: string;
}

export interface EmergencyRequestInput {
  pickupLatitude: number;
  pickupLongitude: number;
  priority: Priority;
  category: string;
}

export interface RankedAmbulance {
  id: string;
  distanceKm: number;
  score: number;
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function typeSuitability(type: AmbulanceType, req: EmergencyRequestInput): number {
  if (req.priority === 'CRITICAL') return type === 'ICU' ? 1 : 0;
  if (req.priority === 'HIGH') return type === 'ADVANCED' || type === 'ICU' ? 1 : 0.5;
  return 0.5;
}

// Deterministic, rule-based ranking.
// Lower score wins. Distance dominates; type suitability and CRITICAL-ICU mismatch adjust.
export function rankAmbulances(candidates: AmbulanceCandidate[], req: EmergencyRequestInput): RankedAmbulance[] {
  return candidates
    .filter((a) => a.status === 'AVAILABLE' && a.latitude != null && a.longitude != null)
    .map((a) => {
      const distanceKm = haversineKm(a.latitude as number, a.longitude as number, req.pickupLatitude, req.pickupLongitude);
      const suitability = typeSuitability(a.type, req);
      const icuMismatchPenalty = req.priority === 'CRITICAL' && a.type !== 'ICU' ? 5 : 0;
      const score = distanceKm - suitability * 2 + icuMismatchPenalty;
      return { id: a.id, distanceKm: Number(distanceKm.toFixed(2)), score: Number(score.toFixed(3)) };
    })
    .sort((a, b) => a.score - b.score);
}
