export interface FetchOptions {
  timeoutMs?: number;
  userAgent?: string;
}

/**
 * Fetch JSON from an external provider with a hard timeout and provider-friendly headers.
 * Throws on non-2xx or timeout; callers treat any throw as "provider unavailable".
 */
export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': opts.userAgent ?? 'PanaNexus/1.0',
      },
    });
    if (!res.ok) throw new Error(`Provider responded ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
