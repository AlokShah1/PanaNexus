const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}/api/v1${path}`, { cache: 'no-store', ...init });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return null;
    return (j.data as T) ?? (j as T);
  } catch {
    return null;
  }
}
