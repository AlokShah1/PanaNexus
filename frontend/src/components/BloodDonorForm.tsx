'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { apiGet, apiPost } from '@/lib/api';

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export default function BloodDonorForm() {
  const { status } = useSession();
  const [bloodGroup, setBloodGroup] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    if (status !== 'authed') return;
    apiGet<{ id: string; bloodGroup: string; isAvailable: boolean; lastDonationDate?: string | null } | null>('/donors/blood')
      .then((r) => {
        if (r.ok && r.data) {
          setHasProfile(true);
          setBloodGroup(r.data.bloodGroup);
          setIsAvailable(r.data.isAvailable);
          if (r.data.lastDonationDate) {
            try {
              const d = new Date(r.data.lastDonationDate);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              setLastDonationDate(`${y}-${m}-${day}`);
            } catch {
              /* ignore */
            }
          }
        }
      })
      .catch(() => undefined);
  }, [status]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setPending(true);
    const res = await apiPost<{ id: string }>('/donors/blood', {
      bloodGroup,
      isAvailable,
      lastDonationDate: lastDonationDate || undefined,
    });
    if (!res.ok) {
      setError(res.message);
      setPending(false);
      return;
    }
    setMsg('Blood donor profile saved.');
    setHasProfile(true);
    setPending(false);
  }

  async function toggleAvailability() {
    setPending(true);
    const res = await apiPost<{ id: string; isAvailable: boolean }>('/donors/blood/availability', { isAvailable: !isAvailable });
    if (!res.ok) {
      setError(res.message);
      setPending(false);
      return;
    }
    setIsAvailable(res.data.isAvailable);
    setMsg(`Availability ${res.data.isAvailable ? 'enabled' : 'disabled'}.`);
    setPending(false);
  }

  if (status !== 'authed') {
    return (
      <div className="flex max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Register as blood donor</h2>
        <p className="text-sm text-ink-muted">Sign in to register as a donor.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Register as blood donor</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Blood group</span>
        <select
          required
          value={bloodGroup}
          onChange={(e) => setBloodGroup(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        Available to donate
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Last donation date</span>
        <input
          type="date"
          value={lastDonationDate}
          onChange={(e) => setLastDonationDate(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? 'Saving…' : hasProfile ? 'Update' : 'Save'}
        </button>
        {hasProfile && (
          <button
            type="button"
            onClick={toggleAvailability}
            disabled={pending}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {isAvailable ? 'Mark unavailable' : 'Mark available'}
          </button>
        )}
      </div>
    </form>
  );
}
