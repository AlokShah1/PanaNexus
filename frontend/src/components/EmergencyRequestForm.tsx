'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { reverseGeocode, searchPlace } from '@/lib/geo';
import { Badge, StatusDot } from '@/components/ui';
import {
  IconAlert,
  IconAmbulance,
  IconCheck,
  IconClock,
  IconPin,
  IconRefresh,
  IconSearch,
  IconShield,
} from '@/components/icons';

const CATEGORIES = [
  { value: 'ACCIDENT', label: 'Accident', emoji: '🚗' },
  { value: 'CARDIAC', label: 'Breathing / heart', emoji: '🫁' },
  { value: 'GENERAL', label: 'Medical emergency', emoji: '🏥' },
  { value: 'OTHER', label: 'Other', emoji: '🆘' },
];

const PRIORITIES = [
  { value: 'MEDIUM', label: 'Serious' },
  { value: 'HIGH', label: 'Urgent' },
  { value: 'CRITICAL', label: 'Life threatening' },
] as const;

type Match = { id: string; distanceKm: number; registrationNumber?: string | null; type?: string | null };
type AmbulanceInfo = { id: string; registrationNumber: string; type: string; driver: string | null };
type Stage =
  | 'REQUESTED'
  | 'SEARCHING'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'TRANSPORTING'
  | 'COMPLETED'
  | 'CANCELLED';

const STEPS: { key: Exclude<Stage, 'CANCELLED'>; label: string }[] = [
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'SEARCHING', label: 'Searching' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'EN_ROUTE', label: 'En route' },
  { key: 'ARRIVED', label: 'Arrived' },
  { key: 'TRANSPORTING', label: 'Transporting' },
  { key: 'COMPLETED', label: 'Completed' },
];

