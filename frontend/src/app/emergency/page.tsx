import EmergencyRequestForm from '@/components/EmergencyRequestForm';
import { Badge } from '@/components/ui';
import { IconAlert } from '@/components/icons';

export default function Page() {
  return (
    <main className="relative overflow-hidden bg-mesh">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="danger">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
            </span>
            Emergency assistance
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <IconAlert size={15} className="text-danger" />
            Stay with the patient and keep the phone reachable
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Request an ambulance
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          Share your location, tell us what is happening, and we will match the nearest suitable ambulance and
          track the trip.
        </p>

        <div className="mt-8">
          <EmergencyRequestForm />
        </div>
      </div>
    </main>
  );
}