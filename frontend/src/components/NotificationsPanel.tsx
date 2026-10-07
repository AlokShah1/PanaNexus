'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { relativeTime } from '@/lib/format';

type Notification = { id: string; type: string; title: string; body: string | null; link?: string | null; read: boolean; createdAt: string };

export default function NotificationsPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(() => Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    apiGet<Notification[]>('/notifications?limit=30')
      .then((r) => {
        if (active) {
          if (!r.ok) setError(r.message);
          else setItems(r.data);
        }
      })
      .catch(() => {
        if (active) setError('Something went wrong while loading.');
      });
    apiGet<{ count: number }>('/notifications/unread-count')
      .then((r) => {
        if (active && r.ok) setUnreadCount(r.data.count);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
    return () => {
      clearInterval(interval);
    };
  }, []);

  async function markRead(id: string) {
    try {
      await apiPost<{ id: string }>(`/notifications/${id}/read`, {});
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  }

  async function markAllRead() {
    try {
      await apiPost<{ updated: number }>('/notifications/read-all', {});
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  }

  function handleItemClick(n: Notification) {
    if (n.link && n.link.startsWith('/')) {
      router.push(n.link);
    }
  }

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-slate-600">No notifications.</p>;
  return (
    <div className="flex max-w-2xl flex-col gap-4">
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
