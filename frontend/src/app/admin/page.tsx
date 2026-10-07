'use client';

import { useState } from 'react';
import { useSession } from '@/lib/session';
import { roleLabel } from '@/lib/format';
import { Badge, StatusDot } from '@/components/ui';
import { IconBolt, IconChart, IconClipboard, IconShield, IconSpark, IconStar, IconUsers } from '@/components/icons';
import { Guest, PageSkeleton, WrongRole } from '@/components/admin/ui';
import VerificationQueue from '@/components/admin/VerificationQueue';
import UsersPanel from '@/components/admin/UsersPanel';
import FeedbackPanel from '@/components/admin/FeedbackPanel';
import AuditPanel from '@/components/admin/AuditPanel';
import SettingsPanel from '@/components/admin/SettingsPanel';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel';
import DemoPanel from '@/components/admin/DemoPanel';

const TABS = [
  { id: 'verifications', label: 'Verifications', Icon: IconShield },
  { id: 'users', label: 'Users', Icon: IconUsers },
  { id: 'feedback', label: 'Feedback', Icon: IconStar },
  { id: 'audit', label: 'Audit log', Icon: IconClipboard },
  { id: 'settings', label: 'Settings', Icon: IconBolt },
  { id: 'analytics', label: 'Analytics', Icon: IconChart },
  { id: 'demo', label: 'Demo', Icon: IconSpark },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const { status, profile } = useSession();
  const [tab, setTab] = useState<TabId>('verifications');

  if (status === 'loading') return <PageSkeleton />;
  if (status !== 'authed' || !profile) return <Guest next="/admin" />;
  if (profile.role !== 'ADMIN') return <WrongRole />;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="brand">
            <StatusDot tone="brand" />
            {roleLabel(profile.role)} console
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Platform administration</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Signed in as {profile.name} · {profile.email}
          </p>
        </div>
        <Badge tone="neutral">{profile.verificationStatus}</Badge>
      </header>

      <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-all ${
              tab === t.id
                ? 'bg-ink text-white shadow-[0_10px_26px_-14px_rgba(10,26,51,0.9)]'
                : 'bg-white text-ink-muted ring-1 ring-slate-200 hover:text-brand-700 hover:ring-brand-300'
            }`}
          >
            <t.Icon size={15} />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'verifications' && <VerificationQueue />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'feedback' && <FeedbackPanel />}
        {tab === 'audit' && <AuditPanel />}
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'analytics' && <AnalyticsPanel />}
        {tab === 'demo' && <DemoPanel />}
      </div>
    </main>
  );
}
