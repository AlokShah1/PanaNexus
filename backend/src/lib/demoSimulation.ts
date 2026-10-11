import { db } from '../../prisma/db.js';
import { emitToRoom, emitToUser, tripRoom } from './realtime.js';
import { haversineKm, type LatLng } from './geo.js';
import { routeGeometryWithFallback } from './maps/index.js';
import { demoMode } from '../config/env.js';

const TICK_MS = 2000;
const SPEED_KMH = 42;

export type SimulationState = 'running' | 'paused' | 'arrived';

interface Simulation {
  tripId: string;
  ambulanceId: string;
  emergencyRequestId: string;
  requesterId: string;
  timer: ReturnType<typeof setInterval> | null;
  /** Ordered path the marker follows (road geometry when available). */
  path: LatLng[];
  /** Cumulative distance (km) at each path vertex, for constant-speed interpolation. */
  cumulative: number[];
  totalKm: number;
  traveledKm: number;
  state: SimulationState;
  /** True when the path is a straight-line fallback rather than road geometry. */
  approximate: boolean;
}

const active = new Map<string, Simulation>();

/**
 * Serialises lifecycle operations per key so concurrent HTTP requests cannot
 * double-start a worker, resume an already-running sim, or race a stop.
 */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}

export function isDemoMode(): boolean {
  return demoMode;
}

export interface ActiveSimulation {
  tripId: string;
  ambulanceId: string;
  emergencyRequestId: string;
  state: SimulationState;
  etaMinutes: number;
  progressPercent: number;
  distanceKm: number;
  approximate: boolean;
}

function etaMinutesFor(sim: Simulation): number {
  const remainingKm = Math.max(0, sim.totalKm - sim.traveledKm);
  return Math.max(1, Math.round((remainingKm / SPEED_KMH) * 60));
}

export function activeSimulations(): ActiveSimulation[] {
  return [...active.values()].map((sim) => ({
    tripId: sim.tripId,
    ambulanceId: sim.ambulanceId,
    emergencyRequestId: sim.emergencyRequestId,
    state: sim.state,
    etaMinutes: etaMinutesFor(sim),
    progressPercent: sim.totalKm > 0 ? Math.min(100, Math.round((sim.traveledKm / sim.totalKm) * 100)) : 0,
    distanceKm: Number(sim.traveledKm.toFixed(2)),
    approximate: sim.approximate,
  }));
}

/** Build cumulative distance markers along an ordered path. */
export function cumulativeDistances(path: LatLng[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < path.length; i += 1) {
    cumulative.push(cumulative[i - 1] + haversineKm(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng));
  }
  return cumulative;
}

/**
 * Interpolate the position along `path` at `traveledKm`. Pure so the movement
 * maths is unit-testable without a database or socket.
 */
export function positionAlongPath(path: LatLng[], cumulative: number[], traveledKm: number): LatLng {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1) return path[0];
  const total = cumulative[cumulative.length - 1] || 0;
  if (traveledKm <= 0 || total <= 0) return path[0];
  if (traveledKm >= total) return path[path.length - 1];
  let i = 1;
  while (i < cumulative.length && cumulative[i] < traveledKm) i += 1;
  const segStart = cumulative[i - 1];
  const segLen = cumulative[i] - segStart || 1;
  const t = (traveledKm - segStart) / segLen;
  const a = path[i - 1];
  const b = path[i];
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function stopTimer(sim: Simulation): void {
  if (sim.timer) {
    clearInterval(sim.timer);
    sim.timer = null;
  }
}

function startTimer(sim: Simulation): void {
  stopTimer(sim);
  sim.timer = setInterval(() => {
    void tick(sim).catch(() => stopSimulationInternal(sim.tripId));
  }, TICK_MS);
  if (typeof sim.timer.unref === 'function') sim.timer.unref();
}

/* --------------------------------------------------------------- lifecycle */

export interface StartSimulationResult {
  tripId: string;
  ambulanceId: string;
  distanceKm: number;
  etaMinutes: number;
  /** True when the path is a straight-line fallback rather than road geometry. */
  approximate: boolean;
  /** True when a simulation for this request was already running. */
  alreadyRunning: boolean;
}

