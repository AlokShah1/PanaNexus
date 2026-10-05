import EmergencyRequestForm from '@/components/EmergencyRequestForm';

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Emergency</h1>
      <EmergencyRequestForm />
    </main>
  );
}
