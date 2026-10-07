'use client';

import { useCallback } from 'react';
import { useSession } from '@/lib/session';
import { roleLabel } from '@/lib/format';
import { Badge, StatusDot } from '@/components/ui';
import { IconHospital } from '@/components/icons';
import { Guest, PageSkeleton, VerificationBanner, WrongRole } from '@/components/facility/ui';
import FacilityProfile from '@/components/facility/FacilityProfile';
import AppointmentsPanel from '@/components/facility/AppointmentsPanel';
import BloodUnitsPanel from '@/components/facility/BloodUnitsPanel';
import BloodRequestsPanel from '@/components/facility/BloodRequestsPanel';

export default function FacilityPage() {
  const { status, profile, refresh } = useSession();

  const handleCreated = useCallback(async () => {
    await refresh();
  }, [refresh]);

  if (status === 'loading') return <PageSkeleton />;
  if (status !== 'authed' || !profile) return <Guest next="/facility" />;
  if (profile.role !== 'FACILITY_STAFF') return <WrongRole />;

  const linked = !!profile.facilityId;

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
            <IconHospital size={15} className="text-brand-600" />
            Run your facility directory profile, appointments and blood bank.
          </p>
        </div>
        <Badge tone={profile.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>{profile.verificationStatus}</Badge>
      </header>

      <VerificationBanner profile={profile} />

      <div className="mt-6 space-y-6">
        <FacilityProfile profile={profile} onCreated={handleCreated} />
        {linked && <AppointmentsPanel />}
        {linked && <BloodUnitsPanel profile={profile} />}
        {linked && <BloodRequestsPanel profile={profile} />}
      </div>
    </main>
  );
}