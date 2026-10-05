import OrganDonorForm from '@/components/OrganDonorForm';

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Organ Donation</h1>
      <p className="text-slate-600">Register your organ-donation pledge. Coordination is left to authorized professionals.</p>
      <OrganDonorForm />
    </main>
  );
}
