export default function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 py-16">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-slate-600">{description}</p>
      <p className="text-sm text-slate-500">This module is planned for a later increment.</p>
    </main>
  );
}
