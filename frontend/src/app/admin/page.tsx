'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';

type AdminStats = {
  users: { total: number }; patients: number; doctors: number; facilities: number;
  appointments: { total: number }; emergency: { active: number };
  ambulances: { available: number }; blood: { totalUnits: number; pendingRequests: number; availableDonors: number };
  feedback: { averageRating: number | null }; auditLogs: number;
};

export default function Page() {
  const [state, setState] = useState<'loading' | 'forbidden' | 'unauth' | 'ok'>('loading');
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    apiGet<AdminStats>('/admin/analytics').then((r) => {
      if (r.ok) { setState('ok'); setStats(r.data); }
      else if (r.code === 'FORBIDDEN') setState('forbidden');
      else setState('unauth');
    }).catch(() => setState('unauth'));
  }, []);

  if (state !== 'ok' || !stats) {
    if (state === 'loading') return <main className="mx-auto max-w-5xl px-5 py-10 text-slate-600">Loading…</main>;
    if (state === 'unauth') return <main className="mx-auto max-w-5xl px-5 py-10 text-slate-600">Please <Link href="/login" className="underline">log in</Link>.</main>;
    if (state === 'forbidden') return <main className="mx-auto max-w-5xl px-5 py-10 text-slate-600">Admins only.</main>;
    return <main className="mx-auto max-w-5xl px-5 py-10 text-slate-600">No data.</main>;
  }
  const st = stats;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Admin Analytics</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card label="Users" value={st.users.total} />
        <Card label="Patients" value={st.patients} />
        <Card label="Doctors" value={st.doctors} />
        <Card label="Facilities" value={st.facilities} />
        <Card label="Appointments" value={st.appointments.total} />
        <Card label="Active emergencies" value={st.emergency.active} />
        <Card label="Available ambulances" value={st.ambulances.available} />
        <Card label="Blood units" value={st.blood.totalUnits} />
        <Card label="Pending blood requests" value={st.blood.pendingRequests} />
        <Card label="Available donors" value={st.blood.availableDonors} />
        <Card label="Feedback avg rating" value={st.feedback.averageRating != null ? st.feedback.averageRating.toFixed(1) : '—'} />
        <Card label="Audit logs" value={st.auditLogs} />
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white p-4 ring-1 ring-slate-200">
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}
