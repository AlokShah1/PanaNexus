const TERMS: { heading: string; body: string[] }[] = [
  {
    heading: 'Using PanaNexus',
    body: [
      'PanaNexus connects patients, doctors, hospitals, health posts, ambulance services, blood units and donors. Use it only for lawful, genuine healthcare coordination.',
      'You are responsible for the accuracy of the information you provide and for keeping your sign-in credentials private.',
    ],
  },
  {
    heading: 'Accounts and roles',
    body: [
      'Doctor, facility and ambulance accounts are professional accounts and are only usable after identity verification is approved.',
      'Access is role-based. Attempting to view records or act as a role you are not authorised for is not permitted and may be logged.',
    ],
  },
  {
    heading: 'Not an emergency service',
    body: [
      'PanaNexus helps request and coordinate an ambulance, but it is not an emergency call service. In a life-threatening situation always contact the official emergency number first.',
      'Clinical decisions, diagnoses and treatment are the responsibility of licensed professionals, not the platform.',
    ],
  },
  {
    heading: 'Health information',
    body: [
      'Records, uploaded reports and donor information are private and shared only with authorised people. Do not upload content you do not have the right to share.',
      'Blood and organ donation pledges must be given freely and truthfully; you can withdraw a pledge at any time.',
    ],
  },
  {
    heading: 'Acceptable use',
    body: [
      'Do not misuse the service: no false emergency requests, no harassment, no attempts to break or overload the platform, and no scraping or reselling of data.',
      'We may suspend accounts that break these rules or that put others at risk.',
    ],
  },
  {
    heading: 'Availability and changes',
    body: [
      'The platform is provided as-is. Features may change, and access may be interrupted for maintenance or due to network conditions.',
      'These terms, and the privacy policy, may be updated; continued use means you accept the current version.',
    ],
  },
];

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">Legal</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Terms of use</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
        These terms describe the rules for using PanaNexus. They apply to everyone who uses the platform, in any role.
      </p>

      <div className="mt-10 space-y-8">
        {TERMS.map((section) => (
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
          See the{' '}
          <a href="/privacy" className="font-semibold text-brand-700 underline">
            privacy policy
          </a>{' '}
          for how your information is handled, or the{' '}
          <a href="/about" className="font-semibold text-brand-700 underline">
            about page
          </a>{' '}
          for an overview of the platform.
        </p>
      </div>
    </main>
  );
}
