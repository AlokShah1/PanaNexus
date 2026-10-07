'use client';

import { useEffect, useRef, useState } from 'react';

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface EmergencyMapProps {
  pickup: (MapPoint & { accuracy?: number | null }) | null;
  ambulance?: MapPoint | null;
  className?: string;
  interactive?: boolean;
  showAccuracy?: boolean;
  fallbackLabel?: string;
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function EmergencyMap({
  pickup,
  ambulance,
  className = '',
  interactive = false,
  showAccuracy = true,
  fallbackLabel = 'Map preview unavailable on this connection.',
}: EmergencyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const pickupRef = useRef<import('leaflet').CircleMarker | null>(null);
  const accuracyRef = useRef<import('leaflet').Circle | null>(null);
  const ambulanceRef = useRef<import('leaflet').Marker | null>(null);
  const routeRef = useRef<import('leaflet').Polyline | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  /* ------------------------------------------------ initialise once */
  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return undefined;

    (async () => {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;

        const map = L.map(containerRef.current, {
          zoomControl: interactive,
          attributionControl: true,
          dragging: interactive,
          scrollWheelZoom: false,
          doubleClickZoom: interactive,
          boxZoom: false,
          keyboard: false,
          touchZoom: interactive,
          fadeAnimation: true,
        });
        mapRef.current = map;
        L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);
        const start: [number, number] = pickup ? [pickup.lat, pickup.lng] : [23.2599, 77.4126];
        map.setView(start, pickup ? 14 : 12);
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
      leafletRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------- pickup marker + accuracy */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!pickup) {
      pickupRef.current?.remove();
      pickupRef.current = null;
      accuracyRef.current?.remove();
      accuracyRef.current = null;
      return;
    }
    const ll: [number, number] = [pickup.lat, pickup.lng];
    if (!pickupRef.current) {
      pickupRef.current = L.circleMarker(ll, { radius: 8, color: '#ffffff', weight: 3, fillColor: '#1f45f5', fillOpacity: 1 }).addTo(map);
      pickupRef.current.bindTooltip('Your pickup point', { direction: 'top', offset: [0, -6] });
    } else {
      pickupRef.current.setLatLng(ll);
    }
    if (showAccuracy && pickup.accuracy != null && pickup.accuracy > 0) {
      const radius = Math.min(pickup.accuracy, 1500);
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle(ll, { radius, color: '#1f45f5', weight: 1, opacity: 0.5, fillColor: '#3366ff', fillOpacity: 0.12 }).addTo(map);
      } else {
        accuracyRef.current.setLatLng(ll);
        accuracyRef.current.setRadius(radius);
      }
    } else if (accuracyRef.current) {
      accuracyRef.current.remove();
      accuracyRef.current = null;
    }
  }, [pickup, showAccuracy, ready]);

  /* ------------------------------------- ambulance marker + route */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!ambulance) {
      ambulanceRef.current?.remove();
      ambulanceRef.current = null;
      routeRef.current?.remove();
      routeRef.current = null;
      return;
    }
    const ll: [number, number] = [ambulance.lat, ambulance.lng];
    const icon = L.divIcon({
      className: 'pn-ambulance-marker',
      html: '<div style="display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#e11d48;color:#fff;font-size:15px;font-weight:700;box-shadow:0 4px 10px rgba(225,29,72,.45);border:2px solid #fff">✚</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    if (!ambulanceRef.current) {
      ambulanceRef.current = L.marker(ll, { icon }).addTo(map);
      ambulanceRef.current.bindTooltip('Assigned ambulance', { direction: 'top', offset: [0, -12] });
    } else {
      ambulanceRef.current.setLatLng(ll);
    }
    if (pickup) {
      const coords: [number, number][] = [
        [ambulance.lat, ambulance.lng],
        [pickup.lat, pickup.lng],
      ];
      if (!routeRef.current) {
        routeRef.current = L.polyline(coords, { color: '#e11d48', weight: 3, opacity: 0.7, dashArray: '6 8' }).addTo(map);
      } else {
        routeRef.current.setLatLngs(coords);
      }
      try {
        map.fitBounds(L.latLngBounds(coords).pad(0.35), { animate: true });
      } catch {
        /* ignore */
      }
    } else {
      map.panTo(ll);
    }
  }, [ambulance, pickup, ready]);

  /* ------------------------------------- keep pickup in view */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickup || ambulance) return;
    try {
      map.setView([pickup.lat, pickup.lng], Math.max(map.getZoom(), 15), { animate: true });
    } catch {
      /* ignore */
    }
  }, [pickup, ambulance, ready]);

  return (
    <div className={`pn-map relative isolate overflow-hidden ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100 px-4 text-center text-[13px] font-medium text-ink-muted">
          {fallbackLabel}
        </div>
      )}
    </div>
  );
}