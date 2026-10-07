'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch, type Paginated } from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import { IconCalendar } from '@/components/icons';
import { Card, Empty, ErrorBanner, Pager, Skeleton, SuccessNotice, type ApiError } from './ui';

type AppointmentItem = {
  id: string;
  startsAt: string;
  status: string;
  notes: string | null;
  doctor: { id: string; name: string | null; specialization: string | null } | null;
  patient: { id: string; name: string | null } | null;
  facility: { id: string; name: string | null } | null;
};

type Row = AppointmentItem & { whenLabel: string; isUpcoming: boolean };

const STATUS_TONE: Record<string, 'warning' | 'brand' | 'success' | 'danger' | 'neutral'> = {
  REQUESTED: 'warning',
  CONFIRMED: 'brand',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  NO_SHOW: 'danger',
};

const ACTIONS: Record<string, Array<{ label: string; next: string; variant: 'primary' | 'secondary' | 'ghost' }>> = {
  REQUESTED: [
    { label: 'Confirm', next: 'CONFIRMED', variant: 'primary' },
    { label: 'Cancel', next: 'CANCELLED', variant: 'ghost' },
  ],
  CONFIRMED: [
    { label: 'Complete', next: 'COMPLETED', variant: 'primary' },
    { label: 'No-show', next: 'NO_SHOW', variant: 'secondary' },
    { label: 'Cancel', next: 'CANCELLED', variant: 'ghost' },
  ],
};

const FILTERS = ['', 'REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

function fmtTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AppointmentsPanel() {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<Paginated<Row>['meta'] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filter) params.set('status', filter);
    const res = await apiGet<Paginated<AppointmentItem>>(`/appointments?${params.toString()}`);
    if (!res.ok) {
      setError(res);
      setRows(null);
      setMeta(null);
      return;
    }
    const now = Date.now();
    const mapped = res.data.items
      .map((a) => ({ ...a, whenLabel: fmtTime(a.startsAt), isUpcoming: new Date(a.startsAt).getTime() >= now }))
      .sort((a, b) => {
        if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? -1 : 1;
        return a.isUpcoming
          ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
          : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
      });
    setRows(mapped);
    setMeta(res.data.meta);
  }, [filter, page]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function setStatus(item: Row, status: string) {
    setBusyId(item.id);
    setError(null);
    setNotice(null);
    const res = await apiPatch<{ id: string }>(`/appointments/${item.id}`, { status });
    setBusyId(null);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice(`Appointment marked ${status.toLowerCase()}.`);
    await load();
  }

  const upcoming = rows?.filter((r) => r.isUpcoming) ?? [];
  const past = rows?.filter((r) => !r.isUpcoming) ?? [];

  return (
    <Card
      title="My appointments"
      description="Requests from patients who booked you."
      actions={
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Appointment status filter">
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
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
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
      <div className="space-y-5">
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} />}
        {!rows && !error && <Skeleton rows={4} />}
        {rows && rows.length === 0 && (
          <Empty
            title="No appointments here yet"
            hint="When patients book you, requests appear in this list."
            icon={<IconCalendar size={20} />}
          />
        )}

        {rows && rows.length > 0 && (
          <>
            <section>
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink-subtle">Upcoming</h3>
              <div className="mt-3 space-y-3">
                {upcoming.length === 0 && <p className="text-sm text-ink-muted">Nothing scheduled.</p>}
                {upcoming.map((item) => (
                  <AppointmentRow key={item.id} item={item} busyId={busyId} onStatus={(s) => void setStatus(item, s)} />
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink-subtle">Past</h3>
              <div className="mt-3 space-y-3">
                {past.length === 0 && <p className="text-sm text-ink-muted">Nothing in the past.</p>}
                {past.map((item) => (
                  <AppointmentRow key={item.id} item={item} busyId={busyId} onStatus={(s) => void setStatus(item, s)} />
                ))}
              </div>
            </section>
          </>
        )}
        <Pager page={page} meta={meta} onPage={setPage} busy={!rows} />
      </div>
    </Card>
  );
}

function AppointmentRow({
  item,
  busyId,
  onStatus,
}: {
  item: Row;
  busyId: string | null;
  onStatus: (status: string) => void;
}) {
  const actions = ACTIONS[item.status] ?? [];
  const disabled = busyId === item.id;
  return (
    <article className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{item.status.replace(/_/g, ' ')}</Badge>
            <span className="text-sm font-semibold text-ink">{item.whenLabel}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
            <span>Patient: {item.patient?.name ?? '—'}</span>
            {item.facility && <span>Facility: {item.facility.name}</span>}
          </div>
          {item.notes && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{item.notes}</p>}
        </div>
        {actions.length > 0 && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.next}
                type="button"
                variant={action.variant}
                className="px-4 py-1.5 text-xs"
                disabled={disabled}
                onClick={() => onStatus(action.next)}
              >
                {disabled ? 'Updating…' : action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}