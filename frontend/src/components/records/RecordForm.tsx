'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';

type Patient = { id: string; name: string | null };

type Props = {
  patients: Patient[];
  onSuccess: () => void;
};

export default function RecordForm({ patients, onSuccess }: Props) {
  const [patientId, setPatientId] = useState('');
  const [recordType, setRecordType] = useState('CONSULTATION');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState('');
  const [attachments, setAttachments] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const pres = prescriptions
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const atts = attachments
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await apiPost<{ id: string }>('/medical-records', {
      patientId,
      recordType,
      diagnosis: diagnosis || undefined,
      treatment: treatment || undefined,
      notes: notes || undefined,
      prescriptions: pres.length ? pres : undefined,
      attachments: atts.length ? atts : undefined,
    });
    setPending(false);
    if (!res.ok) {
      const msg = res.code === 'VERIFICATION_REQUIRED' ? 'Your account must be verified first' : res.message;
      setError(msg);
      return;
    }
    setPatientId('');
    setDiagnosis('');
    setTreatment('');
    setNotes('');
    setPrescriptions('');
    setAttachments('');
    onSuccess();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70">
      <h2 className="text-base font-bold text-ink">New record</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Patient</span>
        <select
          required
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Record type</span>
        <select
          value={recordType}
          onChange={(e) => setRecordType(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          <option value="CONSULTATION">Consultation</option>
          <option value="PRESCRIPTION">Prescription</option>
          <option value="LAB_RESULT">Lab result</option>
          <option value="IMAGING">Imaging</option>
          <option value="VACCINATION">Vaccination</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Diagnosis</span>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          rows={3}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Treatment</span>
        <textarea
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          rows={3}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          rows={3}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Prescriptions (one per line)</span>
        <textarea
          value={prescriptions}
          onChange={(e) => setPrescriptions(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          rows={4}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Attachments (URLs, one per line)</span>
        <textarea
          value={attachments}
          onChange={(e) => setAttachments(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          rows={3}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save record'}
      </button>
    </form>
  );
}