const TRIP_STAGE: Record<string, Stage> = {
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  TRANSPORTING: 'TRANSPORTING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const CENTER = { x: 200, y: 130 };
const DEG_PER_PX = 0.000045;
const AMB_START = { x: 345, y: 45 };

const COPY: Record<Stage, { title: string; sub: string; tone: 'search' | 'active' | 'done' | 'stopped' }> = {
  REQUESTED: { title: 'Ambulance requested', sub: 'Your request was sent to the care network.', tone: 'active' },
  SEARCHING: { title: 'Searching…', sub: 'Matching the nearest suitable ambulance to your location.', tone: 'search' },
  ASSIGNED: { title: 'Ambulance assigned', sub: 'The nearest unit is being confirmed.', tone: 'active' },
  EN_ROUTE: { title: 'Ambulance en route', sub: 'The ambulance is on its way to your pickup point.', tone: 'active' },
  ARRIVED: { title: 'Ambulance has arrived', sub: 'The crew is at your location. Please stay reachable.', tone: 'done' },
  TRANSPORTING: { title: 'Transporting', sub: 'You are on the way to the hospital.', tone: 'active' },
  COMPLETED: { title: 'Trip completed', sub: 'The trip has ended. Take care and follow up with your doctor.', tone: 'done' },
  CANCELLED: { title: 'Request cancelled', sub: 'This emergency request was cancelled.', tone: 'stopped' },
};

export default function EmergencyRequestForm() {
  /* ---------------------------------------------------------- location */
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [pin, setPin] = useState(CENTER);
  const [gpsLive, setGpsLive] = useState(false);
  const [manual, setManual] = useState(false);
  const [placeText, setPlaceText] = useState('');
  const [placeBusy, setPlaceBusy] = useState(false);
  const watchRef = useRef<number | null>(null);

  /* ------------------------------------------------------------ request */
  const [category, setCategory] = useState('CARDIAC');
  const [priority, setPriority] = useState<string>('HIGH');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);

  /* ----------------------------------------------------------- tracking */
  const [requestId, setRequestId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stage, setStage] = useState<Stage | null>(null);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [ambulance, setAmbulance] = useState<AmbulanceInfo | null>(null);
  const [etaEndMs, setEtaEndMs] = useState<number | null>(null);
  const [etaTotalMs, setEtaTotalMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [pollFails, setPollFails] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickup = origin
    ? {
        lat: origin.lat - (pin.y - CENTER.y) * DEG_PER_PX,
        lng: origin.lng + (pin.x - CENTER.x) * DEG_PER_PX,
      }
    : null;
  const pinAdjusted = pin.x !== CENTER.x || pin.y !== CENTER.y;

  /* ---------------------------------------------------------- geolocation */
  const stopWatch = useCallback(() => {
    if (watchRef.current != null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setGpsLive(false);
  }, []);

  const locate = useCallback(() => {
    setLocError(null);
    setLocating(true);
    if (!('geolocation' in navigator)) {
      setLocating(false);
      setLocError('We could not access your location on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const o = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(o);
        setAccuracy(pos.coords.accuracy);
        setPin(CENTER);
        setLocating(false);
        setAddress(await reverseGeocode(o.lat, o.lng));
        if (watchRef.current == null) {
          watchRef.current = navigator.geolocation.watchPosition(
            (p2) => {
              setAccuracy(p2.coords.accuracy);
              setPin((current) => {
                if (current.x !== CENTER.x || current.y !== CENTER.y) return current;
                setOrigin({ lat: p2.coords.latitude, lng: p2.coords.longitude });
                return current;
              });
            },
            () => undefined,
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
          );
          setGpsLive(true);
        }
      },
      (err) => {
        setLocating(false);
        setGpsLive(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "We couldn't access your location."
            : 'We had trouble reading your location.',
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => stopWatch, [stopWatch]);

  async function searchManualPlace() {
    if (!placeText.trim()) return;
    setPlaceBusy(true);
    setLocError(null);
    const found = await searchPlace(placeText.trim());
    setPlaceBusy(false);
    if (!found) {
      setLocError("We couldn't find that place. Try a landmark or street name.");
      return;
    }
    setOrigin({ lat: found.lat, lng: found.lng });
    setAccuracy(null);
    setPin(CENTER);
    setAddress(found.label);
  }

  /* -------------------------------------------------------------- polling */
  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await apiGet<{
        request: { status: string };
        trip: { status: string } | null;
        ambulance: AmbulanceInfo | null;
      }>(`/emergency/${id}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError('Your session expired. Sign in again to keep tracking.');
        }
        setPollFails((n) => n + 1);
        return;
      }
      setPollFails(0);
      setNowMs(Date.now());
      const { request, trip, ambulance: amb } = res.data;
      setBackendStatus(request.status);
      if (amb) setAmbulance(amb);
      const next: Stage = trip
        ? TRIP_STAGE[trip.status] ?? 'EN_ROUTE'
        : request.status === 'MATCHED' || request.status === 'ASSIGNED'
          ? 'ASSIGNED'
          : request.status === 'CANCELLED'
            ? 'CANCELLED'
            : request.status === 'PENDING'
              ? 'SEARCHING'
              : 'REQUESTED';
      setStage(next);
      if (next === 'COMPLETED' || next === 'CANCELLED') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 4000);
  }, []);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  /* live tick for ETA countdown + marker glide while a trip is active */
  useEffect(() => {
    if (!requestId) return undefined;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [requestId]);

  /* --------------------------------------------------------------- submit */
  async function submit() {
    if (!pickup) {
      setError('Please share your location first.');
      return;
    }
    setPending(true);
    setError(null);
    setAuthNeeded(false);
    const res = await apiPost<{ request: { id: string; status: string }; matches: Match[] }>('/emergency', {
      pickupLatitude: Number(pickup.lat.toFixed(6)),
      pickupLongitude: Number(pickup.lng.toFixed(6)),
      category,
      priority,
    });
    setPending(false);
    if (!res.ok) {
      if (res.status === 401) {
        setAuthNeeded(true);
        return;
      }
      setError(res.message);
      return;
    }
    const { request, matches: m } = res.data;
    setNowMs(Date.now());
    setRequestId(request.id);
    setMatches(m ?? []);
    setBackendStatus(request.status);
    const found = (m ?? []).length > 0;
    setStage(found ? 'ASSIGNED' : 'SEARCHING');
    if (found && m[0]) {
      const etaMin = Math.max(2, Math.round((m[0].distanceKm / 32) * 60));
      setEtaTotalMs(etaMin * 60_000);
      setEtaEndMs(Date.now() + etaMin * 60_000);
    }
    startPolling(request.id);
  }

  /* ----------------------------------------------------------- map drag */
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  function svgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return CENTER;
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / 400, r.height / 260);
    const ox = (r.width - 400 * scale) / 2;
    const oy = (r.height - 260 * scale) / 2;
    return {
      x: Math.min(386, Math.max(14, (clientX - r.left - ox) / scale)),
      y: Math.min(246, Math.max(14, (clientY - r.top - oy) / scale)),
    };
  }

  function onMarkerDown(e: React.PointerEvent) {
    if (!pickup || requestId) return;
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onMarkerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    setPin(svgPoint(e.clientX, e.clientY));
  }
  async function onMarkerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (pickup) setAddress(await reverseGeocode(pickup.lat, pickup.lng));
  }

  /* ------------------------------------------------------------ derived */
  const etaMinutesLeft =
    etaEndMs && stage && stage !== 'ARRIVED' && stage !== 'COMPLETED' && stage !== 'CANCELLED'
      ? Math.max(1, Math.ceil((etaEndMs - nowMs) / 60_000))
      : null;
  const stageIndex = stage ? STEPS.findIndex((s) => s.key === stage) : -1;
  const copy = stage ? COPY[stage] : null;
  const assigned = stage === 'ASSIGNED' || stage === 'EN_ROUTE' || stage === 'ARRIVED' || stage === 'TRANSPORTING';
  const showVehicle = !!stage && stage !== 'REQUESTED' && stage !== 'SEARCHING' && stage !== 'CANCELLED';
  const liveMatch = matches[0] ?? null;
  const km = liveMatch?.distanceKm ?? null;

  const progress = (() => {
    if (!stage) return 0;
    if (stage === 'ARRIVED' || stage === 'TRANSPORTING' || stage === 'COMPLETED') return 1;
    if (stage === 'EN_ROUTE' && etaEndMs && etaTotalMs) {
      return Math.min(0.97, Math.max(0.05, 1 - Math.max(0, etaEndMs - nowMs) / etaTotalMs));
    }
    if (stage === 'ASSIGNED') return 0.05;
    return 0;
  })();
  const ambPos = {
    x: AMB_START.x + (pin.x - AMB_START.x) * progress,
    y: AMB_START.y + (pin.y - AMB_START.y) * progress,
  };

  /* ================================================================ view */
  if (authNeeded) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-lift ring-1 ring-slate-200/70">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <IconShield size={22} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-ink">Sign in to request an ambulance</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Requests are tied to a verified account so dispatchers can reach you and keep an auditable record of the
          trip.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="/login?next=/emergency"
            className="rounded-full bg-danger px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#c01039]"
          >
            Sign in
          </a>
          <a
            href="/register"
            className="rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50"
          >
            Create account
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      {/* ------------------------------------------------------- main flow */}
      <div className="order-2 lg:order-1">
        {!requestId && (
          <>
            {/* step 1 — location */}
            <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
              <StepTitle n={1} title="Where are you?" done={pickup != null} />
              {pickup != null && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
                  <IconPin size={18} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold">{address ?? `Location captured${accuracy != null ? ` (±${Math.round(accuracy)} m)` : ''}`}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-brand-700/80">
                      {gpsLive && (
                        <>
                          <StatusDot tone="success" />
                          GPS live
                          <span aria-hidden>·</span>
                        </>
                      )}
                      {pinAdjusted ? 'Pin adjusted' : accuracy != null ? `Accuracy ±${Math.round(accuracy)} m` : 'Point captured'}
                    </p>
                  </div>
                  {pinAdjusted && (
                    <button
                      onClick={() => {
                        setPin(CENTER);
                        if (origin) void reverseGeocode(origin.lat, origin.lng).then(setAddress);
                      }}
                      className="ml-auto shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
                    >
                      Reset pin
                    </button>
                  )}
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
                  {pickup != null ? 'Update my location' : 'Use my current location'}
                </button>
                {!manual && pickup == null && (
                  <button
                    onClick={() => setManual(true)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    Enter a place instead
                  </button>
                )}
              </div>

              {locError && (
                <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                  <p>{locError}</p>
                  <div className="mt-2 flex gap-3">
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
                <div className="mt-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                      <input
                        value={placeText}
                        onChange={(e) => setPlaceText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void searchManualPlace())}
                        placeholder="Area, landmark or street — e.g. MP Nagar, Bhopal"
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                      />
                    </div>
                    <button
                      onClick={() => void searchManualPlace()}
                      disabled={placeBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {placeBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <IconSearch size={16} />}
                      Find
                    </button>
                  </div>
                  <p className="mt-2 text-[12.5px] text-ink-subtle">
                    We never guess your location from your IP — this point is what dispatch will use.
                  </p>
                </div>
              )}
            </section>

            {/* step 2 — what is happening */}
            <section className="mt-4 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
              <StepTitle n={2} title="What is happening?" />
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {CATEGORIES.map((t) => {
                  const active = category === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setCategory(t.value)}
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

              <div className="mt-5">
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
            </section>

            {/* step 3 — confirm */}
            <section className="mt-4 rounded-3xl bg-gradient-to-br from-danger-soft to-white p-6 shadow-soft ring-1 ring-danger/15">
              <StepTitle n={3} title="Confirm and send" />
              {pickup && (
                <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                  We will dispatch the nearest suitable ambulance to{' '}
                  <span className="font-semibold text-ink">{address ?? 'your pinned location'}</span> for a{' '}
                  <span className="font-semibold text-ink">{CATEGORIES.find((c) => c.value === category)?.label.toLowerCase()}</span>{' '}
                  case marked <span className="font-semibold text-danger">{PRIORITIES.find((p) => p.value === priority)?.label.toLowerCase()}</span>.
                </p>
              )}
              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-medium text-danger ring-1 ring-danger/20">
                  {error}
                </p>
              )}
              <button
                onClick={() => void submit()}
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
          </>
        )}

        {/* ------------------------------------------------- tracking view */}
        {requestId && copy && (
          <section
            className={`rounded-3xl p-6 shadow-lift ring-1 ${
              copy.tone === 'stopped' ? 'bg-slate-50 ring-slate-200' : 'bg-white ring-slate-200/70'
            }`}
          >
            <div className="flex items-start gap-4">
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                  copy.tone === 'done'
                    ? 'bg-success text-white'
                    : copy.tone === 'stopped'
                      ? 'bg-slate-300 text-white'
                      : 'bg-danger text-white'
                }`}
              >
                {copy.tone === 'done' ? <IconCheck size={24} /> : <IconAmbulance size={24} />}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-subtle">
                  {stage === 'SEARCHING' ? 'Ambulance requested' : 'Live trip status'}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl">{copy.title}</h2>
                <p className="mt-1 text-sm text-ink-muted">{copy.sub}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-subtle">
                  <span>
                    Reference <span className="font-mono font-semibold text-ink-muted">{requestId.slice(0, 8)}</span>
                  </span>
                  {stage === 'ASSIGNED' && backendStatus === 'MATCHED' && (
                    <span className="font-semibold text-brand-700">Nearest unit located — confirming…</span>
                  )}
                </p>
                {pollFails > 2 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-200">
                    <IconRefresh size={13} /> Live updates interrupted — retrying…
                  </p>
                )}
              </div>
            </div>

            {/* vehicle / ETA */}
            {(assigned || etaMinutesLeft != null) && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                    {stage === 'ARRIVED' || stage === 'TRANSPORTING' || stage === 'COMPLETED' ? 'Ambulance' : 'Estimated arrival'}
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">
                    {stage === 'ARRIVED' || stage === 'TRANSPORTING' || stage === 'COMPLETED'
                      ? 'On scene'
                      : etaMinutesLeft != null
                        ? `~${etaMinutesLeft} min`
                        : 'Calculating…'}
                  </p>
                  {ambulance ? (
                    <p className="mt-1 text-[13px] text-brand-100">
                      {ambulance.registrationNumber} · {ambulance.type.toLowerCase()}
                      {ambulance.driver ? ` · ${ambulance.driver}` : ''}
                    </p>
                  ) : liveMatch?.registrationNumber ? (
                    <p className="mt-1 text-[13px] text-brand-100">
                      {liveMatch.registrationNumber} · {liveMatch.type?.toLowerCase() ?? 'ambulance'}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    {km != null ? 'Distance to pickup' : 'Pickup point'}
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink">{km != null ? `${km} km away` : address ?? 'Pinned'}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{address ?? 'Location captured'}</p>
                </div>
              </div>
            )}

            {/* timeline */}
            {stage !== 'CANCELLED' && (
              <ol className="mt-6 grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6">
                {STEPS.map((s, i) => {
                  const done = stageIndex >= 0 && i < stageIndex;
                  const active = stageIndex === i;
                  return (
                    <li key={s.key} className="flex items-center gap-3 py-1.5">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors ${
                          done ? 'bg-success text-white' : active ? 'bg-danger text-white animate-pulse' : 'bg-slate-200 text-ink-subtle'
                        }`}
                      >
                        {done ? <IconCheck size={14} /> : i + 1}
                      </span>
                      <span className={`text-sm ${active ? 'font-bold text-ink' : done ? 'text-ink-muted' : 'text-ink-subtle'}`}>
                        {s.label}
                      </span>
                      {i < STEPS.length - 1 && <span className={`hidden h-px flex-1 sm:block ${done ? 'bg-success/40' : 'bg-slate-200'}`} />}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-amber-200/70">
              <IconAlert size={16} className="mt-0.5 shrink-0" />
              <p>
                Keep your phone reachable and stay at the pinned spot. If the situation worsens, call your local
                emergency number immediately.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* --------------------------------------------------------- map panel */}
      <div className="order-1 lg:order-2">
        <div className="sticky top-24 overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-slate-200/70">
          <div className="relative h-56 touch-none bg-gradient-to-br from-brand-50 to-white sm:h-64">
            <div aria-hidden className="absolute inset-0 bg-dots-fine opacity-50" />
            <svg
              ref={svgRef}
              viewBox="0 0 400 260"
              className="relative h-full w-full"
              onPointerMove={onMarkerMove}
              onPointerUp={onMarkerUp}
              onPointerLeave={onMarkerUp}
              role="img"
              aria-label="Pickup map. Drag the pin to adjust your pickup point."
            >
              <g stroke="#bcd2ff" strokeWidth="1">
                <path d="M0 70h400M0 130h400M0 190h400M80 0v260M170 0v260M260 0v260M340 0v260" />
              </g>
              <path
                d="M-10 240 C 90 210, 130 140, 210 118 S 330 50, 410 34"
                stroke="#8eb4ff"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="8 9"
                className="animate-dash"
              />

              {requestId && showVehicle && (
                <>
                  <line
                    x1={ambPos.x}
                    y1={ambPos.y}
                    x2={pin.x}
                    y2={pin.y}
                    stroke="#e11d48"
                    strokeWidth="2"
                    strokeDasharray="5 6"
                    opacity="0.7"
                  />
                  <g style={{ transition: 'transform 3.5s linear' }} transform={`translate(${ambPos.x - 14} ${ambPos.y - 10})`}>
                    <rect x="0" y="0" width="28" height="18" rx="5" fill="#e11d48" />
                    <rect x="18" y="4" width="7" height="7" rx="1.5" fill="#fff" opacity="0.9" />
                    <path d="M6 5v8M2 9h8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                    <circle cx="8" cy="18" r="3" fill="#0a1a33" />
                    <circle cx="21" cy="18" r="3" fill="#0a1a33" />
                    {etaMinutesLeft != null && stage === 'EN_ROUTE' && (
                      <text x="14" y="-6" textAnchor="middle" fontSize="11" fontWeight="700" fill="#e11d48">
                        {etaMinutesLeft} min
                      </text>
                    )}
                  </g>
                </>
              )}

              {pickup && (
                <g
                  onPointerDown={onMarkerDown}
                  style={{ cursor: 'grab', touchAction: 'none' }}
                  className="select-none"
                >
                  <circle cx={pin.x} cy={pin.y} r="24" fill="#1f45f5" opacity="0.10" className="animate-pulse-ring" />
                  <path
                    d={`M${pin.x} ${pin.y - 26} c -8 -12 -14 -17 -14 -24 a 14 14 0 1 1 28 0 c 0 7 -6 12 -14 24 z`}
                    fill="#1f45f5"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  <circle cx={pin.x} cy={pin.y - 44} r="4.5" fill="#fff" />
                  <circle cx={pin.x} cy={pin.y + 4} r="2.6" fill="#1f45f5" />
                </g>
              )}
            </svg>

            <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
              <Badge tone={pickup ? 'success' : 'neutral'}>
                <StatusDot tone={pickup ? 'success' : 'warning'} />
                {pickup ? 'Pickup set' : 'Waiting for location'}
              </Badge>
              {pinAdjusted && <Badge tone="brand">Pin adjusted</Badge>}
            </div>
            {pickup && (
              <p className="pointer-events-none absolute bottom-3 left-4 right-4 truncate rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-ink-muted shadow-soft">
                {address ?? 'Drag the pin to fine-tune your pickup point'}
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 p-5">
            {requestId ? (
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger">
                  <IconClock size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">Tracking request {requestId.slice(0, 8)}</p>
                  <p className="text-[13px] text-ink-muted">
                    Status refreshes automatically{stage === 'EN_ROUTE' ? ` · arriving in ~${etaMinutesLeft ?? '—'} min` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-ink">Live status appears here</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                  Confirm the pin, send the request, and this panel shows the assigned ambulance, ETA and a
                  step-by-step trip timeline.
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
