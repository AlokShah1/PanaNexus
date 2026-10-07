'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiPatch, apiPost, type Paginated } from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import { IconDroplet } from '@/components/icons';
import { Card, Empty, ErrorBanner, Pager, Skeleton, SuccessNotice, type ApiError, blockReason, fmtDateTime } from './ui';
import type { SessionProfile } from '@/lib/session';

type BloodRequestRow = {
  id: string;
  requesterId: string;
  facilityId: string | null;
  bloodGroup: string;
  units: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Row = BloodRequestRow & { createdLabel: string };

const STATUS_TONE: Record<string, 'warning' | 'success' | 'brand' | 'neutral' | 'danger'> = {
  PENDING: 'warning',
  FULFILLED: 'success',
  PARTIALLY_FULFILLED: 'brand',
  CANCELLED: 'danger',
};

const WHO_BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const NEXT_STATUS: Record<string, string> = {
  PENDING: 'FULFILLED',
  FULFILLED: 'CANCELLED',
  PARTIALLY_FULFILLED: 'FULFILLED',
};

export default function BloodRequestsPanel({ profile }: { profile: SessionProfile }) {
  const blockReasonText = blockReason(profile);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<Paginated<Row>['meta'] | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [group, setGroup] = useState('O+');
  const [units, setUnits] = useState('1');
  const [createBusy, setCreateBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await apiGet<Paginated<BloodRequestRow>>(`/blood/requests?page=${page}&limit=20`);
    if (!res.ok) {
      setError(res);
      return;
    }
    setRows(res.data.items.map((r) => ({ ...r, createdLabel: fmtDateTime(r.createdAt) })));
    setMeta(res.data.meta);
  }, [page]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const n = Number(units);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      setError({ status: 422, message: 'Units must be a whole number between 1 and 1000.' });
      return;
    }
    setCreateBusy(true);
    setError(null);
    setNotice(null);
    const res = await apiPost<{ request: { id: string }; availability: unknown[]; donors: unknown[] }>(
      '/blood/requests',
      { bloodGroup: group, units: n },
    );
    setCreateBusy(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice(
      res.data.availability.length > 0
        ? `Request placed — ${res.data.availability.length} matching unit source${res.data.availability.length === 1 ? '' : 's'} available.`
        : 'Request placed — no matching units in stock yet.',
    );
    await load();
  }

  async function setStatus(row: Row, status: string) {
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    const res = await apiPatch<{ id: string; status: string }>(`/blood/requests/${row.id}`, { status });
    setBusyId(null);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice(`Request marked ${res.data.status.toLowerCase()}.`);
    await load();
  }

  return (
    <Card
      title="Blood requests"
      description="Request units for patients or track the requests your team filed."
      actions={<Badge tone={(rows ?? []).some((r) => r.status === 'PENDING') ? 'warning' : 'neutral'}>Incoming matching active</Badge>}
    >
      <div className="space-y-4">
        {blockReasonText && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {blockReasonText} Placing requests unlocks once an admin verifies your account.
          </p>
        )}
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} />}

        <form
          onSubmit={(e) => void create(e)}
          className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4"
          aria-label="Place blood request"
        >
          <label className="block">
            <span className="text-xs font-bold text-ink">Blood group needed</span>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="mt-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            >
              {WHO_BLOOD.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-ink">Units</span>
            <input
              type="number"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              min={1}
              max={1000}
              className="mt-1.5 w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
          <Button
            type="submit"
            disabled={createBusy || !!blockReasonText}
            title={blockReasonText ?? undefined}
          >
            {createBusy ? 'Placing…' : 'Place request'}
          </Button>
        </form>

        {!rows && !error && <Skeleton rows={3} />}
        {rows && rows.length === 0 && (
          <Empty
            title="No blood requests yet"
            hint="Requests you file are tracked here as pending, fulfilled, partially fulfilled or cancelled."
            icon={<IconDroplet size={20} />}
          />
        )}

        <div className="space-y-3">
          {rows?.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{row.status.replace(/_/g, ' ')}</Badge>
                    <Badge tone="brand">{row.bloodGroup}</Badge>
                    <span className="text-sm font-semibold text-ink">{row.units} unit{row.units === 1 ? '' : 's'}</span>
                    <span className="text-[12px] text-ink-subtle">{row.createdLabel}</span>
                  </div>
                </div>
                {NEXT_STATUS[row.status] && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-4 py-1.5 text-xs"
                    disabled={busyId === row.id}
                    onClick={() => void setStatus(row, NEXT_STATUS[row.status])}
                  >
                    {busyId === row.id ? 'Updating…' : `Mark ${NEXT_STATUS[row.status].replace(/_/g, ' ').toLowerCase()}`}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>

        <Pager page={page} meta={meta} onPage={setPage} busy={!rows} />
      </div>
    </Card>
  );
}