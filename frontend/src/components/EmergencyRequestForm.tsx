'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiPost } from '@/lib/api';
import { Badge, StatusDot } from '@/components/ui';
import { IconAmbulance, IconCheck, IconClock, IconPin, IconRefresh } from '@/components/icons';

const EMERGENCY_TYPES = [
  { value: 'ACCIDENT', label: 'Accident', emoji: '🚗' },
  { value: 'CARDIAC', label: 'Breathing / heart', emoji: '🫁' },
  { value: 'INJURY', label: 'Injury', emoji: '🤕' },
  { value: 'PREGNANCY', label: 'Pregnancy', emoji: '🤰' },
  { value: 'GENERAL', label: 'Medical emergency', emoji: '❤️' },
  { value: 'OTHER', label: 'Other', emoji: '❓' },
];

const PRIORITIES = [
  { value: 'MEDIUM', label: 'Serious' },
  { value: 'HIGH', label: 'Urgent' },
  { value: 'CRITICAL', label: 'Life threatening' },
] as const;

type Match = { id: string; distanceKm: number };
type TripState = 'REQUESTED' | 'SEARCHING' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'TRANSPORTING' | 'COMPLETED';

const STEPS: { key: TripState; label: string }[] = [
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'SEARCHING', label: 'Searching' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'EN_ROUTE', label: 'En route' },
  { key: 'ARRIVED', label: 'Arrived' },
  { key: 'TRANSPORTING', label: 'Transporting' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function EmergencyRequestForm() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [type, setType] = useState('CARDIAC');
  const [priority, setPriority] = useState<string>('HIGH');
  const [forWhom, setForWhom] = useState<'me' | 'someone'>('me');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tripState, setTripState] = useState<TripState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const locate = useCallback(() => {
    setLocError(null);
    setLocating(true);
    if (!('geolocation' in navigator)) {
      setLocating(false);
      setLocError('We could not access your location on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(pos.coords.accuracy);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocError("We couldn't access your location.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function submit() {
    if (lat == null || lng == null) {
      setError('Please share your location first.');
      return;
    }
    setPending(true);
    setError(null);
    const res = await apiPost<{ request: { id: string; status: string }; matches: Match[] }>('/emergency', {
      pickupLatitude: lat,
      pickupLongitude: lng,
      category: type,
      priority,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setRequestId(res.data.request.id);
    setMatches(res.data.matches ?? []);
    setTripState(res.data.request.status === 'MATCHED' ? 'SEARCHING' : 'REQUESTED');

  }

  function useManualLocation() {
    const parts = manualText.split(',').map((s) => Number(s.trim()));
    if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
      setLat(parts[0]);
      setLng(parts[1]);
      setAccuracy(null);
      setLocError(null);

    } else {
      setLocError('Enter coordinates as latitude, longitude');
    }
  }

  const etaMinutes = matches[0] ? Math.max(2, Math.round((matches[0].distanceKm / 32) * 60)) : null;
  const currentIndex = tripState ? STEPS.findIndex((s) => s.key === tripState) : -1;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      {/* ------------------------------------------------------- flow */}
      <div className="order-2 lg:order-1">
        {/* step 1 location */}
        <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
          <StepTitle n={1} title="Where are you?" done={lat != null} />
          {lat != null && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <IconPin size={18} />
              <span className="font-semibold">Location captured</span>
              <span className="text-brand-700/70">
                {lat.toFixed(4)}, {lng?.toFixed(4)}
                {accuracy != null ? ` · ±${Math.round(accuracy)}m` : ''}
              </span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={locate}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {locating ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <IconPin size={17} />
              )}
              {lat != null ? 'Update my location' : 'Use my current location'}
            </button>
            {!manual && lat == null && (
              <button
                onClick={() => setManual(true)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Enter location manually
              </button>
            )}
          </div>

          {locError && (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
              <p>{locError}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={locate} className="inline-flex items-center gap-1.5 font-semibold underline">
                  <IconRefresh size={14} /> Try again
                </button>
                <button onClick={() => setManual(true)} className="font-semibold underline">
                  Enter manually
                </button>
              </div>
            </div>
          )}

          {manual && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="27.7172, 85.3240"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
              />
              <button onClick={useManualLocation} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">
                Use this point
              </button>
            </div>
          )}
        </section>

        {/* step 2 type */}
        <section className="mt-4 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
          <StepTitle n={2} title="What is happening?" />
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {EMERGENCY_TYPES.map((t) => {
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  aria-pressed={active}
                  className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                    active
                      ? 'border-danger/40 bg-danger-soft shadow-[0_10px_24px_-16px_rgba(225,29,72,0.9)]'
                      : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {t.emoji}
                  </span>
                  <span className="text-[13px] font-semibold text-ink">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">How urgent?</p>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    aria-pressed={priority === p.value}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                      priority === p.value
                        ? 'bg-danger text-white shadow-[0_8px_18px_-10px_rgba(225,29,72,0.9)]'
                        : 'bg-slate-100 text-ink-muted hover:bg-danger-soft hover:text-danger'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Who needs help?</p>
              <div className="flex gap-2">
                {(['me', 'someone'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setForWhom(v)}
                    aria-pressed={forWhom === v}
                    className={`flex-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                      forWhom === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink-muted hover:bg-brand-50'
                    }`}
                  >
                    {v === 'me' ? 'Me' : 'Someone else'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* step 3 submit */}
        <section className="mt-4 rounded-3xl bg-gradient-to-br from-danger-soft to-white p-6 shadow-soft ring-1 ring-danger/15">
          <StepTitle n={3} title="Send the request" />
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-medium text-danger ring-1 ring-danger/20">
              {error}
            </p>
          )}
          <button
            onClick={submit}
            disabled={pending}
            className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-danger px-6 py-4 text-base font-bold text-white shadow-[0_18px_40px_-18px_rgba(225,29,72,0.9)] transition-all hover:bg-[#c01039] active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <IconAmbulance size={22} />
            )}
            {pending ? 'Sending request…' : 'Request Ambulance'}
          </button>
        </section>
      </div>

      {/* ------------------------------------------------------- map panel */}
      <div className="order-1 lg:order-2">
        <div className="sticky top-24 overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-slate-200/70">
          <div className="relative h-56 bg-gradient-to-br from-brand-50 to-white sm:h-64">
            <div aria-hidden className="absolute inset-0 bg-dots-fine opacity-50" />
            <svg aria-hidden viewBox="0 0 400 260" className="relative h-full w-full">
              <g stroke="#bcd2ff" strokeWidth="1">
                <path d="M0 70h400M0 130h400M0 190h400M80 0v260M170 0v260M260 0v260M340 0v260" />
              </g>
              <path
                d="M-10 220 C 90 200, 120 120, 200 100 S 320 40, 410 30"
                stroke="#8eb4ff"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="8 9"
                className="animate-dash"
              />
              {lat != null && lng != null && (
                <g>
                  <circle cx="200" cy="130" r="26" fill="#1f45f5" opacity="0.10" className="animate-pulse-ring" />
                  <circle cx="200" cy="130" r="8" fill="#1f45f5" />
                  <circle cx="200" cy="130" r="3" fill="#fff" />
                </g>
              )}
              {lat != null && matches[0] && (
                <g className="animate-float">
                  <circle cx="310" cy="60" r="12" fill="#e11d48" opacity="0.14" />
                  <circle cx="310" cy="60" r="6" fill="#e11d48" />
                </g>
              )}
            </svg>
            <div className="absolute left-4 top-4">
              <Badge tone={lat != null ? 'success' : 'neutral'}>
                <StatusDot tone={lat != null ? 'success' : 'warning'} />
                {lat != null ? 'Location ready' : 'Waiting for location'}
              </Badge>
            </div>
          </div>

          <div className="border-t border-slate-100 p-5">
            {requestId ? (
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger text-white">
                    <IconAmbulance size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">Ambulance request active</p>
                    <p className="text-[13px] text-ink-muted">
                      Reference <span className="font-mono">{requestId.slice(0, 8)}</span>
                    </p>
                  </div>
                </div>

                {etaMinutes != null && (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
                    <IconClock size={17} />
                    <span>
                      Nearest unit <strong>~{etaMinutes} min</strong> away ({matches[0].distanceKm} km)
                    </span>
                  </div>
                )}

                <ol className="mt-5 space-y-0">
                  {STEPS.map((s, i) => {
                    const done = currentIndex >= 0 && i < currentIndex;
                    const active = currentIndex === i;
                    return (
                      <li key={s.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold transition-colors ${
                              done
                                ? 'bg-success text-white'
                                : active
                                  ? 'bg-danger text-white'
                                  : 'bg-slate-200 text-ink-subtle'
                            }`}
                          >
                            {done ? <IconCheck size={13} /> : i + 1}
                          </span>
                          {i < STEPS.length - 1 && (
                            <span className={`h-8 w-0.5 ${done ? 'bg-success/40' : 'bg-slate-200'}`} />
                          )}
                        </div>
                        <span
                          className={`pt-0.5 text-sm ${active ? 'font-bold text-ink' : done ? 'text-ink-muted' : 'text-ink-subtle'}`}
                        >
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-ink">Live status appears here</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                  Once you send a request we show the matched ambulance, estimated arrival and a step-by-step trip
                  timeline.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
          done ? 'bg-success text-white' : 'bg-brand-600 text-white'
        }`}
      >
        {done ? <IconCheck size={14} /> : n}
      </span>
      <h2 className="text-base font-bold text-ink">{title}</h2>
    </div>
  );
}