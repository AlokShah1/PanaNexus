'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiFetch, apiGet } from '@/lib/api';
import { Button } from '@/components/ui';
import { IconBolt } from '@/components/icons';
import { Card, ErrorBanner, Skeleton, SuccessNotice, type ApiError } from './ui';

type SettingsBody = { settings: Record<string, string> };

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

export default function SettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [emergencyDispatchPhone, setEmergencyDispatchPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiGet<SettingsBody>('/admin/settings');
    setLoading(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    const settings = res.data.settings ?? {};
    setMaintenanceMode(settings.maintenanceMode === 'true');
    setSupportEmail(settings.supportEmail ?? '');
    setEmergencyDispatchPhone(settings.emergencyDispatchPhone ?? '');
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (supportEmail.trim() && !isValidEmail(supportEmail.trim())) {
      setError({ status: 422, message: 'Support email does not look like a valid address.' });
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await apiFetch<SettingsBody>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        settings: {
          maintenanceMode: String(maintenanceMode),
          supportEmail: supportEmail.trim(),
          emergencyDispatchPhone: emergencyDispatchPhone.trim(),
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    setNotice('Settings saved.');
  }

  return (
    <Card title="Platform settings" description="Controls stored in the PlatformSetting table.">
      <div className="space-y-4">
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} />}
        {loading && <Skeleton rows={3} />}
        {!loading && (
          <form onSubmit={save} className="space-y-4">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--brand-600)]"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">Maintenance mode</span>
                <span className="mt-0.5 block text-[13px] text-ink-muted">
                  Store the maintenance flag as <code className="text-ink-subtle">maintenanceMode=true</code>.
                </span>
              </span>
            </label>

            <div>
              <label htmlFor="support-email" className="text-[13px] font-bold text-ink">
                Support email
              </label>
              <input
                id="support-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@pananexus.example"
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>

            <div>
              <label htmlFor="dispatch-phone" className="text-[13px] font-bold text-ink">
                Emergency dispatch phone
              </label>
              <input
                id="dispatch-phone"
                type="tel"
                value={emergencyDispatchPhone}
                onChange={(e) => setEmergencyDispatchPhone(e.target.value)}
                placeholder="+91 11 2345 6789"
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
              />
              <p className="mt-1 text-[12px] text-ink-subtle">Shown to users during an emergency request.</p>
            </div>

            <Button type="submit" disabled={saving} className="px-5 py-2.5 text-sm">
              <IconBolt size={15} /> {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
