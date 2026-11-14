import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ArrowUpRight, Loader2, MapPin, Navigation, Star } from 'lucide-react';
import { useMarketplaceApp } from '../../context/useMarketplaceApp';
import type { Salon } from '../../types';

interface MarketplaceMapViewProps {
  salons: Salon[];
}

interface ResolvedSalonCoordinate {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

const DEFAULT_MAP_CENTER = {
  lat: 5.36,
  lng: -4.008,
};

const SALON_TYPE_LABELS: Record<string, string> = {
  barbershop: 'Barbershop',
  salon_femme: 'Salon femme',
  salon_mixte: 'Salon mixte',
  institut: 'Institut de beauté',
};

function buildSalonLocationQuery(salon: Salon): string {
  return [salon.name, salon.address, salon.quarter, salon.commune, salon.city, salon.country]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');
}

function formatSalonAddressLine(salon: Salon): string {
  return (
    [salon.address, salon.quarter, salon.commune, salon.city]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(', ') || 'Adresse non renseignée'
  );
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes('RESOURCE_EXHAUSTED') || message.includes('OVER_QUERY_LIMIT') || message.includes('429')
  );
}

interface SalonMarkerProps {
  salon: Salon;
  position: ResolvedSalonCoordinate;
  isSelected: boolean;
  onSelect: (salonId: string) => void;
  onReserve: (salon: Salon) => void;
  formatPrice: (amount: number) => string;
  routed: boolean;
}

