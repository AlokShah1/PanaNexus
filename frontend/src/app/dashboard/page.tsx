'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { apiGet } from '@/lib/api';
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

type Me = { id: string; role: string };

const NAV = [
  { label: 'Appointments', href: '/appointments', Icon: IconCalendar },
  { label: 'Medical records', href: '#', Icon: IconClipboard },
  { label: 'Doctors', href: '/doctors', Icon: IconStethoscope },
  { label: 'Facilities', href: '/hospitals', Icon: IconHospital },
  { label: 'Emergency', href: '/emergency', Icon: IconAmbulance },
  { label: 'Blood', href: '/blood', Icon: IconDroplet },
  { label: 'Donor services', href: '/organ-donation', Icon: IconHeart },
  { label: 'Notifications', href: '/notifications', Icon: IconBell },
];

export default function Page() {
  const [me, setMe] = useState<Me | null | 'loading'>('loading');

  useEffect(() => {
    apiGet<Me>('/auth/me').then((r) => setMe(r.ok ? r.data : null)).catch(() => setMe(null));
  }, []);

  if (me === 'loading') {
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

  if (!me) {
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge tone="brand">
            <StatusDot tone="success" />
            {roleLabel(me.role)}
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Your care at a glance</h1>
        </div>
        <SignOutButton />
      </header>

      {/* metric strip */}
      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Upcoming appointments', value: '—', hint: 'Book from a doctor page', tone: 'from-brand-600 to-brand-800' },
          { label: 'Active records', value: '—', hint: 'Authorized access only', tone: 'from-teal-500 to-teal-600' },
          { label: 'Notifications', value: '—', hint: 'Updates from your care team', tone: 'from-brand-500 to-teal-500' },
          { label: 'Emergency readiness', value: 'Ready', hint: 'Location sharing is opt-in', tone: 'from-danger to-brand-600' },
        ].map((c) => (
          <div key={c.label} className={`rounded-3xl bg-gradient-to-br ${c.tone} p-5 text-white shadow-lift`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{c.label}</p>
            <p className="mt-2 text-2xl font-bold">{c.value}</p>
            <p className="mt-1 text-[12px] text-white/70">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* quick actions + activity */}
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