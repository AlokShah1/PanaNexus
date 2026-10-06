const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const FRIENDLY: Partial<Record<number, string>> = {
  400: 'Something went wrong while loading healthcare facilities.',
  401: 'Please log in to continue.',
  403: "You don't have permission to do that.",
  404: 'The requested information was not found.',
  409: 'This slot is no longer available.',
  422: 'Please check the details and try again.',
  429: 'Too many requests. Please try again in a moment.',
  500: 'Something went wrong while loading healthcare facilities.',
  503: 'Service is unavailable right now.',
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: string; message: string };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      credentials: 'include',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      cache: 'no-store',
      ...init,
    });
  } catch {
    return { ok: false, status: 0, message: 'Something went wrong while loading healthcare facilities.' };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const b = body as { error?: { code?: string; message?: string } } | null;
    const msg =
      res.status === 422 && b?.error?.message
        ? b.error.message
        : FRIENDLY[res.status] ?? 'Something went wrong while loading healthcare facilities.';
    return { ok: false, status: res.status, code: b?.error?.code, message: msg };
  }

  const b = body as { data?: T } | T | null;
  return { ok: true, data: (b as { data?: T })?.data ?? (b as T) };
}

export function apiGet<T>(path: string, init?: RequestInit) {
  return apiFetch<T>(path, { ...init, method: 'GET' });
}

export function apiPost<T>(path: string, body: unknown, init?: RequestInit) {
  return apiFetch<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown, init?: RequestInit) {
  return apiFetch<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });
}
