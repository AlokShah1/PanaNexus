'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { Empty, ErrorBanner, Skeleton, type ApiError } from '@/components/dashboard/ui';
import { IconBell } from '@/components/icons';

type Notification = { id: string; type: string; title: string; body: string | null; link?: string | null; read: boolean; createdAt: string };

export default function NotificationsPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(() => Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(() => {
    Promise.all([
      apiGet<Notification[]>('/notifications?limit=30'),
      apiGet<{ count: number }>('/notifications/unread-count'),
    ])
      .then(([list, unread]) => {
        if (!list.ok) {
          setError({ status: list.status, code: list.code, message: list.message });
          setLoading(false);
          return;
        }
        setItems(list.data);
        if (unread.ok) setUnreadCount(unread.data.count);
        setLoading(false);
      })
      .catch(() => {
        setError({ status: 0, message: 'Something went wrong while loading.' });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function retry() {
    setLoading(true);
    setError(null);
    load();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      apiGet<Notification[]>('/notifications?limit=30')
        .then((r) => {
          if (r.ok) setItems(r.data);
        })
        .catch(() => undefined);
      apiGet<{ count: number }>('/notifications/unread-count')
        .then((r) => {
          if (r.ok) setUnreadCount(r.data.count);
        })
        .catch(() => undefined);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function markRead(id: string) {
    setActionError(null);
    const r = await apiPost<{ id: string }>(`/notifications/${id}/read`, {});
    if (!r.ok) {
      setActionError(r.message);
      return;
    }
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    setActionError(null);
    const r = await apiPost<{ updated: number }>('/notifications/read-all', {});
    if (!r.ok) {
      setActionError(r.message);
      return;
    }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  function handleItemClick(n: Notification) {
    if (n.link && n.link.startsWith('/')) {
      router.push(n.link);
    }
  }

  if (loading) return <Skeleton rows={4} />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;
  if (items.length === 0) {
    return <Empty icon={<IconBell />} title="No notifications yet" hint="Updates about your requests and appointments will appear here." />;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {actionError && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700 ring-1 ring-red-200">
          {actionError}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Unread: {unreadCount}</span>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-brand-600 underline hover:text-brand-700">
            Mark all read
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-md border p-4 ${n.read ? 'border-slate-200 bg-white' : 'border-slate-300 bg-slate-50'}`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">{n.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{relativeTime(n.createdAt)}</span>
                {!n.read && (
                  <button onClick={() => markRead(n.id)} className="text-xs text-slate-600 underline hover:text-slate-700">
                    Mark read
                  </button>
                )}
              </div>
            </div>
            {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
            {n.link && n.link.startsWith('/') && (
              <button onClick={() => handleItemClick(n)} className="mt-2 text-xs text-brand-600 underline hover:text-brand-700">
                View details
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
