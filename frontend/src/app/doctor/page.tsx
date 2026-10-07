'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { roleLabel } from '@/lib/format';
import { apiGet } from '@/lib/api';
import { Badge, StatusDot } from '@/components/ui';
import { IconStethoscope } from '@/components/icons';
import { Guest, PageSkeleton, VerificationBanner, WrongRole, type ApiError } from '@/components/doctor/ui';
import ProfileCard, { type DoctorMe, type DoctorState } from '@/components/doctor/ProfileCard';
import AvailabilityEditor from '@/components/doctor/AvailabilityEditor';
import AppointmentsPanel from '@/components/doctor/AppointmentsPanel';

export default function DoctorPage() {
  const { status, profile } = useSession();
  const [doctor, setDoctor] = useState<DoctorState>({ phase: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const load = useCallback(async () => {
    const res = await apiGet<DoctorMe>('/doctors/me');
    if (!res.ok) {
      if (res.code === 'DOCTOR_NOT_FOUND') {
        setDoctor({ phase: 'missing' });
        return;
      }
      setDoctor({ phase: 'error', error: res as ApiError });
      return;
    }
    setDoctor({ phase: 'ready', doctor: res.data });
  }, []);

  useEffect(() => {
    if (status !== 'authed') return;
    void (async () => {
      await load();
    })();
  }, [status, reloadKey, load]);

  if (status === 'loading') return <PageSkeleton />;
  if (status !== 'authed' || !profile) return <Guest next="/doctor" />;
  if (profile.role !== 'DOCTOR') return <WrongRole />;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="brand">
            <StatusDot tone="brand" />
            {roleLabel(profile.role)} workspace
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Welcome back, {profile.name.split(' ')[0]}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-muted">
            <IconStethoscope size={15} className="text-brand-600" />
            Manage your profile, consultation hours and patient requests.
          </p>
        </div>
        <Badge tone={profile.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>{profile.verificationStatus}</Badge>
      </header>

      <VerificationBanner profile={profile} />

      <div className="mt-6 space-y-6">
        <ProfileCard state={doctor} profile={profile} onReload={reload} />
        {doctor.phase === 'ready' && <AvailabilityEditor doctorId={doctor.doctor.id} profile={profile} />}
        <AppointmentsPanel />
      </div>
    </main>
  );
}