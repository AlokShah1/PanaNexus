'use client';

import { useEffect, useState, type ReactNode } from 'react';
import VerificationPanel from '@/components/VerificationPanel';
import { apiGet } from '@/lib/api';
import { isProRole, useSession } from '@/lib/session';
import { Badge, Blob } from '@/components/ui';
import { IconShield } from '@/components/icons';
import {
  GuestCard,
  NonProCard,
  PanelSkeleton,
  SuspendedCard,
} from '@/components/verification/Cards';

export default function Page() {
  const { status, profile } = useSession();
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<unknown>('/verifications/me').then((res) => {
      if (active && !res.ok && res.code === 'ACCOUNT_SUSPENDED') setSuspended(true);
    });
    return () => {
      active = false;
    };
  }, []);

  let content: ReactNode;
  if (suspended) {
    content = <SuspendedCard />;
  } else if (status === 'loading') {
    content = <PanelSkeleton />;
  } else if (status !== 'authed' || !profile) {
    content = <GuestCard />;
  } else if (!isProRole(profile.role)) {
    content = <NonProCard />;
  } else {
    content = <VerificationPanel />;
  }

  return (
    <main className="relative overflow-hidden">
      <Blob className="right-[-120px] top-[-80px] h-[300px] w-[300px] bg-brand-200/30" />

      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="brand">
            <IconShield size={13} />
            Verification
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Professional verification
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Doctors, healthcare facilities and ambulance providers are reviewed by our team before
            professional features unlock. Track your status, respond to feedback and upload
            credentials here.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">{content}</div>
    </main>
  );
}
