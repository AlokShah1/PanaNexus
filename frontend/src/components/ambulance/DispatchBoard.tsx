'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getRealtime } from '@/lib/realtime';
import { Badge, Button } from '@/components/ui';
import { IconAmbulance, IconHeart } from '@/components/icons';
import { Card, Empty, ErrorBanner, Skeleton, SuccessNotice, type ApiError, blockReason, fmtDateTime } from './ui';
import type { AmbulanceRow } from './types';
import type { SessionProfile } from '@/lib/session';

type EmergencyListItem = {
  id: string;
  status: string;
  state: string;
  category: string;
  priority: string;
  pickupAddress: string | null;
  destinationAddress: string | null;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  tripStatus: string | null;
  ambulance: { registrationNumber: string; type: string } | null;
};

type Row = EmergencyListItem & { createdLabel: string };

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'brand' | 'neutral'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'brand',
  LOW: 'neutral',
};

export default function DispatchBoard({
  fleet,
  onAccepted,
  profile,
}: {
  fleet: AmbulanceRow[] | null;
  onAccepted: () => void;
  profile: SessionProfile;
}) {
  const blockReasonText = blockReason(profile);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await apiGet<{ items: EmergencyListItem[]; meta: { total: number } }>('/emergency?limit=20');
    if (!res.ok) {
      setError(res);
      setRows(null);
      return;
    }
    setRows(
      res.data.items
        .filter((item) => item.tripStatus === null && (item.state === 'REQUESTED' || item.state === 'SEARCHING'))
        .map((item) => ({ ...item, createdLabel: fmtDateTime(item.createdAt) })),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    const s = getRealtime();
    if (s) {
      const refresh = () => void load();
      s.on('emergency:new', refresh);
      return () => {
        s.off('emergency:new', refresh);
      };
    }
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  const available = (fleet ?? []).filter((a) => a.status === 'AVAILABLE' && a.online);
  const openCount = available.length;

  async function accept(item: Row) {
    const ambulanceId = pick[item.id];
    const chosen = available.find((a) => a.id === ambulanceId) ?? available[0];
    if (!chosen) return;
    setBusyId(item.id);
    setError(null);
    setNotice(null);
    const res = await apiPost<{ trip: { id: string; status: string; state: string } }>(
      `/ambulances/${chosen.id}/accept`,
      { emergencyRequestId: item.id },
    );
    setBusyId(null);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice(`Request #${item.id.slice(0, 8)} accepted with ${chosen.registrationNumber}. Head to the pickup.`);
    onAccepted();
    await load();
  }

  return (
    <Card
      title="Dispatch board"
      description="Open emergency requests matched to operators like you."
      actions={
        <Badge tone={openCount > 0 ? 'success' : 'neutral'}>
          {openCount} available unit{openCount === 1 ? '' : 's'}
        </Badge>
      }
    >
      <div className="space-y-4">
        {blockReasonText && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {blockReasonText} Dispatching unlocks once an admin verifies your account.
          </p>
        )}
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} />}
        {!rows && !error && <Skeleton rows={3} />}
        {rows && rows.length === 0 && (
          <Empty
            title="No open requests"
            hint="Turn an ambulance online and keep this page open — matched emergency requests appear here instantly."
            icon={<IconHeart size={20} />}
          />
        )}
        <div className="space-y-3">
          {rows?.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={PRIORITY_TONE[item.priority] ?? 'neutral'}>{item.priority}</Badge>
                    <Badge tone="brand">{item.category.replace(/_/g, ' ').toLowerCase()}</Badge>
                    <span className="text-[12px] text-ink-subtle">Open · {item.createdLabel}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">Pickup: {item.pickupAddress ?? item.notes ?? 'Nearby'}</p>
                  {item.destinationAddress && (
                    <p className="mt-0.5 text-[13px] text-ink-muted">Destination: {item.destinationAddress}</p>
                  )}
                  {item.notes && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{item.notes}</p>}
                </div>
                <div className="shrink-0">
                  <select
                    aria-label="Ambulance to dispatch"
                    value={pick[item.id] ?? available[0]?.id ?? ''}
                    onChange={(e) => setPick((p) => ({ ...p, [item.id]: e.target.value }))}
                    disabled={available.length === 0}
                    className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
                  >
                    {available.length === 0 && <option value="">No unit available</option>}
                    {available.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.registrationNumber} · {a.type}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    className="w-full px-4 py-2 text-xs"
                    disabled={!chosenFor(item) || busyId === item.id || !!blockReasonText}
                    title={blockReasonText ?? undefined}
                    onClick={() => void accept(item)}
                  >
                    <IconAmbulance size={15} />
                    {busyId === item.id ? 'Accepting…' : 'Accept request'}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Card>
  );

  function chosenFor(item: Row): AmbulanceRow | undefined {
    return pick[item.id] ? available.find((a) => a.id === pick[item.id]) : available[0];
  }
}