const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Reverse geocode a GPS fix to a human-readable address. Returns null on any failure. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(
      `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=0&accept-language=en`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { display_name?: string };
    return j.display_name ?? null;
  } catch {
    return null;
  }
}

export type PlaceResult = { lat: number; lng: number; label: string };

/** Search a free-text place name (landmark, area, street) to a point. */
export async function searchPlace(query: string): Promise<PlaceResult | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(
      `${NOMINATIM}/search?format=jsonv2&limit=1&accept-language=en&q=${encodeURIComponent(query)}`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    const first = j[0];
    if (!first) return null;
    return { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name ?? query };
  } catch {
    return null;
  }
}
