'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { apiGet, apiPost, type Paginated } from '@/lib/api';
import { IconChat, IconRefresh, IconSend } from '@/components/icons';
import { Card, Empty } from '@/components/facility/ui';
import { getRealtime } from '@/lib/realtime';
import { relativeTime } from '@/lib/format';
import { MAX_MESSAGE_LENGTH, type ChatMessage, type ConversationSummary, type ProviderOption } from '@/lib/messages';

export default function Inbox({ role }: { role: string }) {
  const isPatient = role === 'PATIENT';

  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatMessage[] | null>(null);
  const [counterpart, setCounterpart] = useState<ConversationSummary['counterpart'] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [newTarget, setNewTarget] = useState('');
  const [starting, setStarting] = useState(false);

  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadConversations = useCallback(async () => {
    const res = await apiGet<{ items: ConversationSummary[] }>('/messages/conversations');
    if (!res.ok) {
      setError(res.message);
      return null;
    }
    setConversations(res.data.items);
    return res.data.items;
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const res = await apiGet<{ items: ChatMessage[]; counterpart: ConversationSummary['counterpart'] }>(
      `/messages/conversations/${id}/messages`,
    );
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setThread(res.data.items);
    setCounterpart(res.data.counterpart);
    await apiPost(`/messages/conversations/${id}/read`, {});
    setConversations((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) : prev));
  }, []);

  useEffect(() => {
    void (async () => {
      const items = await loadConversations();
      if (items && items.length > 0) setActiveId((cur) => cur ?? items[0].id);
    })();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    void (async () => {
      await loadThread(activeId);
    })();
  }, [activeId, loadThread]);

  useEffect(() => {
    const socket = getRealtime();
    if (!socket) return;
    const onMessage = (payload: { conversationId?: string }) => {
      void loadConversations();
      if (payload?.conversationId && payload.conversationId === activeIdRef.current) {
        void loadThread(payload.conversationId);
      }
    };
    socket.on('message', onMessage);
    return () => {
      socket.off('message', onMessage);
    };
  }, [loadConversations, loadThread]);

  useEffect(() => {
    void (async () => {
      if (isPatient) {
        const res = await apiGet<ProviderOption[]>('/doctors');
        if (res.ok) setProviders(res.data.map((d) => ({ id: d.id, name: d.name, specialization: d.specialization })));
        return;
      }
      const res = await apiGet<Paginated<{ patient: { id: string; name: string | null } | null }>>('/appointments?limit=100');
      if (res.ok) {
        const map = new Map<string, ProviderOption>();
        res.data.items.forEach((a) => {
          if (a.patient) map.set(a.patient.id, { id: a.patient.id, name: a.patient.name ?? 'Patient' });
        });
        setProviders([...map.values()]);
      }
    })();
  }, [isPatient]);

  async function startConversation(e: FormEvent) {
    e.preventDefault();
    if (!newTarget) return;
    setStarting(true);
    setError(null);
    const res = await apiPost<ConversationSummary>(
      '/messages/conversations',
      isPatient ? { doctorId: newTarget } : { patientId: newTarget },
    );
    setStarting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setNewTarget('');
    const items = await loadConversations();
    setActiveId(res.data.id);
    if (!items) setThread(null);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!activeId || !draft.trim()) return;
    setSending(true);
    setError(null);
    const res = await apiPost<ChatMessage>(`/messages/conversations/${activeId}/messages`, { body: draft.trim() });
    setSending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setThread((prev) => [...(prev ?? []), res.data]);
    setDraft('');
    void loadConversations();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card
        title="Conversations"
        description="Private messages between patients and doctors only."
        actions={
          <button
            type="button"
            onClick={() => void loadConversations()}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-ink-muted"
          >
            <IconRefresh size={14} /> Refresh
          </button>
        }
      >
        <div className="space-y-3">
          {error && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[13px] font-semibold text-danger">
              {error}
            </p>
          )}
          {conversations === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-[13px] text-ink-muted">
              No conversations yet. Start one below.
            </p>
          ) : (
            <ul className="space-y-2">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition-colors ${
                      c.id === activeId ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-ink">{c.counterpart.name}</span>
                      {c.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    {c.counterpart.subtitle && (
                      <p className="mt-0.5 truncate text-[12px] text-ink-subtle">{c.counterpart.subtitle}</p>
                    )}
                    <p className="mt-1 truncate text-[12px] text-ink-muted">
                      {c.lastMessage ? c.lastMessage.body : 'No messages yet'}
                    </p>
                    {c.lastMessageAt && <p className="mt-0.5 text-[11px] text-ink-subtle">{relativeTime(c.lastMessageAt)}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={(e) => void startConversation(e)} className="rounded-2xl bg-slate-50 p-4" aria-label="Start a conversation">
            <p className="text-xs font-bold text-ink">New conversation</p>
            {providers === null ? (
              <p className="mt-2 text-[12px] text-ink-muted">Loading contacts…</p>
            ) : providers.length === 0 ? (
              <p className="mt-2 text-[12px] text-ink-muted">
                {isPatient ? 'No verified doctors are available yet.' : 'No patients to message yet.'}
              </p>
            ) : (
              <>
                <select
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
                >
                  <option value="">Select {isPatient ? 'a doctor' : 'a patient'}</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.specialization ? ` — ${p.specialization}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!newTarget || starting}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  <IconChat size={15} /> {starting ? 'Starting…' : 'Start conversation'}
                </button>
              </>
            )}
          </form>
        </div>
      </Card>

      <Card title={counterpart ? counterpart.name : 'Secure thread'} description="Only the two participants can read or send messages here.">
        {!activeId ? (
          <Empty title="No conversation selected" hint="Pick a conversation or start a new one." icon={<IconChat size={22} />} />
        ) : (
          <div className="flex flex-col">
            <div className="max-h-[420px] min-h-[220px] space-y-2 overflow-y-auto pr-1">
              {!thread ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : thread && thread.length > 0 ? (
                thread.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[11px] ${m.mine ? 'text-white/70' : 'text-ink-subtle'}`}>
                        {relativeTime(m.createdAt)}
                        {m.mine && m.readAt ? ' · Read' : ''}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-[13px] text-ink-muted">No messages yet — say hello.</p>
              )}
            </div>

            <form onSubmit={(e) => void send(e)} className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Write a private message…"
                disabled={sending}
                className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-400 disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                <IconSend size={16} /> {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
            <p className="mt-1 text-right text-[11px] text-ink-subtle">
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
