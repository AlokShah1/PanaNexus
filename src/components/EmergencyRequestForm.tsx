'use client';

import { useState } from 'react';

export default function EmergencyRequestForm() {
  const [priority, setPriority] = useState('HIGH');
  const [category, setCategory] = useState('GENERAL');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<{ id: string; distanceKm: number }[]>([]);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setMsg(null); setMatches([]); setPending(true);
    try {
      const res = await fetch('/api/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupLatitude: Number(lat), pickupLongitude: Number(lng), category, priority }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error?.message ?? 'Request failed.'); return; }
      setMsg(`Request ${j.data.request.id} created (${j.data.request.status}).`);
      setMatches(j.data.matches ?? []);
    } catch { setError('Network error.'); } finally { setPending(false); }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Request ambulance</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Priority</span>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option>ACCIDENT</option><option>CARDIAC</option><option>GENERAL</option><option>OTHER</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Pickup latitude</span>
        <input required inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Pickup longitude</span>
        <input required inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {matches.length > 0 && (
        <ul className="text-sm text-slate-700">
          {matches.map((m) => <li key={m.id}>Ambulance {m.id.slice(0, 8)} — {m.distanceKm} km</li>)}
        </ul>
      )}
      <button disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Sending…' : 'Request'}
      </button>
    </form>
  );
}
