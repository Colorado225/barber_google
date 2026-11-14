import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  LayoutGrid,
  Map as MapIcon,
  Menu,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  X,
} from 'lucide-react';
import { useOptionalApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import {
  computeMarketplacePriceBounds,
  useMarketplaceContent,
  type MarketplaceCategoryItem,
} from '../../lib/marketplace-content';

const getCategoryIcon = (iconName: string, isActive: boolean) => {
  const cls = `w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#101010]' : 'text-[#C9A45C]'}`;
  switch (iconName) {
    case 'Scissors':
      return <Scissors className={cls} aria-hidden="true" />;
    case 'Clock':
      return <Clock className={cls} aria-hidden="true" />;
    case 'Star':
      return <Star className={cls} aria-hidden="true" />;
    case 'ShieldCheck':
      return <ShieldCheck className={cls} aria-hidden="true" />;
    case 'Award':
      return <Award className={cls} aria-hidden="true" />;
    case 'Sparkles':
    default:
      return <Sparkles className={cls} aria-hidden="true" />;
  }
};

function scrollToSalonsSection() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const salonsSection = document.getElementById('salons-section');
  if (!salonsSection) return;

  const rect = salonsSection.getBoundingClientRect();
  // Ne défile que si la grille des salons est encore sous la ligne de flottaison.
  if (rect.top <= window.innerHeight * 0.65 && rect.bottom >= 120) return;

  const stickyHeader = document.querySelector('header');
  const headerOffset =
    stickyHeader && window.getComputedStyle(stickyHeader).position === 'sticky'
      ? stickyHeader.getBoundingClientRect().height
      : 0;
  const top = Math.max(0, rect.top + window.scrollY - headerOffset - 16);
  const reducedMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.scrollTo({
    top,
    behavior: reducedMotion ? 'auto' : 'smooth',
  });
}

interface CategoryStripProps {
  categories: MarketplaceCategoryItem[];
  selectedCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  pathname: string;
  onNavigateHome?: () => void;
}

const MarketplaceCategoryStrip: React.FC<CategoryStripProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  pathname,
  onNavigateHome,
}) => {
  const visibleCategories = categories.filter((c) => c.isVisible);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
  }, [updateScrollButtons, visibleCategories.length]);

  if (visibleCategories.length === 0) return null;

  const scrollByOffset = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const handleCategoryClick = (slug: string | null) => {
    const nextSlug = slug !== null && selectedCategory === slug ? null : slug;
    onSelectCategory(nextSlug);
    if (pathname !== '/' && onNavigateHome) {
      onNavigateHome();
      return;
    }
    if (nextSlug !== null) {
      scrollToSalonsSection();
    }
  };

  return (
    <nav aria-label="Catégories de prestations" className="relative flex-1 min-w-0 flex items-center gap-1.5">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByOffset(-220)}
          aria-label="Défiler les catégories vers la gauche"
          className="hidden sm:flex shrink-0 w-7 h-7 items-center justify-center rounded-full bg-[#1a1a20] border border-[#2d2d35] text-stone-300 hover:text-white hover:border-[#C9A45C]/50 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={updateScrollButtons}
        data-testid="marketplace-header-categories"
        className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth py-1.5 sm:py-2"
      >
        <button
          type="button"
          onClick={() => handleCategoryClick(null)}
          aria-pressed={!selectedCategory}
          className={`px-3.5 py-1 sm:py-1.5 rounded-xl text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            !selectedCategory
              ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
              : 'bg-[#16161b] text-stone-300 hover:text-white hover:border-[#C9A45C]/40 border border-[#262632] font-medium'
          }`}
        >
          Tous les services
        </button>

        {visibleCategories.map((cat) => {
          const isSelected = selectedCategory === cat.slug;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat.slug)}
              aria-pressed={isSelected}
              title={cat.description || cat.label}
              className={`px-3.5 py-1 sm:py-1.5 rounded-xl text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#C9A45C] text-[#101010] font-bold shadow-sm'
                  : 'bg-[#16161b] text-stone-300 hover:text-white hover:border-[#C9A45C]/40 border border-[#262632] font-medium'
              }`}
            >
              {getCategoryIcon(cat.iconName, isSelected)}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByOffset(220)}
          aria-label="Défiler les catégories vers la droite"
          className="hidden sm:flex shrink-0 w-7 h-7 items-center justify-center rounded-full bg-[#1a1a20] border border-[#2d2d35] text-stone-300 hover:text-white hover:border-[#C9A45C]/50 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </nav>
  );
};

interface PriceRangeSliderProps {
  bounds: { min: number; max: number; step: number };
  priceRange: [number, number] | null;
  onChange: (range: [number, number] | null) => void;
  formatPrice: (amount: number) => string;
  pathname: string;
  onNavigateHome?: () => void;
}

