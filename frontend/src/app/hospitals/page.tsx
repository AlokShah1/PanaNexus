import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type FacilityRow = { id: string; name: string; type: string; address: string; phone: string | null; operatingHours: string | null };

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const query = type ? `/facilities?type=${encodeURIComponent(type)}` : '/facilities';
  const res = await apiGet<FacilityRow[]>(query);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{type === 'HEALTH_POST' ? 'Health Posts' : 'Hospitals & Facilities'}</h1>
      <div className="flex gap-3 text-sm">
        <a href="/hospitals" className="rounded-md px-3 py-1 ring-1 ring-slate-200">All</a>
        <a href="/hospitals?type=HOSPITAL" className="rounded-md px-3 py-1 ring-1 ring-slate-200">Hospitals</a>
        <a href="/hospitals?type=HEALTH_POST" className="rounded-md px-3 py-1 ring-1 ring-slate-200">Health Posts</a>
      </div>
      {!res.ok && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p>{res.message}</p>
          <a href="" className="mt-2 inline-block font-medium underline">Try again</a>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(res.ok ? res.data : []).map((f) => (
          <li key={f.id} className="rounded-md bg-white p-4 ring-1 ring-slate-200">
            <p className="font-medium text-slate-900">{f.name}</p>
            <p className="text-sm text-slate-600">{f.type === 'HOSPITAL' ? 'Hospital' : 'Health Post'} · {f.address}</p>
            {f.operatingHours && <p className="text-sm text-slate-500">Hours: {f.operatingHours}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
