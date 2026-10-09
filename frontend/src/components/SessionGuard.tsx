'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { refreshSession, useSession } from '@/lib/session';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

const HEARTBEAT_THROTTLE_MS = 60_000;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

/**
 * Client-side companion to the server-enforced session policy.
 *
 * - Sends a throttled heartbeat while the user is genuinely active so an engaged
 *   session is never dropped by the idle timer or by background polling.
 * - Warns ahead of the idle deadline with a "continue working" option.
 * - Before logging out it re-confirms with the server, so a session kept alive
 *   by another tab/request is not dropped by a stale local countdown.
 */
export default function SessionGuard() {
  const router = useRouter();
  const { status, session, signOut } = useSession();
  const [now, setNow] = useState(() => Date.now());
  const lastHeartbeat = useRef(0);
  const ending = useRef(false);

  const expire = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    try {
      await signOut();
    } finally {
      router.push('/login?reason=expired');
      router.refresh();
    }
  }, [router, signOut]);

  const heartbeat = useCallback(async () => {
    if (status !== 'authed') return;
    const next = await refreshSession();
    if (!next) await expire();
  }, [status, expire]);

  // Keep a live clock while signed in.
  useEffect(() => {
    if (status !== 'authed' || !session) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status, session]);

  // Throttled heartbeat on real user activity.
  useEffect(() => {
    if (status !== 'authed') return;
    const onActivity = () => {
      const t = Date.now();
      if (t - lastHeartbeat.current < HEARTBEAT_THROTTLE_MS) return;
      lastHeartbeat.current = t;
      void heartbeat();
    };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
    };
  }, [status, heartbeat]);

  // Re-check the session when the tab regains focus after being away.
  useEffect(() => {
    if (status !== 'authed') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void heartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status, heartbeat]);

  // Handle a session-expired signal raised by any API call.
  useEffect(() => {
    const onExpired = () => void expire();
    window.addEventListener('pn:session-expired', onExpired);
    return () => window.removeEventListener('pn:session-expired', onExpired);
  }, [expire]);

  const remainingMs = session ? new Date(session.idleExpiresAt).getTime() - now : Number.POSITIVE_INFINITY;
  const warningMs = (session?.warningSeconds ?? 120) * 1000;
  const warning =
    status === 'authed' && !!session && remainingMs > 0 && remainingMs <= warningMs;

  const lastConfirm = useRef(0);
  useEffect(() => {
    if (status !== 'authed' || !session || remainingMs > 0) return;
    const t = Date.now();
    if (t - lastConfirm.current < 5000) return;
    lastConfirm.current = t;
    // Local deadline hit: confirm with the server before ending the session.
    void heartbeat();
  }, [remainingMs, status, session, heartbeat]);

  if (status !== 'authed' || !session || !warning) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Session about to expire"
      className="fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200"
    >
      <p className="text-sm font-bold text-ink">Still there?</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
        For your security you&apos;ll be signed out in{' '}
        <span className="font-semibold text-ink">{formatRemaining(remainingMs)}</span> due to inactivity.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void heartbeat();
          }}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Continue working
        </button>
        <button
          type="button"
          onClick={() => void expire()}
          className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
