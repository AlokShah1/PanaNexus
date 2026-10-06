import type { ReactNode } from 'react';
import { IconBolt, IconShield, IconHospital } from '@/components/icons';

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_1fr]">
      {/* brand side */}
      <div className="relative hidden overflow-hidden bg-mesh lg:block">
        <div aria-hidden className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-10 right-10 h-64 w-64 rounded-full bg-teal-400/25 blur-3xl" />
        <div aria-hidden className="absolute inset-0 bg-grid opacity-50" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-teal-500 text-white shadow-[0_10px_24px_-10px_rgba(31,69,245,0.9)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M9.6 3h4.8v6.6H21v4.8h-6.6V21H9.6v-6.6H3V9.6h6.6V3Z" />
              </svg>
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">
              Pana<span className="text-brand-600">Nexus</span>
            </span>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink xl:text-[2.6rem]">
              Healthcare, connected around you.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
              Join a network where records, appointments, emergencies and donor coordination happen in one place.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                { Icon: IconShield, title: 'Secure account', desc: 'Role-based access with audited record access.' },
                { Icon: IconBolt, title: 'Fast access', desc: 'Works on slow mobile networks.' },
                { Icon: IconHospital, title: 'Connected healthcare', desc: 'Hospitals, health posts and responders in one ecosystem.' },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3 rounded-2xl bg-white/70 p-3.5 shadow-soft ring-1 ring-white/70 backdrop-blur">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <f.Icon size={18} />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold text-ink">{f.title}</span>
                    <span className="block text-[13px] text-ink-muted">{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-ink-subtle">Your personal information is protected.</p>
        </div>
      </div>

      {/* form side */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}