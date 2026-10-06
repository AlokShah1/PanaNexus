import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type FacilityRow = { id: string; name: string; type: string; address: string; operatingHours: string | null };

export default async function Page() {
  const res = await apiGet<FacilityRow[]>('/facilities?type=HEALTH_POST');
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Health Posts</h1>
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
            <p className="text-sm text-slate-600">{f.address}</p>
            {f.operatingHours && <p className="text-sm text-slate-500">Hours: {f.operatingHours}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
