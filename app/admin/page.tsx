import { redirect } from 'next/navigation';
import { getSession } from '@/backend/lib/auth';
import { getAnalytics } from '@/backend/lib/analytics';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  let stats: Awaited<ReturnType<typeof getAnalytics>> | null = null;
  try {
    stats = await getAnalytics();
  } catch {
    stats = null;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Admin Analytics</h1>
      {!stats && <p className="text-sm text-amber-700">Database not configured. Set DATABASE_URL and run `npx prisma db init`.</p>}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card label="Users" value={stats.users.total} />
          <Card label="Patients" value={stats.patients} />
          <Card label="Doctors" value={stats.doctors} />
          <Card label="Facilities" value={stats.facilities} />
          <Card label="Appointments" value={stats.appointments.total} />
          <Card label="Active emergencies" value={stats.emergency.active} />
          <Card label="Available ambulances" value={stats.ambulances.available} />
          <Card label="Blood units" value={stats.blood.totalUnits} />
          <Card label="Pending blood requests" value={stats.blood.pendingRequests} />
          <Card label="Available donors" value={stats.blood.availableDonors} />
          <Card label="Feedback avg rating" value={stats.feedback.averageRating != null ? stats.feedback.averageRating!.toFixed(1) : '—'} />
          <Card label="Audit logs" value={stats.auditLogs} />
        </div>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white p-4 ring-1 ring-slate-200">
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}
