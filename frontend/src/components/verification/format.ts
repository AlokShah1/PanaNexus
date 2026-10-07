export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function payloadEntries(payload: Record<string, unknown> | null): [string, string][] {
  if (!payload) return [];
  return Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => [humanizeKey(key), String(value).trim()] as [string, string]);
}

export function normalizePayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}
