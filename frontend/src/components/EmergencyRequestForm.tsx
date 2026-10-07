'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { reverseGeocode } from '@/lib/geo';
import { getRealtime, type TripLocationEvent, type TripStatusEvent } from '@/lib/realtime';
import { Badge, StatusDot } from '@/components/ui';
import {
  IconAmbulance,
  IconCheck,
  IconClock,
  IconPin,
  IconRefresh,
  IconShield,
} from '@/components/icons';

const EmergencyMap = dynamic(() => import('@/components/emergency/EmergencyMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});

const CATEGORIES = [
  { value: 'MEDICAL', label: 'Medical emergency', emoji: '🟥' },
  { value: 'ACCIDENT', label: 'Accident', emoji: '🚗' },
  { value: 'INJURY', label: 'Injury', emoji: '🩹' },
  { value: 'PREGNANCY', label: 'Pregnancy', emoji: '🤰' },
  { value: 'BREATHING', label: 'Breathing difficulty', emoji: '🫁' },
  { value: 'OTHER', label: 'Something else', emoji: '🆘' },
];

const PRIORITIES = [
  { value: 'MEDIUM', label: 'Serious' },
  { value: 'HIGH', label: 'Urgent' },
  { value: 'CRITICAL', label: 'Life threatening' },
] as const;

type Match = { id: string; distanceKm: number; registrationNumber?: string | null; type?: string | null };
type AmbulanceInfo = { id: string; registrationNumber: string; type: string; driver: string | null };
type Facility = { id: string; name: string; type: string; address: string; emergencyAvailable: boolean };
type LocFix = { lat: number; lng: number; accuracy: number | null; obtainedAt: string };
type LocStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported' | 'error';
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

function accuracyQuality(m: number | null): { tone: 'success' | 'warning' | 'danger'; text: string } {
  if (m == null) return { tone: 'warning', text: 'Accuracy unavailable' };
  if (m <= 30) return { tone: 'success', text: 'High accuracy' };
  if (m <= 100) return { tone: 'warning', text: 'Moderate accuracy' };
  return { tone: 'danger', text: 'Low accuracy' };
}

export default function EmergencyRequestForm() {
  /* ---------------------------------------------------------- location */
  const [fix, setFix] = useState<LocFix | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>('idle');
  const [locError, setLocError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  /* -------------------------------------------------------------- form */
  const [category, setCategory] = useState('MEDICAL');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]['value']>('HIGH');
  const [notes, setNotes] = useState('');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [destinationFacilityId, setDestinationFacilityId] = useState('');

  /* ---------------------------------------------------------- request */
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  /* --------------------------------------------------------- tracking */
  const [stage, setStage] = useState<Stage>('SEARCHING');
  const [ambulance, setAmbulance] = useState<AmbulanceInfo | null>(null);
  const [liveLocation, setLiveLocation] = useState<TripLocationEvent | null>(null);
  const [liveUp, setLiveUp] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [etaEndMs, setEtaEndMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [pollFails, setPollFails] = useState(0);
  const [askingCancel, setAskingCancel] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocStatus('unsupported');
      setLocError('Location services are not available in this browser. Please use a phone with GPS.');
      return;
    }
    setLocStatus('requesting');
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: LocFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
          obtainedAt: new Date(pos.timestamp || Date.now()).toISOString(),
        };
        setFix(next);
        setLocStatus('ready');
        setGeocoding(true);
        void reverseGeocode(next.lat, next.lng).then((label) => {
          setAddress(label);
          setGeocoding(false);
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocStatus('denied');
          setLocError('Location access is required to request an ambulance.');
        } else if (err.code === err.TIMEOUT) {
          setLocStatus('error');
          setLocError('Getting a GPS fix took too long. Move to an open area and try again.');
        } else {
          setLocStatus('error');
          setLocError('We could not get your GPS location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    void apiGet<Facility[]>('/facilities').then((res) => {
      if (res.ok) setFacilities(res.data.filter((f) => f.emergencyAvailable));
    });
  }, []);

  /* ---------------------------------------------------------- polling */
  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await apiGet<{
        request: { status: string };
        trip: { status: string; isSimulation?: boolean } | null;
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
      if (amb) setAmbulance(amb);
      if (trip?.isSimulation) setIsSimulation(true);
      const next: Stage = trip
        ? TRIP_STAGE[trip.status] ?? 'EN_ROUTE'
        : request.status === 'CANCELLED'
          ? 'CANCELLED'
          : request.status === 'COMPLETED'
            ? 'COMPLETED'
            : 'SEARCHING';
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

  /* --------------------------------------------------------- realtime */
  useEffect(() => {
    if (!requestId) return undefined;
    const s = getRealtime();
    if (!s) return undefined;
    const onStatus = (p: TripStatusEvent) => {
      if (p.emergencyRequestId !== requestId) return;
      setLiveUp(true);
      if (p.isSimulation) setIsSimulation(true);
      setStage((prev) => {
        const next = (p.state as Stage) ?? prev;
        if (next === 'EN_ROUTE' && !etaEndMs) {
          setEtaEndMs(Date.now() + 8 * 60_000);
        }
        return next;
      });
      if (p.ambulance && p.ambulance.id) {
        setAmbulance({
          id: p.ambulance.id,
          registrationNumber: p.ambulance.registrationNumber,
          type: p.ambulance.type,
          driver: p.ambulance.driverName,
        });
      }
    };
    const onLocation = (p: TripLocationEvent) => {
      setLiveUp(true);
      setLiveLocation(p);
      if (p.isSimulation) setIsSimulation(true);
      if (typeof p.etaMinutes === 'number' && p.etaMinutes > 0) {
        setEtaEndMs(Date.now() + p.etaMinutes * 60_000);
      }
    };
    s.on('trip:status', onStatus);
    s.on('trip:location', onLocation);
    s.emit('trip:subscribe', requestId);
    return () => {
      s.off('trip:status', onStatus);
      s.off('trip:location', onLocation);
      s.emit('trip:unsubscribe', requestId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return undefined;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [requestId]);

  /* ----------------------------------------------------------- submit */
  async function submit() {
    if (!fix) {
      setError('Please share your location first.');
      return;
    }
    setPending(true);
    setError(null);
    setAuthNeeded(false);
    const res = await apiPost<{ request: { id: string; status: string }; matches: Match[] }>('/emergency', {
      pickupLatitude: Number(fix.lat.toFixed(6)),
      pickupLongitude: Number(fix.lng.toFixed(6)),
      pickupAccuracy: fix.accuracy ?? undefined,
      pickupObtainedAt: fix.obtainedAt,
      pickupAddress: address?.trim() || undefined,
      destinationFacilityId: destinationFacilityId || undefined,
      notes: notes.trim() || undefined,
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
    setStage('SEARCHING');
    if (m?.[0]) {
      const etaMin = Math.max(2, Math.round((m[0].distanceKm / 32) * 60));
      setEtaEndMs(Date.now() + etaMin * 60_000);
    }
    startPolling(request.id);
  }

  async function cancelRequest() {
    if (!requestId) return;
    setPending(true);
    setError(null);
    const res = await apiPost<{ id: string; status: string; state: string }>(`/emergency/${requestId}/cancel`, {
      reason: 'Cancelled by requester',
    });
    setPending(false);
    setAskingCancel(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setStage('CANCELLED');
  }

  /* ---------------------------------------------------------- derived */
  const distanceKm = useMemo(() => {
    if (liveLocation && fix) {
      const R = 6371;
      const dLat = ((liveLocation.latitude - fix.lat) * Math.PI) / 180;
      const dLng = ((liveLocation.longitude - fix.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((fix.lat * Math.PI) / 180) * Math.cos((liveLocation.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return Number((2 * R * Math.asin(Math.sqrt(a))).toFixed(2));
    }
    return matches[0]?.distanceKm ?? null;
  }, [liveLocation, fix, matches]);

  const etaMinutesLeft =
    etaEndMs && stage !== 'ARRIVED' && stage !== 'TRANSPORTING' && stage !== 'COMPLETED' && stage !== 'CANCELLED'
      ? Math.max(1, Math.ceil((etaEndMs - nowMs) / 60_000))
      : null;
  const stageIndex = STEPS.findIndex((s) => s.key === stage);
  const copy = COPY[stage];
  const assigned = stage === 'ASSIGNED' || stage === 'EN_ROUTE' || stage === 'ARRIVED' || stage === 'TRANSPORTING';
  const quality = accuracyQuality(fix?.accuracy ?? null);

  const ambulancePoint = liveLocation ? { lat: liveLocation.latitude, lng: liveLocation.longitude } : null;

  /* ================================================================ view */
  if (authNeeded) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-lift ring-1 ring-slate-200/70">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <IconShield size={22} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-ink">Sign in to request an ambulance</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Requests are tied to a verified account so dispatchers can reach you and keep an auditable record of the trip.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/login?next=/emergency" className="rounded-full bg-danger px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#c01039]">
            Sign in
          </a>
          <a href="/register" className="rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50">
            Create account
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="order-1">
        {!requestId && (
          <>
            {/* step 1 — location consent */}
            <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
              <StepTitle n={1} title="Confirm your location" done={!!fix} />
              {!fix && (
                <>
                  <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
                    <IconPin size={18} className="mt-0.5 shrink-0" />
                    <p className="leading-relaxed">
                      We need your current location to find and dispatch the nearest ambulance. This uses your phone&apos;s GPS
                      and is shared only with the responding crew.
                    </p>
                  </div>
                  <button
                    onClick={requestLocation}
                    disabled={locStatus === 'requesting'}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
                  >
                    {locStatus === 'requesting' ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <IconPin size={17} />
                    )}
                    {locStatus === 'requesting' ? 'Getting your location…' : 'Allow location access'}
                  </button>
                </>
              )}

              {fix && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                    <IconCheck size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Location found</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-brand-700/90">
                      <Badge tone={quality.tone}>
                        <StatusDot tone={quality.tone === 'danger' ? 'warning' : quality.tone} />
                        {fix.accuracy != null ? `±${fix.accuracy} m` : 'GPS fix'}
                      </Badge>
                      <span>{quality.text}</span>
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-muted">
                      {geocoding ? 'Looking up nearby address…' : address ?? 'Address not available — GPS point captured'}
                    </p>
                  </div>
                  <button
                    onClick={requestLocation}
                    className="ml-auto shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
                  >
                    Update
                  </button>
                </div>
              )}

              {locError && (
                <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                  <p className="font-medium">{locError}</p>
                  {locStatus === 'denied' && (
                    <p className="mt-1 text-[12.5px] text-amber-700/90">
                      Enable location for this site in your browser settings, then try again.
                    </p>
                  )}
                  <button onClick={requestLocation} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline">
                    <IconRefresh size={14} /> Try again
                  </button>
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
                        active ? 'border-danger/40 bg-danger-soft' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
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
                        priority === p.value ? 'bg-danger text-white' : 'bg-slate-100 text-ink-muted hover:bg-danger-soft hover:text-danger'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {facilities.length > 0 && (
                <div className="mt-5">
                  <label htmlFor="destination" className="mb-1.5 block text-sm font-semibold text-ink">
                    Preferred hospital <span className="font-normal text-ink-subtle">(optional)</span>
                  </label>
                  <select
                    id="destination"
                    value={destinationFacilityId}
                    onChange={(e) => setDestinationFacilityId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                  >
                    <option value="">Closest suitable facility</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} — {f.address}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* step 3 — confirm */}
            <section className="mt-4 rounded-3xl bg-gradient-to-br from-danger-soft to-white p-6 shadow-soft ring-1 ring-danger/15">
              <StepTitle n={3} title="Confirm and send" done={false} />
              <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                {fix ? (
                  <>
                    We will dispatch the nearest suitable ambulance to{' '}
                    <span className="font-semibold text-ink">{address ?? 'your GPS location'}</span> for a{' '}
                    <span className="font-semibold text-ink">{CATEGORIES.find((c) => c.value === category)?.label.toLowerCase()}</span> case marked{' '}
                    <span className="font-semibold text-danger">{PRIORITIES.find((p) => p.value === priority)?.label.toLowerCase()}</span>.
                  </>
                ) : (
                  'Confirm your location above to enable the request.'
                )}
              </p>
              <div className="mt-4">
                <label htmlFor="notes" className="mb-1.5 block text-sm font-semibold text-ink">
                  Notes for dispatch <span className="font-normal text-ink-subtle">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Symptoms, landmarks, patient details dispatchers should know…"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
              </div>
              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-medium text-danger ring-1 ring-danger/20">
                  {error}
                </p>
              )}
              <button
                onClick={() => void submit()}
                disabled={pending || !fix}
                className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-danger px-6 py-4 text-base font-bold text-white shadow-[0_18px_40px_-18px_rgba(225,29,72,0.9)] transition-all hover:bg-[#c01039] active:scale-[0.99] disabled:opacity-60"
              >
                {pending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <IconAmbulance size={22} />}
                {pending ? 'Sending request…' : 'Request ambulance'}
              </button>
              {!fix && <p className="mt-2 text-center text-[12.5px] text-ink-subtle">Location is required before you can send.</p>}
            </section>
          </>
        )}

        {/* ------------------------------------------------- tracking */}
        {requestId && (
          <section className={`rounded-3xl p-6 shadow-lift ring-1 ${copy.tone === 'stopped' ? 'bg-slate-50 ring-slate-200' : 'bg-white ring-slate-200/70'}`}>
            <div className="flex items-start gap-4">
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                  copy.tone === 'done' ? 'bg-success text-white' : copy.tone === 'stopped' ? 'bg-slate-300 text-white' : 'bg-danger text-white'
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isSimulation && <Badge tone="brand">Demo tracking</Badge>}
                  {liveUp && !['COMPLETED', 'CANCELLED'].includes(stage) && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-[12px] font-semibold text-success ring-1 ring-success/20">
                      <StatusDot tone="success" /> Live
                    </span>
                  )}
                  {pollFails > 2 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-200">
                      <IconRefresh size={13} /> Reconnecting…
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(assigned || etaMinutesLeft != null || distanceKm != null) && (
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
                  ) : matches[0]?.registrationNumber ? (
                    <p className="mt-1 text-[13px] text-brand-100">
                      {matches[0].registrationNumber} · {matches[0].type?.toLowerCase() ?? 'ambulance'}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-brand-100/80">Estimate based on straight-line distance.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                    {distanceKm != null ? 'Distance to pickup' : 'Pickup point'}
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink">{distanceKm != null ? `${distanceKm} km away` : address ?? 'GPS point'}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{address ?? 'Location captured'}</p>
                </div>
              </div>
            )}

            {stage !== 'CANCELLED' && (
              <ol className="mt-6 grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6">
                {STEPS.map((s, i) => {
                  const done = stageIndex >= 0 && i < stageIndex;
                  const active = stageIndex === i;
                  return (
                    <li key={s.key} className="flex items-center gap-3 py-1.5">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors ${
                          done ? 'bg-success text-white' : active ? 'bg-danger text-white' : 'bg-slate-200 text-ink-subtle'
                        }`}
                      >
                        {done ? <IconCheck size={14} /> : i + 1}
                      </span>
                      <span className={`text-sm ${active ? 'font-bold text-ink' : done ? 'text-ink-muted' : 'text-ink-subtle'}`}>{s.label}</span>
                      {i < STEPS.length - 1 && <span className={`hidden h-px flex-1 sm:block ${done ? 'bg-success/40' : 'bg-slate-200'}`} />}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {!['COMPLETED', 'CANCELLED'].includes(stage) && (
                <>
                  {askingCancel ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-2.5 ring-1 ring-slate-200">
                      <span className="text-sm font-semibold text-ink">Cancel this request?</span>
                      <button onClick={() => setAskingCancel(false)} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink-muted ring-1 ring-slate-200">
                        Keep
                      </button>
                      <button onClick={() => void cancelRequest()} disabled={pending} className="rounded-full bg-danger px-4 py-1.5 text-sm font-bold text-white disabled:opacity-60">
                        Yes, cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setAskingCancel(true)} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink-muted hover:border-danger/30 hover:text-danger">
                      Cancel request
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  setRequestId(null);
                  setFix(null);
                  setAddress(null);
                  setLocStatus('idle');
                  setLiveLocation(null);
                  setLiveUp(false);
                  setIsSimulation(false);
                  setEtaEndMs(null);
                }}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
              >
                New request
              </button>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
          </section>
        )}
      </div>

      {/* ------------------------------------------------------ map card */}
      <div className="order-2">
        <div className="overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-slate-200/70 lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <IconPin size={16} className="text-brand-600" />
              {requestId ? 'Live trip map' : 'Your pickup point'}
            </div>
            {isSimulation && <Badge tone="brand">Demo</Badge>}
          </div>
          <div className="h-64 w-full sm:h-72 lg:h-80">
            {fix || requestId ? (
              <EmergencyMap
                pickup={fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null}
                ambulance={ambulancePoint}
                className="h-full w-full"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-slate-50 px-6 text-center">
                <div className="max-w-xs">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                    <IconPin size={22} />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-ink">Map appears once your location is set</p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    We only plot your device GPS fix — never an IP-based guess.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 p-5">
            {requestId ? (
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger">
                  <IconClock size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">Tracking {requestId.slice(0, 8)}</p>
                  <p className="text-[13px] text-ink-muted">
                    {stage === 'EN_ROUTE' ? `Arriving in ~${etaMinutesLeft ?? '—'} min` : 'Status updates automatically'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Your GPS point and the assigned ambulance will appear here with live position updates during the trip.
              </p>
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
      <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? 'bg-success text-white' : 'bg-brand-600 text-white'}`}>
        {done ? <IconCheck size={14} /> : n}
      </span>
      <h2 className="text-base font-bold text-ink">{title}</h2>
    </div>
  );
}