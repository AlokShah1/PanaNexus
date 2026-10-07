import {
  IconAmbulance,
  IconClipboard,
  IconDroplet,
  IconHospital,
  IconPin,
  IconStethoscope,
} from './icons';

type Node = {
  icon: typeof IconPin;
  label: string;
  sub: string;
  ring: string;
  cell: string;
  delay?: number;
};

const NODES: Node[] = [
  { icon: IconStethoscope, label: 'Doctors', sub: 'Care', ring: 'ring-teal-500/30', cell: 'sm:col-start-1 sm:row-start-1', delay: 700 },
  { icon: IconHospital, label: 'Hospitals', sub: 'Facilities', ring: 'ring-brand-200', cell: 'sm:col-start-3 sm:row-start-1', delay: 1000 },
  { icon: IconPin, label: 'You', sub: 'Request', ring: 'ring-brand-200', cell: 'sm:col-start-1 sm:row-start-2' },
  { icon: IconAmbulance, label: 'Ambulance', sub: 'Emergency', ring: 'ring-danger/25', cell: 'sm:col-start-3 sm:row-start-2', delay: 300 },
  { icon: IconDroplet, label: 'Blood', sub: 'Donors', ring: 'ring-danger/20', cell: 'sm:col-start-1 sm:row-start-3', delay: 1300 },
  { icon: IconClipboard, label: 'Records', sub: 'History', ring: 'ring-brand-200', cell: 'sm:col-start-3 sm:row-start-3', delay: 1600 },
];

export default function EcosystemArt() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {/* backdrop */}
      <div aria-hidden className="pointer-events-none absolute -inset-8 -z-10 overflow-hidden rounded-[48px]">
        <div className="absolute inset-0 rounded-[40px] bg-gradient-to-br from-brand-100/70 via-white to-teal-500/10" />
        <div className="absolute inset-0 rounded-[40px] bg-grid opacity-70" />
      </div>

      <div className="relative overflow-hidden rounded-[32px] bg-white/70 p-5 shadow-lift ring-1 ring-white/70 backdrop-blur-sm sm:aspect-[5/4] sm:p-6">
        {/* connection lines (behind cards, tablet/desktop only) */}
        <svg
          aria-hidden
          viewBox="0 0 400 320"
          className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
        >
          <defs>
            <linearGradient id="pn-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#598cff" />
              <stop offset="50%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#1f45f5" />
            </linearGradient>
          </defs>
          <g stroke="#1f45f5" strokeWidth="1" fill="none" opacity="0.14">
            <circle cx="200" cy="160" r="118" />
            <circle cx="200" cy="160" r="86" />
          </g>
          <g stroke="url(#pn-line)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeDasharray="6 7" className="animate-dash">
            <path d="M200 160 C 155 135, 120 90, 79 66" />
            <path d="M200 160 C 245 135, 280 90, 321 66" />
            <path d="M200 160 C 150 160, 110 160, 79 160" />
            <path d="M200 160 C 250 160, 290 160, 321 160" />
            <path d="M200 160 C 155 185, 120 230, 79 254" />
            <path d="M200 160 C 245 185, 280 230, 321 254" />
          </g>
        </svg>

        {/* nodes — grid on sm+, stacked on mobile */}
        <div className="grid grid-cols-2 place-items-center gap-2.5 sm:h-full sm:grid-cols-3 sm:grid-rows-3 sm:gap-0">
          {/* centre core */}
          <div className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-2">
            <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glow sm:h-28 sm:w-28">
              <span
                aria-hidden
                className="absolute inset-1.5 animate-pulse-ring rounded-2xl border border-brand-500/40"
              />
              <span className="px-2 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.12em] sm:text-xs">
                Pana
                <br />
                Nexus
              </span>
            </div>
          </div>

          {NODES.map((n) => {
            const Icon = n.icon;
            return (
              <div key={n.label} className={n.cell}>
                <div className="animate-float" style={n.delay ? { animationDelay: `${n.delay}ms` } : undefined}>
                  <div className={`flex items-center gap-1.5 rounded-2xl bg-white/90 px-2 py-2 shadow-soft ring-1 backdrop-blur ${n.ring} sm:gap-2 sm:px-3`}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 sm:h-9 sm:w-9">
                      <Icon size={16} />
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[12px] font-semibold text-ink sm:text-[13px]">{n.label}</span>
                      <span className="block text-[10px] text-ink-subtle sm:text-[11px]">{n.sub}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}