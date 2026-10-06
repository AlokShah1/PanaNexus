import EcosystemArt from '@/components/EcosystemArt';
import {
  Badge,
  Blob,
  ButtonLink,
  CrossMark,
  Divider,
  LinkArrow,
  SectionHeading,
  StatusDot,
} from '@/components/ui';
import {
  IconAmbulance,
  IconArrow,
  IconBolt,
  IconCalendar,
  IconClipboard,
  IconDroplet,
  IconHospital,
  IconPin,
  IconShield,
  IconSpark,
  IconStethoscope,
  IconUsers,
} from '@/components/icons';

const QUICK = [
  {
    href: '/emergency',
    label: 'Emergency',
    desc: 'Request an ambulance and track the trip live.',
    Icon: IconAmbulance,
    tone: 'danger' as const,
    ring: 'from-danger/12 to-danger/0',
    iconRing: 'bg-danger text-white',
    dot: 'danger' as const,
  },
  {
    href: '/doctors',
    label: 'Doctors',
    desc: 'Find the right specialist and book a visit.',
    Icon: IconStethoscope,
    tone: 'brand' as const,
    ring: 'from-brand-100/70 to-brand-50/0',
    iconRing: 'bg-brand-600 text-white',
    dot: 'brand' as const,
  },
  {
    href: '/hospitals',
    label: 'Healthcare',
    desc: 'Locate hospitals and health posts near you.',
    Icon: IconHospital,
    tone: 'teal' as const,
    ring: 'from-teal-500/14 to-teal-500/0',
    iconRing: 'bg-teal-500 text-white',
    dot: 'success' as const,
  },
  {
    href: '/blood',
    label: 'Blood & Donors',
    desc: 'Check availability and register as a donor.',
    Icon: IconDroplet,
    tone: 'warning' as const,
    ring: 'from-danger/10 to-brand-50/0',
    iconRing: 'bg-gradient-to-br from-danger to-brand-600 text-white',
    dot: 'warning' as const,
  },
];

const FEATURES = [
  {
    title: 'Digital medical records',
    desc: 'Authorized, auditable health history that travels with the patient — no paper files.',
    Icon: IconClipboard,
    accent: 'from-brand-500 to-brand-700',
  },
  {
    title: 'Appointments without queues',
    desc: 'See availability, book a slot and get reminders. Double-booking prevented server-side.',
    Icon: IconCalendar,
    accent: 'from-teal-500 to-teal-600',
  },
  {
    title: 'Emergency response',
    desc: 'Geolocated request, deterministic ambulance matching and dispatch with live trip status.',
    Icon: IconAmbulance,
    accent: 'from-danger to-brand-600',
  },
  {
    title: 'Blood network',
    desc: 'Live unit availability by blood group with compatible donor coordination.',
    Icon: IconDroplet,
    accent: 'from-brand-600 to-danger',
  },
  {
    title: 'Donor registry',
    desc: 'Blood and organ donor pledges recorded with consent and verification status.',
    Icon: IconShield,
    accent: 'from-teal-600 to-brand-600',
  },
  {
    title: 'Connected facilities',
    desc: 'Hospitals and health posts share availability so referrals and transfers are faster.',
    Icon: IconUsers,
    accent: 'from-brand-700 to-brand-500',
  },
];

const FLOW = [
  { label: 'Patient', sub: 'Request or search', Icon: IconUsers },
  { label: 'PanaNexus', sub: 'Coordinates securely', Icon: IconSpark, core: true },
  { label: 'Care network', sub: 'Doctors · Facilities · Ambulance · Blood', Icon: IconHospital },
];

