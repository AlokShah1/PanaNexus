'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiPatch, apiPost, type Paginated } from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import { IconDroplet } from '@/components/icons';
import { Card, Empty, ErrorBanner, Pager, Skeleton, SuccessNotice, type ApiError, blockReason } from './ui';
import type { SessionProfile } from '@/lib/session';

type Unit = { id: string; bloodGroup: string; units: number; facility: { id: string; name: string } | null };

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const GROUP_TONE: Record<string, 'danger' | 'warning' | 'brand' | 'success' | 'neutral' | 'teal'> = {
  'O+': 'success',
  'O-': 'warning',
  'A+': 'brand',
  'A-': 'brand',
  'B+': 'teal',
  'B-': 'neutral',
  'AB+': 'danger',
  'AB-': 'neutral',
};

export default function BloodUnitsPanel({ profile }: { profile: SessionProfile }) {
  const blockReasonText = blockReason(profile);
  const [rows, setRows] = useState<Unit[] | null>(null);
  const [meta, setMeta] = useState<Paginated<Unit>['meta'] | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [group, setGroup] = useState('O+');
  const [units, setUnits] = useState('0');
  const [addBusy, setAddBusy] = useState(false);
  const [editUnits, setEditUnits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await apiGet<Paginated<Unit>>(`/blood/units?page=${page}&limit=20`);
    if (!res.ok) {
      setError(res);
      return;
    }
    setRows(res.data.items);
    setMeta(res.data.meta);
  }, [page]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const n = Number(units);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      setError({ status: 422, message: 'Units must be a whole number between 1 and 999.' });
      return;
    }
    setAddBusy(true);
    setError(null);
    setNotice(null);
    const res = await apiPost<{ id: string; bloodGroup: string; units: number }>('/blood/units', {
      bloodGroup: group,
      units: n,
    });
    setAddBusy(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice(`${res.data.bloodGroup} stock is now ${res.data.units} units.`);
    await load();
  }

  async function setUnit(unit: Unit) {
    const n = Number(editUnits[unit.id] ?? unit.units);
    if (!Number.isInteger(n) || n < 0 || n > 999) {
      setError({ status: 422, message: 'Units must be between 0 and 999.' });
      return;
    }
    setBusyId(unit.id);
    setError(null);
    setNotice(null);
    const res = await apiPatch<{ id: string; units: number }>(`/blood/units/${unit.id}`, { units: n });
    setBusyId(null);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice(`${unit.bloodGroup} stock updated to ${res.data.units} units.`);
    await load();
  }

  const total = (rows ?? []).reduce((s, r) => s + r.units, 0);

  return (
    <Card
      title="Blood stock"
      description="Units registered at your facility. Adding an existing group tops it up."
      actions={<Badge tone={total > 0 ? 'success' : 'neutral'}>{total} units in stock</Badge>}
    >
      <div className="space-y-4">
        {blockReasonText && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {blockReasonText} Managing stock unlocks once an admin verifies your account.
          </p>
        )}
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} />}

        <form
          onSubmit={(e) => void add(e)}
          className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4"
          aria-label="Add blood units"
        >
          <label className="block">
            <span className="text-xs font-bold text-ink">Blood group</span>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="mt-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            >
              {GROUPS.map((g) => (
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
              max={999}
              className="mt-1.5 w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
          <Button
            type="submit"
            disabled={addBusy || !!blockReasonText}
            title={blockReasonText ?? undefined}
          >
            {addBusy ? 'Saving…' : 'Add stock'}
          </Button>
        </form>

        {!rows && !error && <Skeleton rows={3} />}
        {rows && rows.length === 0 && (
          <Empty
            title="No blood stock recorded"
            hint="Add units above — availability is exposed publicly and used to match urgent requests."
            icon={<IconDroplet size={20} />}
          />
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows?.map((unit) => (
            <article key={unit.id} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Badge tone={GROUP_TONE[unit.bloodGroup] ?? 'neutral'}>{unit.bloodGroup}</Badge>
                <span className="ml-auto text-lg font-bold text-ink">{unit.units}</span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="number"
                  value={editUnits[unit.id] ?? String(unit.units)}
                  onChange={(e) => setEditUnits((d) => ({ ...d, [unit.id]: e.target.value }))}
                  min={0}
                  max={999}
                  aria-label={`Set ${unit.bloodGroup} units`}
                  className="w-24 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  disabled={busyId === unit.id || !!blockReasonText}
                  title={blockReasonText ?? undefined}
                  onClick={() => void setUnit(unit)}
                >
                  {busyId === unit.id ? 'Saving…' : 'Set'}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-ink-subtle">{unit.facility?.name ?? 'Your facility'}</p>
            </article>
          ))}
        </div>

        <Pager page={page} meta={meta} onPage={setPage} busy={!rows} />
      </div>
    </Card>
  );
}