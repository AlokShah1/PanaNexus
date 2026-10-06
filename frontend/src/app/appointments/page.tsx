import Link from 'next/link';
import BookAppointmentForm from '@/components/BookAppointmentForm';
import { Badge, Blob } from '@/components/ui';
import { IconCalendar, IconCheck, IconClock } from '@/components/icons';

export default async function Page({ searchParams }: { searchParams: Promise<{ doctor?: string }> }) {
  const { doctor } = await searchParams;

  return (
    <main className="relative overflow-hidden">
      <Blob className="left-[-120px] top-[-60px] h-[300px] w-[300px] bg-brand-200/30" />

      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="brand">
            <IconCalendar size={13} />
            Appointments
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Book a visit in three steps</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Choose a doctor, pick a slot and confirm. Double-booking is prevented on the server, so the time you
            see is the time you get.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <BookAppointmentForm preselectDoctor={doctor} />

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
              <h2 className="text-sm font-bold text-ink">What happens next</h2>
              <ul className="mt-3 space-y-3 text-[13px] text-ink-muted">
                <li className="flex gap-2">
                  <IconCheck size={15} className="mt-0.5 shrink-0 text-success" />
                  The slot is reserved immediately so nobody else can take it.
                </li>
                <li className="flex gap-2">
                  <IconClock size={15} className="mt-0.5 shrink-0 text-brand-600" />
                  You can cancel or reschedule from your dashboard.
                </li>
                <li className="flex gap-2">
                  <IconCalendar size={15} className="mt-0.5 shrink-0 text-teal-600" />
                  The facility and doctor see the booking in their own dashboards.
                </li>
              </ul>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-lift">
              <h2 className="text-sm font-bold">Need care urgently?</h2>
              <p className="mt-1.5 text-[13px] text-brand-50">Appointments are not for emergencies.</p>
              <Link
                href="/emergency"
                className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-[13px] font-bold text-brand-700 transition-transform hover:scale-[1.02]"
              >
                Request an ambulance
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}