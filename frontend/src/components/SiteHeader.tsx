'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV = [
  { href: '/hospitals', label: 'Find Care' },
  { href: '/doctors', label: 'Doctors' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/blood', label: 'Blood' },
];

function Logo() {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="PanaNexus home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-teal-500 text-white shadow-[0_8px_20px_-8px_rgba(31,69,245,0.8)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M9.6 3h4.8v6.6H21v4.8h-6.6V21H9.6v-6.6H3V9.6h6.6V3Z" />
        </svg>
      </span>
      <span className="text-[17px] font-bold tracking-tight text-ink">
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
          <Link
            href="/login"
            className="hidden rounded-full px-3.5 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-brand-700 lg:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="hidden rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 lg:inline-flex"
          >
            Get Started
          </Link>

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
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2.5 text-center text-sm font-semibold text-ink-muted ring-1 ring-slate-200 transition-colors hover:text-brand-700"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-800"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
