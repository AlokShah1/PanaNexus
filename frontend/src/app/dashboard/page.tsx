'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { apiGet, type Paginated } from '@/lib/api';
import { isProRole, useSession } from '@/lib/session';
import { roleLabel } from '@/lib/format';
import { Badge, StatusDot } from '@/components/ui';
import {
  IconAmbulance,
  IconBell,
  IconCalendar,
  IconClipboard,
  IconDroplet,
  IconHeart,
  IconHospital,
  IconShield,
  IconStethoscope,
} from '@/components/icons';

type AppointmentItem = { id: string; startsAt: string; status: string };

const NAV = [
  { label: 'Appointments', href: '/appointments', Icon: IconCalendar },
  { label: 'Medical records', href: '/records', Icon: IconClipboard },
  { label: 'Doctors', href: '/doctors', Icon: IconStethoscope },
  { label: 'Facilities', href: '/hospitals', Icon: IconHospital },
  { label: 'Emergency', href: '/emergency', Icon: IconAmbulance },
  { label: 'Blood', href: '/blood', Icon: IconDroplet },
  { label: 'Donor services', href: '/organ-donation', Icon: IconHeart },
  { label: 'Notifications', href: '/notifications', Icon: IconBell },
];

const ROLE_DASHBOARDS: Record<string, { href: string; label: string }> = {
  ADMIN: { href: '/admin', label: 'Admin console' },
  DOCTOR: { href: '/doctor', label: 'Doctor workspace' },
  AMBULANCE_OPERATOR: { href: '/ambulance', label: 'Ambulance dispatch' },
  FACILITY_STAFF: { href: '/facility', label: 'Facility workspace' },
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'In review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

export default function Page() {
  const { status, profile } = useSession();
  const [upcoming, setUpcoming] = useState<number | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [records, setRecords] = useState<number | null>(null);

  useEffect(() => {
    if (status !== 'authed' || !profile) return;
    const now = Date.now();
    void apiGet<Paginated<AppointmentItem>>('/appointments?limit=100').then((r) => {
      if (!r.ok) return;
      const count = r.data.items.filter(
        (a) => (a.status === 'REQUESTED' || a.status === 'CONFIRMED') && new Date(a.startsAt).getTime() >= now,
      ).length;
      setUpcoming(count);
    });
    void apiGet<{ count: number }>('/notifications/unread-count').then((r) => {
      if (r.ok) setUnread(r.data.count);
    });
    void apiGet<Paginated<unknown>>('/medical-records?limit=1').then((r) => {
      setRecords(r.ok ? r.data.meta.total : null);
    });
  }, [status, profile]);

  if (status === 'loading') {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="h-6 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-slate-200/70" />
          ))}
        </div>
      </main>
    );
  }

  if (status !== 'authed' || !profile) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-ink">You are not signed in</h1>
        <p className="mt-2 text-sm text-ink-muted">Sign in to see your care, appointments and records.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login" className="rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700">
            Sign in
          </Link>
          <Link href="/register" className="rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50">
            Create account
          </Link>
        </div>
      </main>
    );
  }

  const roleDashboard = ROLE_DASHBOARDS[profile.role];
  const pendingVerify = isProRole(profile.role) && profile.verificationStatus === 'PENDING';
  const rejectedVerify = isProRole(profile.role) && profile.verificationStatus === 'REJECTED';

  const metrics = [
    { label: 'Upcoming appointments', value: upcoming === null ? '—' : String(upcoming), hint: 'Book from a doctor page', tone: 'from-brand-600 to-brand-800' },
    { label: 'Medical records', value: records === null ? '—' : String(records), hint: records === null ? 'Not available for your role' : 'Authorized access only', tone: 'from-teal-500 to-teal-600' },
    { label: 'Unread notifications', value: unread === null ? '—' : String(unread), hint: 'Updates from your care team', tone: 'from-brand-500 to-teal-500' },
    { label: 'Account status', value: STATUS_LABEL[profile.verificationStatus] ?? profile.verificationStatus, hint: roleLabel(profile.role), tone: 'from-danger to-brand-600' },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge tone="brand">
            <StatusDot tone="success" />
            {roleLabel(profile.role)}
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Your care at a glance</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Signed in as {profile.name} · {profile.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      {(pendingVerify || rejectedVerify) && (
        <Link
          href="/verification"
          className={`mt-6 flex items-center justify-between gap-4 rounded-3xl p-5 ring-1 transition-colors ${
            rejectedVerify ? 'bg-danger-soft ring-danger/20 hover:bg-red-100' : 'bg-amber-50 ring-amber-200 hover:bg-amber-100'
          }`}
        >
          <div>
            <p className={`text-sm font-bold ${rejectedVerify ? 'text-danger' : 'text-amber-900'}`}>
              {rejectedVerify ? 'Your verification needs attention' : 'Your professional verification is under review'}
            </p>
            <p className={`mt-0.5 text-[13px] ${rejectedVerify ? 'text-danger/80' : 'text-amber-800'}`}>
              {rejectedVerify
                ? 'Review the reason, upload documents and resubmit to unlock professional features.'
                : 'You can browse now. Professional features unlock once an admin approves your account.'}
            </p>
          </div>
          <span className={`hidden shrink-0 rounded-full px-4 py-2 text-[13px] font-bold text-white sm:block ${rejectedVerify ? 'bg-danger' : 'bg-amber-600'}`}>
            Open verification
          </span>
        </Link>
      )}

      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((c) => (
          <div key={c.label} className={`rounded-3xl bg-gradient-to-br ${c.tone} p-5 text-white shadow-lift`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{c.label}</p>
            <p className="mt-2 text-2xl font-bold">{c.value}</p>
            <p className="mt-1 text-[12px] text-white/70">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
          <h2 className="text-base font-bold text-ink">Jump to</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="group rounded-2xl border border-slate-200 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50/50"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  <n.Icon size={18} />
                </span>
                <span className="mt-2.5 block text-[13px] font-semibold text-ink">{n.label}</span>
              </Link>
            ))}
          </div>
          {roleDashboard && (
            <Link
              href={roleDashboard.href}
              className="mt-4 flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white transition-colors hover:bg-brand-800"
            >
              <span className="text-sm font-bold">{roleDashboard.label}</span>
              <span className="text-[13px] text-white/70">Open →</span>
            </Link>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
          <h2 className="text-base font-bold text-ink">Recent activity</h2>
          <ol className="mt-4 space-y-4">
            {[
              { title: 'Account secured', desc: 'Your session is protected with an encrypted, HttpOnly cookie.', tone: 'success' as const },
              { title: 'Records access is audited', desc: 'Every sensitive record view is logged for accountability.', tone: 'brand' as const },
              { title: 'Emergency location is opt-in', desc: 'We only ask for location when you start a request.', tone: 'warning' as const },
            ].map((a) => (
              <li key={a.title} className="flex gap-3">
                <StatusDot tone={a.tone} />
                <div>
                  <p className="text-[13px] font-semibold text-ink">{a.title}</p>
                  <p className="text-[12px] leading-relaxed text-ink-muted">{a.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-2xl bg-brand-50 p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-brand-800">
              <IconShield size={15} />
              Need help now?
            </p>
            <Link
              href="/emergency"
              className="mt-2 inline-flex rounded-full bg-danger px-4 py-2 text-[13px] font-bold text-white transition-transform hover:scale-[1.02]"
            >
              Request ambulance
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