export default function Home() {
  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden bg-mesh">
        <Blob className="left-[-120px] top-[-80px] h-[380px] w-[380px] bg-brand-300/35" />
        <Blob className="right-[-100px] top-[120px] h-[320px] w-[320px] bg-teal-400/25" />
        <CrossMark className="-right-10 top-24 h-40 w-40 text-brand-200/40" />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="animate-fade-up">
            <Badge tone="brand">
              <StatusDot tone="brand" />
              Connected healthcare for health posts and hospitals
            </Badge>

            <h1 className="mt-5 text-[2.1rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Healthcare, connected <span className="text-gradient">around you.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-muted sm:text-base">
              One lightweight platform joining patients, doctors, hospitals, health posts, ambulances and
              donors — so records, appointments and emergencies move without paperwork.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/emergency" variant="emergency" className="px-6 py-3 text-[15px]">
                <IconAmbulance size={18} />
                Emergency Help
              </ButtonLink>
              <ButtonLink href="/hospitals" variant="primary" className="px-6 py-3 text-[15px]">
                <IconHospital size={18} />
                Find Healthcare
              </ButtonLink>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-2">
                <IconShield size={16} className="text-success" />
                Authorized access only
              </span>
              <span className="inline-flex items-center gap-2">
                <IconBolt size={16} className="text-brand-600" />
                Built for slow networks
              </span>
              <span className="inline-flex items-center gap-2">
                <IconPin size={16} className="text-teal-600" />
                Location-aware, never IP-based
              </span>
            </div>
          </div>

          <div className="animate-fade-up-delay lg:pl-4">
            <EcosystemArt />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- quick actions */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map((q, i) => (
            <a
              key={q.href}
              href={q.href}
              className={`group animate-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br ${q.ring} p-5 shadow-soft ring-1 ring-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lift`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl shadow-soft ${q.iconRing}`}>
                  <q.Icon size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-ink">{q.label}</h3>
                    <StatusDot tone={q.dot} />
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{q.desc}</p>
                </div>
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Open <IconArrow size={14} />
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- flow */}
      <section className="relative overflow-hidden bg-white py-16">
        <Blob className="right-[-140px] top-10 h-[340px] w-[340px] bg-brand-200/30" />
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SectionHeading
            align="center"
            eyebrow="How it works"
            title="One request, an entire care network behind it"
            description="PanaNexus sits between people who need care and the people who provide it, so every handoff is tracked and nothing is lost on paper."
          />

          <div className="mt-12 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {FLOW.map((step, i) => (
              <div key={step.label} className="contents">
                <div
                  className={`animate-fade-up rounded-3xl p-6 text-center shadow-soft ring-1 transition-all duration-300 hover:-translate-y-1 ${
                    step.core
                      ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white ring-brand-700'
                      : 'bg-white ring-slate-200'
                  }`}
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <span
                    className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${
                      step.core ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-700'
                    }`}
                  >
                    <step.Icon size={22} />
                  </span>
                  <p className={`mt-3 text-[15px] font-bold ${step.core ? 'text-white' : 'text-ink'}`}>{step.label}</p>
                  <p className={`mt-1 text-[13px] ${step.core ? 'text-brand-100' : 'text-ink-muted'}`}>{step.sub}</p>
                </div>
                {i < FLOW.length - 1 && (
                  <div className="hidden md:block" aria-hidden>
                    <svg width="64" height="20" viewBox="0 0 64 20" className="animate-blink">
                      <path
                        d="M2 10h48m0 0-8-6m8 6-8 6"
                        fill="none"
                        stroke="#8eb4ff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Capabilities"
          title="Built around how healthcare actually works"
          description="Every module is designed for a real task — finding a doctor, booking a visit, coordinating an emergency, or matching blood."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className="group animate-fade-up relative overflow-hidden rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                aria-hidden
                className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${f.accent} opacity-[0.08] transition-transform duration-500 group-hover:scale-150`}
              />
              <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${f.accent} text-white shadow-soft`}>
                <f.Icon size={20} />
              </span>
              <h3 className="mt-4 text-[15px] font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- nearby */}
      <section className="bg-white py-16">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <SectionHeading
              eyebrow="Nearby"
              title="Healthcare near you"
              description="Share your location once and we surface the hospitals, health posts and services closest to you — no location, no guesswork."
            />
            <div className="mt-6">
              <LinkArrow href="/hospitals">Explore the healthcare directory</LinkArrow>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 to-white p-6 shadow-soft ring-1 ring-slate-200/70">
              <div aria-hidden className="absolute inset-0 bg-dots-fine opacity-40" />
              <svg aria-hidden viewBox="0 0 320 200" className="relative h-44 w-full">
                <g stroke="#bcd2ff" strokeWidth="1">
                  <path d="M0 60h320M0 120h320M60 0v200M140 0v200M220 0v200" />
                </g>
                <path d="M20 170 C 90 150, 120 70, 200 60 S 290 40, 310 30" stroke="#8eb4ff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="7 8" className="animate-dash" />
                {[
                  { x: 60, y: 140 },
                  { x: 130, y: 96 },
                  { x: 200, y: 60 },
                  { x: 258, y: 44 },
                ].map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="14" fill="#3366ff" opacity="0.10" />
                    <circle cx={p.x} cy={p.y} r="6" fill="#1f45f5" />
                    <circle cx={p.x} cy={p.y} r="2.4" fill="#fff" />
                  </g>
                ))}
                <g>
                  <circle cx="238" cy="120" r="9" fill="#e11d48" opacity="0.14" className="animate-pulse-ring" />
                  <circle cx="238" cy="120" r="5" fill="#e11d48" />
                </g>
              </svg>
              <div className="relative mt-4 flex flex-wrap gap-2">
                <Badge tone="brand">Hospitals</Badge>
                <Badge tone="teal">Health posts</Badge>
                <Badge tone="danger">Emergency</Badge>
                <Badge tone="neutral">Open now</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- emergency */}
      <section className="relative overflow-hidden py-16">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-danger-soft via-white to-white" />
        <Blob className="left-[8%] top-6 h-[300px] w-[300px] bg-danger/15" />
        <div className="relative mx-auto w-full max-w-4xl px-4 text-center sm:px-6">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-danger text-white shadow-[0_18px_40px_-16px_rgba(225,29,72,0.8)]">
            <IconAmbulance size={30} />
          </span>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink sm:text-4xl">Need help right now?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Tell us where you are and what is happening. We match the nearest suitable ambulance, then track the
            trip until it is complete.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href="/emergency" variant="emergency" className="px-7 py-3.5 text-base">
              <IconAmbulance size={20} />
              Request an Ambulance
            </ButtonLink>
            <ButtonLink href="/organ-donation" variant="secondary" className="px-6 py-3.5">
              Register as a donor
            </ButtonLink>
          </div>
          <Divider className="mx-auto mt-10 max-w-lg" />
          <p className="mt-6 text-xs text-ink-subtle">
            PanaNexus coordinates transport and information. Emergency call services remain the first response for
            life-threatening situations.
          </p>
        </div>
      </section>
    </>
  );
}