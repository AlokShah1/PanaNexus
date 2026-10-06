import { db } from '@/backend/prisma/db';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let rows: { id: string; name: string; address: string; operatingHours: string | null }[] = [];
  let error = false;
  try {
    const all = await db.orm.public.HealthcareFacility.all();
    rows = all.filter((f) => f.type === 'HEALTH_POST');
  } catch {
    error = true;
  }
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Health Posts</h1>
      {error && <p className="text-sm text-amber-700">Database not configured.</p>}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((f) => (
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
