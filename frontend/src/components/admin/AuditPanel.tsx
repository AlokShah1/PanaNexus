'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, type Paginated } from '@/lib/api';
import { Badge, Button } from '@/components/ui';
import { IconClipboard, IconRefresh } from '@/components/icons';
import { Card, Empty, ErrorBanner, Pager, Skeleton, fmtDateTime, type ApiError } from './ui';

type AuditRow = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: unknown;
  actor: { id: string; name: string; email: string } | null;
  createdAt: string;
};

function metadataText(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return '—';
  const text = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export default function AuditPanel() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [meta, setMeta] = useState<Paginated<AuditRow>['meta'] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await apiGet<Paginated<AuditRow>>(`/admin/audit?page=${page}&limit=30`);
    if (!res.ok) {
      setError(res);
      setRows(null);
      setMeta(null);
      return;
    }
    setRows(res.data.items);
    setMeta(res.data.meta);
  }, [page]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <Card
      title="Audit log"
      description="Every sensitive action recorded against the platform."
      actions={
        <Button type="button" variant="secondary" className="px-4 py-2 text-xs" onClick={() => void load()}>
          <IconRefresh size={14} /> Refresh
        </Button>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner error={error} onRetry={() => void load()} />}
        {!rows && !error && <Skeleton rows={6} />}
        {rows && rows.length === 0 && (
          <Empty title="No audit events yet" hint="Actions like approvals and suspensions show up here." icon={<IconClipboard size={20} />} />
        )}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th scope="col" className="py-2 pr-4 font-semibold">Action</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Target</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Actor</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Details</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-3 pr-4">
                      <Badge tone={row.action.includes('SUSPEND') || row.action.includes('REJECT') ? 'danger' : 'brand'}>
                        {row.action.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-[13px] text-ink-muted">
                      {row.entity ?? '—'}
                      {row.entityId ? <span className="block max-w-[140px] truncate text-[12px] text-ink-subtle">{row.entityId}</span> : null}
                    </td>
                    <td className="py-3 pr-4 text-[13px]">
                      <span className="font-semibold text-ink">{row.actor?.name ?? 'System'}</span>
                      {row.actor?.email && <span className="block text-[12px] text-ink-subtle">{row.actor.email}</span>}
                    </td>
                    <td className="max-w-[260px] py-3 pr-4 break-words text-[12px] text-ink-muted">{metadataText(row.metadata)}</td>
                    <td className="py-3 pr-4 text-[13px] text-ink-muted">{fmtDateTime(row.createdAt)}</td>
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
