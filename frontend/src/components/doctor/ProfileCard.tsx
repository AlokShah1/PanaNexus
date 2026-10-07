'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { roleLabel } from '@/lib/format';
import { Badge, Button } from '@/components/ui';
import { IconStethoscope } from '@/components/icons';
import { Card, ErrorBanner, Skeleton, SuccessNotice, type ApiError, blockReason } from './ui';
import type { SessionProfile } from '@/lib/session';

export type DoctorMe = {
  id: string;
  userId: string;
  specialization: string | null;
  licenseNumber: string | null;
  bio: string | null;
  facilityId: string | null;
  user: { id: string; name: string; email: string; role: string; verificationStatus: string } | null;
  facility: { id: string; name: string } | null;
  availability: { weekday: number; startMinute: number; endMinute: number; slotMinutes: number }[];
};

type FacilityOption = { id: string; name: string; type: string; address: string };

export type DoctorState =
  | { phase: 'loading' }
  | { phase: 'missing' }
  | { phase: 'ready'; doctor: DoctorMe }
  | { phase: 'error'; error: ApiError };

type Draft = { specialization: string; licenseNumber: string; bio: string; facilityId: string };

function emptyDraft(): Draft {
  return { specialization: '', licenseNumber: '', bio: '', facilityId: '' };
}

function ProfileForm({
  title,
  description,
  submitLabel,
  pending,
  draft,
  setDraft,
  onSubmit,
  onCancel,
  blockReasonText,
}: {
  title: string;
  description: string;
  submitLabel: string;
  pending: boolean;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  blockReasonText: string | null;
}) {
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await apiGet<FacilityOption[]>('/facilities');
      if (res.ok) setFacilities(res.data);
    })();
  }, []);

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mt-5 space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="doc-specialization" className="text-[13px] font-bold text-ink">
            Specialization
          </label>
          <input
            id="doc-specialization"
            value={draft.specialization}
            onChange={(e) => setDraft({ ...draft, specialization: e.target.value })}
            placeholder="e.g. Cardiology"
            maxLength={80}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
        <div>
          <label htmlFor="doc-license" className="text-[13px] font-bold text-ink">
            License number
          </label>
          <input
            id="doc-license"
            value={draft.licenseNumber}
            onChange={(e) => setDraft({ ...draft, licenseNumber: e.target.value })}
            placeholder="Medical council registration"
            maxLength={60}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
      </div>
      <div>
        <label htmlFor="doc-facility" className="text-[13px] font-bold text-ink">
          Affiliated facility
        </label>
        <select
          id="doc-facility"
          value={draft.facilityId}
          onChange={(e) => setDraft({ ...draft, facilityId: e.target.value })}
          className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
        >
          <option value="">No facility affiliation</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} · {f.address}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="doc-bio" className="text-[13px] font-bold text-ink">
          Short bio
        </label>
        <textarea
          id="doc-bio"
          value={draft.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          rows={3}
          maxLength={500}
          placeholder="Years of experience, areas of interest…"
          className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="sr-only">{title}</h3>
        <Button type="submit" disabled={pending || !!blockReasonText} title={blockReasonText ?? undefined}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {blockReasonText && <p className="text-[13px] font-semibold text-amber-700">{blockReasonText}</p>}
      </div>
      <p className="text-[12px] text-ink-subtle">{description}</p>
    </form>
  );
}

