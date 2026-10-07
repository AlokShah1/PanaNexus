'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/lib/session';
import { apiGet, apiPatch, Paginated } from '@/lib/api';
import { Badge, Blob, SectionHeading } from '@/components/ui';
import { IconFileText, IconRefresh } from '@/components/icons';
import RecordForm from '@/components/records/RecordForm';
import { formatDateTime, formatDate } from '@/lib/format';

type RecordItem = {
  id: string;
  recordType: string;
  diagnosis: string | null;
  treatment: string | null;
  notes: string | null;
  prescriptions: string[] | null;
  attachments: string[] | null;
  facilityId: string | null;
  createdAt: string;
  patient?: { id: string; name: string | null } | null;
  doctor?: { id: string; name: string | null; specialization: string | null } | null;
};

type Appointment = {
  id: string;
  startsAt: string;
  status: string;
  doctor: { id: string; name: string | null; specialization: string | null } | null;
  patient: { id: string; name: string | null } | null;
  facility: { id: string; name: string | null } | null;
};

export default function Page() {
  const { status, profile } = useSession();
  const [items, setItems] = useState<RecordItem[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Array<{ id: string; name: string | null }>>([]);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [editData, setEditData] = useState({ diagnosis: '', treatment: '', notes: '', prescriptions: '', attachments: '' });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const canCreate = status === 'authed' && profile?.role === 'DOCTOR';
  const canEdit = status === 'authed' && (profile?.role === 'DOCTOR' || profile?.role === 'ADMIN');
  // readOnly not needed as computed via canCreate/canEdit

  useEffect(() => {
    load(page, typeFilter);
  }, [page, typeFilter]);

  async function load(p: number, t: string) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', '20');
    if (t) params.set('recordType', t);
    const res = await apiGet<Paginated<RecordItem>>(`/medical-records?${params.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setItems(res.data.items);
    setMeta(res.data.meta);
  }

  useEffect(() => {
    if (!canCreate) return;
    apiGet<Paginated<Appointment>>('/appointments?limit=100').then((r) => {
      if (r.ok) {
        const map = new Map<string, { id: string; name: string | null }>();
        r.data.items.forEach((a) => {
          if (a.patient) map.set(a.patient.id, a.patient);
        });
        setPatients(Array.from(map.values()));
      }
    });
  }, [canCreate]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((i) => {
      const pName = i.patient?.name?.toLowerCase() ?? '';
      const dName = i.doctor?.name?.toLowerCase() ?? '';
      return pName.includes(s) || dName.includes(s) || i.id.toLowerCase().includes(s);
    });
  }, [items, search]);

  function startEdit(i: RecordItem) {
    setEditing(i);
    setEditData({
      diagnosis: i.diagnosis ?? '',
      treatment: i.treatment ?? '',
      notes: i.notes ?? '',
      prescriptions: (i.prescriptions ?? []).join('\n'),
      attachments: (i.attachments ?? []).join('\n'),
    });
    setEditError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    const pres = editData.prescriptions
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const atts = editData.attachments
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await apiPatch<RecordItem>(`/medical-records/${editing.id}`, {
      diagnosis: editData.diagnosis || null,
      treatment: editData.treatment || null,
      notes: editData.notes || null,
      prescriptions: pres,
      attachments: atts,
    });
    setSaving(false);
    if (!res.ok) {
      setEditError(res.code === 'VERIFICATION_REQUIRED' ? 'Your account must be verified first' : res.message);
      return;
    }
    setEditing(null);
    load(page, typeFilter);
  }

  return (
    <main className="relative overflow-hidden">
      <Blob className="left-[-120px] top-[-60px] h-[300px] w-[300px] bg-brand-200/30" />
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Badge tone="brand">
            <IconFileText size={13} />
            Medical records
          </Badge>
          <SectionHeading
            title="Records"
            description="View and manage medical records with role-based access"
            align="left"
          />
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        {canCreate && <RecordForm patients={patients} onSuccess={() => load(1, typeFilter)} />}
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient/doctor"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">All types</option>
            <option value="CONSULTATION">Consultation</option>
            <option value="PRESCRIPTION">Prescription</option>
            <option value="LAB_RESULT">Lab result</option>
            <option value="IMAGING">Imaging</option>
            <option value="VACCINATION">Vaccination</option>
            <option value="OTHER">Other</option>
          </select>
          <button
            onClick={() => load(page, typeFilter)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-ink-muted"
          >
            <IconRefresh size={15} />
            Refresh
          </button>
        </div>
        {error && (
          <div role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger ring-1 ring-danger/20">
            {error}
          </div>
        )}
        <div className="rounded-3xl bg-white shadow-soft ring-1 ring-slate-200/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Doctor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Diagnosis</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((i) => (
                  <>
                    <tr key={i.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-ink-muted">{formatDate(i.createdAt)}</td>
                      <td className="px-6 py-4 text-ink">{i.patient?.name ?? '-'}</td>
                      <td className="px-6 py-4 text-ink">{i.doctor?.name ?? '-'}</td>
                      <td className="px-6 py-4 text-ink-muted">{i.recordType}</td>
                      <td className="px-6 py-4 text-ink-muted truncate max-w-xs">{i.diagnosis ?? '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setExpandedId(expandedId === i.id ? null : i.id)}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-ink-muted"
                          >
                            {expandedId === i.id ? 'Collapse' : 'Expand'}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => startEdit(i)}
                              className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === i.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold text-ink-muted">Treatment</p>
                              <p className="mt-1 text-sm text-ink">{i.treatment ?? '-'}</p>
                              <p className="mt-4 text-xs font-semibold text-ink-muted">Notes</p>
                              <p className="mt-1 text-sm text-ink">{i.notes ?? '-'}</p>
                              <p className="mt-4 text-xs font-semibold text-ink-muted">Created</p>
                              <p className="mt-1 text-sm text-ink-muted">{formatDateTime(i.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-ink-muted">Prescriptions</p>
                              <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
                                {(i.prescriptions ?? []).length === 0 && <li>-</li>}
                                {(i.prescriptions ?? []).map((p, idx) => (
                                  <li key={idx}>{p}</li>
                                ))}
                              </ul>
                              <p className="mt-4 text-xs font-semibold text-ink-muted">Attachments</p>
                              <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
                                {(i.attachments ?? []).length === 0 && <li>-</li>}
                                {(i.attachments ?? []).map((a, idx) => (
                                  <li key={idx}>
                                    <a href={a} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                                      {a}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">No records found.</div>
          )}
        </div>
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-ink-muted disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-ink-muted">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button
              disabled={page >= meta.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-ink-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveEdit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
            <h2 className="text-base font-bold text-ink">Edit record</h2>
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Diagnosis</span>
              <textarea
                value={editData.diagnosis}
                onChange={(e) => setEditData({ ...editData, diagnosis: e.target.value })}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                rows={3}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Treatment</span>
              <textarea
                value={editData.treatment}
                onChange={(e) => setEditData({ ...editData, treatment: e.target.value })}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                rows={3}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Notes</span>
              <textarea
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                rows={3}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Prescriptions (one per line)</span>
              <textarea
                value={editData.prescriptions}
                onChange={(e) => setEditData({ ...editData, prescriptions: e.target.value })}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                rows={4}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Attachments (URLs, one per line)</span>
              <textarea
                value={editData.attachments}
                onChange={(e) => setEditData({ ...editData, attachments: e.target.value })}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                rows={3}
              />
            </label>
            {editError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {editError}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-ink-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
