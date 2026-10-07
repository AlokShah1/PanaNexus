'use client';

import { useState, type FormEvent } from 'react';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import { IconAmbulance, IconClose } from '@/components/icons';
import { Card, ErrorBanner, Empty, Skeleton, SuccessNotice, type ApiError, blockReason } from './ui';
import { AMBULANCE_TYPES, type AmbulanceRow } from './types';
import type { SessionProfile } from '@/lib/session';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'brand' | 'neutral'> = {
  AVAILABLE: 'success',
  OFFLINE: 'neutral',
  ASSIGNED: 'warning',
  EN_ROUTE: 'warning',
  ARRIVED: 'brand',
  TRANSPORTING: 'brand',
  COMPLETED: 'success',
};

type Draft = {
  type: string;
  registrationNumber: string;
  driverName: string;
  driverPhone: string;
  latitude: string;
  longitude: string;
};

function emptyDraft(): Draft {
  return {
    type: 'BASIC',
    registrationNumber: '',
    driverName: '',
    driverPhone: '',
    latitude: '',
    longitude: '',
  };
}

function toPatch(d: Draft): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (d.type) body.type = d.type;
  if (d.driverName.trim()) body.driverName = d.driverName.trim();
  if (d.driverPhone.trim()) body.driverPhone = d.driverPhone.trim();
  const lat = Number(d.latitude);
  const lng = Number(d.longitude);
  if (d.latitude.trim() && Number.isFinite(lat)) body.latitude = lat;
  if (d.longitude.trim() && Number.isFinite(lng)) body.longitude = lng;
  return body;
}

