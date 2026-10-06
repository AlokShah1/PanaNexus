import OrganDonorForm from '@/components/OrganDonorForm';
import { Badge, Blob } from '@/components/ui';
import { IconShield, IconCheck } from '@/components/icons';

const POINTS = [
  {
    title: 'Registration',
    desc: 'Record which organs you are willing to donate, with explicit consent.',
  },
  {
    title: 'Verification',
    desc: 'Authorized staff confirm identity and consent before a pledge is treated as verified.',
  },
  {
    title: 'Authorized coordination',
    desc: 'Clinicians and authorized coordinators handle any follow-up. No automated allocation happens here.',
  },
];

export default function Page() {
  return (
    <main className="relative overflow-hidden">
      <Blob className="left-[-100px] top-[-80px] h-[320px] w-[320px] bg-brand-200/30" />
      <Blob className="right-[-120px] bottom-0 h-[280px] w-[280px] bg-teal-400/20" />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <Badge tone="teal">
              <IconShield size={13} />
              Donor registry
            </Badge>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Pledge organ donation</h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-muted">
              Organ donation is a deeply personal decision. PanaNexus records your pledge and consent so
              authorized coordinators can reach your family at the right time — nothing more.
            </p>

            <ul className="mt-8 space-y-3">
              {POINTS.map((p, i) => (
                <li key={p.title} className="flex gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-200/70">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-teal-500 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{p.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{p.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <OrganDonorForm />
            <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-success" />
                Your pledge is private. Only authorized coordinators can view or act on it, and every access is
                recorded in the audit log.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}