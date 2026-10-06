import { Badge, Blob, SectionHeading } from '@/components/ui';
import { ButtonLink } from '@/components/ui';
import {
  IconAmbulance,
  IconCalendar,
  IconClipboard,
  IconDroplet,
  IconHospital,
  IconShield,
  IconStethoscope,
} from '@/components/icons';

const SERVICES = [
  {
    title: 'Medical records',
    desc: 'Consultations, diagnoses, treatment plans and prescriptions in one authorised history.',
    href: '/register',
    Icon: IconClipboard,
    accent: 'from-brand-600 to-brand-800',
  },
  {
    title: 'Doctor discovery',
    desc: 'Search registered doctors by name, specialty or facility and see who is available.',
    href: '/doctors',
    Icon: IconStethoscope,
    accent: 'from-teal-500 to-teal-600',
  },
  {
    title: 'Appointments',
    desc: 'Pick a doctor, choose a slot and confirm — with server-side double-booking protection.',
    href: '/appointments',
    Icon: IconCalendar,
    accent: 'from-brand-500 to-teal-500',
  },
  {
    title: 'Emergency response',
    desc: 'Geolocated ambulance requests matched to the nearest suitable vehicle, with live trip status.',
    href: '/emergency',
    Icon: IconAmbulance,
    accent: 'from-danger to-brand-600',
  },
  {
    title: 'Hospitals & health posts',
    desc: 'A directory of connected facilities with opening hours and contact details.',
    href: '/hospitals',
    Icon: IconHospital,
    accent: 'from-brand-700 to-brand-500',
  },
  {
    title: 'Blood & donors',
    desc: 'Check reported availability by blood group and register as a blood or organ donor.',
    href: '/blood',
    Icon: IconDroplet,
    accent: 'from-brand-600 to-danger',
  },
];

export default function Page() {
  return (
    <main className="relative overflow-hidden">
      <Blob className="right-[-120px] top-[-80px] h-[320px] w-[320px] bg-teal-400/25" />

      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <Badge tone="teal">Platform services</Badge>
          <SectionHeading
            title="Everything connected to your care"
            description="Each service is built around a specific task you are trying to complete, not around a database table."
          />
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <a
              key={s.title}
              href={s.href}
              className="group rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${s.accent} text-white shadow-soft`}>
                <s.Icon size={20} />
              </span>
              <h2 className="mt-4 text-[15px] font-bold text-ink">{s.title}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{s.desc}</p>
              <span className="mt-4 inline-block text-[13px] font-semibold text-brand-700">Open →</span>
            </a>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-7 text-white shadow-lift">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <IconShield size={20} />
              Built for privacy from day one
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-brand-50">
              Role-based access, audited record access and encrypted sessions. Clinical decisions always stay with
              licensed professionals.
            </p>
          </div>
          <ButtonLink href="/register" variant="secondary">
            Create an account
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}