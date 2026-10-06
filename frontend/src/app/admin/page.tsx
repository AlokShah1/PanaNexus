'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { Badge } from '@/components/ui';
import { IconChart, IconRefresh, IconUsers } from '@/components/icons';

type AdminStats = {
  users: { total: number; byRole: Record<string, number> };
  patients: number;
  doctors: number;
  facilities: number;
  appointments: { total: number; byStatus: Record<string, number> };
  emergency: { total: number; active: number; byStatus: Record<string, number> };
  ambulances: { total: number; available: number; byStatus: Record<string, number> };
  blood: { totalUnits: number; pendingRequests: number; availableDonors: number };
  feedback: { averageRating: number | null; count: number };
  auditLogs: number;
};

export default function Page() {
  const [state, setState] = useState<'loading' | 'forbidden' | 'unauth' | 'ok'>('loading');
  const [stats, setStats] = useState<AdminStats | null>(null);

  async function load() {
    setState('loading');
    const r = await apiGet<AdminStats>('/admin/analytics').catch(() => null);
    if (!r) return setState('unauth');
    if (r.ok) {
      setStats(r.data);
      setState('ok');
    } else if (r.code === 'FORBIDDEN') setState('forbidden');
    else setState('unauth');
  }

  useEffect(() => {
    let active = true;
    apiGet<AdminStats>('/admin/analytics')
      .then((r) => {
        if (!active) return;
        if (!r) return setState('unauth');
        if (r.ok) {
          setStats(r.data);
          setState('ok');
        } else if (r.code === 'FORBIDDEN') setState('forbidden');
        else setState('unauth');
      })
      .catch(() => {
        if (active) setState('unauth');
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'loading') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="h-6 w-48 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-slate-200/70" />
          ))}
        </div>
      </main>
    );
  }

  if (state !== 'ok' || !stats) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-ink">
          {state === 'forbidden' ? 'Administrators only' : 'Sign in to continue'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {state === 'forbidden'
            ? 'This dashboard shows system-wide analytics and is limited to administrator accounts.'
            : 'Your session may have expired.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login" className="rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white">
            Go to login
          </Link>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-200"
          >
            <IconRefresh size={15} /> Retry
          </button>
        </div>
      </main>
    );
  }

  const roleBars = Object.entries(stats.users.byRole).sort((a, b) => b[1] - a[1]);
  const maxRole = Math.max(1, ...roleBars.map(([, v]) => v));

  const metrics = [
    { label: 'Registered users', value: stats.users.total, sub: `${stats.patients} patients · ${stats.doctors} doctors`, tone: 'from-brand-600 to-brand-800' },
    { label: 'Facilities', value: stats.facilities, sub: 'Hospitals and health posts', tone: 'from-teal-500 to-teal-600' },
    { label: 'Appointments', value: stats.appointments.total, sub: `${stats.appointments.byStatus['REQUESTED'] ?? 0} awaiting confirmation`, tone: 'from-brand-500 to-teal-500' },
    { label: 'Active emergencies', value: stats.emergency.active, sub: `${stats.ambulances.available} ambulances free`, tone: 'from-danger to-brand-600' },
    { label: 'Blood units', value: stats.blood.totalUnits, sub: `${stats.blood.pendingRequests} pending requests`, tone: 'from-brand-600 to-danger' },
    { label: 'Audit events', value: stats.auditLogs, sub: 'Sensitive actions recorded', tone: 'from-ink to-brand-900' },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="brand">
            <IconChart size={13} />
            Administration
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">System analytics</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Live figures from the PanaNexus database — nothing simulated.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink-muted ring-1 ring-slate-200 transition-colors hover:text-brand-700"
        >
          <IconRefresh size={15} /> Refresh
        </button>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-3xl bg-gradient-to-br ${m.tone} p-5 text-white shadow-lift`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{m.label}</p>
            <p className="mt-2 text-3xl font-bold">{m.value}</p>
            <p className="mt-1 text-[12px] text-white/70">{m.sub}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <IconUsers size={18} className="text-brand-600" />
            Users by role
          </h2>
          {roleBars.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No users registered yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {roleBars.map(([role, count]) => (
                <li key={role}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-ink">{role.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="text-ink-muted">{count}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-700"
                      style={{ width: `${Math.round((count / maxRole) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
          <h2 className="text-base font-bold text-ink">Feedback</h2>
          <div className="mt-5 flex items-end gap-4">
            <span className="text-4xl font-bold text-ink">
              {stats.feedback.averageRating != null ? stats.feedback.averageRating.toFixed(1) : '—'}
            </span>
            <span className="pb-1 text-sm text-ink-muted">
              average rating from {stats.feedback.count} submission{stats.feedback.count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-5 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => {
              const filled = stats.feedback.averageRating != null && stats.feedback.averageRating >= i - 0.4;
              return (
                <span
                  key={i}
                  className={`h-2.5 flex-1 rounded-full ${filled ? 'bg-brand-500' : 'bg-slate-100'}`}
                />
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}