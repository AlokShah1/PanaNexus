'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui';
import { IconChart, IconRefresh, IconUsers } from '@/components/icons';
import { Card, ErrorBanner, type ApiError } from './ui';

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

function BarList({ data }: { data: Array<[string, number]> }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  if (data.length === 0) return <p className="text-sm text-ink-muted">Nothing recorded yet.</p>;
  return (
    <ul className="space-y-3">
      {data.map(([label, value]) => (
        <li key={label}>
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-ink">{label}</span>
            <span className="text-ink-muted">{value}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-700"
              style={{ width: `${Math.round((value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function entries(record: Record<string, number>): Array<[string, number]> {
  return Object.entries(record)
    .map(([k, v]) => [k.replace(/_/g, ' ').toLowerCase(), v] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}

export default function AnalyticsPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiGet<AdminStats>('/admin/analytics');
    setLoading(false);
    if (!res.ok) {
      setError(res);
      setStats(null);
      return;
    }
    setStats(res.data);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  if (loading && !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-slate-200/70" />
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return <ErrorBanner error={error ?? { status: 0, message: 'Analytics unavailable.' }} onRetry={() => void load()} />;
  }

  const metrics = [
    { label: 'Registered users', value: stats.users.total, sub: `${stats.patients} patients · ${stats.doctors} doctors`, tone: 'from-brand-600 to-brand-800' },
    { label: 'Facilities', value: stats.facilities, sub: 'Hospitals and health posts', tone: 'from-teal-500 to-teal-600' },
    { label: 'Appointments', value: stats.appointments.total, sub: `${stats.appointments.byStatus['REQUESTED'] ?? 0} awaiting confirmation`, tone: 'from-brand-500 to-teal-500' },
    { label: 'Active emergencies', value: stats.emergency.active, sub: `${stats.ambulances.available} ambulances free`, tone: 'from-danger to-brand-600' },
    { label: 'Blood units', value: stats.blood.totalUnits, sub: `${stats.blood.pendingRequests} pending requests`, tone: 'from-brand-600 to-danger' },
    { label: 'Audit events', value: stats.auditLogs, sub: 'Sensitive actions recorded', tone: 'from-ink to-brand-900' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button type="button" variant="secondary" className="px-4 py-2 text-xs" onClick={() => void load()}>
          <IconRefresh size={14} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-3xl bg-gradient-to-br ${m.tone} p-5 text-white shadow-lift`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{m.label}</p>
            <p className="mt-2 text-3xl font-bold">{m.value}</p>
            <p className="mt-1 text-[12px] text-white/70">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Users by role" description="Account mix across PanaNexus.">
          <BarList data={entries(stats.users.byRole)} />
        </Card>

        <Card title="Appointments by status" description="Bookings by lifecycle state.">
          <BarList data={entries(stats.appointments.byStatus)} />
        </Card>

        <Card title="Emergencies by state" description={`${stats.emergency.total} requests total.`}>
          <BarList data={entries(stats.emergency.byStatus)} />
        </Card>

        <Card title="Fleet by status" description={`${stats.ambulances.total} ambulances registered.`}>
          <BarList data={entries(stats.ambulances.byStatus)} />
        </Card>

        <Card title="Blood bank" description="Units on shelves across facilities.">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="text-2xl font-bold text-brand-700">{stats.blood.totalUnits}</p>
              <p className="mt-1 text-[12px] text-ink-muted">Units available</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-700">{stats.blood.pendingRequests}</p>
              <p className="mt-1 text-[12px] text-ink-muted">Pending requests</p>
            </div>
            <div className="rounded-2xl bg-teal-50 p-4">
              <p className="text-2xl font-bold text-teal-600">{stats.blood.availableDonors}</p>
              <p className="mt-1 text-[12px] text-ink-muted">Available donors</p>
            </div>
          </div>
        </Card>

        <Card title="Feedback score" description={`${stats.feedback.count} rated submission${stats.feedback.count === 1 ? '' : 's'}.`}>
          <div className="flex items-end gap-4">
            <span className="text-4xl font-bold text-ink">
              {stats.feedback.averageRating != null ? stats.feedback.averageRating.toFixed(1) : '—'}
            </span>
            <span className="pb-1 text-sm text-ink-muted">average rating</span>
          </div>
          <div className="mt-5 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => {
              const filled = stats.feedback.averageRating != null && stats.feedback.averageRating >= i - 0.4;
              return <span key={i} className={`h-2.5 flex-1 rounded-full ${filled ? 'bg-brand-500' : 'bg-slate-100'}`} />;
            })}
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
        <IconChart size={15} className="text-brand-600" />
        <IconUsers size={15} className="text-teal-600" />
        Live figures from the database — nothing simulated.
      </div>
    </div>
  );
}
