'use client';

import { useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Badge } from '@/components/ui';
import { IconDownload, IconFileText, IconRefresh, IconTrash, IconUpload } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import {
  REPORT_ACCEPT,
  REPORT_CATEGORIES,
  type ReportCategory,
  type ReportFile,
  deleteReport,
  formatBytes,
  getReportDownload,
  listReports,
  reportCategoryLabel,
  uploadReport,
} from '@/lib/reports';

type Patient = { id: string; name: string | null };

type Props = {
  patients?: Patient[];
};

export default function ReportFiles({ patients = [] }: Props) {
  const { status, profile } = useSession();
  const role = profile?.role ?? '';

  const [ownPatientId, setOwnPatientId] = useState<string | null | undefined>(undefined);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [items, setItems] = useState<ReportFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<ReportCategory>('MEDICAL_REPORT');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authed' || role !== 'PATIENT') return;
    let cancelled = false;
    apiGet<{ id: string } | null>('/patients/me').then((r) => {
      if (!cancelled) setOwnPatientId(r.ok && r.data ? r.data.id : null);
    });
    return () => {
      cancelled = true;
    };
  }, [status, role]);

  const canSelect = role === 'DOCTOR' || role === 'FACILITY_STAFF';
  const effectivePatientId =
    role === 'PATIENT' ? (ownPatientId ?? undefined) : selectedPatientId || undefined;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, role, ownPatientId, selectedPatientId, canSelect, effectivePatientId]);

  async function load() {
    if (status !== 'authed') return;
    if (role === 'PATIENT' && ownPatientId === undefined) return;
    if (role === 'PATIENT' && !ownPatientId) {
      setItems([]);
      return;
    }
    if (canSelect && !selectedPatientId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listReports(effectivePatientId);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setItems(res.data.items);
  }

  const canUpload = status === 'authed' && Boolean(effectivePatientId);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!effectivePatientId || !file) return;
    setUploading(true);
    setUploadError(null);
    setNotice(null);
    const res = await uploadReport({ patientId: effectivePatientId, file, category, title: title.trim() || undefined });
    setUploading(false);
    if (!res.ok) {
      setUploadError(res.message);
      return;
    }
    setFile(null);
    setTitle('');
    if (fileRef.current) fileRef.current.value = '';
    setNotice('Report uploaded securely.');
    void load();
  }

  async function onDownload(r: ReportFile) {
    setBusyId(r.id);
    setError(null);
    setNotice(null);
    const res = await getReportDownload(r.id);
    setBusyId(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const a = document.createElement('a');
    a.href = res.data.url;
    a.download = res.data.filename;
    a.rel = 'noreferrer';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    const mins = Math.max(1, Math.round(res.data.expiresInSeconds / 60));
    setNotice(`Secure download link ready — it expires in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }

  async function onDelete(r: ReportFile) {
    if (!window.confirm(`Delete "${r.originalFilename}"? This cannot be undone.`)) return;
    setBusyId(r.id);
    setError(null);
    setNotice(null);
    const res = await deleteReport(r.id);
    setBusyId(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setNotice('Report deleted.');
    void load();
  }

  if (status !== 'authed') return null;

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <IconFileText size={17} />
            Report files
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Private documents stored securely. Downloads use short-lived links.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-ink-muted disabled:opacity-50"
        >
          <IconRefresh size={14} />
          Refresh
        </button>
      </div>

      {canSelect && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Patient</span>
          <select
            value={selectedPatientId}
            onChange={(e) => {
              setSelectedPatientId(e.target.value);
              setNotice(null);
              setError(null);
            }}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">Select patient</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? p.id}
              </option>
            ))}
          </select>
        </label>
      )}

      {role === 'PATIENT' && ownPatientId === null && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Complete your patient profile before uploading reports.
        </p>
      )}

      {canUpload && (
        <form onSubmit={onUpload} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">File (PDF, JPEG, PNG, WebP, max 15 MB)</span>
              <input
                ref={fileRef}
                type="file"
                accept={REPORT_ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Title (optional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Blood test — March"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
            />
          </label>
          {uploadError && (
            <p role="alert" className="text-sm text-red-600">
              {uploadError}
            </p>
          )}
          <button
            type="submit"
            disabled={!file || uploading}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <IconUpload size={15} />
            {uploading ? 'Uploading…' : 'Upload report'}
          </button>
        </form>
      )}

      {notice && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{notice}</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-danger/5 px-4 py-3 text-sm text-danger ring-1 ring-danger/20">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((r) => {
              const canDelete = role === 'ADMIN' || r.uploadedById === profile?.id;
              return (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="max-w-[220px] truncate font-medium text-ink" title={r.originalFilename}>
                        {r.title || r.originalFilename}
                      </span>
                      {r.isDemo && <Badge tone="neutral">Demo</Badge>}
                    </div>
                    {r.title && <p className="mt-0.5 max-w-[240px] truncate text-xs text-ink-muted">{r.originalFilename}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{reportCategoryLabel(r.category)}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatBytes(r.sizeBytes)}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void onDownload(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:opacity-50"
                      >
                        <IconDownload size={13} />
                        Download
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void onDelete(r)}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-50"
                        >
                          <IconTrash size={13} />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="p-8 text-center text-sm text-ink-muted">
            {loading ? 'Loading…' : 'No report files yet.'}
          </div>
        )}
      </div>
    </section>
  );
}
