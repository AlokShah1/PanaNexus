import { apiGet } from '@/lib/api';
import { Badge, Blob, StatusDot } from '@/components/ui';
import { IconClock, IconHospital, IconPhone, IconPin, IconRefresh, IconSearch } from '@/components/icons';

export const dynamic = 'force-dynamic';

type Facility = {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string | null;
  operatingHours: string | null;
};

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Hospitals', value: 'HOSPITAL' },
  { label: 'Health Posts', value: 'HEALTH_POST' },
];

export default async function HospitalsPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const { type, q } = await searchParams;
  const query = type ? `/facilities?type=${encodeURIComponent(type)}` : '/facilities';
  const res = await apiGet<Facility[]>(query);

  const term = (q ?? '').trim().toLowerCase();
  const facilities = (res.ok ? res.data : []).filter((f) =>
    term ? `${f.name} ${f.address}`.toLowerCase().includes(term) : true,
  );

  return (
    <main className="relative overflow-hidden">
      <Blob className="right-[-120px] top-[-60px] h-[320px] w-[320px] bg-brand-200/35" />

      {/* --------------------------------------------------------- header */}
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="brand">
            <StatusDot tone="brand" />
            Healthcare directory
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Find healthcare near you</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Hospitals and health posts connected to PanaNexus. Open hours and contact details come straight from
            the facility record.
          </p>

          {/* search + filters */}
          <form className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <IconSearch size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                name="q"
                defaultValue={q ?? ''}
                placeholder="Search hospitals, health posts, services…"
                className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
            <button
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
            >
              Search
            </button>
          </form>

          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => {
              const active = (type ?? '') === f.value;
              const href = f.value ? `/hospitals?type=${f.value}${term ? `&q=${encodeURIComponent(term)}` : ''}` : `/hospitals${term ? `?q=${encodeURIComponent(term)}` : ''}`;
              return (
                <a
                  key={f.label}
                  href={href}
                  className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
                    active
                      ? 'bg-brand-600 text-white shadow-[0_10px_22px_-12px_rgba(31,69,245,0.9)]'
                      : 'bg-white text-ink-muted ring-1 ring-slate-200 hover:ring-brand-300 hover:text-brand-700'
                  }`}
                >
                  {f.label}
                </a>
              );
            })}
            <span className="shrink-0 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink-subtle ring-1 ring-slate-200">
              Emergency services
            </span>
            <span className="shrink-0 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink-subtle ring-1 ring-slate-200">
              Open now
            </span>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- results */}
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {!res.ok && (
          <div className="rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200/70">
            <p className="text-sm font-medium text-ink-muted">{res.message}</p>
            <a
              href=""
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <IconRefresh size={16} /> Try again
            </a>
          </div>
        )}

        {res.ok && facilities.length === 0 && (
          <div className="rounded-3xl bg-white p-12 text-center shadow-soft ring-1 ring-slate-200/70">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconHospital size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-ink">No facilities found{term ? ` for “${q}”` : ' yet'}</p>
            <p className="mt-1 text-[13px] text-ink-muted">Try a different search or clear the filter.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f) => (
            <article
              key={f.id}
              className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative h-24 bg-gradient-to-br from-brand-600 to-brand-800">
                <div aria-hidden className="absolute inset-0 bg-grid opacity-30" />
                <span className="absolute left-5 top-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/95 text-brand-700 shadow-soft">
                  <IconHospital size={22} />
                </span>
                <span className="absolute right-4 top-5">
                  <Badge tone={f.type === 'HOSPITAL' ? 'brand' : 'teal'}>
                    {f.type === 'HOSPITAL' ? 'Hospital' : 'Health post'}
                  </Badge>
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-[15px] font-bold text-ink">{f.name}</h2>
                <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-ink-muted">
                  <IconPin size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
                  {f.address}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {f.operatingHours ? (
                    <Badge tone="neutral">
                      <IconClock size={12} />
                      {f.operatingHours}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Hours not listed</Badge>
                  )}
                  <Badge tone="neutral">Distance —</Badge>
                </div>

                <div className="mt-4 flex items-center gap-2 pt-1">
                  {f.phone ? (
                    <a
                      href={`tel:${f.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-2 text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                    >
                      <IconPhone size={15} /> Call
                    </a>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3.5 py-2 text-[13px] font-semibold text-ink-subtle">
                      No phone listed
                    </span>
                  )}
                  <a
                    href="/appointments"
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800"
                  >
                    Book appointment
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}