const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const API_ROOT = BASE;
export const API_BASE = `${BASE}/api/v1`;

export const NETWORK_ERROR_MESSAGE = "We're having trouble connecting right now. Please try again.";

const FRIENDLY: Partial<Record<number, string>> = {
  400: 'Please check the details and try again.',
  401: 'Please log in to continue.',
  403: "You don't have permission to do that.",
  404: 'The requested information was not found.',
  409: 'That already exists. Please check and try again.',
  422: 'Please check the details and try again.',
  429: 'Too many requests. Please try again in a moment.',
  500: 'Something went wrong on our end. Please try again.',
  502: 'Temporarily unavailable. Please try again in a moment.',
  503: 'Temporarily unavailable. Please try again in a moment.',
};

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

function fallbackFor(status: number): string {
  return FRIENDLY[status] ?? GENERIC_ERROR_MESSAGE;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: string; message: string };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      credentials: 'include',
      headers: typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
      cache: 'no-store',
      ...init,
    });
  } catch {
    return { ok: false, status: 0, message: NETWORK_ERROR_MESSAGE };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const b = body as { error?: { code?: string; message?: string } } | null;
    if (res.status === 401 && b?.error?.code === 'SESSION_EXPIRED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pn:session-expired'));
    }
    const msg =
      res.status < 500 && b?.error?.message
        ? b.error.message
        : fallbackFor(res.status);
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

export function apiDelete<T>(path: string, init?: RequestInit) {
  return apiFetch<T>(path, { ...init, method: 'DELETE' });
}

export function apiUpload<T>(path: string, form: FormData, init?: RequestInit) {
  return apiFetch<T>(path, { ...init, method: 'POST', body: form });
}

export type PageMeta = { page: number; limit: number; total: number; totalPages: number };
export type Paginated<T> = { items: T[]; meta: PageMeta };
