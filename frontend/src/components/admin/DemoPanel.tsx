'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Badge, Button, StatusDot } from '@/components/ui';
import { IconAlert, IconAmbulance, IconCheck, IconRefresh, IconSpark } from '@/components/icons';
import { Card, SuccessNotice } from './ui';

type DemoStatus = {
  demoMode: boolean;
  seeded: boolean;
  counts: Record<string, number>;
  note: string;
};

type EmergencyItem = { id: string; state: string; category: string; priority: string; createdAt: string };

export default function DemoPanel() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'seed' | 'clear' | 'reset' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seed, setSeed] = useState<{ password: string; credentials: Record<string, string> } | null>(null);

  const [emergencies, setEmergencies] = useState<Array<{ id: string; label: string }>>([]);
  const [selected, setSelected] = useState('');
  const [simBusy, setSimBusy] = useState(false);
  const [active, setActive] = useState<{ tripId: string; etaMinutes: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<DemoStatus>('/admin/demo/status');
    setLoading(false);
    if (res.ok) setStatus(res.data);
    else setStatus(null);
  }, []);

  const loadEmergencies = useCallback(async () => {
    const res = await apiGet<{ items: EmergencyItem[] }>('/emergency?limit=50');
    if (!res.ok) return;
    const options = res.data.items
      .filter((e) => ['REQUESTED', 'SEARCHING', 'ASSIGNED', 'EN_ROUTE'].includes(e.state))
      .map((e) => ({ id: e.id, label: `${e.category.toLowerCase()} · ${e.priority.toLowerCase()} · ${e.id.slice(0, 8)}` }));
    setEmergencies(options);
    setSelected((prev) => prev || options[0]?.id || '');
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
      await loadEmergencies();
    })();
  }, [load, loadEmergencies]);

  async function act(kind: 'seed' | 'clear' | 'reset') {
    setBusy(kind);
    setNotice(null);
    setErr(null);
    const res = await apiPost<Record<string, unknown>>(`/admin/demo/${kind}`, {});
    setBusy(null);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    if (kind === 'seed' && res.data) {
      const d = res.data as unknown as { password?: string; credentials?: Record<string, string> };
      if (d.password && d.credentials) setSeed({ password: d.password, credentials: d.credentials });
    }
    setNotice(
      kind === 'seed'
        ? 'Demo dataset created.'
        : kind === 'reset'
          ? 'Demo dataset reset — cleared and re-seeded.'
          : 'Demo data cleared. Real records are untouched.',
    );
    await load();
    await loadEmergencies();
  }

  async function startSim() {
    if (!selected) return;
    setSimBusy(true);
    setNotice(null);
    setErr(null);
    const res = await apiPost<{ tripId: string; etaMinutes: number }>('/admin/demo/simulate/start', { emergencyRequestId: selected });
    setSimBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    setActive({ tripId: res.data.tripId, etaMinutes: res.data.etaMinutes });
    setNotice('Simulated dispatch started — open the emergency tracking view to watch it move.');
  }

  async function stopSim() {
    if (!active) return;
    setSimBusy(true);
    setErr(null);
    const res = await apiPost<{ stopped: boolean }>('/admin/demo/simulate/stop', { tripId: active.tripId });
    setSimBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    setActive(null);
    setNotice('Simulation stopped.');
  }

  if (loading && !status) {
    return <div className="h-40 animate-pulse rounded-3xl bg-slate-200/70" />;
  }

  const demoMode = status?.demoMode ?? false;
  const counts = status?.counts ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-lift">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15">
            <IconSpark size={20} />
          </span>
          <div>
            <p className="flex items-center gap-2 text-sm font-bold">
              Presentation mode
              <Badge tone={demoMode ? 'success' : 'neutral'}>{demoMode ? 'DEMO_MODE on' : 'DEMO_MODE off'}</Badge>
            </p>
            <p className="mt-1 max-w-xl text-[13px] text-white/80">
              Seed a fully synthetic dataset for demos and testing. Demo data is labelled in the ledger and can be cleared at any
              time without touching real records.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="dark"
          className="bg-white/15 hover:bg-white/25"
          onClick={() => void load()}
        >
          <IconRefresh size={14} /> Refresh
        </Button>
      </div>

      {!demoMode && (
        <div role="alert" className="flex items-start gap-2.5 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <IconAlert size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-[13px] text-amber-800">
            Ambulance simulation is disabled. Set <code className="rounded bg-white px-1">DEMO_MODE=true</code> in the backend
            environment to enable live simulated tracking. Seeding and clearing are still available.
          </p>
        </div>
      )}

      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      {err && (
        <div role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[13px] font-semibold text-danger ring-1 ring-danger/20">
          {err}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Demo dataset"
          description={status?.seeded ? 'A demo dataset is currently loaded.' : 'No demo dataset is currently loaded.'}
          actions={status?.seeded ? <StatusDot tone="success" /> : undefined}
        >
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" disabled={!!busy} onClick={() => void act('seed')}>
              {busy === 'seed' ? 'Seeding…' : 'Seed demo data'}
            </Button>
            <Button type="button" variant="secondary" disabled={!!busy} onClick={() => void act('reset')}>
              {busy === 'reset' ? 'Resetting…' : 'Reset (clear + seed)'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!!busy}
              className="text-danger ring-danger/20 hover:bg-danger-soft"
              onClick={() => void act('clear')}
            >
              {busy === 'clear' ? 'Clearing…' : 'Clear demo data'}
            </Button>
          </div>

          {Object.keys(counts).length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(counts)
                .filter(([, n]) => n > 0)
                .map(([key, n]) => (
                  <div key={key} className="rounded-2xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                    <p className="text-lg font-bold text-ink">{n}</p>
                    <p className="text-[11px] capitalize text-ink-muted">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</p>
                  </div>
                ))}
            </div>
          )}

          {seed && (
            <div className="mt-5 rounded-2xl bg-ink p-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Demo sign-in credentials</p>
              <p className="mt-1 text-[13px]">
                Password for every demo account: <span className="font-mono font-semibold">{seed.password}</span>
              </p>
              <ul className="mt-3 space-y-1 text-[13px] text-white/85">
                {Object.entries(seed.credentials).map(([role, email]) => (
                  <li key={role} className="flex items-center justify-between gap-3">
                    <span className="capitalize text-white/60">{role}</span>
                    <span className="font-mono">{email}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card
          title="Simulated dispatch"
          description="Drive a demo ambulance toward a pending emergency so tracking can be shown live. Requires DEMO_MODE."
        >
          <label htmlFor="sim-emergency" className="mb-1.5 block text-sm font-semibold text-ink">
            Emergency request
          </label>
          <select
            id="sim-emergency"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!demoMode || emergencies.length === 0}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 disabled:bg-slate-50"
          >
            {emergencies.length === 0 && <option value="">No pending emergencies</option>}
            {emergencies.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>

          <div className="mt-4 flex flex-wrap gap-2">
            {active ? (
              <Button type="button" variant="emergency" disabled={simBusy} onClick={() => void stopSim()}>
                <IconAmbulance size={16} /> {simBusy ? 'Stopping…' : 'Stop simulation'}
              </Button>
            ) : (
              <Button type="button" variant="primary" disabled={!demoMode || simBusy || !selected} onClick={() => void startSim()}>
                <IconAmbulance size={16} /> {simBusy ? 'Starting…' : 'Start demo tracking'}
              </Button>
            )}
            {active && (
              <Badge tone="warning">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
                </span>
                Simulating · ETA ~{active.etaMinutes} min
              </Badge>
            )}
          </div>

          <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-muted">
            <IconCheck size={15} className="text-brand-600" />
            Simulated trips are flagged <span className="font-semibold text-ink">isSimulation</span> and shown with a “Demo
            tracking” label — they never run when DEMO_MODE is off.
          </p>
        </Card>
      </div>
    </div>
  );
}