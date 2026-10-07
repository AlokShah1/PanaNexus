import { db } from '../../prisma/db.js';
import { emitToRoom, emitToUser, tripRoom } from './realtime.js';
import { haversineKm } from './matching.js';
import { demoMode } from '../config/env.js';

const TICK_MS = 2000;
const SPEED_KMH = 42;

interface Simulation {
  tripId: string;
  ambulanceId: string;
  emergencyRequestId: string;
  requesterId: string;
  timer: ReturnType<typeof setInterval>;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  progress: number;
  totalKm: number;
}

const active = new Map<string, Simulation>();

export function isDemoMode(): boolean {
  return demoMode;
}

export function activeSimulations(): string[] {
  return [...active.keys()];
}

function stop(tripId: string): boolean {
  const sim = active.get(tripId);
  if (!sim) return false;
  clearInterval(sim.timer);
  active.delete(tripId);
  return true;
}

export async function stopSimulation(tripId: string): Promise<boolean> {
  return stop(tripId);
}

export function stopAllSimulations(): void {
  for (const id of [...active.keys()]) stop(id);
}

export interface StartSimulationResult {
  tripId: string;
  ambulanceId: string;
  distanceKm: number;
  etaMinutes: number;
}

/**
 * Presentation-only: drives an ambulance along a straight interpolated route to
 * the pickup point, publishing trip:location / trip:status over Socket.IO.
 * Only callable when DEMO_MODE is enabled.
 */
export async function startSimulation(emergencyRequestId: string): Promise<StartSimulationResult | null> {
  if (!demoMode) return null;
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

  if (active.has(trip.id)) return { tripId: trip.id, ambulanceId: ambulance.id, distanceKm: 0, etaMinutes: 0 };

  const fromLat = ambulance.latitude ?? request.pickupLatitude - 0.02;
  const fromLng = ambulance.longitude ?? request.pickupLongitude - 0.02;
  const toLat = request.pickupLatitude;
  const toLng = request.pickupLongitude;
  const totalKm = Math.max(haversineKm(fromLat, fromLng, toLat, toLng), 0.05);

  const sim: Simulation = {
    tripId: trip.id,
    ambulanceId: ambulance.id,
    emergencyRequestId: request.id,
    requesterId: request.requesterId,
    timer: setInterval(() => undefined, TICK_MS),
    fromLat,
    fromLng,
    toLat,
    toLng,
    progress: 0,
    totalKm,
  };
  clearInterval(sim.timer);
  sim.timer = setInterval(() => {
    void tick(sim).catch(() => stop(sim.tripId));
  }, TICK_MS);
  active.set(trip.id, sim);

  const startEvent = { tripId: trip.id, emergencyRequestId: request.id, status: 'EN_ROUTE', state: 'EN_ROUTE', isSimulation: true };
  emitToUser(request.requesterId, 'trip:status', startEvent);
  emitToRoom(tripRoom(trip.id), 'trip:status', startEvent);

  return { tripId: trip.id, ambulanceId: ambulance.id, distanceKm: Number(totalKm.toFixed(2)), etaMinutes: Math.max(1, Math.round((totalKm / SPEED_KMH) * 60)) };
}

async function tick(sim: Simulation): Promise<void> {
  const stepKm = (SPEED_KMH / 3600) * (TICK_MS / 1000);
  sim.progress = Math.min(1, sim.progress + stepKm / sim.totalKm);
  const lat = sim.fromLat + (sim.toLat - sim.fromLat) * sim.progress;
  const lng = sim.fromLng + (sim.toLng - sim.fromLng) * sim.progress;
  const accuracy = 8 + Math.round((1 - sim.progress) * 10);

  await db.orm.public.Ambulance.where({ id: sim.ambulanceId }).update({
    latitude: lat,
    longitude: lng,
  });
  const update = await db.orm.public.LocationUpdate.create({
    tripId: sim.tripId,
    latitude: lat,
    longitude: lng,
    accuracy,
  });
  const event = {
    tripId: sim.tripId,
    latitude: update.latitude,
    longitude: update.longitude,
    accuracy: update.accuracy ?? null,
    recordedAt: update.recordedAt,
    isSimulation: true,
    etaMinutes: Math.max(1, Math.round(((sim.totalKm * (1 - sim.progress)) / SPEED_KMH) * 60)),
  };
  emitToRoom(tripRoom(sim.tripId), 'trip:location', event);
  emitToUser(sim.requesterId, 'trip:location', event);

  if (sim.progress >= 1) {
    const nowIso = new Date().toISOString();
    await db.orm.public.Trip.where({ id: sim.tripId }).update({ status: 'ARRIVED', arrivedAt: nowIso });
    await db.orm.public.EmergencyRequest.where({ id: sim.emergencyRequestId }).update({ status: 'ARRIVED' });
    const done = { tripId: sim.tripId, emergencyRequestId: sim.emergencyRequestId, status: 'ARRIVED', state: 'ARRIVED', isSimulation: true };
    emitToRoom(tripRoom(sim.tripId), 'trip:status', done);
    emitToUser(sim.requesterId, 'trip:status', done);
    stop(sim.tripId);
  }
}