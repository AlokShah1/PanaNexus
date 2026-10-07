'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPatch } from '@/lib/api';
import { Badge, Button, StatusDot } from '@/components/ui';
import { IconAmbulance, IconPin } from '@/components/icons';
import { Card, ErrorBanner, Empty, Skeleton, SuccessNotice, type ApiError, blockReason, fmtDateTime } from './ui';
import { useLocationShare } from './useLocationShare';
import type { AmbulanceRow } from './types';
import type { SessionProfile } from '@/lib/session';

type TripDetail = {
  request: {
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
    pickupLatitude: number;
    pickupLongitude: number;
    destination: { id: string; name: string; address: string } | null;
  };
  trip: {
    id: string;
    status: string;
    state: string;
    ambulanceId: string;
    startedAt: string | null;
    arrivedAt: string | null;
    completedAt: string | null;
    endedAt: string | null;
  } | null;
  ambulance: {
    id: string;
    registrationNumber: string;
    type: string;
    driver: string | null;
    driverPhone: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  locations: { latitude: number; longitude: number; recordedAt: string }[];
};

type TripCard = {
  ambulanceId: string;
  requestId: string;
  reg: string;
  state: string;
  category: string;
  priority: string;
  pickup: string;
  destination: string | null;
  notes: string | null;
  createdLabel: string;
  arrivedLabel: string | null;
  startedLabel: string | null;
  completedLabel: string | null;
};

const NEXT: Record<string, Array<{ label: string; value: string }>> = {
  ASSIGNED: [
    { label: 'Start en route', value: 'EN_ROUTE' },
    { label: 'Mark arrived', value: 'ARRIVED' },
  ],
  EN_ROUTE: [{ label: 'Mark arrived', value: 'ARRIVED' }],
  ARRIVED: [{ label: 'Start transporting', value: 'TRANSPORTING' }],
  TRANSPORTING: [{ label: 'Complete trip', value: 'COMPLETED' }],
};

const STATE_TONE: Record<string, 'brand' | 'warning' | 'success' | 'neutral'> = {
  ASSIGNED: 'warning',
  EN_ROUTE: 'brand',
  ARRIVED: 'warning',
  TRANSPORTING: 'brand',
  COMPLETED: 'success',
};

function fmtLabel(iso: string | null): string | null {
  return iso ? fmtDateTime(iso) : null;
}

export default function ActiveTripPanel({
  fleet,
  refreshKey,
  onChanged,
  profile,
}: {
  fleet: AmbulanceRow[] | null;
  refreshKey: number;
  onChanged: () => void;
  profile: SessionProfile;
}) {
  const blockReasonText = blockReason(profile);
  const [trips, setTrips] = useState<TripCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      const list = await apiGet<{ items: Array<{ id: string; state: string; tripStatus: string | null }> }>('/emergency?limit=50');
      if (!active) return;
      if (!list.ok) {
        setError(list);
        setLoading(false);
        return;
      }
      const liveStates = new Set(['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRANSPORTING']);
      const next: TripCard[] = [];
      for (const item of list.data.items.filter((i) => liveStates.has(i.state))) {
        const res = await apiGet<TripDetail>(`/emergency/${encodeURIComponent(item.id)}`);
        if (!active) return;
        if (!res.ok) continue;
        const d = res.data;
        if (!d.ambulance?.id || !d.trip) continue;
        if (fleet && !fleet.some((a) => a.id === d.ambulance!.id)) continue;
        next.push({
          ambulanceId: d.ambulance.id,
          requestId: item.id,
          reg: d.ambulance.registrationNumber ?? 'Unit',
          state: d.request.state,
          category: d.request.category,
          priority: d.request.priority,
          pickup: d.request.pickupAddress ?? d.request.notes ?? 'Pickup',
          destination: d.request.destinationAddress,
          notes: d.request.notes,
          createdLabel: fmtDateTime(d.request.createdAt),
          startedLabel: fmtLabel(d.trip.startedAt ?? null),
          arrivedLabel: fmtLabel(d.trip.arrivedAt ?? null),
          completedLabel: fmtLabel(d.trip.completedAt ?? null),
        });
      }
      if (!active) return;
      setTrips(next);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshKey, fleet]);

  const live = useLocationShare(trips.length > 0 ? trips[0].ambulanceId : null, !blockReasonText && trips.length > 0);

  async function update(row: TripCard, status: string) {
    setBusyId(row.ambulanceId);
    setError(null);
    setNotice(null);
    const res = await apiPatch<{ id: string; status: string }>(`/ambulances/${row.ambulanceId}/status`, { status });
    setBusyId(null);
    if (!res.ok) {
      setError(res);
      return;
    }
    if (status === 'COMPLETED') {
      setNotice(`${row.reg} finished the trip — take care of your crew.`);
    } else {
      setNotice(`${row.reg} marked ${status.replace(/_/g, ' ').toLowerCase()}.`);
    }
    onChanged();
  }

  return (
    <Card
      title="Active trips"
      description="Trips assigned to your fleet, from pickup to hospital handoff. They reload automatically as they progress."
      actions={<StatusDot tone={trips.length > 0 ? 'danger' : 'success'} />}
    >
      <div className="space-y-4">
        {blockReasonText && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {blockReasonText} Live location sharing and trip controls unlock after verification.
          </p>
        )}
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} />}
        {loading && trips.length === 0 && <Skeleton rows={2} />}
        {!loading && trips.length === 0 && (
          <Empty
            title="No active trips"
            hint="Accept a request from the dispatch board and it will be tracked here from pickup to hospital."
            icon={<IconAmbulance size={20} />}
          />
        )}

        {trips.length > 0 && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-brand-50 ring-1 ring-brand-100">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
                  <IconPin size={15} />
                  Live location · {live.sent} update{live.sent === 1 ? '' : 's'} sent
                </p>
                {live.status === 'denied' || live.status === 'unsupported' ? (
                  <span className="text-[12px] font-semibold text-amber-700">{live.message}</span>
                ) : (
                  <Badge tone={live.status === 'sharing' ? 'success' : 'neutral'}>
                    {live.status === 'sharing' ? 'Sharing' : 'Waiting for GPS'}
                  </Badge>
                )}
              </div>
              {live.message && live.status !== 'sharing' && (
                <p className="px-4 pb-3 text-[12px] text-ink-muted">{live.message}</p>
              )}
            </div>
            <ul className="space-y-3">
              {trips.map((row) => {
                const actions = NEXT[row.state] ?? [];
                return (
                  <li key={row.ambulanceId} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={STATE_TONE[row.state] ?? 'brand'}>{row.state.replace(/_/g, ' ')}</Badge>
                          <Badge tone="warning">{row.priority}</Badge>
                          <Badge tone="brand">{row.category.replace(/_/g, ' ').toLowerCase()}</Badge>
                          <span className="text-[12px] text-ink-subtle">{row.createdLabel}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-ink">{row.reg}</p>
                        <p className="mt-0.5 text-[13px] text-ink-muted">Pickup: {row.pickup}</p>
                        {row.destination && <p className="text-[13px] text-ink-muted">Destination: {row.destination}</p>}
                        {row.notes && <p className="mt-1 text-[13px] text-ink-muted">{row.notes}</p>}
                        {(row.startedLabel || row.arrivedLabel || row.completedLabel) && (
                          <p className="mt-1 text-[12px] text-ink-subtle">
                            {row.startedLabel && `Started ${row.startedLabel}`}
                            {row.arrivedLabel && ` · Arrived ${row.arrivedLabel}`}
                            {row.completedLabel && ` · Completed ${row.completedLabel}`}
                          </p>
                        )}
                      </div>
                      {actions.length > 0 && (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {actions.map((action) => (
                            <Button
                              key={action.value}
                              type="button"
                              variant={action.value === 'COMPLETED' ? 'emergency' : 'primary'}
                              className="px-4 py-1.5 text-xs"
                              disabled={busyId === row.ambulanceId || !!blockReasonText}
                              title={blockReasonText ?? undefined}
                              onClick={() => void update(row, action.value)}
                            >
                              {busyId === row.ambulanceId ? 'Updating…' : action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}