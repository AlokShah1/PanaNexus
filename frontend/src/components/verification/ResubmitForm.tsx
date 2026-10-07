'use client';

import { useState } from 'react';
import { apiDelete, apiPost, apiUpload } from '@/lib/api';
import { Button } from '@/components/ui';
import { IconClipboard } from '@/components/icons';
import { apiErrorMessage } from './apiError';
import { DocumentList } from './Documents';
import { Field, RESUBMIT_FIELDS } from './fields';

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf';
const ALLOWED_EXT = /\.(jpe?g|png|webp|pdf)$/i;

type Props = {
  role: string;
  initialPayload: Record<string, unknown> | null;
  documents: string[];
  onSubmitted: () => void;
};

export default function ResubmitForm({ role, initialPayload, documents, onSubmitted }: Props) {
  const fields = RESUBMIT_FIELDS[role] ?? [];
  const [docs, setDocs] = useState<string[]>(documents);
  const [payloadDirty, setPayloadDirty] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function defaultValue(name: string): string {
    const value = initialPayload?.[name];
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
  }

  async function uploadFiles(picked: File[]) {
    if (picked.length === 0) return;
    setError(null);
    for (const file of picked) {
      if (!ALLOWED_EXT.test(file.name)) {
        setError(`"${file.name}" is not a supported file type. Use JPG, PNG, WEBP or PDF.`);
        return;
      }
      if (file.size > MAX_SIZE) {
        setError(`"${file.name}" is larger than 5 MB. Please upload a smaller file.`);
        return;
      }
    }
    if (docs.length + picked.length > MAX_FILES) {
      setError(`You can attach at most ${MAX_FILES} documents. Remove one before adding more.`);
      return;
    }
    setUploading(true);
    const form = new FormData();
    for (const file of picked) form.append('files', file);
    const res = await apiUpload<{ documentUrls: string[] }>('/verifications/me/documents', form);
    setUploading(false);
    if (!res.ok) {
      setError(apiErrorMessage(res));
      return;
    }
    setDocs(res.data.documentUrls);
    setUploaded(true);
  }

  async function removeDoc(name: string) {
    setError(null);
    setRemoving(name);
    const res = await apiDelete<{ documentUrls: string[] }>(
      `/verifications/me/documents/${encodeURIComponent(name)}`,
    );
    setRemoving(null);
    if (!res.ok) {
      setError(apiErrorMessage(res));
      return;
    }
    setDocs(res.data.documentUrls);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const errors: Record<string, string> = {};
    if (payloadDirty) {
      for (const def of fields) {
        const value = String(form.get(def.name) ?? '').trim();
        if (def.required && value.length < (def.minLength ?? 1)) {
          errors[def.name] = `${def.label} is required.`;
        } else if (value.length > 0 && def.minLength && value.length < def.minLength) {
          errors[def.name] = `${def.label} must be at least ${def.minLength} characters.`;
        }
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    const body: { payload?: Record<string, unknown> } = {};
    if (payloadDirty) {
      const payload: Record<string, unknown> = { ...(initialPayload ?? {}) };
      for (const def of fields) payload[def.name] = String(form.get(def.name) ?? '').trim();
      body.payload = payload;
    }
    const res = await apiPost<{ request: unknown; verificationStatus: string }>(
      '/verifications/me/resubmit',
      body,
    );
    setSubmitting(false);
    if (!res.ok) {
      setError(apiErrorMessage(res));
      return;
    }
    onSubmitted();
  }

  const canSubmit = (uploaded || payloadDirty) && !uploading && !submitting;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
      <div>
        <h3 className="text-base font-bold text-ink">Update your submission</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Adjust your details, attach supporting documents, then send it back to our review team.
        </p>
      </div>

      {fields.length > 0 && (
        <div className="space-y-4" onChange={() => setPayloadDirty(true)}>
          {fields.map((def) => (
            <Field
              key={def.name}
              def={def}
              defaultValue={defaultValue(def.name)}
              error={fieldErrors[def.name] ?? null}
            />
          ))}
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Documents{' '}
          <span className="font-normal text-ink-subtle">
            (JPG, PNG, WEBP or PDF · up to 5 MB each · max {MAX_FILES} files)
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50 focus-within:ring-4 focus-within:ring-brand-500/10">
            <input
              type="file"
              multiple
              accept={ACCEPT}
              disabled={uploading || removing !== null}
              className="sr-only"
              onChange={(e) => {
                const picked = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = '';
                void uploadFiles(picked);
              }}
            />
            <IconClipboard size={16} />
            Choose files
          </label>
          {uploading && (
            <span className="inline-flex items-center gap-2 text-sm text-ink-muted" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              Uploading…
            </span>
          )}
        </div>
        <div className="mt-3">
          <DocumentList
            documents={docs}
            onRemove={removeDoc}
            removing={removing}
            emptyHint="No documents attached yet. Add images or scans of your credentials."
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger ring-1 ring-danger/20"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Resubmitting…
            </>
          ) : (
            'Resubmit for review'
          )}
        </Button>
        {!canSubmit && !submitting && (
          <p className="text-xs text-ink-subtle">Attach a document or update a field to enable resubmission.</p>
        )}
      </div>
    </form>
  );
}
