export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SPEED_KMH: Record<Priority, number> = { LOW: 30, MEDIUM: 40, HIGH: 50, CRITICAL: 60 };

// Deterministic heuristic ETA (minutes). Not a trained model; document limitations.
export function predictEtaMinutes(distanceKm: number, priority: Priority): number {
  const speed = SPEED_KMH[priority] ?? 30;
  const minutes = (distanceKm / speed) * 60;
  return Math.max(1, Math.round(minutes));
}

export interface BloodHistoryPoint { date: string; bloodGroup: string; units: number }

// Simple trailing-average forecast per blood group over the most recent `window` points.
export function forecastBloodDemand(history: BloodHistoryPoint[], window = 3): Record<string, number> {
  const byGroup: Record<string, BloodHistoryPoint[]> = {};
  for (const p of history) (byGroup[p.bloodGroup] ??= []).push(p);
  const out: Record<string, number> = {};
  for (const [group, points] of Object.entries(byGroup)) {
    const recent = points.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, window);
    const avg = recent.reduce((s, p) => s + p.units, 0) / Math.max(1, recent.length);
    out[group] = Math.round(avg);
  }
  return out;
}

export interface AllocCandidate { id: string; type: 'BASIC' | 'ADVANCED' | 'ICU'; distanceKm: number; status: string }
export interface AllocRequest { id: string; priority: Priority }

const PRI_RANK: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Greedy deterministic allocation: highest-priority requests first, best-fit ambulance by type then distance.
export function allocateAmbulances(candidates: AllocCandidate[], requests: AllocRequest[]) {
  const free = [...candidates].filter((c) => c.status === 'AVAILABLE');
  const sortedReq = [...requests].sort((a, b) => PRI_RANK[a.priority] - PRI_RANK[b.priority]);
  const assignments: { requestId: string; ambulanceId: string | null }[] = [];
  for (const req of sortedReq) {
    let idx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < free.length; i++) {
      const c = free[i];
      let score: number;
      if (req.priority === 'CRITICAL') score = c.type === 'ICU' ? c.distanceKm : c.distanceKm + 20;
      else if (req.priority === 'HIGH') score = c.type === 'ADVANCED' || c.type === 'ICU' ? c.distanceKm : c.distanceKm + 5;
      else score = c.distanceKm;
      if (score < bestScore) { bestScore = score; idx = i; }
    }
    if (idx >= 0) {
      assignments.push({ requestId: req.id, ambulanceId: free[idx].id });
      free.splice(idx, 1);
    } else {
      assignments.push({ requestId: req.id, ambulanceId: null });
    }
  }
  return assignments;
}
