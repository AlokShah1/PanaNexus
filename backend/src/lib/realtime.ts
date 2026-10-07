export interface RealtimeEmit {
  toUser(userId: string, event: string, payload: unknown): void;
  toRoom(room: string, event: string, payload: unknown): void;
}

type Handler = RealtimeEmit;

let handler: Handler | null = null;

export function setRealtime(h: Handler | null): void {
  handler = h;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  handler?.toUser(userId, event, payload);
}

export function emitToRoom(room: string, event: string, payload: unknown): void {
  handler?.toRoom(room, event, payload);
}

export function tripRoom(tripId: string): string {
  return `trip:${tripId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export const OPERATOR_ROOM = 'operators:available';
