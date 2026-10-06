import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/backend/lib/auth';
import SignOutButton from '@/frontend/components/SignOutButton';

const sections = [
  { label: 'Appointments', href: '/appointments' },
  { label: 'Medical Records', href: '#' },
  { label: 'Doctors', href: '/doctors' },
  { label: 'Facilities', href: '/hospitals' },
  { label: 'Emergency', href: '/emergency' },
  { label: 'Blood', href: '/blood' },
  { label: 'Donor Services', href: '/organ-donation' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Profile', href: '#' },
];

export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <SignOutButton />
      </header>
      <p className="text-sm text-slate-600">
        Signed in as <span className="font-medium text-slate-900">{session.role.replace(/_/g, ' ')}</span>
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="block rounded-md bg-white p-4 text-sm font-medium text-slate-800 ring-1 ring-slate-200">
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
