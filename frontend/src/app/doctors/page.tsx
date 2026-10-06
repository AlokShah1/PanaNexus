import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type DoctorRow = { id: string; specialization: string | null; user?: { name: string } | null; facility?: { name: string } | null };

export default async function Page() {
  const doctors = await apiGet<DoctorRow[]>('/doctors');
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Doctors</h1>
      {!doctors && <p className="text-sm text-amber-700">Backend not reachable. Check NEXT_PUBLIC_API_URL.</p>}
      {doctors && doctors.length === 0 && <p className="text-sm text-slate-600">No doctors registered yet.</p>}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(doctors ?? []).map((d) => (
          <li key={d.id} className="rounded-md bg-white p-4 ring-1 ring-slate-200">
            <p className="font-medium text-slate-900">{d.user?.name ?? 'Doctor'}</p>
            <p className="text-sm text-slate-600">{d.specialization ?? 'General'}</p>
            {d.facility && <p className="text-sm text-slate-500">Facility: {d.facility.name}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
