'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui';
import { IconClock, IconClose } from '@/components/icons';
import { Card, ErrorBanner, SuccessNotice, type ApiError, blockReason } from './ui';
import { WEEKDAYS, formatMinute, timeToMinutes } from './time';
import type { SessionProfile } from '@/lib/session';

type Slot = { weekday: number; startMinute: number; endMinute: number; slotMinutes: number };
type AvailRow = { key: number; weekday: number; start: string; end: string; slotMinutes: number };

const SLOT_CHOICES = [15, 30, 45, 60];

export default function AvailabilityEditor({
  doctorId,
  profile,
}: {
  doctorId: string;
  profile: SessionProfile;
}) {
  const [rows, setRows] = useState<AvailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(1);
  const blockReasonText = blockReason(profile);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiGet<Slot[]>(`/appointments/availability?doctorId=${encodeURIComponent(doctorId)}`);
    setLoading(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    setRows(
      res.data.map((s) => ({
        key: nextKey.current++,
        weekday: s.weekday,
        start: formatMinute(s.startMinute),
        end: formatMinute(s.endMinute),
        slotMinutes: s.slotMinutes,
      })),
    );
  }, [doctorId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  function addRow(weekday: number) {
    setRows((r) => [
      ...r,
      { key: nextKey.current++, weekday, start: '09:00', end: '17:00', slotMinutes: 30 },
    ]);
  }

  function removeRow(key: number) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  function patchRow(key: number, patch: Partial<AvailRow>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function invalidRow(row: AvailRow): boolean {
    return !row.start || !row.end || timeToMinutes(row.start) >= timeToMinutes(row.end);
  }

  async function save() {
    setNotice(null);
    setError(null);
    if (rows.length === 0) {
      setError({ status: 422, message: 'Add at least one time range before saving.' });
      return;
    }
    const invalid = rows.find(invalidRow);
    if (invalid) {
      setError({
        status: 422,
        message: `On ${WEEKDAYS[invalid.weekday]}, the end time must be after the start time.`,
      });
      return;
    }
    if (rows.length > 21) {
      setError({ status: 422, message: 'Keep to 21 time ranges max across the week.' });
      return;
    }
    setSaving(true);
    const slots: Slot[] = rows.map((row) => ({
      weekday: row.weekday,
      startMinute: timeToMinutes(row.start),
      endMinute: timeToMinutes(row.end),
      slotMinutes: row.slotMinutes,
    }));
    const res = await apiPost<{ slots: Slot[] }>('/appointments/availability', { slots });
    setSaving(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice('Availability saved. The full weekly set was replaced on the server.');
    await load();
  }

  return (
    <Card
      title="Weekly availability"
      description="Consultation hours used to build bookable slots. Saving replaces the whole week."
      actions={
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || !!blockReasonText}
          title={blockReasonText ?? undefined}
          className="px-4 py-2 text-xs"
        >
          {saving ? 'Saving…' : 'Save availability'}
        </Button>
      }
    >
      {blockReasonText && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
          {blockReasonText} Save availability unlocks once an admin verifies your account.
        </p>
      )}
      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      {error && <ErrorBanner error={error} />}
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading availability">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-slate-100" role="group" aria-label="Weekly availability editor">
          {WEEKDAYS.map((day, weekday) => {
            const dayRows = rows.filter((r) => r.weekday === weekday);
            return (
              <div key={day} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[110px_1fr]">
                <div className="flex items-center gap-2 sm:items-start sm:pt-2.5">
                  <IconClock size={15} className="hidden text-ink-subtle sm:block" />
                  <span className="text-sm font-semibold text-ink">{day}</span>
                </div>
                <div className="space-y-2">
                  {dayRows.map((row) => {
                    const invalid = invalidRow(row);
                    return (
                      <div key={row.key} className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={row.start}
                          onChange={(e) => patchRow(row.key, { start: e.target.value })}
                          aria-label={`${day} start time`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                        />
                        <span className="text-ink-subtle">–</span>
                        <input
                          type="time"
                          value={row.end}
                          onChange={(e) => patchRow(row.key, { end: e.target.value })}
                          aria-label={`${day} end time`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                        />
                        <select
                          value={row.slotMinutes}
                          onChange={(e) => patchRow(row.key, { slotMinutes: Number(e.target.value) })}
                          aria-label={`${day} slot length`}
                          className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-400"
                        >
                          {SLOT_CHOICES.map((s) => (
                            <option key={s} value={s}>
                              {s} min
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 w-9 p-0"
                          onClick={() => removeRow(row.key)}
                          aria-label={`Remove ${day} ${row.start}–${row.end}`}
                        >
                          <IconClose size={16} />
                        </Button>
                        {invalid && (
                          <span className="text-[12px] font-semibold text-danger">End must be after start</span>
                        )}
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-4 py-1.5 text-xs"
                    onClick={() => addRow(weekday)}
                  >
                    + Add range
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}