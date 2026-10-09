import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { db } from '../../prisma/db.js';
import { env } from '../config/env.js';
import { resolveSession } from '../lib/session.js';
import { OPERATOR_ROOM, setRealtime, tripRoom, userRoom } from '../lib/realtime.js';

function readCookieToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === 'hc_session') return rest.join('=');
  }
  return undefined;
}

const ACTIVE_TRIP_STATUSES = new Set(['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRANSPORTING']);

export function attachRealtime(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: env.NODE_ENV === 'production'
        ? [env.FRONTEND_URL.replace(/\/+$/, '')]
        : ['http://localhost:3000', env.FRONTEND_URL.replace(/\/+$/, '')],
      credentials: true,
    },
  });

  setRealtime({
    toUser: (userId, event, payload) => {
      void io.to(userRoom(userId)).emit(event, payload);
    },
    toRoom: (room, event, payload) => {
      void io.to(room).emit(event, payload);
    },
  });

  io.use((socket, next) => {
    void (async () => {
      const token =
        readCookieToken(socket.handshake.headers.cookie) ??
        (typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined);
      const resolution = await resolveSession(token);
      if (resolution.status !== 'valid') return next(new Error('UNAUTHORIZED'));
      const user = await db.orm.public.User.where({ id: resolution.session.userId }).first();
      if (!user || user.verificationStatus === 'SUSPENDED') return next(new Error('UNAUTHORIZED'));
      socket.data.userId = user.id;
      socket.data.role = user.role;
      next();
    })().catch(() => next(new Error('UNAUTHORIZED')));
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    const role = socket.data.role as string;
    void socket.join(userRoom(userId));

    void (async () => {
      try {
        const user = await db.orm.public.User.where({ id: userId }).first();
        if (!user) return;
        if (user.role === 'AMBULANCE_OPERATOR' && user.verificationStatus === 'VERIFIED') {
          void socket.join(OPERATOR_ROOM);
        }
        const tripIds: string[] = [];
        if (user.role !== 'ADMIN') {
          const requests = await db.orm.public.EmergencyRequest.where({ requesterId: userId }).all();
          for (const r of requests.filter((x) => ACTIVE_TRIP_STATUSES.has(x.status)).slice(-10)) {
            const trip = await db.orm.public.Trip.where({ emergencyRequestId: r.id }).first();
            if (trip) tripIds.push(trip.id);
          }
        }
        if (user.role === 'AMBULANCE_OPERATOR' || user.role === 'ADMIN') {
          const fleet = await db.orm.public.Ambulance.where({ operatorId: userId }).all();
          for (const a of fleet) {
            const trips = await db.orm.public.Trip.where({ ambulanceId: a.id }).all();
            for (const t of trips) if (ACTIVE_TRIP_STATUSES.has(t.status)) tripIds.push(t.id);
          }
        }
        for (const id of new Set(tripIds)) void socket.join(tripRoom(id));
      } catch (err) {
        console.error('realtime connection setup failed', err);
      }
    })();

    socket.on('trip:subscribe', (subId: unknown) => {
      void (async () => {
        if (typeof subId !== 'string' || subId.length > 64) return;
        try {
          let trip = await db.orm.public.Trip.where({ id: subId }).first();
          if (!trip) trip = await db.orm.public.Trip.where({ emergencyRequestId: subId }).first();
          if (!trip) return;
          const request = await db.orm.public.EmergencyRequest.where({ id: trip.emergencyRequestId }).first();
          if (!request) return;
          const isRequester = request.requesterId === userId;
          let hasAccess = isRequester || role === 'ADMIN';
          if (!hasAccess && role === 'AMBULANCE_OPERATOR') {
            const ambulance = await db.orm.public.Ambulance.where({ id: trip.ambulanceId }).first();
            hasAccess = ambulance?.operatorId === userId;
          }
          if (hasAccess) void socket.join(tripRoom(trip.id));
        } catch (err) {
          console.error('trip:subscribe failed', err);
        }
      })();
    });

    socket.on('trip:unsubscribe', (subId: unknown) => {
      void (async () => {
        if (typeof subId !== 'string' || subId.length > 64) return;
        try {
          let trip = await db.orm.public.Trip.where({ id: subId }).first();
          if (!trip) trip = await db.orm.public.Trip.where({ emergencyRequestId: subId }).first();
          if (trip) void socket.leave(tripRoom(trip.id));
        } catch (err) {
          console.error('trip:unsubscribe failed', err);
        }
      })();
    });
  });

  return io;
}