const SalonAdvancedMarker: React.FC<SalonMarkerProps> = ({
  salon,
  position,
  isSelected,
  onSelect,
  onReserve,
  formatPrice,
  routed,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const showcaseHref = `/salons/${salon.slug || salon.id}`;
  const locationLabel = position.formattedAddress || formatSalonAddressLine(salon);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: position.lat, lng: position.lng }}
        title={salon.name}
        zIndex={isSelected ? 10 : 1}
        onClick={() => onSelect(salon.id)}
      >
        <Pin
          background={isSelected ? '#E5C378' : '#C9A45C'}
          borderColor="#101010"
          glyphColor="#101010"
          scale={isSelected ? 1.2 : 1}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={260} onCloseClick={() => onSelect('')}>
          <div className="p-1 text-[#101010] min-w-[200px]">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold leading-snug">{salon.name}</h3>
              {typeof salon.rating === 'number' && salon.rating > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-700 shrink-0 tabular-nums">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" aria-hidden="true" />
                  {salon.rating.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-1 leading-snug">{locationLabel}</p>
            <div className="mt-2 pt-2 border-t border-stone-200 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-stone-900 tabular-nums">
                {salon.minPrice !== undefined ? `Dès ${formatPrice(salon.minPrice)}` : 'Sur fiche'}
              </span>
              <div className="flex items-center gap-1.5">
                {!salon.isDemo &&
                  (routed ? (
                    <Link
                      to={showcaseHref}
                      className="text-[11px] font-medium text-stone-700 hover:text-black underline"
                    >
                      Vitrine
                    </Link>
                  ) : (
                    <a
                      href={showcaseHref}
                      className="text-[11px] font-medium text-stone-700 hover:text-black underline"
                    >
                      Vitrine
                    </a>
                  ))}
                <button
                  type="button"
                  onClick={() => onReserve(salon)}
                  className="text-[11px] font-semibold bg-[#101010] text-[#E5C378] px-2.5 py-1 rounded-md cursor-pointer"
                >
                  Réserver
                </button>
              </div>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface GoogleMapCanvasProps {
  salons: Salon[];
  selectedSalonId: string;
  onSelectSalon: (salonId: string) => void;
  onReserve: (salon: Salon) => void;
  coordinatesBySalonId: Record<string, ResolvedSalonCoordinate>;
  onResolveCoordinates: (updates: Record<string, ResolvedSalonCoordinate>) => void;
  onResolvingChange: (resolving: boolean) => void;
  onLookupErrorChange: (message: string | null) => void;
  formatPrice: (amount: number) => string;
  routed: boolean;
}

const MarketplaceGoogleMapInner: React.FC<GoogleMapCanvasProps> = ({
  salons,
  selectedSalonId,
  onSelectSalon,
  onReserve,
  coordinatesBySalonId,
  onResolveCoordinates,
  onResolvingChange,
  onLookupErrorChange,
  formatPrice,
  routed,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const coreLib = useMapsLibrary('core');
  const attemptedQueriesRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!placesLib) return;

    const pending = salons.filter((salon) => {
      if (typeof salon.latitude === 'number' && typeof salon.longitude === 'number') return false;
      if (coordinatesBySalonId[salon.id]) return false;
      const query = buildSalonLocationQuery(salon);
      if (!query) return false;
      return !attemptedQueriesRef.current[`${salon.id}:${query}`];
    });

    if (pending.length === 0) {
      onResolvingChange(false);
      return;
    }

    let cancelled = false;
    onResolvingChange(true);
    onLookupErrorChange(null);

    void (async () => {
      const updates: Record<string, ResolvedSalonCoordinate> = {};
      try {
        for (const salon of pending) {
          if (cancelled) return;
          const query = buildSalonLocationQuery(salon);
          attemptedQueriesRef.current[`${salon.id}:${query}`] = true;

          const response = await placesLib.Place.searchByText({
            textQuery: query,
            fields: ['id', 'displayName', 'location', 'formattedAddress'],
            maxResultCount: 1,
            language: 'fr',
          });

          const matchedPlace = response?.places?.[0];
          const location = matchedPlace?.location;
          if (location) {
            updates[salon.id] = {
              lat: location.lat(),
              lng: location.lng(),
              formattedAddress: matchedPlace.formattedAddress ?? undefined,
            };
          }
        }
        if (!cancelled && Object.keys(updates).length > 0) {
          onResolveCoordinates(updates);
        }
      } catch (error) {
        if (cancelled) return;
        if (isQuotaError(error) && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onLookupErrorChange('Certaines positions sur la carte n’ont pas pu être localisées automatiquement.');
      } finally {
        if (!cancelled) {
          onResolvingChange(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placesLib, salons, coordinatesBySalonId, onResolveCoordinates, onResolvingChange, onLookupErrorChange]);

  const resolvedEntries = useMemo(
    () =>
      salons
        .map((salon) => {
          const explicit =
            typeof salon.latitude === 'number' && typeof salon.longitude === 'number'
              ? { lat: salon.latitude, lng: salon.longitude }
              : coordinatesBySalonId[salon.id];
          return explicit ? { salon, coord: explicit } : null;
        })
        .filter((entry): entry is { salon: Salon; coord: ResolvedSalonCoordinate } => Boolean(entry)),
    [salons, coordinatesBySalonId],
  );

  useEffect(() => {
    if (!map || !coreLib || resolvedEntries.length === 0) return;

    if (resolvedEntries.length === 1) {
      map.panTo({ lat: resolvedEntries[0].coord.lat, lng: resolvedEntries[0].coord.lng });
      const currentZoom = map.getZoom();
      if (!currentZoom || currentZoom < 12 || currentZoom > 16) {
        map.setZoom(14);
      }
      return;
    }

    const bounds = new coreLib.LatLngBounds();
    resolvedEntries.forEach(({ coord }) => {
      bounds.extend({ lat: coord.lat, lng: coord.lng });
    });
    map.fitBounds(bounds, 48);
  }, [map, coreLib, resolvedEntries]);

  useEffect(() => {
    if (!map || !selectedSalonId) return;
    const target = resolvedEntries.find((entry) => entry.salon.id === selectedSalonId);
    if (target) {
      map.panTo({ lat: target.coord.lat, lng: target.coord.lng });
    }
  }, [map, selectedSalonId, resolvedEntries]);

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      defaultCenter={DEFAULT_MAP_CENTER}
      defaultZoom={12}
      gestureHandling="greedy"
      onClick={() => onSelectSalon('')}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      className="w-full h-full"
    >
      {resolvedEntries.map(({ salon, coord }) => (
        <SalonAdvancedMarker
          key={salon.id}
          salon={salon}
          position={coord}
          isSelected={selectedSalonId === salon.id}
          onSelect={onSelectSalon}
          onReserve={onReserve}
          formatPrice={formatPrice}
          routed={routed}
        />
      ))}
    </GoogleMap>
  );
};

export const MarketplaceMapView: React.FC<MarketplaceMapViewProps> = ({ salons }) => {
  const routed = useInRouterContext();
  const { setSelectedSalonForModal, formatPrice } = useMarketplaceApp();
  const [selectedSalonId, setSelectedSalonId] = useState<string>('');
  const [coordinatesBySalonId, setCoordinatesBySalonId] = useState<Record<string, ResolvedSalonCoordinate>>(
    {},
  );
  const [resolving, setResolving] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const mapsApiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';

  const mergeCoordinates = React.useCallback((updates: Record<string, ResolvedSalonCoordinate>) => {
    setCoordinatesBySalonId((prev) => ({ ...prev, ...updates }));
  }, []);

  const locatedCount = useMemo(
    () =>
      salons.filter(
        (salon) =>
          (typeof salon.latitude === 'number' && typeof salon.longitude === 'number') ||
          Boolean(coordinatesBySalonId[salon.id]),
      ).length,
    [salons, coordinatesBySalonId],
  );

  return (
    <div data-testid="marketplace-map-view" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#27272c] bg-[#141418] relative h-[420px] sm:h-[480px] lg:h-[540px]">
        {mapsApiKey ? (
          <APIProvider apiKey={mapsApiKey} libraries={['marker', 'places']} language="fr" region="CI">
            <MarketplaceGoogleMapInner
              salons={salons}
              selectedSalonId={selectedSalonId}
              onSelectSalon={setSelectedSalonId}
              onReserve={(salon) => setSelectedSalonForModal(salon)}
              coordinatesBySalonId={coordinatesBySalonId}
              onResolveCoordinates={mergeCoordinates}
              onResolvingChange={setResolving}
              onLookupErrorChange={setLookupError}
              formatPrice={formatPrice}
              routed={routed}
            />
          </APIProvider>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#181510] via-[#121215] to-[#0d0d0e]">
            <div className="w-12 h-12 rounded-2xl bg-[#1f1b13] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] mb-4">
              <Navigation className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-white">Vue géographique des salons</h3>
            <p className="text-xs sm:text-sm text-stone-400 mt-1.5 max-w-md leading-relaxed">
              Consultez la liste géographique ci-contre pour explorer les établissements par ville, commune et
              quartier. La carte interactive Google Maps s’active automatiquement lorsque{' '}
              <code className="text-[#E5C378]">VITE_GOOGLE_MAPS_API_KEY</code> est configurée.
            </p>
          </div>
        )}

        {mapsApiKey && resolving && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#101010]/90 border border-[#27272c] text-xs text-stone-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A45C]" aria-hidden="true" />
            <span>Localisation des salons…</span>
          </div>
        )}

        {mapsApiKey && lookupError && (
          <div
            role="status"
            className="absolute bottom-3 left-3 right-3 z-10 px-3 py-2 rounded-xl bg-[#101010]/90 border border-amber-500/30 text-xs text-amber-200"
          >
            {lookupError}
          </div>
        )}
      </div>

      <div className="lg:col-span-5 rounded-2xl border border-[#27272c] bg-[#141418] flex flex-col max-h-[540px]">
        <div className="px-4 py-3 border-b border-[#232329] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
            <span className="text-sm font-bold text-white">Adresses & zones</span>
          </div>
          <span className="text-xs text-stone-400 tabular-nums">
            {mapsApiKey
              ? `${locatedCount}/${salons.length} localisé(s)`
              : `${salons.length} établissement(s)`}
          </span>
        </div>

        <ul className="divide-y divide-[#202026] overflow-y-auto flex-1">
          {salons.map((salon) => {
            const isSelected = selectedSalonId === salon.id;
            const resolved = coordinatesBySalonId[salon.id];
            const addressLine = resolved?.formattedAddress || formatSalonAddressLine(salon);
            const typeLabel = salon.type ? SALON_TYPE_LABELS[salon.type] : undefined;
            const showcaseHref = `/salons/${salon.slug || salon.id}`;
            const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              buildSalonLocationQuery(salon),
            )}`;

            return (
              <li
                key={salon.id}
                className={`p-4 transition-colors ${isSelected ? 'bg-[#1d1a12]' : 'hover:bg-[#19191f]'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSalonId(salon.id);
                      if (!mapsApiKey) {
                        setSelectedSalonForModal(salon);
                      }
                    }}
                    className="text-left flex-1 min-w-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold truncate ${
                          isSelected ? 'text-[#E5C378]' : 'text-white'
                        }`}
                      >
                        {salon.name}
                      </span>
                      {typeof salon.rating === 'number' && salon.rating > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-300 shrink-0 tabular-nums">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                          {salon.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400 mt-1 line-clamp-2">
                      {typeLabel ? `${typeLabel} · ${addressLine}` : addressLine}
                    </p>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!salon.isDemo &&
                      (routed ? (
                        <Link
                          to={showcaseHref}
                          className="text-[11px] font-medium text-stone-300 hover:text-[#C9A45C] px-2 py-1 rounded-lg bg-[#1d1d23] border border-stone-800"
                        >
                          Vitrine
                        </Link>
                      ) : (
                        <a
                          href={showcaseHref}
                          className="text-[11px] font-medium text-stone-300 hover:text-[#C9A45C] px-2 py-1 rounded-lg bg-[#1d1d23] border border-stone-800"
                        >
                          Vitrine
                        </a>
                      ))}
                    <button
                      type="button"
                      onClick={() => setSelectedSalonForModal(salon)}
                      className="text-xs font-semibold bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Réserver
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
                  <span className="tabular-nums text-[#E5C378] font-semibold">
                    {salon.minPrice !== undefined
                      ? `À partir de ${formatPrice(salon.minPrice)}`
                      : 'Sur fiche'}
                  </span>
                  <a
                    href={externalMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-stone-400 hover:text-white transition-colors"
                  >
                    <span>Google Maps</span>
                    <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
