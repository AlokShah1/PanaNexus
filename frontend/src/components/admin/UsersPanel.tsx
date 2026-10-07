'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, type Paginated } from '@/lib/api';
import { roleLabel } from '@/lib/format';
import { Badge, Button } from '@/components/ui';
import { IconSearch, IconUsers } from '@/components/icons';
import { Card, Empty, ErrorBanner, Pager, Skeleton, SuccessNotice, fmtDateTime, type ApiError } from './ui';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  verificationStatus: string;
  phone: string | null;
  facilityId: string | null;
  createdAt: string;
};

const ROLES = ['', 'PATIENT', 'DOCTOR', 'FACILITY_STAFF', 'AMBULANCE_OPERATOR', 'BLOOD_DONOR', 'ORGAN_DONOR', 'ADMIN'];
const STATUSES = ['', 'VERIFIED', 'PENDING', 'REJECTED', 'SUSPENDED'];

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
};

type Pending = { id: string; action: 'suspend' | 'unsuspend' } | null;

export default function UsersPanel() {
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [meta, setMeta] = useState<Paginated<UserRow>['meta'] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (appliedQuery.trim()) params.set('q', appliedQuery.trim());
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    const res = await apiGet<Paginated<UserRow>>(`/admin/users?${params.toString()}`);
    if (!res.ok) {
      setError(res);
      setRows(null);
      setMeta(null);
      return;
    }
    setRows(res.data.items);
    setMeta(res.data.meta);
  }, [page, appliedQuery, role, status]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function submit(user: UserRow) {
    if (pending?.action === 'suspend' && !reason.trim()) {
      setError({ status: 422, message: 'A reason is required to suspend an account.' });
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res =
      pending?.action === 'suspend'
        ? await apiPost<{ id: string }>(`/admin/users/${user.id}/suspend`, { reason: reason.trim() })
        : await apiPost<{ id: string }>(`/admin/users/${user.id}/unsuspend`, {});
    setBusy(false);
    if (!res.ok) {
      setError(res);
      return;
    }
    setPending(null);
    setReason('');
    setNotice(
      pending?.action === 'suspend' ? `${user.name} is suspended.` : `${user.name} can use their account again.`,
    );
    await load();
  }

  return (
    <Card title="Users" description="Search every account and manage access.">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setAppliedQuery(query);
        }}
      >
        <div className="relative min-w-[220px] flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search users by name or email"
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          aria-label="Filter users by role"
          className="rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r ? roleLabel(r) : 'All roles'}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter users by verification status"
          className="rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All statuses'}
            </option>
          ))}
        </select>
        <Button type="submit" variant="dark" className="px-5 py-2.5 text-xs">
          Search
        </Button>
      </form>

      <div className="mt-5 space-y-4">
        {notice && <SuccessNotice>{notice}</SuccessNotice>}
        {error && <ErrorBanner error={error} onRetry={() => void load()} />}
        {!rows && !error && <Skeleton rows={5} />}
        {rows && rows.length === 0 && (
          <Empty title="No users match these filters" hint="Try a different search term or clear the filters." icon={<IconUsers size={20} />} />
        )}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th scope="col" className="py-2 pr-4 font-semibold">Account</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Role</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Joined</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-ink">{user.name}</p>
                      <p className="text-[13px] text-ink-muted">{user.email}</p>
                      {user.phone && <p className="text-[12px] text-ink-subtle">{user.phone}</p>}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone="neutral">{roleLabel(user.role)}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={STATUS_TONE[user.verificationStatus] ?? 'neutral'}>
                        {user.verificationStatus.charAt(0) + user.verificationStatus.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-[13px] text-ink-muted">{fmtDateTime(user.createdAt)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-2">
                        {user.verificationStatus === 'SUSPENDED' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3.5 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => {
                              setPending({ id: user.id, action: 'unsuspend' });
                              setReason('');
                              setError(null);
                            }}
                            aria-label={`Restore ${user.name}`}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="emergency"
                            className="px-3.5 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => {
                              setPending({ id: user.id, action: 'suspend' });
                              setReason('');
                              setError(null);
                            }}
                            aria-label={`Suspend ${user.name}`}
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                      {pending && pending.id === user.id && (
                        <div className="mt-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                          {pending.action === 'suspend' ? (
                            <>
                              <label htmlFor={`suspend-${user.id}`} className="text-[12px] font-bold text-ink">
                                Reason for suspension
                              </label>
                              <textarea
                                id={`suspend-${user.id}`}
                                rows={2}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                                placeholder="Sent to the account owner."
                              />
                            </>
                          ) : (
                            <p className="text-[13px] text-ink-muted">
                              Restore {user.name}&apos;s account? Their previous status is applied again.
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              className="px-3.5 py-1.5 text-xs"
                              disabled={busy || (pending.action === 'suspend' && !reason.trim())}
                              onClick={() => void submit(user)}
                            >
                              {busy ? 'Working…' : pending.action === 'suspend' ? 'Confirm suspension' : 'Confirm restore'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="px-3.5 py-1.5 text-xs"
                              onClick={() => {
                                setPending(null);
                                setReason('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} meta={meta} onPage={setPage} busy={!rows} />
      </div>
    </Card>
  );
}
