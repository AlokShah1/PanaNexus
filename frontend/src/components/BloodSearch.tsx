'use client';

import { useState } from 'react';
import { apiGet } from '@/lib/api';
import { Badge, StatusDot } from '@/components/ui';
import { IconDroplet, IconRefresh } from '@/components/icons';

const GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;

type Availability = { id: string; bloodGroup: string; units: number; facility: { id: string; name: string } | null };

export default function BloodSearch() {
  const [group, setGroup] = useState('');
  const [rows, setRows] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    setSearched(true);
    const qs = group ? `?bloodGroup=${encodeURIComponent(group)}` : '';
    const res = await apiGet<Availability[]>(`/blood/availability${qs}`);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      setRows([]);
      return;
    }
    setRows(res.data);
  }

  function statusFor(units: number) {
    if (units <= 0) return { tone: 'danger' as const, label: 'Unavailable' };
    if (units < 3) return { tone: 'warning' as const, label: 'Low' };
    return { tone: 'success' as const, label: 'Available' };
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* group picker */}
      <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
        <h2 className="text-base font-bold text-ink">Choose a blood group</h2>
        <p className="mt-1 text-[13px] text-ink-muted">Availability updates as reported by each facility.</p>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {GROUPS.map((g) => {
            const active = group === g;
            return (
              <button
                key={g}
                onClick={() => setGroup(g)}
                aria-pressed={active}
                className={`rounded-2xl py-3 text-sm font-bold transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-br from-danger to-brand-600 text-white shadow-[0_10px_22px_-12px_rgba(225,29,72,0.9)]'
                    : 'bg-slate-100 text-ink-muted hover:bg-danger-soft hover:text-danger'
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>

        <button
          onClick={search}
          disabled={loading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <IconDroplet size={16} />
          )}
          Check availability
        </button>

        <div className="mt-5 rounded-2xl bg-brand-50 p-4 text-[13px] leading-relaxed text-brand-900">
          PanaNexus coordinates information between facilities and donors. Transfusion eligibility is always decided
          by licensed professionals.
        </div>
      </div>

      {/* results */}
      <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">
            {group ? `Availability for ${group}` : 'All reported availability'}
          </h2>
          {searched && (
            <Badge tone="neutral">
              <StatusDot tone="success" />
              {rows.length} source{rows.length === 1 ? '' : 's'}
            </Badge>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
            <p className="text-sm font-medium text-ink-muted">{error}</p>
            <button
              onClick={() => search()}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <IconRefresh size={15} /> Try again
            </button>
          </div>
        )}

        {!error && rows.length > 0 && (
          <ul className="mt-5 space-y-2.5">
            {rows.map((r) => {
              const s = statusFor(r.units);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-danger to-brand-600 text-sm font-bold text-white">
                      {r.bloodGroup}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{r.facility?.name ?? 'Facility'}</p>
                      <p className="text-[13px] text-ink-muted">{r.units} units reported</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={s.tone}>
                      <StatusDot tone={s.tone === 'danger' ? 'danger' : s.tone === 'warning' ? 'warning' : 'success'} />
                      {s.label}
                    </Badge>
                    <a
                      href="/organ-donation"
                      className="rounded-full bg-slate-100 px-3.5 py-1.5 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      Register as donor
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!error && searched && rows.length === 0 && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft">
              <IconDroplet size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-ink">No availability reported yet</p>
            <p className="mt-1 text-[13px] text-ink-muted">Register as a donor so facilities can contact you.</p>
          </div>
        )}

        {!searched && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-10 text-center">
            <p className="text-sm font-semibold text-ink">Select a blood group to check availability</p>
            <p className="mt-1 text-[13px] text-ink-muted">Results come from facilities that report their stock.</p>
          </div>
        )}
      </div>
    </div>
  );
}