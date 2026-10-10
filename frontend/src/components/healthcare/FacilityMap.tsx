'use client';

import { useEffect, useRef, useState } from 'react';

export interface FacilityMapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  categoryLabel: string;
  verified: boolean;
  distanceLabel: string | null;
}

export interface FacilityMapProps {
  points: FacilityMapPoint[];
  origin: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  emptyLabel?: string;
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type Leaflet = typeof import('leaflet');

export default function FacilityMap({
  points,
  origin,
  selectedId,
  onSelect,
  className = '',
  emptyLabel = 'No map locations to show yet.',
}: FacilityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').CircleMarker>>(new Map());
  const originRef = useRef<import('leaflet').CircleMarker | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    const markers = markersRef.current;
    if (!el) return undefined;
    (async () => {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;
        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true,
        });
        map.setView([23.2599, 77.4126], 5);
        L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);
        mapRef.current = map;
        const ro = new ResizeObserver(() => map.invalidateSize());
        ro.observe(containerRef.current);
        cleanupRef.current = () => ro.disconnect();
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
      originRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    const plottable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const live = new Set(plottable.map((p) => p.id));
    for (const [id, marker] of markersRef.current) {
      if (!live.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    const bounds: [number, number][] = [];
    for (const p of plottable) {
      bounds.push([p.lat, p.lng]);
      const selected = p.id === selectedId;
      const color = selected ? '#e11d48' : p.verified ? '#0d9488' : '#0284c7';
      const marker =
        markersRef.current.get(p.id) ??
        L.circleMarker([p.lat, p.lng], {
          radius: selected ? 10 : 7,
          color: '#ffffff',
          weight: selected ? 3 : 2,
          fillColor: color,
          fillOpacity: 0.95,
        }).addTo(map);
      marker.setLatLng([p.lat, p.lng]);
      marker.setStyle({ fillColor: color, radius: selected ? 10 : 7, weight: selected ? 3 : 2 });
      marker.bindPopup(
        `<div style="min-width:150px"><div style="font-weight:700">${escapeHtml(p.name)}</div>` +
          `<div style="font-size:12px;color:#64748b">${escapeHtml(p.categoryLabel)}` +
          (p.distanceLabel ? ` · ${escapeHtml(p.distanceLabel)}` : '') +
          `</div><div style="font-size:11px;margin-top:4px;color:${p.verified ? '#0d9488' : '#0284c7'}">` +
          `${p.verified ? 'PanaNexus verified' : 'OpenStreetMap listing — unverified'}</div></div>`,
      );
      marker.off('click');
      marker.on('click', () => onSelectRef.current?.(p.id));
      markersRef.current.set(p.id, marker);
    }

    if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) bounds.push([origin.lat, origin.lng]);
    if (bounds.length > 1) {
      try {
        map.fitBounds(L.latLngBounds(bounds).pad(0.25), { animate: false, maxZoom: 15 });
      } catch {
        /* ignore */
      }
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14, { animate: false });
    }
  }, [points, origin, selectedId, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;
    if (originRef.current) {
      originRef.current.remove();
      originRef.current = null;
    }
    if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return;
    originRef.current = L.circleMarker([origin.lat, origin.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#1d4ed8',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip('Your search location', { direction: 'top', offset: [0, -6] });
  }, [origin, ready]);

  useEffect(() => {
    if (!selectedId) return;
    const marker = markersRef.current.get(selectedId);
    if (marker) marker.openPopup();
  }, [selectedId, points]);

  const empty = points.length === 0;

  return (
    <div className={`pn-map relative isolate overflow-hidden ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100 px-4 text-center text-[13px] font-medium text-ink-muted">
          Map preview unavailable on this connection.
        </div>
      )}
      {!failed && empty && ready && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[12px] font-medium text-ink-muted shadow-soft">
            {emptyLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
