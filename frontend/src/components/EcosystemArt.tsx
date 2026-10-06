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
  pos: string;
  ring: string;
  delay?: string;
};

const NODES: Node[] = [
  { icon: IconPin, label: 'You', sub: 'Request', pos: 'left-[4%] top-[44%]', ring: 'ring-brand-200', delay: '' },
  { icon: IconStethoscope, label: 'Doctors', sub: 'Care', pos: 'left-[30%] top-[10%]', ring: 'ring-teal-500/30', delay: 'animation-delay-700' },
  { icon: IconHospital, label: 'Hospitals', sub: 'Facilities', pos: 'right-[30%] top-[10%]', ring: 'ring-brand-200', delay: 'animation-delay-1000' },
  { icon: IconAmbulance, label: 'Ambulance', sub: 'Emergency', pos: 'right-[4%] top-[44%]', ring: 'ring-danger/25', delay: 'animation-delay-300' },
  { icon: IconDroplet, label: 'Blood', sub: 'Donors', pos: 'left-[32%] bottom-[6%]', ring: 'ring-danger/20', delay: 'animation-delay-1300' },
  { icon: IconClipboard, label: 'Records', sub: 'History', pos: 'right-[32%] bottom-[6%]', ring: 'ring-brand-200', delay: 'animation-delay-1600' },
];

export default function EcosystemArt() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {/* backdrop */}
      <div aria-hidden className="absolute -inset-8 -z-10">
        <div className="absolute inset-0 rounded-[40px] bg-gradient-to-br from-brand-100/70 via-white to-teal-500/10" />
        <div className="absolute inset-0 rounded-[40px] bg-grid opacity-70" />
      </div>

      <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[32px] bg-white/70 p-6 shadow-lift ring-1 ring-white/70 backdrop-blur-sm sm:p-8">
        {/* connection lines */}
        <svg aria-hidden viewBox="0 0 400 320" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="pn-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#598cff" />
              <stop offset="50%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#1f45f5" />
            </linearGradient>
          </defs>
          <g stroke="url(#pn-line)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeDasharray="6 7" className="animate-dash">
            <path d="M64 148 C 120 148, 120 52, 176 52" />
            <path d="M224 52 C 280 52, 280 148, 336 148" />
            <path d="M64 148 C 130 148, 130 268, 176 268" />
            <path d="M224 268 C 270 268, 270 148, 336 148" />
            <path d="M176 52 C 200 20, 200 20, 224 52" />
            <path d="M176 268 C 200 300, 200 300, 224 268" />
          </g>
          <g stroke="#1f45f5" strokeWidth="1" fill="none" opacity="0.14">
            <circle cx="200" cy="160" r="118" />
            <circle cx="200" cy="160" r="86" />
          </g>
        </svg>

        {/* centre core */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glow sm:h-28 sm:w-28">
            <span
              aria-hidden
              className="absolute inset-0 animate-pulse-ring rounded-3xl border border-brand-500/40"
            />
            <span className="px-2 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.12em] sm:text-xs">
              Pana
              <br />
              Nexus
            </span>
          </div>
        </div>

        {/* nodes */}
        {NODES.map((n) => {
          const Icon = n.icon;
          return (
            <div key={n.label} className={`absolute ${n.pos}`}>
              <div className={`animate-float ${n.delay ?? ''}`}>
                <div className={`flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-soft ring-1 ${n.ring} backdrop-blur`}>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon size={18} />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13px] font-semibold text-ink">{n.label}</span>
                    <span className="block text-[11px] text-ink-subtle">{n.sub}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}