export default function FleetPanel({
  fleet,
  fleetError,
  onReload,
  profile,
}: {
  fleet: AmbulanceRow[] | null;
  fleetError: ApiError | null;
  onReload: () => void;
  profile: SessionProfile;
}) {
  const blockReasonText = blockReason(profile);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, Draft>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function beginEdit(row: AmbulanceRow) {
    setEditingId(row.id);
    setEditDrafts((d) => ({
      ...d,
      [row.id]: {
        type: row.type,
        registrationNumber: row.registrationNumber,
        driverName: row.driverName ?? '',
        driverPhone: row.driverPhone ?? '',
        latitude: row.latitude !== null ? String(row.latitude) : '',
        longitude: row.longitude !== null ? String(row.longitude) : '',
      },
    }));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!draft.type) {
      setFormError({ status: 422, message: 'Pick an ambulance type.' });
      return;
    }
    setBusyKey('create');
    setFormError(null);
    setNotice(null);
    if (!draft.registrationNumber.trim()) {
      setBusyKey(null);
      setFormError({ status: 422, message: 'Registration number is required.' });
      return;
    }
    const body: Record<string, unknown> = {
      registrationNumber: draft.registrationNumber.trim(),
      type: draft.type,
      ...toPatch(draft),
    };
    const res = await apiPost<{ ambulance: AmbulanceRow }>('/ambulances/me', body);
    setBusyKey(null);
    if (!res.ok) {
      setFormError(res);
      return;
    }
    setShowForm(false);
    setDraft(emptyDraft());
    setNotice(`Ambulance ${res.data.ambulance.registrationNumber} added.`);
    onReload();
  }

  async function saveEdit(row: AmbulanceRow) {
    const d = editDrafts[row.id] ?? emptyDraft();
    setBusyKey(`edit:${row.id}`);
    setFormError(null);
    setNotice(null);
    const res = await apiPatch<{ ambulance: AmbulanceRow }>(`/ambulances/me/${row.id}`, toPatch(d));
    setBusyKey(null);
    if (!res.ok) {
      setFormError(res);
      return;
    }
    setEditingId(null);
    setNotice(`Ambulance ${row.registrationNumber} updated.`);
    onReload();
  }

  async function toggle(row: AmbulanceRow) {
    const next = row.online ? false : true;
    setBusyKey(`line:${row.id}`);
    setFormError(null);
    setNotice(null);
    const res = await apiPost<{ id: string; online: boolean }>(`/ambulances/me/${row.id}/${next ? 'online' : 'offline'}`, {});
    setBusyKey(null);
    if (!res.ok) {
      setFormError(res);
      return;
    }
    setNotice(`Ambulance ${row.registrationNumber} is now ${next ? 'online' : 'offline'}.`);
    onReload();
  }

  async function remove(row: AmbulanceRow) {
    setBusyKey(`del:${row.id}`);
    setFormError(null);
    setNotice(null);
    const res = await apiDelete<{ id: string; removed: boolean }>(`/ambulances/me/${row.id}`);
    setBusyKey(null);
    if (!res.ok) {
      setFormError(res);
      setConfirmDelete(null);
      return;
    }
    setConfirmDelete(null);
    setNotice(`Ambulance ${row.registrationNumber} removed.`);
    onReload();
  }

  const live = fleet ?? [];

  return (
    <Card
      title="My ambulances"
      description="Units you operate. Mark a unit online to appear in the dispatch board."
      actions={
        <Button
          type="button"
          className="px-4 py-2 text-xs"
          onClick={() => {
            setShowForm((v) => !v);
            setFormError(null);
          }}
          disabled={!!blockReasonText}
          title={blockReasonText ?? undefined}
        >
          {showForm ? 'Close form' : '+ Add ambulance'}
        </Button>
      }
    >
      <div className="space-y-4">
        {blockReasonText && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {blockReasonText} You can still view your units, but dispatching and live location need a verified account.
          </p>
        )}
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {formError && <ErrorBanner error={formError} />}
        {fleetError && !fleet && <ErrorBanner error={fleetError} onRetry={onReload} />}

        {showForm && (
          <form
            onSubmit={(e) => void create(e)}
            className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4"
            aria-label="Add ambulance"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="text-xs font-bold text-ink">Registration number *</span>
                <input
                  value={draft.registrationNumber ?? ''}
                  onChange={(e) => setDraft({ ...draft, registrationNumber: e.target.value })}
                  placeholder="e.g. BA 1 JA 4827"
                  maxLength={20}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink">Type</span>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
                >
                  {AMBULANCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink">Driver name</span>
                <input
                  value={draft.driverName}
                  onChange={(e) => setDraft({ ...draft, driverName: e.target.value })}
                  maxLength={80}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink">Driver phone</span>
                <input
                  value={draft.driverPhone}
                  onChange={(e) => setDraft({ ...draft, driverPhone: e.target.value })}
                  maxLength={30}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink">Latitude</span>
                <input
                  value={draft.latitude}
                  onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink">Longitude</span>
                <input
                  value={draft.longitude}
                  onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-3">
              <Button type="submit" disabled={busyKey === 'create'}>
                {busyKey === 'create' ? 'Adding…' : 'Add ambulance'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {!fleet && !fleetError && <Skeleton rows={3} />}
        {fleet && live.length === 0 && (
          <Empty
            icon={<IconAmbulance size={20} />}
            title="No ambulances registered"
            hint="Add your first unit — dispatchers can only send you requests once a unit is online."
          />
        )}

        <div className="space-y-3">
          {live.map((row) => (
            <article key={row.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <IconAmbulance size={20} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{row.registrationNumber}</p>
                      <Badge tone={row.online ? 'success' : 'neutral'}>{row.online ? 'Online' : 'Offline'}</Badge>
                      <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{row.status}</Badge>
                      <Badge tone="brand">{row.type}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      {row.driverName ? `${row.driverName}${row.driverPhone ? ` · ${row.driverPhone}` : ''}` : 'No driver assigned'}
                      {row.latitude !== null && row.longitude !== null
                        ? ` · ${row.latitude.toFixed(3)}, ${row.longitude.toFixed(3)}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={row.online ? 'secondary' : 'primary'}
                    className="px-3.5 py-1.5 text-xs"
                    disabled={busyKey === `line:${row.id}`}
                    onClick={() => void toggle(row)}
                  >
                    {busyKey === `line:${row.id}` ? 'Working…' : row.online ? 'Go offline' : 'Go online'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3.5 py-1.5 text-xs"
                    onClick={() => beginEdit(row)}
                  >
                    Edit
                  </Button>
                  {!row.online && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3.5 py-1.5 text-xs text-danger"
                      onClick={() => setConfirmDelete(row.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {editingId === row.id && (
                <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(['type', 'driverName', 'driverPhone', 'latitude', 'longitude'] as const).map((field) => (
                    <label key={field} className="block">
                      <span className="text-xs font-bold text-ink">
                        {field === 'type' ? 'Type' : field === 'latitude' ? 'Latitude' : field === 'longitude' ? 'Longitude' : field === 'driverName' ? 'Driver name' : 'Driver phone'}
                      </span>
                      {field === 'type' ? (
                        <select
                          value={editDrafts[row.id]?.type ?? 'BASIC'}
                          onChange={(e) =>
                            setEditDrafts((d) => ({ ...d, [row.id]: { ...d[row.id]!, type: e.target.value } }))
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
                        >
                          {AMBULANCE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={editDrafts[row.id]?.[field] ?? ''}
                          onChange={(e) =>
                            setEditDrafts((d) => ({ ...d, [row.id]: { ...d[row.id]!, [field]: e.target.value } }))
                          }
                          inputMode={field === 'latitude' || field === 'longitude' ? 'decimal' : 'text'}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                        />
                      )}
                    </label>
                  ))}
                  <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                    <Button
                      type="button"
                      disabled={busyKey === `edit:${row.id}`}
                      onClick={() => void saveEdit(row)}
                    >
                      {busyKey === `edit:${row.id}` ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                      <IconClose size={15} className="mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {confirmDelete === row.id && (
                <div className="mt-4 rounded-2xl bg-danger-soft p-4 text-sm" role="alert">
                  <p className="font-semibold text-danger">Remove {row.registrationNumber}?</p>
                  <p className="mt-1 text-ink-muted">
                    It can only be removed while offline — no active or historical trips will be touched.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="emergency" disabled={busyKey === `del:${row.id}`} onClick={() => void remove(row)}>
                      {busyKey === `del:${row.id}` ? 'Removing…' : 'Remove ambulance'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmDelete(null)}>
                      Keep it
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </Card>
  );
}