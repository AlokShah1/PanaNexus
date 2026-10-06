import { apiGet } from '@/lib/api';
import { Badge, Blob, StatusDot } from '@/components/ui';
import { IconHospital, IconPin, IconRefresh } from '@/components/icons';

export const dynamic = 'force-dynamic';

type Facility = { id: string; name: string; type: string; address: string; operatingHours: string | null };

export default async function Page() {
  const res = await apiGet<Facility[]>('/facilities?type=HEALTH_POST');
  const rows = res.ok ? res.data : [];

  return (
    <main className="relative overflow-hidden">
      <Blob className="right-[-120px] top-[-60px] h-[300px] w-[300px] bg-teal-400/25" />

      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="teal">
            <StatusDot tone="success" />
            Primary care network
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Health posts</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Local health posts connected to PanaNexus, with their operating hours and contact details.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {!res.ok && (
          <div className="rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
            <p className="text-sm font-medium text-ink-muted">{res.message}</p>
            <a href="" className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
              <IconRefresh size={16} /> Try again
            </a>
          </div>
        )}

        {res.ok && rows.length === 0 && (
          <div className="rounded-3xl bg-white p-12 text-center shadow-soft ring-1 ring-slate-200/70">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconHospital size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-ink">No health posts listed yet</p>
            <p className="mt-1 text-[13px] text-ink-muted">Facilities appear here once they are registered.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((f) => (
            <article
              key={f.id}
              className="group rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-brand-600 text-white shadow-soft">
                <IconHospital size={22} />
              </span>
              <h2 className="mt-4 text-[15px] font-bold text-ink">{f.name}</h2>
              <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-ink-muted">
                <IconPin size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
                {f.address}
              </p>
              {f.operatingHours && <p className="mt-2 text-[12px] text-ink-subtle">{f.operatingHours}</p>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}