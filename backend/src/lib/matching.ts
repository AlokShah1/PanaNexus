import { haversineKm } from './geo.js';

export { haversineKm };

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
