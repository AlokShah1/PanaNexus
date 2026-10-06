import { Blob, ButtonLink, SectionHeading, WaveDivider } from '@/components/ui';
import { IconAmbulance, IconClipboard, IconDroplet, IconHospital, IconShield, IconSpark } from '@/components/icons';

const PILLARS = [
  {
    title: 'One coordinated network',
    desc: 'Health posts, hospitals, doctors, ambulances and donors work from the same information instead of separate registers.',
    Icon: IconHospital,
    accent: 'from-brand-600 to-brand-800',
  },
  {
    title: 'Records that follow the patient',
    desc: 'Every consultation is recorded once and available to the people authorised to see it — with an audit trail.',
    Icon: IconClipboard,
    accent: 'from-teal-500 to-teal-600',
  },
  {
    title: 'Emergency without guesswork',
    desc: 'A geolocated request is matched to the nearest suitable ambulance and tracked until the trip ends.',
    Icon: IconAmbulance,
    accent: 'from-danger to-brand-600',
  },
  {
    title: 'Donor networks that work',
    desc: 'Blood availability and donor pledges are coordinated so requests reach people who can actually help.',
    Icon: IconDroplet,
    accent: 'from-brand-600 to-danger',
  },
  {
    title: 'Privacy by default',
    desc: 'Medical records and live location are never public. Access is role-based, server-enforced and logged.',
    Icon: IconShield,
    accent: 'from-brand-700 to-teal-600',
  },
  {
    title: 'Lightweight by design',
    desc: 'Server-rendered pages, small payloads and no heavy dependencies — built for slow mobile networks.',
    Icon: IconSpark,
    accent: 'from-teal-600 to-brand-600',
  },
];

export default function Page() {
  return (
    <main className="relative overflow-hidden">
      <Blob className="left-[-100px] top-[-60px] h-[320px] w-[320px] bg-brand-200/30" />

      <section className="bg-mesh">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="About PanaNexus"
            title="A single digital backbone for community healthcare"
            description="PanaNexus connects patients, doctors, hospitals, health posts, ambulance services and donors so that care does not depend on handwritten notes and phone calls."
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register">Get started</ButtonLink>
            <ButtonLink href="/services" variant="secondary">
              Explore services
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="bg-white">
        <WaveDivider />
      </div>

      <section className="bg-white pb-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <article key={p.title} className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${p.accent} text-white shadow-soft`}>
                  <p.Icon size={20} />
                </span>
                <h2 className="mt-4 text-[15px] font-bold text-ink">{p.title}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{p.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}