import Link from "next/link";

const actions = [
  { href: "/emergency", title: "Request Ambulance", desc: "Get emergency transport quickly with live matching." },
  { href: "/appointments", title: "Book Appointment", desc: "Find a doctor and schedule a visit online." },
  { href: "/hospitals", title: "Find Healthcare Facility", desc: "Locate nearby hospitals and health posts." },
  { href: "/blood", title: "Find Blood / Donor", desc: "Check blood availability and coordinate donors." },
];

const features = [
  { title: "Medical records", desc: "Authorized, secure access to your health history." },
  { title: "Appointments", desc: "Online booking and reminders without queues." },
  { title: "Emergency support", desc: "Ambulance discovery and live trip tracking." },
  { title: "Donor services", desc: "Blood and organ donor registration and matching." },
  { title: "Connected care", desc: "Better coordination between health posts and hospitals." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-10">
      <header className="flex items-center justify-between border-b border-slate-200 pb-5">
        <p className="text-lg font-semibold tracking-tight">Healthcare Ecosystem</p>
        <nav className="flex gap-4 text-sm font-medium text-slate-600">
          <Link href="/login">Login</Link>
          <Link href="/register" className="rounded-md bg-slate-900 px-3 py-1.5 text-white">Register</Link>
        </nav>
      </header>

      <section aria-labelledby="hero-title" className="flex flex-col gap-3">
        <h1 id="hero-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Connected healthcare. Faster access. Better coordination.
        </h1>
        <p className="max-w-2xl text-slate-600">
          One lightweight platform connecting patients, doctors, hospitals, health posts, donors, and emergency services.
        </p>
      </section>

      <section aria-label="Key actions" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
            <h2 className="font-semibold text-slate-900">{a.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{a.desc}</p>
          </Link>
        ))}
      </section>

      <section aria-labelledby="features-title" className="flex flex-col gap-4">
        <h2 id="features-title" className="text-xl font-semibold tracking-tight">Why this platform</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f.title} className="rounded-md bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200">
              <span className="font-medium text-slate-900">{f.title}.</span> {f.desc}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