export default function ProfileCard({
  state,
  profile,
  onReload,
}: {
  state: DoctorState;
  profile: SessionProfile | null;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const blockReasonText = blockReason(profile);

  function draftFromDoctor(doctor: DoctorMe): Draft {
    return {
      specialization: doctor.specialization ?? '',
      licenseNumber: doctor.licenseNumber ?? '',
      bio: doctor.bio ?? '',
      facilityId: doctor.facilityId ?? '',
    };
  }

  async function create() {
    if (!draft.specialization.trim() && !draft.licenseNumber.trim() && !draft.bio.trim()) {
      setFormError({ status: 422, message: 'Add at least your specialization or license number.' });
      return;
    }
    setPending(true);
    setFormError(null);
    setNotice(null);
    const body: Record<string, unknown> = {};
    if (draft.specialization.trim()) body.specialization = draft.specialization.trim();
    if (draft.licenseNumber.trim()) body.licenseNumber = draft.licenseNumber.trim();
    if (draft.bio.trim()) body.bio = draft.bio.trim();
    if (draft.facilityId) body.facilityId = draft.facilityId;
    const res = await apiPost<{ id: string }>('/doctors/profile', body);
    setPending(false);
    if (!res.ok) {
      setFormError(res);
      return;
    }
    setNotice('Doctor profile created.');
    onReload();
  }

  async function update() {
    setPending(true);
    setFormError(null);
    setNotice(null);
    const res = await apiPatch<DoctorMe>('/doctors/me', {
      specialization: draft.specialization.trim(),
      licenseNumber: draft.licenseNumber.trim(),
      bio: draft.bio.trim(),
      ...(draft.facilityId ? { facilityId: draft.facilityId } : {}),
    });
    setPending(false);
    if (!res.ok) {
      setFormError(res);
      return;
    }
    setEditing(false);
    setNotice('Profile updated.');
    onReload();
  }

  if (state.phase === 'loading') {
    return (
      <Card title="Doctor profile">
        <Skeleton rows={2} />
      </Card>
    );
  }

  if (state.phase === 'error') {
    return <ErrorBanner error={state.error} onRetry={onReload} />;
  }

  if (state.phase === 'missing' || (state.phase === 'ready' && editing)) {
    const isCreate = state.phase === 'missing';
    return (
      <Card
        title={isCreate ? 'Create your doctor profile' : 'Edit doctor profile'}
        description={
          isCreate
            ? 'Required before a verification request; patients can book you once you are approved.'
            : 'Changes apply to your public doctor listing.'
        }
        actions={
          state.phase === 'ready' && editing ? (
            <Button type="button" variant="ghost" className="px-4 py-2 text-xs" onClick={() => setEditing(false)}>
              Back to profile
            </Button>
          ) : undefined
        }
      >
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {formError && <ErrorBanner error={formError} />}
        <ProfileForm
          title={isCreate ? 'Create your doctor profile' : 'Edit doctor profile'}
          description={isCreate ? 'You can edit these details any time.' : ''}
          submitLabel={isCreate ? 'Create profile' : 'Save changes'}
          pending={pending}
          draft={draft}
          setDraft={setDraft}
          onSubmit={isCreate ? create : update}
          blockReasonText={blockReasonText}
        />
      </Card>
    );
  }

  const doctor = state.doctor;
  return (
    <Card
      title="Doctor profile"
      description="Visible on your public doctor listing."
      actions={
        <Button
          type="button"
          variant="secondary"
          className="px-4 py-2 text-xs"
          onClick={() => {
            setDraft(draftFromDoctor(doctor));
            setEditing(true);
          }}
        >
          Edit profile
        </Button>
      }
    >
      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <IconStethoscope size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-ink">{doctor.user?.name ?? 'Your profile'}</p>
          <p className="text-[13px] text-ink-muted">{doctor.user?.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {doctor.specialization ? <Badge tone="brand">{doctor.specialization}</Badge> : null}
            {doctor.licenseNumber ? <Badge tone="neutral">License · {doctor.licenseNumber}</Badge> : null}
            {doctor.facility ? <Badge tone="teal">{doctor.facility.name}</Badge> : null}
            {doctor.user ? <Badge tone={doctor.user.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>{doctor.user.verificationStatus}</Badge> : null}
          </div>
          {doctor.bio && <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{doctor.bio}</p>}
          <p className="mt-3 text-[12px] text-ink-subtle">
            Role {roleLabel(doctor.user?.role ?? 'DOCTOR')} · {doctor.availability.length} weekly availability ranges
          </p>
        </div>
      </div>
    </Card>
  );
}