import Link from 'next/link';
import BookAppointmentForm from '@/frontend/components/BookAppointmentForm';

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
      <BookAppointmentForm />
      <p className="text-sm text-slate-600">
        View your appointments on the <Link href="/dashboard" className="font-medium text-slate-900 underline">dashboard</Link>.
      </p>
    </main>
  );
}
