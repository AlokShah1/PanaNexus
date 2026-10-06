'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';

export default function EmergencyRequestForm() {
  const [priority, setPriority] = useState('HIGH');
  const [category, setCategory] = useState('GENERAL');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<{ id: string; distanceKm: number }[]>([]);
  const [pending, setPending] = useState(false);

  function locate() {
    setGeoMsg('Getting your location…');
    if (!('geolocation' in navigator)) {
      setGeoMsg('Location is not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setGeoMsg(null);
        setError(null);
      },
      () => setGeoMsg("We couldn't access your location. Try again or enter manually below."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setMsg(null); setMatches([]);
    if (!lat || !lng || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      setError('Please share your location first.');
      return;
    }
    setPending(true);
    const res = await apiPost<{ request: { id: string; status: string }; matches: { id: string; distanceKm: number }[] }>(
      '/emergency',
      { pickupLatitude: Number(lat), pickupLongitude: Number(lng), category, priority },
    );
    setPending(false);
    if (!res.ok) { setError(res.message); return; }
    setMsg(`Request ${res.data.request.id} created (${res.data.request.status}).`);
    setMatches(res.data.matches ?? []);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Request ambulance</h2>

      <button type="button" onClick={locate} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800">
        Use my current location
      </button>
      {geoMsg && <p className="text-sm text-slate-600">{geoMsg}</p>}

      {lat && lng && !showManual && (
        <p className="text-sm text-slate-700">📍 {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</p>
      )}

      <button type="button" onClick={() => setShowManual((v) => !v)} className="text-sm text-slate-600 underline">
        {showManual ? 'Hide location entry' : 'Enter location manually'}
      </button>
      {showManual && (
        <div className="grid grid-cols-2 gap-3">
          <input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Priority</span>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">What is happening?</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option>ACCIDENT</option><option>CARDIAC</option><option>GENERAL</option><option>OTHER</option>
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {matches.length > 0 && (
        <ul className="text-sm text-slate-700">
          {matches.map((m) => <li key={m.id}>Ambulance {m.id.slice(0, 8)} — {m.distanceKm} km</li>)}
        </ul>
      )}
      <button disabled={pending} className="rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Sending…' : '🚑 Request ambulance'}
      </button>
    </form>
  );
}
