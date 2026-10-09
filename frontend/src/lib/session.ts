'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

export type SessionProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'SUSPENDED';
  phone: string | null;
  facilityId: string | null;
  createdAt: string;
};

export type SessionInfo = {
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  warningSeconds: number;
};

export type SessionState = {
  status: 'loading' | 'authed' | 'guest';
  profile: SessionProfile | null;
  session: SessionInfo | null;
};

const PRO_ROLES = new Set(['DOCTOR', 'FACILITY_STAFF', 'AMBULANCE_OPERATOR']);

const state: SessionState = { status: 'loading', profile: null, session: null };
let inflight: Promise<SessionState> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setState(next: SessionState): void {
  state.status = next.status;
  state.profile = next.profile;
  state.session = next.session;
  notify();
}

async function load(force: boolean): Promise<SessionState> {
  if (!force && !inflight && state.status !== 'loading') return state;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const res = await apiGet<{ profile: SessionProfile; session?: SessionInfo }>('/auth/me');
    const next: SessionState =
      res.ok && res.data?.profile
        ? { status: 'authed', profile: res.data.profile, session: res.data.session ?? null }
        : { status: 'guest', profile: null, session: null };
    inflight = null;
    setState(next);
    return next;
  })();
  return inflight;
}

/** Force a fresh session read (e.g. after login). */
export function reloadSession(): Promise<SessionState> {
  return load(true);
}

/**
 * Heartbeat: resets the server-enforced idle window and returns the refreshed
 * expiry. Returns null when the session has already ended or the network failed.
 */
export async function refreshSession(): Promise<SessionInfo | null> {
  const res = await apiPost<{ session: SessionInfo }>('/auth/heartbeat', {});
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      setState({ status: 'guest', profile: null, session: null });
    }
    return null;
  }
  if (res.data?.session) {
    state.session = res.data.session;
    notify();
    return state.session;
  }
  return null;
}

/** Clear local session state without calling the server (already invalidated). */
export function clearSession(): void {
  setState({ status: 'guest', profile: null, session: null });
}

export function useSession(): SessionState & {
  refresh: () => Promise<SessionState>;
  signOut: () => Promise<void>;
} {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    void load(false);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(() => load(true), []);
  const signOut = useCallback(async () => {
    await apiPost('/auth/logout', {});
    setState({ status: 'guest', profile: null, session: null });
  }, []);

  return { status: state.status, profile: state.profile, session: state.session, refresh, signOut };
}

export function isProRole(role: string | undefined | null): boolean {
  return PRO_ROLES.has(role ?? '');
}

export function needsVerification(profile: SessionProfile | null): boolean {
  if (!profile) return false;
  return isProRole(profile.role) && (profile.verificationStatus === 'PENDING' || profile.verificationStatus === 'REJECTED');
}
