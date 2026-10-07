'use client';

import { API_BASE } from '@/lib/api';
import { IconClipboard, IconClose } from '@/components/icons';

export function documentUrl(filename: string): string {
  return `${API_BASE}/verifications/me/documents/${encodeURIComponent(filename)}`;
}

export function DocumentList({
  documents,
  onRemove,
  removing,
  emptyHint,
}: {
  documents: string[];
  onRemove?: (filename: string) => void;
  removing?: string | null;
  emptyHint?: string;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyHint ?? 'No documents attached yet.'}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {documents.map((name) => (
        <li
          key={name}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <IconClipboard size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink" title={name}>
            {name}
          </span>
          <a
            href={documentUrl(name)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${name}`}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50"
          >
            View
          </a>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(name)}
              disabled={removing === name}
              aria-label={`Remove ${name}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-50"
            >
              {removing === name ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
              ) : (
                <IconClose size={16} />
              )}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
