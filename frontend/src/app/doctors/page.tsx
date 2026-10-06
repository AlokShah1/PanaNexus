import { apiGet } from '@/lib/api';
import { Badge, Blob, StatusDot } from '@/components/ui';
import { IconRefresh, IconSearch, IconStethoscope } from '@/components/icons';

export const dynamic = 'force-dynamic';

type Doctor = {
  id: string;
  specialization: string | null;
  licenseNumber: string | null;
  name: string | null;
  facility: { id: string; name: string; type: string } | null;
};

const SPECIALTIES = ['All', 'General', 'Cardiology', 'Paediatrics', 'Orthopaedics', 'Dermatology', 'Gynaecology'];

function initials(name: string | null) {
  if (!name) return 'DR';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<{ q?: string; specialty?: string }> }) {
  const { q, specialty } = await searchParams;
  const res = await apiGet<Doctor[]>('/doctors');

  const term = (q ?? '').trim().toLowerCase();
  const doctors = (res.ok ? res.data : []).filter((d) => {
    const matchesTerm = term ? `${d.name ?? ''} ${d.specialization ?? ''} ${d.facility?.name ?? ''}`.toLowerCase().includes(term) : true;
    const matchesSpecialty =
      !specialty || specialty === 'All'
        ? true
        : (d.specialization ?? 'General').toLowerCase().includes(specialty.toLowerCase());
    return matchesTerm && matchesSpecialty;
  });

  return (
    <main className="relative overflow-hidden">
      <Blob className="left-[-120px] top-[-80px] h-[300px] w-[300px] bg-teal-400/25" />

      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="teal">
            <StatusDot tone="success" />
            Doctor directory
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Find the right doctor</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
            Search registered doctors by name, specialty or facility and book directly.
          </p>

          <form className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                name="q"
                defaultValue={q ?? ''}
                placeholder="Search by name, specialty or facility…"
                className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
            <button className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
              Search
            </button>
          </form>

          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {SPECIALTIES.map((s) => {
              const active = (specialty ?? 'All') === s;
              const params = new URLSearchParams();
              if (q) params.set('q', q);
              if (s !== 'All') params.set('specialty', s);
              const qs = params.toString();
              return (
                <a
                  key={s}
                  href={`/doctors${qs ? `?${qs}` : ''}`}
                  className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
                    active
                      ? 'bg-brand-600 text-white shadow-[0_10px_22px_-12px_rgba(31,69,245,0.9)]'
                      : 'bg-white text-ink-muted ring-1 ring-slate-200 hover:ring-brand-300 hover:text-brand-700'
                  }`}
                >
                  {s}
                </a>
              );
            })}
          </div>
        </div>
      </header>

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

        {res.ok && doctors.length === 0 && (
          <div className="rounded-3xl bg-white p-12 text-center shadow-soft ring-1 ring-slate-200/70">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconStethoscope size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-ink">No doctors match your search</p>
            <p className="mt-1 text-[13px] text-ink-muted">Try another name, specialty or facility.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <article
              key={d.id}
              className="group overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="flex items-start gap-4 p-5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-teal-500 text-base font-bold text-white shadow-soft">
                  {initials(d.name)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-bold text-ink">{d.name ?? 'Registered doctor'}</h2>
                  <p className="mt-0.5 text-[13px] font-medium text-brand-700">{d.specialization ?? 'General medicine'}</p>
                  <p className="mt-1 truncate text-[13px] text-ink-muted">{d.facility?.name ?? 'Facility not linked'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
                <span className="text-[12px] text-ink-subtle">Next available — book to check</span>
                <a
                  href={`/appointments?doctor=${d.id}`}
                  className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800"
                >
                  Book
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}