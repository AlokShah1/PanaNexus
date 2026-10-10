import { Blob, Badge, StatusDot } from '@/components/ui';
import HospitalsExplorer from '@/components/healthcare/HospitalsExplorer';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <main className="relative overflow-hidden">
      <Blob className="right-[-120px] top-[-60px] h-[320px] w-[320px] bg-brand-200/35" />

      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="brand">
            <StatusDot tone="brand" />
            Healthcare directory
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Find care near you</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Search PanaNexus hospitals, health posts, clinics and pharmacies — plus real facilities listed on
            OpenStreetMap. Turn on location to sort by distance, see them on a map and get directions.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <HospitalsExplorer />
      </div>
    </main>
  );
}