const MarketplacePriceRangeFilter: React.FC<PriceRangeSliderProps> = ({
  bounds,
  priceRange,
  onChange,
  formatPrice,
  pathname,
  onNavigateHome,
}) => {
  const currentMin = priceRange ? Math.max(bounds.min, Math.min(priceRange[0], bounds.max)) : bounds.min;
  const currentMax = priceRange ? Math.min(bounds.max, Math.max(priceRange[1], currentMin)) : bounds.max;
  const isFiltered = Boolean(priceRange && (currentMin > bounds.min || currentMax < bounds.max));

  const span = Math.max(1, bounds.max - bounds.min);
  const leftPercent = ((currentMin - bounds.min) / span) * 100;
  const rightPercent = 100 - ((currentMax - bounds.min) / span) * 100;

  const commitRange = (nextMin: number, nextMax: number) => {
    if (nextMin <= bounds.min && nextMax >= bounds.max) {
      onChange(null);
    } else {
      onChange([nextMin, nextMax]);
    }
    if (pathname !== '/' && onNavigateHome) {
      onNavigateHome();
    }
  };

  return (
    <div
      data-testid="marketplace-price-filter"
      className="shrink-0 lg:w-[295px] xl:w-[320px] flex flex-col justify-center gap-1 py-1.5 lg:border-l lg:border-[#22222b] lg:pl-4"
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-stone-400 whitespace-nowrap">Prix moyen</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            data-testid="marketplace-price-label"
            className="font-semibold text-[#E5C378] tabular-nums whitespace-nowrap"
          >
            {formatPrice(currentMin)} – {formatPrice(currentMax)}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Réinitialiser la fourchette de prix"
              className="p-0.5 rounded text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="relative h-5 flex items-center">
        <div className="relative w-full h-1.5 rounded-full bg-[#24242d]">
          <div
            className="absolute inset-y-0 rounded-full bg-[#C9A45C]"
            style={{
              left: `${leftPercent}%`,
              right: `${rightPercent}%`,
            }}
          />
        </div>

        <input
          type="range"
          data-testid="price-range-min"
          aria-label="Prix moyen minimum"
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          value={currentMin}
          onChange={(event) => {
            const nextMin = Math.min(Number(event.target.value), currentMax);
            commitRange(nextMin, currentMax);
          }}
          style={{ zIndex: currentMin > bounds.max - bounds.step ? 5 : 3 }}
          className="price-range-slider-input absolute inset-0 w-full h-full m-0 focus-visible:outline-none"
        />

        <input
          type="range"
          data-testid="price-range-max"
          aria-label="Prix moyen maximum"
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          value={currentMax}
          onChange={(event) => {
            const nextMax = Math.max(Number(event.target.value), currentMin);
            commitRange(currentMin, nextMax);
          }}
          style={{ zIndex: 4 }}
          className="price-range-slider-input absolute inset-0 w-full h-full m-0 focus-visible:outline-none"
        />
      </div>
    </div>
  );
};

interface NavbarShellProps {
  routed: boolean;
  pathname: string;
  onNavigateHome?: () => void;
}

