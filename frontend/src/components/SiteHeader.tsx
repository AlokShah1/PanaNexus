import Link from 'next/link';

const NAV = [
  { href: '/hospitals', label: 'Find Care' },
  { href: '/doctors', label: 'Doctors' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/blood', label: 'Blood' },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-teal-500 text-white shadow-[0_8px_20px_-8px_rgba(31,69,245,0.8)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M9.6 3h4.8v6.6H21v4.8h-6.6V21H9.6v-6.6H3V9.6h6.6V3Z" />
            </svg>
          </span>
          <span className="text-[17px] font-bold tracking-tight text-ink">
            Pana<span className="text-brand-600">Nexus</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
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

        <div className="flex items-center gap-2">
          <Link
            href="/emergency"
            className="inline-flex items-center gap-1.5 rounded-full bg-danger px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c01039] md:hidden"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            SOS
          </Link>
          <Link
            href="/login"
            className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-brand-700"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}