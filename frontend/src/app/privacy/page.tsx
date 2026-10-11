import Link from 'next/link';

const POLICY: { heading: string; body: string[] }[] = [
  {
    heading: 'What we collect',
    body: [
      'Account details such as your name, email, phone and role, plus verification details for professionals.',
      'Health information you or your care team add: appointments, medical records, uploaded reports, blood and organ donor details and facility availability.',
      'Location, only while you actively share it to request an ambulance, so responders can find you.',
      'Basic technical data needed to run the service safely, such as session and audit records.',
    ],
  },
  {
    heading: 'How we use it',
    body: [
      'To coordinate care: matching you with doctors, facilities, ambulances, blood units and donors.',
      'To keep the platform accountable: every access to a medical record is logged so misuse can be investigated.',
      'To operate and improve the service: fixing faults, preventing abuse and enforcing rate limits.',
    ],
  },
  {
    heading: 'Who can see what',
    body: [
      'Access is role-based and enforced on the server. Patients see their own records; doctors see patients they are authorised to treat; facility staff see availability for their facility; ambulance operators see assigned trips.',
      'Medical records and uploaded reports require a verified, authorised relationship. They are never public.',
      'Administrators review verifications and audit logs, and those actions are themselves recorded.',
    ],
  },
  {
    heading: 'How it is stored',
    body: [
      'Passwords are stored only as salted hashes; sessions expire and can be revoked.',
      'Uploaded medical reports live in private object storage and open only through short-lived, authorised links.',
      'Live location is used to track an active emergency trip and is never published.',
    ],
  },
  {
    heading: 'Your choices',
    body: [
      'You can update your profile and stop sharing location at any time in the app.',
      'You can ask for a copy or deletion of your account data. Some records may be retained where required for safety, legal or audit reasons.',
    ],
  },
  {
    heading: 'Important limits',
    body: [
      'PanaNexus coordinates care and information. It does not replace emergency call services, and clinical decisions remain with licensed professionals.',
    ],
  },
];

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">Legal</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Privacy policy</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
        This page explains what PanaNexus collects, how it is used, and who can see it. It applies to patients,
        doctors, facilities, ambulance operators and administrators who use the platform.
      </p>

      <div className="mt-10 space-y-8">
        {POLICY.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-bold text-ink">{section.heading}</h2>
            <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-muted">
              {section.body.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
        <p className="text-sm text-ink-muted">
          Questions about your data? See the{' '}
          <Link href="/about" className="font-semibold text-brand-700 underline">
            about page
          </Link>{' '}
          for how the platform works, or contact your facility or platform administrator.
        </p>
        <p className="mt-3 text-xs text-ink-subtle">
          See also the{' '}
          <Link href="/terms" className="underline hover:text-brand-700">
            terms of use
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