/**
 * Presentation-only: drives an ambulance along a route to the pickup point,
 * publishing trip:location / trip:status over Socket.IO. Only callable when
 * DEMO_MODE is enabled. This never contacts real emergency services.
 */
export async function startSimulation(emergencyRequestId: string): Promise<StartSimulationResult | null> {
  if (!demoMode) return null;
  return withLock(`request:${emergencyRequestId}`, async () => {
    const request = await db.orm.public.EmergencyRequest.where({ id: emergencyRequestId }).first();
    if (!request) return null;

    let trip = await db.orm.public.Trip.where({ emergencyRequestId }).first();
    let ambulance = trip ? await db.orm.public.Ambulance.where({ id: trip.ambulanceId }).first() : null;
    if (!trip || !ambulance) {
      ambulance = await db.orm.public.Ambulance.where({ status: 'AVAILABLE' }).first();
      if (!ambulance) return null;
      await db.orm.public.Ambulance.where({ id: ambulance.id }).update({ status: 'ASSIGNED' });
      await db.orm.public.EmergencyRequest.where({ id: request.id }).update({ status: 'ASSIGNED' });
      trip = await db.orm.public.Trip.create({
        emergencyRequestId: request.id,
        ambulanceId: ambulance.id,
        status: 'EN_ROUTE',
        isSimulation: true,
      });
    } else if (!trip.isSimulation) {
      await db.orm.public.Trip.where({ id: trip.id }).update({ isSimulation: true });
    }

    if (active.has(trip.id)) {
      const sim = active.get(trip.id)!;
      return {
        tripId: trip.id,
        ambulanceId: ambulance.id,
        distanceKm: Number((sim.totalKm - sim.traveledKm).toFixed(2)),
        etaMinutes: etaMinutesFor(sim),
        approximate: sim.approximate,
        alreadyRunning: true,
      };
    }

    const from: LatLng = {
      lat: ambulance.latitude ?? request.pickupLatitude - 0.02,
      lng: ambulance.longitude ?? request.pickupLongitude - 0.02,
    };
    const to: LatLng = { lat: request.pickupLatitude, lng: request.pickupLongitude };

    const geometry = await routeGeometryWithFallback(from, to);
    const path = geometry.coordinates.length >= 2 ? geometry.coordinates : [from, to];
    const cumulative = cumulativeDistances(path);
    const totalKm = Math.max(cumulative[cumulative.length - 1] || 0, 0.05);

    const sim: Simulation = {
      tripId: trip.id,
      ambulanceId: ambulance.id,
      emergencyRequestId: request.id,
      requesterId: request.requesterId,
      timer: null,
      path,
      cumulative,
      totalKm,
      traveledKm: 0,
      state: 'running',
      approximate: geometry.approximate,
    };
    active.set(trip.id, sim);
    startTimer(sim);

    const startEvent = {
      tripId: trip.id,
      emergencyRequestId: request.id,
      status: 'EN_ROUTE',
      state: 'EN_ROUTE',
      isSimulation: true,
      approximate: sim.approximate,
    };
    emitToUser(request.requesterId, 'trip:status', startEvent);
    emitToRoom(tripRoom(trip.id), 'trip:status', startEvent);

    return {
      tripId: trip.id,
      ambulanceId: ambulance.id,
      distanceKm: Number(totalKm.toFixed(2)),
      etaMinutes: etaMinutesFor(sim),
      approximate: sim.approximate,
      alreadyRunning: false,
    };
  });
}

/** Pause a running simulation without clearing its progress. */
export async function pauseSimulation(tripId: string): Promise<boolean> {
  return withLock(`sim:${tripId}`, async () => {
    const sim = active.get(tripId);
    if (!sim || sim.state !== 'running') return false;
    stopTimer(sim);
    sim.state = 'paused';
    const paused = { tripId, status: 'EN_ROUTE', state: 'PAUSED', isSimulation: true };
    emitToRoom(tripRoom(tripId), 'trip:status', paused);
    emitToUser(sim.requesterId, 'trip:status', paused);
    return true;
  });
}

