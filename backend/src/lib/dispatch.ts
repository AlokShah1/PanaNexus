import { db } from '../../prisma/db.js';
import { emitToRoom, OPERATOR_ROOM } from './realtime.js';
import { rankAmbulances } from './matching.js';
import { haversineKm } from './geo.js';
import { routeWithFallback } from './maps/index.js';
import { notify } from './notify.js';

/**
 * A request that no operator accepts within {@link ESCALATION_AFTER_MS} is
 * re-broadcast on {@link ESCALATION_INTERVAL_MS} cadence, paging progressively
 * more of the available fleet. After {@link MAX_ESCALATIONS} rounds the request
 * is surfaced to administrators so it cannot sit silently unanswered.
 */
export const ESCALATION_AFTER_MS = 45_000;
export const ESCALATION_INTERVAL_MS = 30_000;
export const MAX_ESCALATIONS = 6;

/** Thrown inside a dispatch transaction when a claim loses a race. */
export class DispatchConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DispatchConflictError';
  }
}

const escalationState = new Map<string, { count: number; lastAt: number }>();

export function resetDispatchState(): void {
  escalationState.clear();
}

/** Pure predicate: is this open request due for another escalation round? */
export function dueForEscalation(count: number, lastAtMs: number, nowMs: number): boolean {
  if (count >= MAX_ESCALATIONS) return false;
  if (lastAtMs > 0 && nowMs - lastAtMs < ESCALATION_INTERVAL_MS) return false;
  return true;
}

type OpenRequest = {
  id: string;
  status: string;
  category: string;
  priority: string;
  pickupLatitude: number;
  pickupLongitude: number;
  createdAt: string;
};

async function escalateOne(r: OpenRequest, round: number): Promise<void> {
  const available = await db.orm.public.Ambulance.where({ status: 'AVAILABLE' }).include('operator').all();
  const dispatchable = available.filter((a) => a.operator && a.operator.verificationStatus === 'VERIFIED');
  const ranked = rankAmbulances(dispatchable, {
    pickupLatitude: r.pickupLatitude,
    pickupLongitude: r.pickupLongitude,
    priority: r.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    category: r.category,
  });
  // Widen the page with each round so a request is not repeatedly shown to only
  // the same few units that are ignoring it.
  const reach = Math.min(3 + round * 2, 12);
  const byId = new Map(dispatchable.map((a) => [a.id, a]));

  emitToRoom(OPERATOR_ROOM, 'emergency:new', {
    id: r.id,
    state: 'SEARCHING',
    category: r.category,
    priority: r.priority,
    escalated: true,
    round,
    createdAt: r.createdAt,
  });

  for (const m of ranked.slice(0, reach)) {
    const a = byId.get(m.id);
    if (a?.operatorId) {
      await notify(a.operatorId, {
        type: 'EMERGENCY',
        title: round === 1 ? 'Emergency still unassigned' : `Emergency escalation (round ${round})`,
        body: `${r.category.replace(/_/g, ' ').toLowerCase()} · ${Math.round(m.distanceKm)} km away — awaiting acceptance`,
        link: '/ambulance',
      });
    }
  }

  if (round >= MAX_ESCALATIONS) {
    const admins = await db.orm.public.User.where({ role: 'ADMIN' }).all();
    for (const admin of admins) {
      await notify(admin.id, {
        type: 'EMERGENCY',
        title: 'Emergency unassigned — needs attention',
        body: `Request ${r.id.slice(0, 8)} has gone unanswered through all escalation rounds.`,
        link: '/admin',
      });
    }
  }

  await db.orm.public.AuditLog.create({
    action: 'EMERGENCY_ESCALATED',
    entity: 'EmergencyRequest',
    entityId: r.id,
    actorId: null,
    metadata: JSON.stringify({ round }),
  }).catch(() => undefined);
}

async function collectOpen(nowMs: number, status: 'PENDING' | 'MATCHED'): Promise<OpenRequest[]> {
  const rows = (await db.orm.public.EmergencyRequest.where({ status }).all()) as OpenRequest[];
  return rows.filter((r) => {
    const created = Date.parse(r.createdAt);
    return Number.isFinite(created) && nowMs - created >= ESCALATION_AFTER_MS;
  });
}

/** One escalation sweep. Exported so it can be driven directly by tests. */
export async function escalateOpenRequests(nowMs = Date.now()): Promise<{ escalated: string[] }> {
  const open = [...(await collectOpen(nowMs, 'PENDING')), ...(await collectOpen(nowMs, 'MATCHED'))];
  const escalated: string[] = [];
  for (const r of open) {
    const state = escalationState.get(r.id) ?? { count: 0, lastAt: 0 };
    if (!dueForEscalation(state.count, state.lastAt, nowMs)) continue;
    const round = state.count + 1;
    escalationState.set(r.id, { count: round, lastAt: nowMs });
    try {
      await escalateOne(r, round);
      escalated.push(r.id);
    } catch (err) {
      console.error('emergency escalation failed', r.id, err);
    }
  }
  return { escalated };
}

let loop: ReturnType<typeof setInterval> | null = null;

export function startDispatchLoop(): void {
  if (loop) return;
  loop = setInterval(() => {
    void escalateOpenRequests().catch(() => undefined);
  }, ESCALATION_INTERVAL_MS);
  if (typeof loop.unref === 'function') loop.unref();
}

export function stopDispatchLoop(): void {
  if (loop) {
    clearInterval(loop);
    loop = null;
  }
}

export interface RoadEta {
  minutes: number;
  distanceKm: number;
  /** True when the provider could not route by road and this is a straight-line estimate. */
  approximate: boolean;
}

/**
 * Road-network ETA for dispatch. Best-effort: if the routing provider is slow or
 * unavailable we fall back to an honestly-labelled straight-line estimate rather
 * than blocking the request.
 */
export async function roadEtaMinutes(
  fromLat: number | null,
  fromLng: number | null,
  toLat: number,
  toLng: number,
  timeoutMs = 1500,
): Promise<RoadEta | null> {
  if (fromLat == null || fromLng == null || !Number.isFinite(fromLat) || !Number.isFinite(fromLng)) {
    return null;
  }
  const straight = Number(haversineKm(fromLat, fromLng, toLat, toLng).toFixed(2));
  try {
    const result = await Promise.race([
      routeWithFallback({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('eta timeout')), timeoutMs)),
    ]);
    return { minutes: result.durationMinutes, distanceKm: result.distanceKm, approximate: result.approximate };
  } catch {
    return { minutes: Math.max(1, Math.round((straight / 40) * 60)), distanceKm: straight, approximate: true };
  }
}
