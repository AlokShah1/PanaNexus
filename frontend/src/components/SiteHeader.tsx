'use client';

import { useState } from 'react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { needsVerification, useSession } from '@/lib/session';
import { roleLabel } from '@/lib/format';

const NAV = [
  { href: '/hospitals', label: 'Find Care' },
  { href: '/doctors', label: 'Doctors' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/blood', label: 'Blood' },
];

const ROLE_DASHBOARDS: Record<string, string> = {
  ADMIN: '/admin',
  DOCTOR: '/doctor',
  AMBULANCE_OPERATOR: '/ambulance',
  FACILITY_STAFF: '/facility',
  PATIENT: '/dashboard',
  BLOOD_DONOR: '/dashboard',
  ORGAN_DONOR: '/dashboard',
};

function Logo() {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="PanaNexus home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-teal-500 text-white shadow-[0_8px_20px_-8px_rgba(31,69,245,0.8)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M9.6 3h4.8v6.6H21v4.8h-6.6V21H9.6v-6.6H3V9.6h6.6V3Z" />
        </svg>
      </span>
      <span className="hidden text-[15px] font-bold tracking-tight text-ink min-[400px]:inline">
        Pana<span className="text-brand-600">Nexus</span>
      </span>
    </Link>
  );
}

function SosButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/emergency"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-danger px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#c01039] sm:px-3.5 sm:text-sm ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      SOS
    </Link>
  );
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { status, profile } = useSession();
  const signedIn = status === 'authed' && profile;
  const dashboardHref = profile ? ROLE_DASHBOARDS[profile.role] ?? '/dashboard' : '/dashboard';
  const pending = needsVerification(profile);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Logo />

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SosButton />
          {signedIn && profile ? (
            <>
              {pending && (
                <Link
                  href="/verification"
                  className="hidden rounded-full bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-300 transition-colors hover:bg-amber-100 lg:inline-flex"
                >
                  {profile.verificationStatus === 'REJECTED' ? 'Action needed' : 'Verification pending'}
                </Link>
              )}
              <Link
                href={dashboardHref}
                className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700 lg:inline-flex"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-teal-500 text-[11px] font-bold text-white">
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-32 truncate">{profile.name.split(' ')[0]}</span>
                <span className="text-[11px] font-medium text-ink-subtle">{roleLabel(profile.role)}</span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-brand-50 lg:inline-flex"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="hidden rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 lg:inline-flex"
              >
                Get Started
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-muted ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-slate-200/70 bg-white lg:hidden">
          <nav className="mx-auto grid w-full max-w-6xl gap-1 px-4 py-3 sm:px-6" aria-label="Mobile">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              {signedIn && profile ? (
                <>
                  {pending && (
                    <Link
                      href="/verification"
                      onClick={() => setOpen(false)}
                      className="col-span-2 rounded-full bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-800 ring-1 ring-amber-300"
                    >
                      {profile.verificationStatus === 'REJECTED' ? 'Action needed on your verification' : 'Verification pending'}
                    </Link>
                  )}
                  <Link
                    href={dashboardHref}
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    My dashboard
                  </Link>
                  <SignOutButton className="rounded-full px-4 py-2.5 text-center text-sm font-semibold text-ink-muted ring-1 ring-slate-200" />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-full px-4 py-2.5 text-center text-sm font-semibold text-ink-muted ring-1 ring-slate-200"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
