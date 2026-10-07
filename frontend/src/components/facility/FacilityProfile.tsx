'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { Badge, Button, StatusDot } from '@/components/ui';
import { IconHospital } from '@/components/icons';
import { Card, ErrorBanner, Skeleton, SuccessNotice, type ApiError, blockReason } from './ui';
import type { SessionProfile } from '@/lib/session';

export type FacilityDetail = {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string | null;
  operatingHours: string | null;
  emergencyAvailable: boolean;
  services: string[];
  latitude: number | null;
  longitude: number | null;
  rating: { avg: number | null; count: number } | null;
  staff: number;
};

type Draft = {
  name: string;
  type: string;
  address: string;
  phone: string;
  operatingHours: string;
  services: string;
  latitude: string;
  longitude: string;
  emergencyAvailable: boolean;
};

function emptyDraft(): Draft {
  return {
    name: '',
    type: 'HOSPITAL',
    address: '',
    phone: '',
    operatingHours: '',
    services: '',
    latitude: '',
    longitude: '',
    emergencyAvailable: false,
  };
}

function bodyFromDraft(d: Draft): Record<string, unknown> {
  const services = d.services
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  const body: Record<string, unknown> = {
    name: d.name.trim(),
    address: d.address.trim(),
    type: d.type,
    emergencyAvailable: d.emergencyAvailable,
  };
  if (d.phone.trim()) body.phone = d.phone.trim();
  if (d.operatingHours.trim()) body.operatingHours = d.operatingHours.trim();
  if (services.length) body.services = services;
  const lat = Number(d.latitude);
  const lng = Number(d.longitude);
  if (d.latitude.trim() && Number.isFinite(lat)) body.latitude = lat;
  if (d.longitude.trim() && Number.isFinite(lng)) body.longitude = lng;
  return body;
}

function FacilityForm({
  label,
  pending,
  draft,
  setDraft,
  onSubmit,
  onCancel,
  disabled,
  disabledText,
}: {
  label: string;
  pending: boolean;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  disabledText?: string | null;
}) {
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mt-5 space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-bold text-ink">Facility name *</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={120}
            placeholder="e.g. Patan Community Hospital"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-bold text-ink">Type *</span>
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="HOSPITAL">Hospital</option>
            <option value="HEALTH_POST">Health post</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[13px] font-bold text-ink">Address *</span>
          <input
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            maxLength={200}
            placeholder="Street, ward, district"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-bold text-ink">Phone</span>
          <input
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            maxLength={40}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-bold text-ink">Operating hours (plain text)</span>
          <input
            value={draft.operatingHours}
            onChange={(e) => setDraft({ ...draft, operatingHours: e.target.value })}
            maxLength={300}
            placeholder="e.g. 24/7 emergency, OPD 8am–5pm"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[13px] font-bold text-ink">Services (comma separated)</span>
          <textarea
            value={draft.services}
            onChange={(e) => setDraft({ ...draft, services: e.target.value })}
            rows={2}
            placeholder="ER, Pharmacy, Maternity, Lab"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-bold text-ink">Latitude</span>
          <input
            value={draft.latitude}
            onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
            inputMode="decimal"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-bold text-ink">Longitude</span>
          <input
            value={draft.longitude}
            onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
            inputMode="decimal"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.emergencyAvailable}
            onChange={(e) => setDraft({ ...draft, emergencyAvailable: e.target.checked })}
            className="h-4 w-4 accent-emerald-600"
          />
          <span className="text-sm font-semibold text-ink">Accepts emergency arrivals</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !!disabled} title={disabledText ?? undefined}>
          {pending ? 'Saving…' : label}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {disabledText && <p className="text-[13px] font-semibold text-amber-700">{disabledText}</p>}
      </div>
    </form>
  );
}

