'use client';

import { useSession } from '@/lib/session';
import { Badge } from '@/components/ui';
import { IconChat } from '@/components/icons';
import { Guest, PageSkeleton, WrongRole } from '@/components/facility/ui';
import Inbox from '@/components/messages/Inbox';

export default function MessagesPage() {
  const { status, profile } = useSession();

  if (status === 'loading') return <PageSkeleton />;
  if (status !== 'authed' || !profile) return <Guest next="/messages" />;
  if (profile.role !== 'PATIENT' && profile.role !== 'DOCTOR') return <WrongRole />;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="brand">
            <IconChat size={13} />
            Secure messages
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Inbox</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Private, participant-only conversations between you and your {profile.role === 'PATIENT' ? 'doctor' : 'patient'}.
          </p>
        </div>
        <Badge tone={profile.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>{profile.verificationStatus}</Badge>
      </header>
      <Inbox role={profile.role} />
    </main>
  );
}
