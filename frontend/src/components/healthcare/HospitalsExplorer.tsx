'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { Empty, ErrorBanner, Pager, Skeleton, type ApiError } from '@/components/facility/ui';
import {
  IconAlert,
  IconHospital,
  IconLocate,
  IconPhone,
  IconPin,
  IconRoute,
  IconStar,
} from '@/components/icons';
import {
  HEALTHCARE_CATEGORIES,
  HEALTHCARE_SORTS,
  formatDistance,
  formatDuration,
  reversePlace,
  searchHealthcare,
  type HealthcarePlace,
  type HealthcareSearchResponse,
  type SortKey,
} from '@/lib/healthcare';
import FacilityMap from './FacilityMap';

type GeoState = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

const RADIUS_OPTIONS = [5, 15, 25, 50];
const PAGE_SIZE = 24;

export default function HospitalsExplorer() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<GeoState>('idle');

  const [category, setCategory] = useState('');
  const [radiusKm, setRadiusKm] = useState(15);
  const [emergency, setEmergency] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('relevance');
  const [wantRoute, setWantRoute] = useState(false);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<HealthcareSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        const res = await searchHealthcare(
          {
            q: submitted || undefined,
            lat: origin?.lat,
            lng: origin?.lng,
            radiusKm: origin ? radiusKm : undefined,
            type: category || undefined,
            emergency,
            openNow,
            verified: verifiedOnly,
            sort,
            route: wantRoute && Boolean(origin),
            page,
            limit: PAGE_SIZE,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (res.ok) {
          setData(res.data);
          setError(null);
        } else {
          setError({ status: res.status, code: res.code, message: res.message });
        }
        setLoading(false);
      })();
    }, 300);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [submitted, origin, category, radiusKm, emergency, openNow, verifiedOnly, sort, wantRoute, page]);

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoState('unsupported');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setOrigin({ lat: latitude, lng: longitude });
        setOriginLabel(null);
        setGeoState('ready');
        setPage(1);
        void (async () => {
          const res = await reversePlace(latitude, longitude);
          if (res.ok && res.data.label) setOriginLabel(res.data.label);
        })();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoState('denied');
        else if (err.code === err.POSITION_UNAVAILABLE) setGeoState('unavailable');
        else setGeoState('timeout');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function clearLocation() {
    setOrigin(null);
    setOriginLabel(null);
    setGeoState('idle');
    setPage(1);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(query.trim());
    setPage(1);
  }

  function pickCategory(value: string) {
    setCategory(value);
    setPage(1);
  }

  const items = data?.items ?? [];
  const mapPoints = items
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.latitude as number,
      lng: p.longitude as number,
      categoryLabel: p.categoryLabel,
      verified: p.verified,
      distanceLabel: p.distanceKm != null ? formatDistance(p.distanceKm) : null,
    }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <form onSubmit={submitSearch} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
          <label htmlFor="hc-search" className="text-sm font-semibold text-ink">
            Search by facility, service or place
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="hc-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Janakpur, ICU, maternity"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
            <Button type="submit" variant="primary" className="shrink-0 px-5 py-3 text-sm">
              Search
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={origin ? 'secondary' : 'primary'}
              onClick={useMyLocation}
              disabled={geoState === 'locating'}
              className="px-4 py-2 text-xs"
            >
              <IconLocate size={15} /> {geoState === 'locating' ? 'Locating…' : 'Use my location'}
            </Button>
            {origin && (
              <button
                type="button"
                onClick={clearLocation}
                className="rounded-full bg-brand-50 px-3.5 py-2 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200"
              >
                {originLabel ? `Near ${originLabel.split(',')[0]}` : 'Near my location'} · clear
              </button>
            )}
          </div>

          <GeoHint state={geoState} hasOrigin={Boolean(origin)} />
        </form>

        <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
          <div className="flex flex-wrap gap-2">
            {HEALTHCARE_CATEGORIES.map((option) => (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => pickCategory(option.value)}
                className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  category === option.value
                    ? 'bg-ink text-white'
                    : 'bg-slate-100 text-ink-muted hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Toggle active={emergency} onClick={() => { setEmergency((v) => !v); setPage(1); }}>
              <IconAlert size={14} /> Emergency
            </Toggle>
            <Toggle active={openNow} onClick={() => { setOpenNow((v) => !v); setPage(1); }}>
              Open now
            </Toggle>
            <Toggle active={verifiedOnly} onClick={() => { setVerifiedOnly((v) => !v); setPage(1); }}>
              PanaNexus verified
            </Toggle>
            <Toggle active={wantRoute} disabled={!origin} onClick={() => { setWantRoute((v) => !v); setPage(1); }}>
              <IconRoute size={14} /> Road distance
            </Toggle>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
            <label className="flex items-center gap-2">
              Sort
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink outline-none focus:border-brand-400"
              >
                {HEALTHCARE_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {origin && (
              <label className="flex items-center gap-2">
                Within
                <select
                  value={radiusKm}
                  onChange={(e) => { setRadiusKm(Number(e.target.value)); setPage(1); }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink outline-none focus:border-brand-400"
                >
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={km}>
                      {km} km
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="lg:hidden">
          <MapPanel points={mapPoints} origin={origin} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        {error && <ErrorBanner error={error} onRetry={() => setPage((p) => p)} />}

        {data?.providerError && (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-900 ring-1 ring-amber-200">
            {data.providerError}
          </div>
        )}

        {data?.placeUnresolved && (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-[13px] font-medium text-ink-muted ring-1 ring-slate-200">
            We couldn&apos;t find “{data.placeUnresolved}” on the map. Showing PanaNexus facilities matching your search.
          </div>
        )}

        {data && !error && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-muted">
            <span>
              {data.meta.total} result{data.meta.total === 1 ? '' : 's'}
              {data.counts.registered > 0 && ` · ${data.counts.registered} PanaNexus`}
              {data.counts.external > 0 && ` · ${data.counts.external} on OpenStreetMap`}
            </span>
            {data.attribution && <span className="text-ink-subtle">{data.attribution}</span>}
          </div>
        )}

        {loading && <Skeleton rows={5} />}

        {!loading && !error && items.length === 0 && (
          <Empty
            icon={<IconHospital size={20} />}
            title="No facilities found"
            hint={
              origin
                ? 'Try a wider radius, a different category, or search a place name.'
                : 'Turn on your location to find care near you, or search for a city.'
            }
          />
        )}

        {!loading && (
          <div className="space-y-3">
            {items.map((place) => (
              <FacilityCard
                key={place.id}
                place={place}
                origin={origin}
                selected={selectedId === place.id}
                onSelect={() => setSelectedId(place.id)}
              />
            ))}
          </div>
        )}

        <Pager page={page} meta={data?.meta ?? null} onPage={setPage} busy={loading} />
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-20">
          <MapPanel points={mapPoints} origin={origin} selectedId={selectedId} onSelect={setSelectedId} />
          <p className="mt-2 text-[12px] text-ink-subtle">
            Distances are straight-line unless road distance is enabled. Map data © OpenStreetMap contributors.
          </p>
        </div>
      </div>
    </div>
  );
}

function MapPanel({
  points,
  origin,
  selectedId,
  onSelect,
}: {
  points: { id: string; name: string; lat: number; lng: number; categoryLabel: string; verified: boolean; distanceLabel: string | null }[];
  origin: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <FacilityMap
      points={points}
      origin={origin}
      selectedId={selectedId}
      onSelect={onSelect}
      emptyLabel="Search to plot facilities on the map."
      className="h-[320px] rounded-3xl ring-1 ring-slate-200/70 lg:h-[calc(100vh-170px)]"
    />
  );
}

function Toggle({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink-muted hover:bg-brand-50 hover:text-brand-700'
      }`}
    >
      {children}
    </button>
  );
}

function GeoHint({ state, hasOrigin }: { state: GeoState; hasOrigin: boolean }) {
  if (hasOrigin) return null;
  const messages: Partial<Record<GeoState, string>> = {
    denied: 'Location permission was blocked. You can still search for a city or area above.',
    unavailable: "We couldn't determine your location right now. Try again or search a place name.",
    timeout: 'Getting your location took too long. Try again or search a place name.',
    unsupported: 'This browser does not support location. Search a place name instead.',
  };
  const message = messages[state];
  if (!message) return null;
  return <p className="mt-3 text-[12px] font-medium text-amber-700">{message}</p>;
}

function FacilityCard({
  place,
  origin,
  selected,
  onSelect,
}: {
  place: HealthcarePlace;
  origin: { lat: number; lng: number } | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasCoords = Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
  const directions = !hasCoords
    ? null
    : origin
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.lat}%2C${origin.lng}%3B${place.latitude}%2C${place.longitude}`
      : `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=15/${place.latitude}/${place.longitude}`;

  return (
    <article
      onClick={onSelect}
      className={`cursor-pointer rounded-3xl bg-white p-5 shadow-soft ring-1 transition-all ${
        selected ? 'ring-2 ring-brand-400' : 'ring-slate-200/70 hover:ring-brand-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-ink">{place.name}</h3>
          <p className="mt-0.5 flex items-start gap-1.5 text-[13px] text-ink-muted">
            <IconPin size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
            {place.address}
          </p>
        </div>
        {place.distanceKm != null && (
          <Badge tone="neutral">{formatDistance(place.distanceKm)}</Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="neutral">{place.categoryLabel}</Badge>
        {place.verified ? (
          <Badge tone="teal">PanaNexus verified</Badge>
        ) : (
          <Badge tone="warning">Unverified map listing</Badge>
        )}
        {place.emergencyAvailable === true && <Badge tone="danger">Emergency</Badge>}
        {place.operatingHours && <Badge tone="neutral">{place.operatingHours}</Badge>}
        {place.openingHoursRaw && <Badge tone="neutral">{place.openingHoursRaw}</Badge>}
      </div>

      {place.route && (
        <p className="mt-3 text-[13px] font-medium text-brand-700">
          <IconRoute size={14} className="mr-1 inline" />
          {formatDistance(place.route.distanceKm)} by road · ~{formatDuration(place.route.durationMinutes)}
          {place.route.approximate && ' (straight-line estimate)'}
        </p>
      )}

      {place.services.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {place.services.slice(0, 5).map((service) => (
            <span key={service} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
              {service}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {place.phone && (
          <a
            href={`tel:${place.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-[13px] font-semibold text-brand-700"
          >
            <IconPhone size={14} /> Call
          </a>
        )}
        {directions ? (
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-[13px] font-semibold text-ink-muted hover:bg-brand-50 hover:text-brand-700"
          >
            <IconRoute size={14} /> Directions
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-[13px] font-medium text-ink-subtle">
            <IconPin size={14} /> Location not available
          </span>
        )}
        {place.verified && place.emergencyAvailable && (
          <Link
            href="/emergency"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3.5 py-1.5 text-[13px] font-semibold text-danger"
          >
            <IconAlert size={14} /> Emergency
          </Link>
        )}
        {place.beds && place.beds.availableBeds > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3.5 py-1.5 text-[13px] font-semibold text-emerald-700">
            {place.beds.availableBeds} beds free
          </span>
        )}
        {place.rating.avg != null && (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-amber-700">
            <IconStar size={14} /> {place.rating.avg} ({place.rating.count})
          </span>
        )}
        {place.sourceLabel.includes('OpenStreetMap') && !place.verified && (
          <span className="text-[11px] text-ink-subtle">Unverified listing · info may be incomplete</span>
        )}
      </div>
    </article>
  );
}