export default function FacilityProfile({
  profile,
  onCreated,
}: {
  profile: SessionProfile;
  onCreated: () => Promise<void>;
}) {
  const blockReasonText = blockReason(profile);
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [missing, setMissing] = useState(!profile.facilityId);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile.facilityId) {
      setMissing(true);
      return;
    }
    setError(null);
    const res = await apiGet<FacilityDetail>(`/facilities/${profile.facilityId}`);
    if (!res.ok) {
      setError(res);
      setFacility(null);
      return;
    }
    setFacility(res.data);
    setMissing(false);
  }, [profile.facilityId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  function draftFromFacility(f: FacilityDetail): Draft {
    return {
      name: f.name,
      type: f.type,
      address: f.address,
      phone: f.phone ?? '',
      operatingHours: f.operatingHours ?? '',
      services: f.services.join(', '),
      latitude: f.latitude !== null ? String(f.latitude) : '',
      longitude: f.longitude !== null ? String(f.longitude) : '',
      emergencyAvailable: f.emergencyAvailable,
    };
  }

  async function create() {
    if (!draft.name.trim() || !draft.address.trim()) {
      setFormError({ status: 422, message: 'Name and address are required.' });
      return;
    }
    setPending(true);
    setFormError(null);
    setNotice(null);
    const res = await apiPost<{ id: string }>('/facilities', bodyFromDraft(draft));
    setPending(false);
    if (!res.ok) {
      setFormError(res);
      return;
    }
    setNotice('Facility created and linked to your account.');
    await onCreated();
  }

  async function update() {
    if (!facility) return;
    if (!draft.name.trim() || !draft.address.trim()) {
      setFormError({ status: 422, message: 'Name and address are required.' });
      return;
    }
    setPending(true);
    setFormError(null);
    setNotice(null);
    const res = await apiPatch<FacilityDetail>(`/facilities/${facility.id}`, bodyFromDraft(draft));
    setPending(false);
    if (!res.ok) {
      setFormError(res);
      return;
    }
    setFacility(res.data);
    setEditing(false);
    setNotice('Facility details updated.');
  }

  return (
    <Card
      title={missing ? 'Register your facility' : 'My facility'}
      description={
        missing
          ? 'Linked to your staff account once created — required before managing blood stock or requests.'
          : 'Public details shown to patients on the directory.'
      }
      actions={
        !missing && facility && !editing ? (
          <Button
            type="button"
            variant="secondary"
            className="px-4 py-2 text-xs"
            onClick={() => {
              setDraft(draftFromFacility(facility));
              setEditing(true);
            }}
          >
            Edit facility
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {blockReasonText && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {blockReasonText} Creating or editing a facility unlocks once an admin verifies your account.
          </p>
        )}
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {formError && <ErrorBanner error={formError} />}
        {error && <ErrorBanner error={error} onRetry={load} />}

        {missing ? (
          <FacilityForm
            label="Create facility"
            pending={pending}
            draft={draft}
            setDraft={setDraft}
            onSubmit={() => void create()}
            disabledText={blockReasonText}
          />
        ) : !facility && !error ? (
          <Skeleton rows={3} />
        ) : facility && editing ? (
          <FacilityForm
            label="Save changes"
            pending={pending}
            draft={draft}
            setDraft={setDraft}
            onSubmit={() => void update()}
            onCancel={() => {
              setEditing(false);
              setFormError(null);
            }}
            disabledText={blockReasonText}
          />
        ) : facility ? (
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <IconHospital size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-bold text-ink">{facility.name}</p>
                <Badge tone={facility.type === 'HOSPITAL' ? 'brand' : 'teal'}>
                  {facility.type.replace(/_/g, ' ')}
                </Badge>
                {facility.emergencyAvailable && <Badge tone="danger">Emergency</Badge>}
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                {facility.address}
                {facility.phone ? ` · ${facility.phone}` : ''}
              </p>
              {facility.operatingHours && <p className="mt-1 text-[13px] text-ink-muted">{facility.operatingHours}</p>}
              {facility.services.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {facility.services.map((s) => (
                    <Badge key={s} tone="neutral">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-subtle">
                <span className="flex items-center gap-1.5">
                  <StatusDot tone={facility.staff > 0 ? 'success' : 'danger'} />
                  {facility.staff} staff linked
                </span>
                {facility.rating && facility.rating.avg !== null && (
                  <span>{facility.rating.avg}/5 · {facility.rating.count} review{facility.rating.count === 1 ? '' : 's'}</span>
                )}
                {facility.latitude !== null && facility.longitude !== null && (
                  <span>
                    {facility.latitude.toFixed(3)}, {facility.longitude.toFixed(3)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}