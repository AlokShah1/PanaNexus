'use client';

import { useEffect, useState } from 'react';

type Doctor = { id: string; name: string | null; specialization: string | null; facility?: { name: string } | null };

export default function BookAppointmentForm() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch('/api/doctors').then((r) => r.json()).then((j) => {
      if (j?.success) setDoctors(j.data);
    }).catch(() => setError('Could not load doctors.'));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null); setError(null); setPending(true);
    try {
      const payload = { doctorId, startsAt: startsAt ? new Date(startsAt).toISOString() : '', notes: notes || undefined };
      const res = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setError(j?.error?.message ?? 'Booking failed.'); return; }
      setMsg('Appointment requested.');
      setStartsAt(''); setNotes('');
    } catch { setError('Network error.'); } finally { setPending(false); }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Book an appointment</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Doctor</span>
        <select required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Select a doctor</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name ?? 'Doctor'} · {d.specialization ?? 'General'}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Date & time</span>
        <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      <button disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Booking…' : 'Book'}
      </button>
    </form>
  );
}
