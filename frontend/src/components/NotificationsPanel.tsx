'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

type Notification = { id: string; type: string; title: string; body: string | null; read: boolean; createdAt: string };

export default function NotificationsPanel() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<Notification[]>('/notifications').then((r) => { if (active) { if (!r.ok) setError(r.message); else setItems(r.data); } }).catch(() => { if (active) setError('Something went wrong while loading.'); });
    return () => { active = false; };
  }, []);

  async function markRead(id: string) {
    try {
      await apiPost<{ id: string }>(`/notifications/${id}/read`, {});
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch { /* ignore */ }
  }

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-slate-600">No notifications.</p>;
  return (
    <ul className="flex max-w-2xl flex-col gap-3">
      {items.map((n) => (
        <li key={n.id} className={`rounded-md border p-4 ${n.read ? 'border-slate-200 bg-white' : 'border-slate-300 bg-slate-50'}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-900">{n.title}</p>
            {!n.read && <button onClick={() => markRead(n.id)} className="text-xs text-slate-600 underline">Mark read</button>}
          </div>
          {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
        </li>
      ))}
    </ul>
  );
}
