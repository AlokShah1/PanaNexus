'use client';

import { useCallback, useState } from 'react';
import { useSession } from '@/lib/session';
import { roleLabel } from '@/lib/format';
import { Badge, StatusDot } from '@/components/ui';
import { IconAmbulance } from '@/components/icons';
import { Guest, PageSkeleton, VerificationBanner, WrongRole } from '@/components/ambulance/ui';
import { useFleet } from '@/components/ambulance/useFleet';
import FleetPanel from '@/components/ambulance/FleetPanel';
import DispatchBoard from '@/components/ambulance/DispatchBoard';
import ActiveTripPanel from '@/components/ambulance/ActiveTripPanel';

export default function AmbulancePage() {
  const { status, profile } = useSession();
  const authed = status === 'authed';
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  const { fleet, error } = useFleet(authed, refreshKey);
  const verified = authed && !!profile && profile.verificationStatus === 'VERIFIED';

  if (status === 'loading') return <PageSkeleton />;
  if (!authed || !profile) return <Guest next="/ambulance" />;
  if (profile.role !== 'AMBULANCE_OPERATOR') return <WrongRole />;

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
            <IconAmbulance size={15} className="text-brand-600" />
            Run your fleet, accept emergency requests and keep responders moving.
          </p>
        </div>
        <Badge tone={profile.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>{profile.verificationStatus}</Badge>
      </header>

      <VerificationBanner profile={profile} />

      <div className="mt-6 space-y-6">
        <ActiveTripPanel
          fleet={fleet ?? null}
          refreshKey={refreshKey}
          onChanged={reload}
          profile={profile}
        />
        {verified && (
          <DispatchBoard fleet={fleet ?? null} onAccepted={reload} profile={profile} />
        )}
        <FleetPanel
          fleet={fleet ?? null}
          fleetError={error}
          onReload={reload}
          profile={profile}
        />
      </div>
    </main>
  );
}