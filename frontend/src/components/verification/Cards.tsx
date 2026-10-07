import { Badge, Button, ButtonLink, StatusDot } from '@/components/ui';
import { IconAlert, IconCheck, IconClock, IconShield, IconUsers } from '@/components/icons';
import { payloadEntries } from './format';
import { DocumentList } from './Documents';
import ResubmitForm from './ResubmitForm';

export function PanelSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading verification status" className="space-y-4">
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200/70" />
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70" />
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-slate-200/70 sm:p-8">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-danger ring-1 ring-danger/20">
        <IconAlert size={22} />
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink">We couldn&apos;t load your verification status</h2>
      <p role="alert" className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        {message}
      </p>
      <div className="mt-5 flex justify-center">
        <Button type="button" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </section>
  );
}

export function GuestCard() {
  return (
    <section className="rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
        <IconShield size={22} />
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink">Sign in to view verification status</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        Professional accounts (doctors, healthcare facilities and ambulance operators) can track their
        verification progress after signing in.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
        <ButtonLink href="/login?next=/verification">Sign in</ButtonLink>
        <ButtonLink href="/register" variant="secondary">
          Create account
        </ButtonLink>
      </div>
    </section>
  );
}

export function NonProCard() {
  return (
    <section className="rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
        <IconUsers size={22} />
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink">
        Professional verification doesn&apos;t apply to your account
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        Only doctors, healthcare facilities and ambulance operators go through verification. Your
        account is ready — everything lives in your dashboard.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
      </div>
    </section>
  );
}

export function SuspendedCard() {
  return (
    <section className="rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-danger/25">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-danger-soft text-danger ring-1 ring-danger/20">
        <IconAlert size={26} />
      </span>
      <div className="mt-4 flex justify-center">
        <Badge tone="danger">Suspended</Badge>
      </div>
      <h2 className="mt-3 text-xl font-bold text-ink">Account suspended</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        Your account has been suspended. Please contact support to review your access — we&apos;ll
        walk you through the next steps.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </section>
  );
}

export function VerifiedCard({ reviewedLabel }: { reviewedLabel: string | null }) {
  return (
    <section className="rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-success/25">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success ring-1 ring-success/25">
        <IconCheck size={26} />
      </span>
      <div className="mt-4 flex justify-center">
        <Badge tone="success">
          <StatusDot tone="success" />
          Verified
        </Badge>
      </div>
      <h2 className="mt-3 text-xl font-bold text-ink">Your account is verified</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        {reviewedLabel ? `Approved on ${reviewedLabel}. ` : ''}
        Your professional access is fully unlocked — every feature reserved for verified accounts is
        ready to use.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/dashboard">Open dashboard</ButtonLink>
      </div>
    </section>
  );
}

export function PendingCard({
  payload,
  documents,
  createdLabel,
}: {
  payload: Record<string, unknown> | null;
  documents: string[];
  createdLabel: string | null;
}) {
  const entries = payloadEntries(payload);

  return (
    <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-amber-200 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <IconClock size={20} />
        </span>
        <div className="min-w-0">
          <Badge tone="warning">
            <StatusDot tone="warning" />
            Under review
          </Badge>
          <h2 className="mt-2 text-xl font-bold text-ink">Verification under review</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Submitted {createdLabel ?? 'recently'}. An admin is reviewing your details —
            professional features unlock as soon as your account is approved.
          </p>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-ink">Submitted details</h3>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {entries.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-bold text-ink">Supporting documents</h3>
        <div className="mt-3">
          <DocumentList
            documents={documents}
            emptyHint="No documents were attached to this submission."
          />
        </div>
      </div>

      <p className="mt-6 rounded-2xl bg-brand-50 p-4 text-[13px] leading-relaxed text-brand-800">
        No action is needed right now. We&apos;ll notify you as soon as a reviewer completes their
        assessment.
      </p>
    </section>
  );
}

export function RejectedCard({
  role,
  payload,
  reason,
  documents,
  onSubmitted,
}: {
  role: string;
  payload: Record<string, unknown> | null;
  reason: string | null;
  documents: string[];
  onSubmitted: () => void;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-danger/25 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-danger-soft text-danger ring-1 ring-danger/20">
          <IconAlert size={20} />
        </span>
        <div className="min-w-0">
          <Badge tone="danger">Changes requested</Badge>
          <h2 className="mt-2 text-xl font-bold text-ink">Verification needs attention</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Our review team asked for updates to your submission. Make the changes below and
            resubmit — we&apos;ll review it again.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-danger-soft p-4 ring-1 ring-danger/15">
        <p className="text-xs font-bold uppercase tracking-wider text-danger">Reviewer feedback</p>
        <p className="mt-1.5 text-sm font-medium text-danger">
          {reason && reason.trim() ? reason : 'The submitted details did not pass review. Please double-check your information and resubmit.'}
        </p>
      </div>

      <ResubmitForm
        role={role}
        initialPayload={payload}
        documents={documents}
        onSubmitted={onSubmitted}
      />
    </section>
  );
}

export function NoRequestCard({ role, onSubmitted }: { role: string; onSubmitted: () => void }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
          <IconShield size={20} />
        </span>
        <div className="min-w-0">
          <Badge tone="brand">Verification</Badge>
          <h2 className="mt-2 text-xl font-bold text-ink">Start your verification</h2>
          <p className="mt-1 text-sm text-ink-muted">
            We don&apos;t have a verification request on file yet. Add your details and credentials
            below to send your first submission for review.
          </p>
        </div>
      </div>

      <ResubmitForm role={role} initialPayload={null} documents={[]} onSubmitted={onSubmitted} />
    </section>
  );
}
