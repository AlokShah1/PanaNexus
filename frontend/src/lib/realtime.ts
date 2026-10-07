'use client';

import { io, type Socket } from 'socket.io-client';
import { API_ROOT } from '@/lib/api';

let socket: Socket | null = null;

export function getRealtime(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (socket && socket.connected) return socket;
  if (!socket) {
    socket = io(API_ROOT, {
      withCredentials: true,
      transports: ['websocket'],
      reconnectionDelay: 2000,
    });
    socket.on('connect_error', () => {
      socket?.disconnect();
      socket = null;
    });
  }
  return socket;
}

export type TripStatusEvent = {
  tripId: string;
  emergencyRequestId: string;
  status: string;
  state: string;
  ambulance?: {
    id: string;
    registrationNumber: string;
    type: string;
    driverName: string | null;
    driverPhone: string | null;
  } | null;
  ambulanceStatus?: string;
};

export type TripLocationEvent = {
  tripId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
};