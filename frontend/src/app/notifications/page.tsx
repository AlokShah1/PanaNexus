import NotificationsPanel from '@/components/NotificationsPanel';
import { Badge, Blob } from '@/components/ui';
import { IconBell } from '@/components/icons';

export default function Page() {
  return (
    <main className="relative overflow-hidden">
      <Blob className="right-[-120px] top-[-80px] h-[300px] w-[300px] bg-brand-200/30" />

      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="brand">
            <IconBell size={13} />
            Notifications
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Your updates</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Appointment confirmations, emergency status changes and blood-request updates appear here.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <NotificationsPanel />
      </div>
    </main>
  );
}