const NavbarShell: React.FC<NavbarShellProps> = ({ routed, pathname, onNavigateHome }) => {
  const {
    mode,
    setMode,
    salons,
    activeSalon,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    priceRange,
    setPriceRange,
    marketplaceViewMode,
    setMarketplaceViewMode,
    favoriteSalonIds,
    formatPrice,
  } = useOptionalApp();
  const { isAuthenticated, user } = useOptionalAuth();
  const { config } = useMarketplaceContent();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showFavoritesTab = Boolean(isAuthenticated && user);

  const publishedSalons = salons.filter(
    (salon) => salon.isPublishedOnMarketplace === true && salon.status !== 'suspended',
  );
  const priceBounds = computeMarketplacePriceBounds(publishedSalons);

  const isMarketplaceBrowsingRoute = !routed || pathname === '/' || pathname.startsWith('/salons/');
  const showMarketplaceTools = mode === 'marketplace' && isMarketplaceBrowsingRoute;

  const handleHeaderSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (routed && pathname !== '/' && onNavigateHome) {
      onNavigateHome();
      return;
    }
    scrollToSalonsSection();
  };

  const handleToggleMarketplaceView = () => {
    const nextView = marketplaceViewMode === 'map' ? 'list' : 'map';
    setMarketplaceViewMode(nextView);
    if (routed && pathname !== '/' && onNavigateHome) {
      onNavigateHome();
      return;
    }
    scrollToSalonsSection();
  };

  const homeLink = routed ? (
    <Link to="/" className="flex items-center gap-3 group text-left shrink-0">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b1a17] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] group-hover:scale-105 transition-transform">
        <Scissors className="w-4 h-4 sm:w-5 sm:h-5 rotate-90" />
      </div>
      <div className="flex flex-col">
        <span className="text-lg sm:text-xl font-bold tracking-tight text-white">
          Barber<span className="text-[#C9A45C]">Cuts</span>
        </span>
        <span className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium leading-none">
          {mode === 'erp' ? 'Business ERP' : 'Marketplace'}
        </span>
      </div>
    </Link>
  ) : (
    <button
      onClick={() => setMode('marketplace')}
      className="flex items-center gap-3 group text-left shrink-0"
    >
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b1a17] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] group-hover:scale-105 transition-transform">
        <Scissors className="w-4 h-4 sm:w-5 sm:h-5 rotate-90" />
      </div>
      <div className="flex flex-col">
        <span className="text-lg sm:text-xl font-bold tracking-tight text-white">
          Barber<span className="text-[#C9A45C]">Cuts</span>
        </span>
        <span className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium leading-none">
          Marketplace
        </span>
      </div>
    </button>
  );

  const authLinks = routed ? (
    <>
      <Link
        to="/tarifs"
        className="text-sm font-medium text-stone-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#C9A45C]" />
        <span>Tarifs Salons</span>
      </Link>
      {showFavoritesTab && (
        <Link
          to="/mes-favoris"
          data-testid="navbar-favorites-tab"
          className={`text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            pathname === '/mes-favoris' ? 'text-[#E5C378]' : 'text-stone-300 hover:text-white'
          }`}
        >
          <Heart
            className={`w-3.5 h-3.5 ${
              favoriteSalonIds.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-[#C9A45C]'
            }`}
            aria-hidden="true"
          />
          <span>Mes favoris</span>
          {favoriteSalonIds.length > 0 && (
            <span className="text-[11px] font-bold text-[#E5C378] tabular-nums">
              ({favoriteSalonIds.length})
            </span>
          )}
        </Link>
      )}
      {config.navTabs
        ?.filter(
          (t) =>
            t.isVisible &&
            !['/', '/tarifs', '/mes-favoris', '/connexion', '/inscription', '/app/tableau-de-bord'].includes(
              t.path,
            ),
        )
        .map((customTab) => (
          <a
            key={customTab.id}
            href={customTab.path}
            className="text-sm font-medium text-stone-300 hover:text-white whitespace-nowrap"
          >
            {customTab.label}
          </a>
        ))}
      <Link to="/connexion" className="text-sm font-medium text-stone-300 hover:text-white whitespace-nowrap">
        Connexion
      </Link>
      <Link
        to="/inscription"
        className="bg-[#C9A45C] text-[#101010] font-semibold text-sm px-3.5 py-2 rounded-lg whitespace-nowrap"
      >
        Inscrire mon salon
      </Link>
      <Link
        to="/app/tableau-de-bord"
        className="text-sm font-medium text-stone-300 hover:text-[#C9A45C] flex items-center gap-1.5 whitespace-nowrap"
      >
        <Store className="w-4 h-4 shrink-0" />
        <span>Espace salon</span>
      </Link>
    </>
  ) : (
    <>
      <button
        onClick={() => setMode('marketplace')}
        className="text-sm font-medium text-white whitespace-nowrap"
      >
        Explorer
      </button>
      {showFavoritesTab && (
        <a
          href="/mes-favoris"
          data-testid="navbar-favorites-tab"
          className="text-sm font-medium text-stone-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap"
        >
          <Heart className="w-3.5 h-3.5 text-[#C9A45C]" aria-hidden="true" />
          <span>Mes favoris</span>
        </a>
      )}
      {!showFavoritesTab && (
        <span className="text-sm text-stone-500 whitespace-nowrap">
          Connectez-vous pour accéder à votre espace.
        </span>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-[#101010]/95 backdrop-blur-md border-b border-[#232326]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 md:py-0 md:h-[4.25rem] flex flex-wrap md:flex-nowrap items-center justify-between gap-x-4 gap-y-2">
        <div className="order-1 flex items-center gap-4 shrink-0">
          {homeLink}
          {mode === 'erp' && activeSalon && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#18181b] border border-[#2d2d32] text-xs text-stone-300">
              <Building2 className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span className="font-medium text-white">{activeSalon.name}</span>
            </div>
          )}
        </div>

        {showMarketplaceTools && (
          <div className="order-3 w-full md:order-2 md:flex-1 md:max-w-md lg:max-w-lg flex items-center gap-2">
            <form role="search" onSubmit={handleHeaderSearchSubmit} className="flex-1 min-w-0">
              <label htmlFor="marketplace-header-search" className="sr-only">
                Rechercher un salon par nom ou localisation
              </label>
              <div className="relative flex items-center rounded-xl bg-[#16161b] border border-[#282832] focus-within:border-[#C9A45C]/60 focus-within:ring-2 focus-within:ring-[#C9A45C]/25 transition-colors">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 w-3.5 h-3.5 text-[#C9A45C]"
                />
                <input
                  id="marketplace-header-search"
                  data-testid="marketplace-header-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Salon, ville, commune ou quartier…"
                  className="w-full rounded-xl bg-transparent py-1.5 sm:py-2 pl-9 pr-8 text-xs sm:text-sm text-white placeholder:text-stone-400 focus-visible:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Effacer la recherche"
                    className="absolute right-2 p-1 rounded-md text-stone-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </form>

            <button
              type="button"
              data-testid="marketplace-view-toggle"
              onClick={handleToggleMarketplaceView}
              aria-pressed={marketplaceViewMode === 'map'}
              aria-label={
                marketplaceViewMode === 'map'
                  ? 'Afficher la liste des salons'
                  : 'Afficher la carte des salons'
              }
              title={
                marketplaceViewMode === 'map'
                  ? 'Passer à la vue liste en cartes'
                  : 'Passer à la vue carte géographique'
              }
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                marketplaceViewMode === 'map'
                  ? 'bg-[#C9A45C] text-[#101010] border-[#C9A45C] shadow-sm'
                  : 'bg-[#16161b] text-stone-200 border-[#282832] hover:border-[#C9A45C]/50 hover:text-white'
              }`}
            >
              {marketplaceViewMode === 'map' ? (
                <>
                  <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Liste</span>
                </>
              ) : (
                <>
                  <MapIcon className="w-3.5 h-3.5 text-[#C9A45C]" aria-hidden="true" />
                  <span>Carte</span>
                </>
              )}
            </button>
          </div>
        )}

        <nav className="order-2 md:order-3 hidden md:flex items-center gap-3.5 lg:gap-5 shrink-0">
          {authLinks}
        </nav>

        <div className="order-2 flex md:hidden items-center gap-2 shrink-0">
          {routed && (
            <Link
              to="/inscription"
              className="bg-[#C9A45C] text-[#101010] font-semibold text-xs px-2.5 py-1.5 rounded-lg"
            >
              Inscrire
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="p-2 rounded-lg bg-[#18181b] border border-[#2c2c30] text-stone-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {showMarketplaceTools && (
        <div className="border-t border-[#1d1d21] bg-[#0e0e10]/90">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center lg:gap-4">
            <MarketplaceCategoryStrip
              categories={config.categories ?? []}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              pathname={pathname}
              onNavigateHome={onNavigateHome}
            />
            <MarketplacePriceRangeFilter
              bounds={priceBounds}
              priceRange={priceRange}
              onChange={setPriceRange}
              formatPrice={formatPrice}
              pathname={pathname}
              onNavigateHome={onNavigateHome}
            />
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <nav className="md:hidden bg-[#141416] border-b border-[#232326] px-4 pt-3 pb-6 flex flex-col gap-3">
          {routed ? (
            <>
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm text-stone-200">
                Explorer les salons
              </Link>
              {showFavoritesTab && (
                <Link
                  to="/mes-favoris"
                  data-testid="navbar-favorites-tab-mobile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 text-sm text-stone-200 flex items-center gap-2"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      favoriteSalonIds.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-[#C9A45C]'
                    }`}
                    aria-hidden="true"
                  />
                  <span>Mes favoris</span>
                  {favoriteSalonIds.length > 0 && (
                    <span className="text-xs font-bold text-[#E5C378] tabular-nums">
                      ({favoriteSalonIds.length})
                    </span>
                  )}
                </Link>
              )}
              <Link
                to="/connexion"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-sm text-stone-200"
              >
                Connexion
              </Link>
              <Link
                to="/inscription"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-sm text-stone-200"
              >
                Inscrire un salon
              </Link>
              <Link
                to="/tarifs"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-sm text-[#E5C378] flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#C9A45C]" />
                Tarifs & Formules Salons
              </Link>
              <Link
                to="/app/tableau-de-bord"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-sm text-stone-200"
              >
                Espace salon
              </Link>
            </>
          ) : (
            <button onClick={() => setMode('marketplace')} className="py-2 text-left text-sm text-stone-200">
              Explorer les salons
            </button>
          )}
        </nav>
      )}
    </header>
  );
};

const RoutedNavbar: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return <NavbarShell routed pathname={pathname} onNavigateHome={() => navigate('/')} />;
};

export const Navbar: React.FC = () => {
  const routed = useInRouterContext();
  return routed ? <RoutedNavbar /> : <NavbarShell routed={false} pathname="/" />;
};
