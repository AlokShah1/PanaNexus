import BloodSearch from '@/components/BloodSearch';
import BloodDonorForm from '@/components/BloodDonorForm';
import { Badge, Blob } from '@/components/ui';
import { IconShield } from '@/components/icons';

export default function Page() {
  return (
    <main className="relative overflow-hidden">
      <Blob className="right-[-140px] top-[-80px] h-[320px] w-[320px] bg-danger/15" />

      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="danger">
            <IconShield size={13} />
            Blood network
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Find blood, or become a donor</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Check what facilities currently report, and register yourself so nearby facilities can reach you when
            a donation is needed.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <BloodSearch />
        <div className="grid gap-6 lg:grid-cols-2">
          <BloodDonorForm />
          <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lift">
            <h2 className="text-lg font-bold">How blood requests work</h2>
            <ol className="mt-4 space-y-3 text-sm text-brand-50">
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">1</span>
                A facility posts a request for a blood group and quantity.
              </li>
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">2</span>
                PanaNexus surfaces compatible donor candidates by group and availability.
              </li>
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">3</span>
                Facility staff contact donors and coordinate the donation directly.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}