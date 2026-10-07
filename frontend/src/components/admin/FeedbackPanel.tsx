'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, type Paginated } from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import { IconStar } from '@/components/icons';
import { Card, Empty, ErrorBanner, Pager, Skeleton, SuccessNotice, fmtDateTime, type ApiError } from './ui';

type FeedbackRow = {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  moderationReason: string | null;
  facility: { id: string; name: string } | null;
  author: { id: string; name: string } | null;
  createdAt: string;
};

const FILTERS = ['', 'PENDING', 'APPROVED', 'REJECTED'] as const;

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export default function FeedbackPanel() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('PENDING');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [meta, setMeta] = useState<Paginated<FeedbackRow>['meta'] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; status: string } | null>(null);
  const [draftText, setDraftText] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filter) params.set('status', filter);
    const res = await apiGet<Paginated<FeedbackRow>>(`/admin/feedback?${params.toString()}`);
    if (!res.ok) {
      setError(res);
      setRows(null);
      setMeta(null);
      return;
    }
    setRows(res.data.items);
    setMeta(res.data.meta);
  }, [filter, page]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function moderate(row: FeedbackRow, status: string, reason?: string) {
    if (status === 'REJECTED' && !(reason ?? '').trim()) {
      setError({ status: 422, message: 'A reason is required to reject feedback.' });
      return;
    }
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    const res = await apiPost<{ id: string }>(`/admin/feedback/${row.id}/moderate`, {
      status,
      reason: (reason ?? '').trim() || null,
    });
    setBusyId(null);
    if (!res.ok) {
      setError(res);
      return;
    }
    setDraft(null);
    setDraftText('');
    setNotice(`Feedback marked ${status.toLowerCase()}.`);
    await load();
  }

  return (
    <Card
      title="Feedback moderation"
      description="Ratings and comments before they show on facility pages."
      actions={
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Feedback status filter">
          {FILTERS.map((f) => (
            <button
              key={f || 'all'}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-ink-muted ring-1 ring-slate-200 hover:text-brand-700 hover:ring-brand-300'
              }`}
            >
              {f ? f.charAt(0) + f.slice(1).toLowerCase() : 'All'}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} onRetry={() => void load()} />}
        {!rows && !error && <Skeleton rows={4} />}
        {rows && rows.length === 0 && (
          <Empty title="No feedback in this view" hint="New submissions land here for review." icon={<IconStar size={20} />} />
        )}
        {rows &&
          rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{row.status}</Badge>
                    <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <IconStar
                          key={i}
                          size={14}
                          className={i < row.rating ? 'text-warning' : 'text-slate-300'}
                        />
                      ))}
                      <span className="ml-1 text-ink-muted">{row.rating}/5</span>
                    </span>
                    <span className="text-[13px] text-ink-muted">{row.author?.name ?? 'Anonymous'}</span>
                    {row.facility && <span className="text-[13px] text-ink-subtle">· {row.facility.name}</span>}
                  </div>
                  {row.comment && <p className="mt-2 text-[13px] leading-relaxed text-ink">{row.comment}</p>}
                  <p className="mt-1 text-[12px] text-ink-subtle">
                    {fmtDateTime(row.createdAt)}
                    {row.moderationReason ? ` · moderation note: ${row.moderationReason}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    className="px-3.5 py-1.5 text-xs"
                    disabled={busyId === row.id || row.status === 'APPROVED'}
                    onClick={() => void moderate(row, 'APPROVED')}
                    aria-label="Approve this feedback"
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="emergency"
                    className="px-3.5 py-1.5 text-xs"
                    disabled={busyId === row.id || row.status === 'REJECTED'}
                    onClick={() => {
                      setError(null);
                      setDraft({ id: row.id, status: 'REJECTED' });
                      setDraftText('');
                    }}
                    aria-label="Reject this feedback"
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3.5 py-1.5 text-xs"
                    disabled={busyId === row.id || row.status === 'PENDING'}
                    onClick={() => void moderate(row, 'PENDING')}
                    aria-label="Reset this feedback to pending"
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {draft && draft.id === row.id && (
                <div className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <label htmlFor={`fb-reason-${row.id}`} className="text-[12px] font-bold text-ink">
                    Reason for rejection
                  </label>
                  <textarea
                    id={`fb-reason-${row.id}`}
                    rows={2}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                    placeholder="Why is this feedback being removed?"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      className="px-3.5 py-1.5 text-xs"
                      disabled={busyId === row.id || !draftText.trim()}
                      onClick={() => void moderate(row, 'REJECTED', draftText)}
                    >
                      {busyId === row.id ? 'Saving…' : 'Confirm rejection'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3.5 py-1.5 text-xs"
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
  );
}