/** Resume a paused simulation from where it stopped. */
export async function resumeSimulation(tripId: string): Promise<boolean> {
  return withLock(`sim:${tripId}`, async () => {
    const sim = active.get(tripId);
    if (!sim || sim.state !== 'paused') return false;
    sim.state = 'running';
    startTimer(sim);
    const resumed = { tripId, status: 'EN_ROUTE', state: 'EN_ROUTE', isSimulation: true, approximate: sim.approximate };
    emitToRoom(tripRoom(tripId), 'trip:status', resumed);
    emitToUser(sim.requesterId, 'trip:status', resumed);
    return true;
  });
}

function stopSimulationInternal(tripId: string): boolean {
  const sim = active.get(tripId);
  if (!sim) return false;
  stopTimer(sim);
  active.delete(tripId);
  return true;
}

/** Stop a simulation and remove its worker (leaves the trip/ambulance state as-is). */
export async function stopSimulation(tripId: string): Promise<boolean> {
  return withLock(`sim:${tripId}`, async () => stopSimulationInternal(tripId));
}

/**
 * Stop a simulation and undo its effects: clear the location pings it produced,
 * return the ambulance to AVAILABLE and reopen the request. Demo-only.
 */
export async function resetSimulation(tripId: string): Promise<boolean> {
  return withLock(`sim:${tripId}`, async () => {
    const sim = active.get(tripId);
    stopSimulationInternal(tripId);
    if (!sim) return false;
    try {
      await db.orm.public.LocationUpdate.where({ tripId }).delete();
    } catch {
      // no ping history
    }
    try {
      await db.orm.public.Trip.where({ id: tripId }).update({ status: 'EN_ROUTE', arrivedAt: null });
      await db.orm.public.Ambulance.where({ id: sim.ambulanceId }).update({ status: 'AVAILABLE' });
      await db.orm.public.EmergencyRequest.where({ id: sim.emergencyRequestId }).update({ status: 'PENDING' });
    } catch {
      // best-effort demo reset
    }
    const reset = { tripId, status: 'EN_ROUTE', state: 'RESET', isSimulation: true };
    emitToRoom(tripRoom(tripId), 'trip:status', reset);
    emitToUser(sim.requesterId, 'trip:status', reset);
    return true;
  });
}

/** Stop every worker — called on graceful shutdown. */
export function stopAllSimulations(): void {
  for (const id of [...active.keys()]) stopSimulationInternal(id);
}

/* -------------------------------------------------------------------- tick */

async function tick(sim: Simulation): Promise<void> {
  if (sim.state !== 'running') return;
  const stepKm = (SPEED_KMH * TICK_MS) / 3_600_000;
  sim.traveledKm = Math.min(sim.totalKm, sim.traveledKm + stepKm);
  const point = positionAlongPath(sim.path, sim.cumulative, sim.traveledKm);

  await db.orm.public.Ambulance.where({ id: sim.ambulanceId }).update({
    latitude: point.lat,
    longitude: point.lng,
  });
  const loc = await db.orm.public.LocationUpdate.create({
    tripId: sim.tripId,
    latitude: point.lat,
    longitude: point.lng,
    accuracy: 12,
  });
  const event = {
    tripId: sim.tripId,
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy: loc.accuracy ?? null,
    recordedAt: loc.recordedAt,
    isSimulation: true,
    etaApproximate: sim.approximate,
    etaMinutes: etaMinutesFor(sim),
  };
  emitToRoom(tripRoom(sim.tripId), 'trip:location', event);
  emitToUser(sim.requesterId, 'trip:location', event);

  if (sim.traveledKm >= sim.totalKm) {
    const nowIso = new Date().toISOString();
    stopTimer(sim);
    sim.state = 'arrived';
    await db.orm.public.Trip.where({ id: sim.tripId }).update({ status: 'ARRIVED', arrivedAt: nowIso });
    await db.orm.public.EmergencyRequest.where({ id: sim.emergencyRequestId }).update({ status: 'ARRIVED' });
    const done = {
      tripId: sim.tripId,
      emergencyRequestId: sim.emergencyRequestId,
      status: 'ARRIVED',
      state: 'ARRIVED',
      isSimulation: true,
    };
    emitToRoom(tripRoom(sim.tripId), 'trip:status', done);
    emitToUser(sim.requesterId, 'trip:status', done);
    active.delete(sim.tripId);
  }
}
