'use client';

import { useState } from 'react';

export default function OrganDonorForm() {
  const [organs, setOrgans] = useState('');
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMsg(null); setPending(true);
    const organsArr = organs.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/donors/organ', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organs: organsArr, consent }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error?.message ?? 'Failed.'); return; }
      setMsg('Organ donor registration saved.');
    } catch { setError('Network error.'); } finally { setPending(false); }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Register as organ donor</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Organs (comma separated)</span>
        <input required value={organs} onChange={(e) => setOrgans(e.target.value)} placeholder="kidney, liver" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I consent to organ donation
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      <button disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
