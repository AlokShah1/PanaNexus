import type { ReactNode } from 'react';
import Link from 'next/link';
import type { PageMeta } from '@/lib/api';
import type { SessionProfile } from '@/lib/session';
import { isProRole } from '@/lib/session';
import { Button } from '@/components/ui';
import { IconAlert, IconRefresh, IconShield } from '@/components/icons';

export type ApiError = { status: number; code?: string; message: string };

export function failText(error: ApiError): string {
  if (error.code === 'VERIFICATION_REQUIRED') return 'Your account must be verified first.';
  if (error.code === 'ACCOUNT_SUSPENDED') return 'Account suspended — contact support.';
  return error.message;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function blockReason(profile: SessionProfile | null): string | null {
  if (!profile) return null;
  if (isProRole(profile.role) && profile.verificationStatus !== 'VERIFIED') {
    return 'Locked until your account is verified.';
  }
  return null;
}

export function Card({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ErrorBanner({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-danger-soft p-4 ring-1 ring-danger/20"
    >
      <div className="flex items-start gap-2.5">
        <IconAlert size={18} className="mt-0.5 shrink-0 text-danger" />
        <div>
          <p className="text-sm font-bold text-danger">{failText(error)}</p>
          {error.code === 'VERIFICATION_REQUIRED' && (
            <Link href="/verification" className="mt-1 inline-block text-[13px] font-semibold text-danger underline">
              Open verification
            </Link>
          )}
        </div>
      </div>
      {onRetry && (
        <Button type="button" variant="secondary" onClick={onRetry} className="px-4 py-2 text-xs">
          <IconRefresh size={14} /> Try again
        </Button>
      )}
    </div>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-[13px] font-semibold text-brand-700 ring-1 ring-brand-200">
      {children}
    </div>
  );
}

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="h-6 w-44 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-4 h-9 w-72 animate-pulse rounded-full bg-slate-200/80" />
      <div className="mt-7 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-slate-200/70" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-slate-200/70" />
        ))}
      </div>
    </main>
  );
}

export function Pager({
  page,
  meta,
  onPage,
  busy,
}: {
  page: number;
  meta: PageMeta | null;
  onPage: (next: number) => void;
  busy?: boolean;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-ink-muted">
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="px-4 py-2 text-xs"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="px-4 py-2 text-xs"
          disabled={busy || page >= meta.totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function Guest({ next }: { next: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-ink">You are not signed in</h1>
      <p className="mt-2 text-sm text-ink-muted">Sign in to open this workspace.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}

export function WrongRole() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <IconShield size={22} />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-ink">This workspace isn&apos;t for your account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Your sign-in does not have access to this console. Head back to your dashboard to find what you need.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
      >
        Open my dashboard
      </Link>
    </main>
  );
}

export function VerificationBanner({ profile }: { profile: SessionProfile }) {
  if (!isProRole(profile.role) || profile.verificationStatus === 'VERIFIED') return null;
  const suspended = profile.verificationStatus === 'SUSPENDED';
  const rejected = profile.verificationStatus === 'REJECTED';
  const tone = suspended || rejected ? 'bg-danger-soft ring-danger/20' : 'bg-amber-50 ring-amber-200';
  const title = suspended
    ? 'Your account is suspended'
    : rejected
      ? 'Your verification was rejected'
      : 'Your professional verification is under review';
  const body = suspended
    ? 'Contact support to restore access. Privileged actions stay locked.'
    : rejected
      ? 'Review the reason, update your documents and resubmit to unlock professional features.'
      : 'You can look around. Professional actions unlock once an admin approves your account.';
  return (
    <Link
      href="/verification"
      role="alert"
      className={`mt-5 flex items-center justify-between gap-4 rounded-3xl p-5 ring-1 transition-colors ${tone} hover:brightness-[0.98]`}
    >
      <div>
        <p className={`text-sm font-bold ${suspended || rejected ? 'text-danger' : 'text-amber-900'}`}>{title}</p>
        <p className={`mt-0.5 text-[13px] ${suspended || rejected ? 'text-danger/80' : 'text-amber-800'}`}>{body}</p>
      </div>
      <span
        className={`hidden shrink-0 rounded-full px-4 py-2 text-[13px] font-bold text-white sm:block ${
          suspended || rejected ? 'bg-danger' : 'bg-amber-600'
        }`}
      >
        Open verification
      </span>
    </Link>
  );
}
