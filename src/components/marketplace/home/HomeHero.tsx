// Haut de page marketplace : bannière promotionnelle, héros avec recherche
// et bandeau de réassurance — contenus pilotés par le SuperAdmin.
import React from 'react';
import { ArrowRight, ChevronDown, MapPin, Search } from 'lucide-react';
import type {
  MarketplaceHeroConfig,
  MarketplacePromoBannerConfig,
  MarketplaceTrustItem,
} from '../../../lib/marketplace-content';
import { DynamicIcon } from './DynamicIcon';

const HERO_VIDEO_SRC = `/assets/video/${encodeURI(
  'Modern Classics Barbershop 📍Charlotte,NC Elite design for the future of barber industry.mp4',
)}`;

export const PromoBanner: React.FC<{ banner: MarketplacePromoBannerConfig }> = ({ banner }) => {
  if (!banner?.enabled) return null;
  return (
    <>
      <aside
        aria-label="Bannière d'annonce"
        className={`py-2.5 px-4 text-center text-xs font-semibold border-b ${
          banner.theme === 'gold'
            ? 'bg-gradient-to-r from-[#211a0e] via-[#332711] to-[#211a0e] border-[#C9A45C]/40 text-[#f7e8c3]'
            : banner.theme === 'emerald'
              ? 'bg-gradient-to-r from-[#0d2217] via-[#143625] to-[#0d2217] border-emerald-500/40 text-emerald-200'
              : 'bg-[#15151b] border-[#292934] text-stone-200'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/40 text-[#E5C378] border border-[#C9A45C]/30">
            {banner.badge}
          </span>
          <span className="font-bold text-white">{banner.title}</span>
          <span className="hidden sm:inline text-stone-300 font-normal">— {banner.description}</span>
          {banner.buttonText && (
            <a
              href={banner.buttonLink || '#salons-section'}
              className="underline underline-offset-4 text-[#C9A45C] hover:text-white font-bold ml-1 inline-flex items-center gap-1"
            >
              <span>{banner.buttonText}</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </aside>
    </>
  );
};

export const HomeHero: React.FC<{
  hero: MarketplaceHeroConfig;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedCommune: string;
  onCommuneChange: (commune: string) => void;
  communes: string[];
  prefersReducedMotion: boolean;
  slowNetwork: boolean;
  videoUnavailable: boolean;
  onVideoError: () => void;
}> = ({
  hero: config,
  searchQuery,
  onSearchQueryChange,
  selectedCommune,
  onCommuneChange,
  communes,
  prefersReducedMotion,
  slowNetwork,
  videoUnavailable,
  onVideoError,
}) => (
  <>
    <section className="relative isolate min-h-[620px] overflow-hidden border-b border-[#1f1f23] bg-[#17130d] md:min-h-[680px]">
      {config.showVideo !== false && !prefersReducedMotion && !slowNetwork && !videoUnavailable && (
        <video
          className="absolute inset-0 h-full w-full object-cover object-[58%_center] sm:object-center"
          src={HERO_VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => onVideoError()}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0d0d0e]/95 via-[#0d0d0e]/75 to-[#0d0d0e]/45"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d0d0e] via-[#0d0d0e]/10 to-transparent"
      />

      <div className="relative z-10 mx-auto flex min-h-[620px] w-full max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8 md:min-h-[680px]">
        <div className="w-full max-w-4xl">
          <p className="mb-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d9b66e]">
            <span aria-hidden="true" className="h-px w-8 bg-[#C9A45C]" />
            {config.badgeText || 'Découvrir les salons'}
          </p>

          <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
            {config.headlineMain || 'Votre style mérite'}
            <br className="hidden sm:block" />{' '}
            <span className="font-serif-luxury font-normal italic text-[#d9b66e]">
              {config.headlineHighlight || 'l’excellence.'}
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-stone-200 sm:text-lg">
            {config.description ||
              'Parcourez les salons qui ont publié leurs informations sur Barber Cuts. Recherchez par nom ou commune pour explorer les résultats disponibles.'}
          </p>

          {/* Formulaire de recherche */}
          <form
            className="mt-9 flex w-full max-w-4xl flex-col gap-2 rounded-2xl border border-white/15 bg-[#111112]/90 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-md sm:flex-row sm:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              const salonSection = document.getElementById('salons-section');
              if (!salonSection) return;

              const stickyHeader = document.querySelector('header');
              const headerOffset =
                stickyHeader && window.getComputedStyle(stickyHeader).position === 'sticky'
                  ? stickyHeader.getBoundingClientRect().height
                  : 0;
              const top = salonSection.getBoundingClientRect().top + window.scrollY - headerOffset - 16;

              window.scrollTo({
                top,
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
              });
            }}
          >
            <div className="relative flex min-w-0 flex-1 items-center rounded-xl border border-transparent transition focus-within:border-[#C9A45C]/60 focus-within:bg-white/[0.03] focus-within:ring-2 focus-within:ring-[#C9A45C]/25">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 h-4 w-4 text-[#d9b66e]"
              />
              <label htmlFor="marketplace-search" className="sr-only">
                {config.searchPlaceholder || 'Rechercher un salon par nom ou commune'}
              </label>
              <input
                id="marketplace-search"
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder={config.searchPlaceholder || 'Nom du salon ou commune'}
                className="w-full rounded-xl bg-transparent py-4 pl-11 pr-4 text-sm text-white placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A45C]/75"
              />
            </div>

            <div aria-hidden="true" className="hidden h-9 w-px bg-white/10 sm:block" />

            <div className="relative w-full rounded-xl border border-transparent transition focus-within:border-[#C9A45C]/60 focus-within:bg-white/[0.03] focus-within:ring-2 focus-within:ring-[#C9A45C]/25 sm:w-56">
              <MapPin
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d9b66e]"
              />
              <label htmlFor="marketplace-commune" className="sr-only">
                Filtrer les salons par commune
              </label>
              <select
                id="marketplace-commune"
                value={selectedCommune}
                onChange={(event) => onCommuneChange(event.target.value)}
                className="w-full cursor-pointer appearance-none rounded-xl bg-transparent py-4 pl-11 pr-10 text-sm text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A45C]/75"
              >
                <option value="all" className="bg-[#17171a] text-white">
                  Toutes les communes
                </option>
                {communes.map((commune) => (
                  <option key={commune} value={commune} className="bg-[#17171a] text-white">
                    {commune}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              />
            </div>

            <button
              type="submit"
              className="flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#C9A45C] px-6 py-4 text-sm font-bold text-[#101010] shadow-md transition-colors hover:bg-[#d6b36a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111112] sm:w-auto"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              <span>{config.ctaText || 'Trouver mon salon'}</span>
            </button>
          </form>

          <p className="mt-4 flex items-center gap-2 text-xs text-stone-300">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#d9b66e]" />
            Les résultats reflètent les salons publiés sur la plateforme.
          </p>
        </div>
      </div>
    </section>
  </>
);

export const TrustBanner: React.FC<{ items: MarketplaceTrustItem[] }> = ({ items }) => {
  if (items.filter((t) => t.isVisible).length === 0) return null;
  return (
    <>
      <section className="bg-[#101014] border-b border-[#1c1c24] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {items
              .filter((t) => t.isVisible)
              .map((item) => (
                <div key={item.id} className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#1b1913] border border-[#C9A45C]/30 flex items-center justify-center shrink-0">
                    <DynamicIcon name={item.iconName} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{item.title}</div>
                    <div className="text-[11px] text-stone-400">{item.subtitle}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>
    </>
  );
};
