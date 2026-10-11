'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Badge, Button, StatusDot } from '@/components/ui';
import { IconAlert, IconAmbulance, IconCheck, IconRefresh, IconSpark } from '@/components/icons';
import { Card, SuccessNotice } from '@/components/dashboard/ui';

type DemoStatus = {
  demoMode: boolean;
  seeded: boolean;
  counts: Record<string, number>;
  note: string;
};

type EmergencyItem = { id: string; state: string; category: string; priority: string; createdAt: string };

type Simulation = {
  tripId: string;
  ambulanceId: string;
  emergencyRequestId: string;
  state: 'running' | 'paused' | 'arrived';
  etaMinutes: number;
  progressPercent: number;
  distanceKm: number;
  approximate: boolean;
};

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
  const [sims, setSims] = useState<Simulation[]>([]);

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

  const loadSims = useCallback(async () => {
    const res = await apiGet<{ simulations: Simulation[] }>('/admin/demo/simulations');
    if (res.ok) setSims(res.data.simulations);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
      await loadEmergencies();
      await loadSims();
    })();
  }, [load, loadEmergencies, loadSims]);

  useEffect(() => {
    if (sims.length === 0) return;
    const id = window.setInterval(() => void loadSims(), 3000);
    return () => window.clearInterval(id);
  }, [sims.length, loadSims]);

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
    await loadSims();
  }

  async function startSim() {
    if (!selected) return;
    setSimBusy(true);
    setNotice(null);
    setErr(null);
    const res = await apiPost<{ tripId: string; etaMinutes: number; approximate: boolean; alreadyRunning: boolean }>(
      '/admin/demo/simulate/start',
      { emergencyRequestId: selected },
    );
    setSimBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    await loadSims();
    setNotice(
      res.data.approximate
        ? 'Simulated dispatch started (straight-line estimate — routing unavailable). Open the emergency tracking view to watch it move.'
        : 'Simulated dispatch started — open the emergency tracking view to watch it move.',
    );
  }

  async function control(action: 'pause' | 'resume' | 'stop' | 'reset', tripId: string) {
    setSimBusy(true);
    setNotice(null);
    setErr(null);
    const res = await apiPost<Record<string, boolean>>(`/admin/demo/simulate/${action}`, { tripId });
    setSimBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    await loadSims();
    if (action === 'reset') setNotice('Simulation reset — ambulance released and request reopened.');
    else if (action === 'stop') setNotice('Simulation stopped.');
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
            <p className="mt-1 text-[13px] text-white/80">
              Seeded demo records are synthetic and clearly flagged. Real records are never touched.
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" className="bg-white/15 text-white ring-white/20 hover:bg-white/25" onClick={() => void load()}>
          <IconRefresh size={16} /> Refresh
        </Button>
      </div>

      {!demoMode && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-warning ring-1 ring-warning/20">
          <IconAlert size={18} />
          <p className="text-[13px] font-semibold">
            Demo tooling is disabled. Set <code className="rounded bg-white/60 px-1">DEMO_MODE=true</code> in the backend env to
            enable seeding and simulated tracking.
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
            <Button type="button" variant="primary" disabled={!demoMode || simBusy || !selected} onClick={() => void startSim()}>
              <IconAmbulance size={16} /> {simBusy ? 'Working…' : 'Start demo tracking'}
            </Button>
          </div>

          {sims.length > 0 && (
            <ul className="mt-4 space-y-2">
              {sims.map((sim) => (
                <li key={sim.tripId} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={sim.state === 'paused' ? 'warning' : 'success'}>
                        {sim.state === 'paused' ? 'Paused' : 'Simulating'}
                      </Badge>
                      <span className="text-[13px] font-semibold text-ink">ETA ~{sim.etaMinutes} min</span>
                      <span className="text-[12px] text-ink-muted">{sim.progressPercent}%</span>
                    </div>
                    <span className="font-mono text-[11px] text-ink-muted">{sim.tripId.slice(0, 8)}</span>
                  </div>
                  {sim.approximate && (
                    <p className="mt-1 text-[11px] font-semibold text-warning">Straight-line estimate — road routing unavailable.</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sim.state === 'paused' ? (
                      <Button type="button" variant="secondary" disabled={simBusy} onClick={() => void control('resume', sim.tripId)}>
                        Resume
                      </Button>
                    ) : (
                      <Button type="button" variant="secondary" disabled={simBusy} onClick={() => void control('pause', sim.tripId)}>
                        Pause
                      </Button>
                    )}
                    <Button type="button" variant="secondary" disabled={simBusy} onClick={() => void control('stop', sim.tripId)}>
                      Stop
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={simBusy}
                      className="text-danger ring-danger/20 hover:bg-danger-soft"
                      onClick={() => void control('reset', sim.tripId)}
                    >
                      Reset
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

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
