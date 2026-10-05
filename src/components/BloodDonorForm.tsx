'use client';

import { useState } from 'react';

export default function BloodDonorForm() {
  const [bloodGroup, setBloodGroup] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMsg(null); setPending(true);
    try {
      const res = await fetch('/api/donors/blood', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloodGroup, isAvailable, lastDonationDate: lastDonationDate || undefined }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error?.message ?? 'Failed.'); return; }
      setMsg('Blood donor profile saved.');
    } catch { setError('Network error.'); } finally { setPending(false); }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Register as blood donor</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Blood group</span>
        <input required value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="O+" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} /> Available to donate
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Last donation date</span>
        <input type="date" value={lastDonationDate} onChange={(e) => setLastDonationDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      <button disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
