import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Award, ChevronLeft, ChevronRight, Heart, MapPin, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { useMarketplaceApp } from '../../context/useMarketplaceApp';
import { useOptionalAuth } from '../../context/AuthContext';
import {
  isSalonRecommendedByHistory,
  selectTopRatedBarbers,
  useMarketplaceContent,
} from '../../lib/marketplace-content';
import type { Salon } from '../../types';

interface FeaturedBarbersSectionProps {
  salons: Salon[];
}

const SALON_TYPE_LABELS: Record<string, string> = {
  barbershop: 'Barbershop',
  salon_femme: 'Salon femme',
  salon_mixte: 'Salon mixte',
  institut: 'Institut de beauté',
};

export const FeaturedBarbersSection: React.FC<FeaturedBarbersSectionProps> = ({ salons }) => {
  const routed = useInRouterContext();
  const { setSelectedSalonForModal, formatPrice, isFavoriteSalon, toggleFavoriteSalon, searchedCategories } =
    useMarketplaceApp();
  const { isAuthenticated, user } = useOptionalAuth();
  const { config } = useMarketplaceContent();
  const isLoggedIn = Boolean(isAuthenticated && user);
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasAppeared, setHasAppeared] = useState(() => typeof IntersectionObserver === 'undefined');

  const featuredSalons = useMemo(() => selectTopRatedBarbers(salons, 8), [salons]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [updateScrollButtons, featuredSalons.length]);

  useEffect(() => {
    if (hasAppeared || featuredSalons.length === 0) return;
    const target = sectionRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setHasAppeared(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasAppeared(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasAppeared, featuredSalons.length]);

  if (featuredSalons.length === 0) return null;

  const scrollByOffset = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: delta, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby="featured-barbers-heading"
      data-testid="featured-barbers-section"
      className="pt-14 pb-2 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full"
    >
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#C9A45C] font-semibold inline-flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" aria-hidden="true" />
            Sélection les mieux notés
          </span>
          <h2
            id="featured-barbers-heading"
            className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance mt-1"
          >
            Barbiers à la une
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-1">
            Les salons plébiscités par les clients pour la qualité de leurs prestations.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollByOffset(-330)}
            disabled={!canScrollLeft}
            aria-label="Défiler les barbiers à la une vers la gauche"
            className="w-9 h-9 rounded-xl bg-[#161619] border border-[#27272c] text-stone-300 hover:text-white hover:border-[#C9A45C]/50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByOffset(330)}
            disabled={!canScrollRight}
            aria-label="Défiler les barbiers à la une vers la droite"
            className="w-9 h-9 rounded-xl bg-[#161619] border border-[#27272c] text-stone-300 hover:text-white hover:border-[#C9A45C]/50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollButtons}
        data-testid="featured-barbers-rail"
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-none pb-2"
      >
        {featuredSalons.map((salon, index) => {
          const locationLabel =
            [salon.commune, salon.quarter, salon.city].filter(Boolean).slice(0, 2).join(', ') ||
            salon.address ||
            '';
          const typeLabel = salon.type ? SALON_TYPE_LABELS[salon.type] : '';
          const metaLine = [typeLabel, locationLabel].filter(Boolean).join(' · ');
          const showcaseHref = `/salons/${salon.slug || salon.id}`;
          const isFavorite = isFavoriteSalon(salon.id);
          const isRecommended = isSalonRecommendedByHistory(salon, searchedCategories, config.categories);

          return (
            <article
              key={salon.id}
              data-testid={`featured-barber-card-${salon.id}`}
              className="group w-[280px] sm:w-[310px] shrink-0 snap-start bg-[#161619] hover:bg-[#1b1b20] border border-[#27272c] hover:border-[#C9A45C]/50 rounded-2xl overflow-hidden transition-colors duration-200 flex flex-col"
            >
              <div
                onClick={() => setSelectedSalonForModal(salon)}
                className="relative aspect-[16/10] w-full overflow-hidden bg-[#111113] cursor-pointer"
              >
                {salon.coverImage ? (
                  <img
                    src={salon.coverImage}
                    alt={salon.name}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="w-full h-full bg-gradient-to-br from-[#231d12] via-[#17171b] to-[#0c0c0e]"
                  />
                )}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#161619] via-transparent to-black/25"
                />

                <span className="pointer-events-none absolute top-3 left-3 text-[11px] font-bold tabular-nums text-[#E5C378] bg-[#101010]/85 px-2 py-0.5 rounded-md border border-[#C9A45C]/30">
                  #{index + 1}
                </span>

                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                  {salon.isVerified && (
                    <span className="pointer-events-none text-[11px] font-medium text-stone-100 bg-[#101010]/80 px-2 py-0.5 rounded-md border border-white/10 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#C9A45C]" aria-hidden="true" />
                      <span>Certifié</span>
                    </span>
                  )}

                  <button
                    type="button"
                    data-testid={`featured-favorite-toggle-${salon.id}`}
                    aria-pressed={isFavorite}
                    aria-label={
                      isLoggedIn
                        ? isFavorite
                          ? 'Retirer des favoris'
                          : 'Ajouter aux favoris'
                        : 'Connectez-vous pour ajouter aux favoris'
                    }
                    title={
                      isLoggedIn
                        ? isFavorite
                          ? 'Retirer des favoris'
                          : 'Ajouter aux favoris'
                        : 'Connectez-vous pour ajouter aux favoris'
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleFavoriteSalon(salon.id);
                    }}
                    className={`w-8 h-8 rounded-full backdrop-blur-md border flex items-center justify-center transition-colors cursor-pointer ${
                      isFavorite
                        ? 'bg-rose-950/80 border-rose-400/50 text-rose-400 hover:bg-rose-900/90'
                        : 'bg-[#101010]/75 border-white/15 text-stone-200 hover:text-white hover:border-[#C9A45C]/50'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform ${isFavorite ? 'fill-rose-500 text-rose-500 scale-105' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSalonForModal(salon)}
                className="text-left p-4 flex flex-col flex-1 gap-2 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A45C] cursor-pointer"
              >
                {isRecommended && (
                  <span
                    data-testid={`featured-recommended-badge-${salon.id}`}
                    title="Recommandé selon vos recherches de catégories récentes"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E5C378]"
                  >
                    <Sparkles className="w-3 h-3 text-[#C9A45C]" aria-hidden="true" />
                    <span>Recommandé</span>
                  </span>
                )}
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    {salon.logo && (
                      <img
                        src={salon.logo}
                        alt=""
                        aria-hidden="true"
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-lg object-cover border border-[#C9A45C]/40 shrink-0"
                      />
                    )}
                    <h3 className="text-base font-bold text-white group-hover:text-[#C9A45C] transition-colors line-clamp-1">
                      {salon.name}
                    </h3>
                  </div>

                  {typeof salon.rating === 'number' && salon.rating > 0 && (
                    <div
                      className="flex items-center gap-1 text-xs font-semibold text-amber-300 shrink-0 tabular-nums"
                      aria-label={`Note ${salon.rating.toFixed(1)} sur 5`}
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                      <span>{salon.rating.toFixed(1)}</span>
                      {typeof salon.reviewCount === 'number' && (
                        <span className="text-stone-400 font-normal">({salon.reviewCount})</span>
                      )}
                    </div>
                  )}
                </div>

                {metaLine && (
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" aria-hidden="true" />
                    <span className="line-clamp-1">{metaLine}</span>
                  </div>
                )}
              </button>

              <div className="px-4 py-3 border-t border-[#242428] flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-stone-400 block text-[11px]">À partir de</span>
                  <span className="font-bold text-[#E5C378] text-sm tabular-nums truncate block">
                    {salon.minPrice !== undefined ? formatPrice(salon.minPrice) : 'Sur fiche'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!salon.isDemo &&
                    (routed ? (
                      <Link
                        to={showcaseHref}
                        className="text-[11px] font-medium text-stone-300 hover:text-[#C9A45C] px-2.5 py-1.5 rounded-lg bg-[#1d1d21] hover:bg-[#25252b] border border-stone-800 transition-colors"
                      >
                        Vitrine
                      </Link>
                    ) : (
                      <a
                        href={showcaseHref}
                        className="text-[11px] font-medium text-stone-300 hover:text-[#C9A45C] px-2.5 py-1.5 rounded-lg bg-[#1d1d21] hover:bg-[#25252b] border border-stone-800 transition-colors"
                      >
                        Vitrine
                      </a>
                    ))}

                  <button
                    type="button"
                    onClick={() => setSelectedSalonForModal(salon)}
                    style={hasAppeared ? { animationDelay: `${index * 90}ms` } : undefined}
                    className={`text-xs font-semibold text-[#101010] bg-[#C9A45C] hover:bg-[#d8b46c] px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      hasAppeared ? 'featured-book-pulse' : ''
                    }`}
                  >
                    Réserver
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
