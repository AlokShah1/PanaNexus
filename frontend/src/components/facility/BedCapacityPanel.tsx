'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiDelete, apiGet, apiPut } from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import { IconCheck, IconHospital, IconTrash } from '@/components/icons';
import { Card, Empty, ErrorBanner, Skeleton, SuccessNotice, type ApiError, blockReason } from './ui';
import type { SessionProfile } from '@/lib/session';
import { WARD_TYPES, occupancyTone, wardLabel, type BedSummary, type WardRow } from '@/lib/beds';

type BedsResponse = { summary: BedSummary; wards: WardRow[] };

export default function BedCapacityPanel({ profile }: { profile: SessionProfile }) {
  const facilityId = profile.facilityId;
  const blockReasonText = blockReason(profile);

  const [rows, setRows] = useState<WardRow[] | null>(null);
  const [summary, setSummary] = useState<BedSummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [ward, setWard] = useState<string>(WARD_TYPES[0]);
  const [label, setLabel] = useState('');
  const [total, setTotal] = useState('');
  const [occupied, setOccupied] = useState('0');
  const [saveBusy, setBusy] = useState(false);
  const [busyWard, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!facilityId) return;
    setError(null);
    const res = await apiGet<BedsResponse>(`/facilities/${facilityId}/beds`);
    if (!res.ok) {
      setError(res);
      return;
    }
    setRows(res.data.wards);
    setSummary(res.data.summary);
  }, [facilityId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const existing = useMemo(() => rows?.find((r) => r.ward === ward) ?? null, [rows, ward]);

  function selectWard(ward_: string) {
    setWard(ward_);
    const row = (rows ?? []).find((r) => r.ward === ward_);
    setTotal(row ? String(row.totalBeds) : '');
    setOccupied(row ? String(row.occupiedBeds) : '0');
    setError(null);
    setNotice(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const totalN = Number(total);
    const occupiedN = Number(occupied || '0');
    if (!Number.isInteger(totalN) || totalN < 1 || totalN > 9999) {
      setError({ status: 422, message: 'Total beds must be a whole number between 1 and 9999.' });
      return;
    }
    if (!Number.isInteger(occupiedN) || occupiedN < 0 || occupiedN > totalN) {
      setError({ status: 422, message: 'Occupied beds must be between 0 and the total.' });
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await apiPut<WardRow>(`/facilities/${facilityId}/beds`, {
      ward,
      label: label.trim() || undefined,
      totalBeds: totalN,
      occupiedBeds: occupiedN,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice(`${wardLabel(ward)} saved — ${res.data.availableBeds} of ${res.data.totalBeds} beds free.`);
    await load();
  }

  async function remove(row: WardRow) {
    setError(null);
    setNotice(null);
    setBusyId(row.ward);
    const res = await apiDelete<{ ward: string }>(`/facilities/${facilityId}/beds/${row.ward}`);
    setBusyId(null);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice(`${wardLabel(row.ward)} removed.`);
    if (row.ward === ward) setTotal('');
    await load();
  }

  const wards = useMemo(() => (rows ?? []).slice().sort((a, b) => a.ward.localeCompare(b.ward)), [rows]);

  return (
    <Card
      title="Bed capacity"
      description="Track wards and live occupancy. Free-bed counts are shown to the public directory."
      actions={
        summary && (
          <Badge tone={occupancyTone(summary.availableBeds, summary.totalBeds)}>
            {summary.availableBeds} of {summary.totalBeds} free
          </Badge>
        )
      }
    >
      <div className="space-y-4">
        {blockReasonText && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {blockReasonText} Bed management unlocks once an admin verifies your account.
          </p>
        )}
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} />}

        <form
          onSubmit={(e) => void save(e)}
          className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4"
          aria-label="Save ward capacity"
        >
          <label className="block">
            <span className="text-xs font-bold text-ink">Ward</span>
            <select
              value={ward}
              onChange={(e) => selectWard(e.target.value)}
              className="mt-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            >
              {WARD_TYPES.map((w) => (
                <option key={w} value={w}>
                  {wardLabel(w)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-ink">Label (optional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={existing?.label ?? 'e.g. Ward 3B'}
              maxLength={80}
              className="mt-1.5 w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-ink">Total beds</span>
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              min={1}
              max={9999}
              className="mt-1.5 w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-ink">Occupied</span>
            <input
              type="number"
              value={occupied}
              onChange={(e) => setOccupied(e.target.value)}
              min={0}
              max={9999}
              className="mt-1.5 w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
          <Button
            type="submit"
            disabled={!!blockReasonText || saveBusy || total.trim() === ''}
            title={blockReasonText ?? undefined}
          >
            <IconCheck size={15} /> {saveBusy ? 'Saving…' : existing ? 'Update' : 'Add ward'}
          </Button>
        </form>

        {!rows && !error && <Skeleton rows={3} />}
        {rows && rows.length === 0 && (
          <Empty
            title="No wards recorded"
            hint="Add wards above — free-bed counts are exposed publicly to help patients find space."
            icon={<IconHospital size={20} />}
          />
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {wards.map((row) => {
            const tone = occupancyTone(row.availableBeds, row.totalBeds);
            const pct = row.totalBeds > 0 ? Math.round((row.occupiedBeds / row.totalBeds) * 100) : 0;
            return (
              <article key={row.ward} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">{row.label ?? wardLabel(row.ward)}</h3>
                  <Badge tone={tone}>{row.availableBeds} free</Badge>
                </div>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{wardLabel(row.ward)}</p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${pct}% occupied`}>
                  <div className={`h-full rounded-full ${tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-success'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-[12px] text-ink-muted">
                  {row.occupiedBeds} occupied · {row.totalBeds} total
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={!!blockReasonText}
                    title={blockReasonText ?? undefined}
                    onClick={() => selectWard(row.ward)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1.5 text-xs text-danger"
                    disabled={!!blockReasonText || busyWard === row.ward}
                    title={blockReasonText ?? undefined}
                    onClick={() => void remove(row)}
                  >
                    <IconTrash size={13} /> {busyWard === row.ward ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
