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

export type SessionState = {
  status: 'loading' | 'authed' | 'guest';
  profile: SessionProfile | null;
};

const PRO_ROLES = new Set(['DOCTOR', 'FACILITY_STAFF', 'AMBULANCE_OPERATOR']);

const state: SessionState = { status: 'loading', profile: null };
let inflight: Promise<SessionState> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

async function load(force: boolean): Promise<SessionState> {
  if (!force && !inflight && state.status !== 'loading') return state;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const res = await apiGet<{ profile: SessionProfile }>('/auth/me');
    const next: SessionState = res.ok && res.data?.profile
      ? { status: 'authed', profile: res.data.profile }
      : { status: 'guest', profile: null };
    state.status = next.status;
    state.profile = next.profile;
    inflight = null;
    notify();
    return next;
  })();
  return inflight;
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
    state.status = 'guest';
    state.profile = null;
    notify();
  }, []);

  return { status: state.status, profile: state.profile, refresh, signOut };
}

export function isProRole(role: string | undefined | null): boolean {
  return PRO_ROLES.has(role ?? '');
}

export function needsVerification(profile: SessionProfile | null): boolean {
  if (!profile) return false;
  return isProRole(profile.role) && (profile.verificationStatus === 'PENDING' || profile.verificationStatus === 'REJECTED');
}
