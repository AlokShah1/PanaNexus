import BloodSearch from '@/components/BloodSearch';
import BloodDonorForm from '@/components/BloodDonorForm';

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Blood</h1>
      <p className="text-slate-600">Check current blood-unit availability by group.</p>
      <BloodSearch />
      <BloodDonorForm />
    </main>
  );
}
