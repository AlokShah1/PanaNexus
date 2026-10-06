'use client';

import { useState } from 'react';
import { apiGet } from '@/lib/api';

type Availability = { id: string; bloodGroup: string; units: number; facility: { id: string; name: string } | null };

export default function BloodSearch() {
  const [bloodGroup, setBloodGroup] = useState('');
  const [rows, setRows] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setRows([]); setLoading(true);
    const qs = bloodGroup ? `?bloodGroup=${encodeURIComponent(bloodGroup)}` : '';
    const res = await apiGet<Availability[]>(`/blood/availability${qs}`);
    setLoading(false);
    if (!res.ok) { setError(res.message); return; }
    setRows(res.data);
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <form onSubmit={search} className="flex gap-2">
        <input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="Blood group (e.g. O+)" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={loading} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? '…' : 'Search'}</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {rows.length > 0 && (
        <ul className="text-sm text-slate-700">
          {rows.map((r) => (
            <li key={r.id}>{r.facility?.name ?? 'Facility'} — {r.bloodGroup}: {r.units} units</li>
          ))}
        </ul>
      )}
      {rows.length === 0 && !loading && !error && <p className="text-sm text-slate-500">No results yet.</p>}
    </div>
  );
}
