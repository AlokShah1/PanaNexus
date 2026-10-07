'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, apiGet, apiPost, type Paginated } from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import { IconCheck, IconClipboard, IconClose, IconRefresh } from '@/components/icons';
import { Card, Empty, ErrorBanner, Pager, Skeleton, SuccessNotice, fmtDateTime, type ApiError } from './ui';

type VerificationItem = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  payload: unknown;
  documentUrls: string[];
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string; email: string; role: string; verificationStatus: string } | null;
};

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED';

const FILTERS: Filter[] = ['PENDING', 'APPROVED', 'REJECTED'];

const KIND_TONE: Record<string, 'brand' | 'teal' | 'warning'> = {
  DOCTOR: 'brand',
  FACILITY: 'teal',
  AMBULANCE: 'warning',
};

function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
}

function payloadSummary(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'No details provided';
  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, 6);
  if (entries.length === 0) return 'No details provided';
  return entries
    .map(([k, v]) => `${humanize(k)}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

type ReasonDraft = { id: string; action: 'reject' | 'request-info' } | null;

export default function VerificationQueue() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<VerificationItem[] | null>(null);
  const [meta, setMeta] = useState<Paginated<VerificationItem>['meta'] | null>(null);
  const [counts, setCounts] = useState<Record<Filter, number> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReasonDraft>(null);
  const [draftText, setDraftText] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const res = await apiGet<Paginated<VerificationItem>>(
      `/admin/verifications?status=${filter}&page=${page}&limit=20`,
    );
    if (!res.ok) {
      setError(res);
      setRows(null);
      setMeta(null);
      return;
    }
    setRows(res.data.items);
    setMeta(res.data.meta);
  }, [filter, page]);

  const loadCounts = useCallback(async () => {
    const results = await Promise.all(
      FILTERS.map((status) => apiGet<Paginated<unknown>>(`/admin/verifications?status=${status}&page=1&limit=1`)),
    );
    const next = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    let any = false;
    results.forEach((res, i) => {
      if (res.ok) {
        any = true;
        next[FILTERS[i]] = res.data.meta.total;
      }
    });
    if (any) setCounts(next);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    void (async () => {
      await loadCounts();
    })();
  }, [loadCounts]);

  async function act(item: VerificationItem, action: 'approve' | 'reject' | 'request-info', reason?: string) {
    if (action !== 'approve' && !(reason ?? '').trim()) {
      setActionError({ status: 422, message: 'A reason is required before you send this.' });
      return;
    }
    setBusyId(item.id);
    setActionError(null);
    setNotice(null);
    const body = action === 'approve' ? {} : { reason: reason!.trim() };
    const res = await apiPost<{ id: string }>(`/admin/verifications/${item.id}/${action}`, body);
    setBusyId(null);
    if (!res.ok) {
      setActionError(res);
      return;
    }
    setDraft(null);
    setDraftText('');
    setNotice(
      action === 'approve'
        ? `${item.user?.name ?? 'The account'} is verified.`
        : action === 'reject'
          ? 'Request rejected and the account owner has been notified.'
          : 'Information request sent to the account owner.',
    );
    await Promise.all([load(), loadCounts()]);
  }

  return (
    <div className="space-y-5">
      <Card
        title="Verification queue"
        description="Review professional credentials before accounts unlock."
        actions={
          <Button type="button" variant="secondary" className="px-4 py-2 text-xs" onClick={() => void loadCounts()}>
            <IconRefresh size={14} /> Refresh counts
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Verification status filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
                filter === f
                  ? 'bg-brand-600 text-white shadow-[0_10px_22px_-12px_rgba(31,69,245,0.9)]'
                  : 'bg-white text-ink-muted ring-1 ring-slate-200 hover:text-brand-700 hover:ring-brand-300'
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
              <span className="ml-1.5 text-[11px] opacity-80">{counts ? counts[f] : '…'}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {notice && <SuccessNotice>{notice}</SuccessNotice>}
          {actionError && <ErrorBanner error={actionError} />}
          {error && <ErrorBanner error={error} onRetry={() => void load()} />}
          {!rows && !error && <Skeleton rows={3} />}
          {rows && rows.length === 0 && (
            <Empty
              title={`No ${filter.toLowerCase()} verification requests`}
              hint="Requests appear here as soon as a professional submits documents."
              icon={<IconClipboard size={20} />}
            />
          )}
          {rows &&
            rows.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={KIND_TONE[item.kind] ?? 'neutral'}>{item.kind.replace(/_/g, ' ')}</Badge>
                      <Badge tone={item.status === 'PENDING' ? 'warning' : item.status === 'APPROVED' ? 'success' : 'danger'}>
                        {item.status}
                      </Badge>
                      <span className="text-[13px] font-semibold text-ink">{item.user?.name ?? 'Unknown user'}</span>
                      <span className="text-[13px] text-ink-muted">{item.user?.email}</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{payloadSummary(item.payload)}</p>
                    <p className="mt-1 text-[12px] text-ink-subtle">
                      Submitted {fmtDateTime(item.createdAt)}
                      {item.reviewedAt ? ` · reviewed ${fmtDateTime(item.reviewedAt)}` : ''}
                      {item.reason ? ` · note: ${item.reason}` : ''}
                    </p>
                    {item.documentUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-ink-subtle">Documents</span>
                        {item.documentUrls.map((file) => (
                          <a
                            key={file}
                            href={`${API_BASE}/verifications/me/documents/${encodeURIComponent(file)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100"
                          >
                            {file}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      className="px-4 py-2 text-xs"
                      disabled={busyId === item.id || item.status !== 'PENDING'}
                      onClick={() => void act(item, 'approve')}
                      aria-label={`Approve verification for ${item.user?.name ?? item.id}`}
                    >
                      <IconCheck size={14} /> Approve
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-4 py-2 text-xs"
                      disabled={busyId === item.id || item.status !== 'PENDING'}
                      onClick={() => {
                        setActionError(null);
                        setDraft({ id: item.id, action: 'request-info' });
                        setDraftText('');
                      }}
                      aria-label={`Request more information from ${item.user?.name ?? item.id}`}
                    >
                      Request info
                    </Button>
                    <Button
                      type="button"
                      variant="emergency"
                      className="px-4 py-2 text-xs"
                      disabled={busyId === item.id || item.status !== 'PENDING'}
                      onClick={() => {
                        setActionError(null);
                        setDraft({ id: item.id, action: 'reject' });
                        setDraftText('');
                      }}
                      aria-label={`Reject verification for ${item.user?.name ?? item.id}`}
                    >
                      <IconClose size={14} /> Reject
                    </Button>
                  </div>
                </div>

                {draft && draft.id === item.id && (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <label htmlFor={`reason-${item.id}`} className="text-[13px] font-bold text-ink">
                      {draft.action === 'reject' ? 'Reason for rejection' : 'What information is missing?'}
                    </label>
                    <textarea
                      id={`reason-${item.id}`}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      rows={2}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                      placeholder="This reason is sent to the account owner."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="px-4 py-2 text-xs"
                        disabled={busyId === item.id || !draftText.trim()}
                        onClick={() => void act(item, draft.action, draftText)}
                      >
                        {busyId === item.id ? 'Sending…' : draft.action === 'reject' ? 'Confirm rejection' : 'Send request'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-4 py-2 text-xs"
                        onClick={() => {
                          setDraft(null);
                          setDraftText('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          <Pager page={page} meta={meta} onPage={setPage} busy={!rows} />
        </div>
      </Card>
    </div>
  );
}
