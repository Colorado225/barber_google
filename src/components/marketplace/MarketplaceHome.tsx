import React, { useState, useMemo, useEffect } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { useOptionalApp } from '../../context/AppContext';
import { listSavedBookings, bookingPortalPath, type SavedBooking } from '../../lib/bookingVault';
import { SalonCard } from './SalonCard';
import { useSalonDeepLink } from '../../hooks/useSalonDeepLink';
import { useMarketplaceContent } from '../../lib/marketplace-content';
import {
  Search,
  MapPin,
  ChevronDown,
  Clock,
  Sparkles,
  Star,
  SlidersHorizontal,
  Flame,
  Quote,
  Scissors,
  Smartphone,
  CalendarCheck,
  ArrowRight,
  ShieldCheck,
  Award,
  CheckCircle2,
  Tag,
  HelpCircle,
  Layers,
  ChevronRight,
} from 'lucide-react';

const HERO_VIDEO_SRC = `/assets/video/${encodeURI(
  'Modern Classics Barbershop 📍Charlotte,NC Elite design for the future of barber industry.mp4',
)}`;

export const MarketplaceHome: React.FC = () => {
  const routed = useInRouterContext();
  const {
    salons,
    setMode,
    reviews,
    addToast,
    setSelectedSalonForModal,
    marketplaceLoading,
    marketplaceError,
  } = useOptionalApp();

  // Dynamic marketplace sections & content managed by SuperAdmin
  const { config } = useMarketplaceContent();

  // QR code links (/?salon=<slug>) open the salon's booking profile directly.
  useSalonDeepLink({
    salons,
    setSelectedSalonForModal,
    setMode,
    onNotFound: () => addToast('Ce lien QR ne correspond à aucun salon publié.', 'error'),
  });

  // Réservations faites depuis cet appareil
  const [savedBookings, setSavedBookings] = useState<SavedBooking[]>([]);
  useEffect(() => {
    setSavedBookings(listSavedBookings());
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommune, setSelectedCommune] = useState('all');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [activeTestimony, setActiveTestimony] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  const communes = useMemo(
    () =>
      [
        ...new Set(
          salons.map((salon) => salon.commune).filter((commune): commune is string => Boolean(commune)),
        ),
      ].sort(),
    [salons],
  );

  // Filter salons, taking into account category filter and admin suspension overrides
  const filteredSalons = useMemo(() => {
    // Check if any salon is suspended in localStorage overrides
    let adminOverrides: Record<string, { status?: string; isPublished?: boolean }> = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('barbercuts_admin_salon_overrides');
        if (raw) adminOverrides = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    return salons.filter((salon) => {
      // If overridden as suspended or hidden by SuperAdmin, hide from marketplace
      if (adminOverrides[salon.id]?.status === 'suspended') return false;
      if (adminOverrides[salon.id]?.isPublished === false) return false;

      // Base published check
      if (salon.isPublishedOnMarketplace !== true && !adminOverrides[salon.id]?.isPublished) {
        return false;
      }

      const matchQuery =
        !searchQuery.trim() ||
        salon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (salon.tagline ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (salon.commune ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchCommune =
        selectedCommune === 'all' || (salon.commune ?? '').toLowerCase() === selectedCommune.toLowerCase();

      return matchQuery && matchCommune;
    });
  }, [salons, searchQuery, selectedCommune]);

  // Testimonials built from real reviews
  const testimonials = useMemo(() => {
    return reviews.slice(0, 4).map((rev) => ({
      id: rev.id,
      name: rev.author,
      role: rev.verified ? 'Client vérifié' : 'Client',
      quote: rev.comment,
      rating: rev.rating,
      initials: rev.author
        .split(' ')
        .map((part) => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    }));
  }, [reviews]);

  const activeTestimonyData = testimonials.length
    ? testimonials[activeTestimony % testimonials.length]
    : null;

  // Icon mapping helper for dynamic sections
  const getDynamicIcon = (name: string) => {
    switch (name) {
      case 'Scissors':
        return <Scissors className="w-5 h-5 text-[#C9A45C]" />;
      case 'Clock':
        return <Clock className="w-5 h-5 text-[#C9A45C]" />;
      case 'Smartphone':
        return <Smartphone className="w-5 h-5 text-[#C9A45C]" />;
      case 'Star':
        return <Star className="w-5 h-5 text-[#C9A45C]" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-[#C9A45C]" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-[#C9A45C]" />;
      case 'Award':
      default:
        return <Award className="w-5 h-5 text-[#C9A45C]" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col">
      {/* OPTIONAL PROMOTIONAL / SEASONAL BANNER */}
      {config.promoBanner?.enabled && (
        <aside
          aria-label="Bannière d'annonce"
          className={`py-2.5 px-4 text-center text-xs font-semibold border-b ${
            config.promoBanner.theme === 'gold'
              ? 'bg-gradient-to-r from-[#211a0e] via-[#332711] to-[#211a0e] border-[#C9A45C]/40 text-[#f7e8c3]'
              : config.promoBanner.theme === 'emerald'
                ? 'bg-gradient-to-r from-[#0d2217] via-[#143625] to-[#0d2217] border-emerald-500/40 text-emerald-200'
                : 'bg-[#15151b] border-[#292934] text-stone-200'
          }`}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/40 text-[#E5C378] border border-[#C9A45C]/30">
              {config.promoBanner.badge}
            </span>
            <span className="font-bold text-white">{config.promoBanner.title}</span>
            <span className="hidden sm:inline text-stone-300 font-normal">
              — {config.promoBanner.description}
            </span>
            {config.promoBanner.buttonText && (
              <a
                href={config.promoBanner.buttonLink || '#salons-section'}
                className="underline underline-offset-4 text-[#C9A45C] hover:text-white font-bold ml-1 inline-flex items-center gap-1"
              >
                <span>{config.promoBanner.buttonText}</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            )}
          </div>
        </aside>
      )}

      {/* HERO SECTION (Configurable) */}
      <section className="relative isolate min-h-[620px] overflow-hidden border-b border-[#1f1f23] bg-[#17130d] md:min-h-[680px]">
        {config.hero.showVideo !== false && !prefersReducedMotion && !videoUnavailable && (
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
            onError={() => setVideoUnavailable(true)}
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
              {config.hero.badgeText || 'Découvrir les salons'}
            </p>

            <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              {config.hero.headlineMain || 'Votre style mérite'}
              <br className="hidden sm:block" />{' '}
              <span className="font-serif-luxury font-normal italic text-[#d9b66e]">
                {config.hero.headlineHighlight || 'l’excellence.'}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-stone-200 sm:text-lg">
              {config.hero.description ||
                'Parcourez les salons qui ont publié leurs informations sur Barber Cuts. Recherchez par nom ou commune pour explorer les résultats disponibles.'}
            </p>

            {/* Search Form */}
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
                  {config.hero.searchPlaceholder || 'Rechercher un salon par nom ou commune'}
                </label>
                <input
                  id="marketplace-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={config.hero.searchPlaceholder || 'Nom du salon ou commune'}
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
                  onChange={(event) => setSelectedCommune(event.target.value)}
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
                <span>{config.hero.ctaText || 'Trouver mon salon'}</span>
              </button>
            </form>

            <p className="mt-4 flex items-center gap-2 text-xs text-stone-300">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#d9b66e]" />
              Les résultats reflètent les salons publiés sur la plateforme.
            </p>
          </div>
        </div>
      </section>

      {/* DYNAMIC TRUST & REASSURANCE BANNER (Managed by Admin) */}
      {config.trustItems && config.trustItems.filter((t) => t.isVisible).length > 0 && (
        <section className="bg-[#101014] border-b border-[#1c1c24] py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {config.trustItems
                .filter((t) => t.isVisible)
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#1b1913] border border-[#C9A45C]/30 flex items-center justify-center shrink-0">
                      {getDynamicIcon(item.iconName)}
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
      )}

      {/* CATEGORIES / PRESTATION TAGS FILTER */}
      {config.categories && config.categories.filter((c) => c.isVisible).length > 0 && (
        <section className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-[11px] uppercase tracking-wider font-bold text-stone-500 mr-2 shrink-0 flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#C9A45C]" />
              Styles populaires :
            </span>
            <button
              onClick={() => {
                setSelectedCategorySlug(null);
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                !selectedCategorySlug
                  ? 'bg-[#C9A45C] text-[#101010] font-bold'
                  : 'bg-[#16161c] text-stone-300 hover:text-white border border-[#262632]'
              }`}
            >
              Tous les styles
            </button>
            {config.categories
              .filter((c) => c.isVisible)
              .map((cat) => {
                const isSelected = selectedCategorySlug === cat.slug;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCategorySlug(null);
                        setSearchQuery('');
                      } else {
                        setSelectedCategorySlug(cat.slug);
                        setSearchQuery(cat.label.split(' ')[0]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#C9A45C] text-[#101010] font-bold'
                        : 'bg-[#16161c] text-stone-300 hover:text-white border border-[#262632]'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {cat.isPopular && <Sparkles className="w-3 h-3 text-[#C9A45C]" />}
                  </button>
                );
              })}
          </div>
        </section>
      )}

      {/* SAVED BOOKINGS (Device local storage) */}
      {savedBookings.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-4">
          <div className="rounded-2xl border border-[#C9A45C]/30 bg-[#17130d] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CalendarCheck className="w-5 h-5 text-[#C9A45C]" />
              <div>
                <p className="text-sm font-bold text-white">
                  {savedBookings.length === 1
                    ? 'Votre réservation est enregistrée'
                    : `${savedBookings.length} réservations sur cet appareil`}
                </p>
                <p className="text-xs text-stone-400">
                  {savedBookings[0].salonName} · {savedBookings[0].serviceName} — suivi, annulation et avis
                  après la prestation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {routed ? (
                <Link
                  to={bookingPortalPath(savedBookings[0].token)}
                  className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  Suivre ma réservation <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <a
                  href={bookingPortalPath(savedBookings[0].token)}
                  className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  Suivre ma réservation <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
              {savedBookings.length > 1 &&
                (routed ? (
                  <Link
                    to="/mes-reservations"
                    className="px-3 py-2 rounded-xl bg-[#232328] text-stone-300 text-xs font-semibold"
                  >
                    Tout voir
                  </Link>
                ) : (
                  <a
                    href="/mes-reservations"
                    className="px-3 py-2 rounded-xl bg-[#232328] text-stone-300 text-xs font-semibold"
                  >
                    Tout voir
                  </a>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* SALONS PUBLIÉS */}
      <section id="salons-section" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              ÉTABLISSEMENTS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Salons publiés</h2>
          </div>
          <span className="text-xs text-stone-400 hidden sm:inline">
            {filteredSalons.length} établissement(s)
          </span>
        </div>

        {marketplaceLoading && <p className="text-sm text-stone-400 mb-4">Chargement des salons publiés…</p>}
        {marketplaceError && (
          <p
            role="alert"
            className="text-sm text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg p-3 mb-4"
          >
            {marketplaceError}
          </p>
        )}
        {filteredSalons.length === 0 ? (
          <div className="text-center py-12 bg-[#141417] rounded-2xl border border-[#25252a]">
            <p className="text-stone-400 text-sm">
              Aucun salon réel n’est actuellement publié dans la marketplace.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCommune('all');
                setSelectedCategorySlug(null);
              }}
              className="mt-3 text-xs text-[#C9A45C] font-semibold hover:underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSalons.map((salon) => (
              <SalonCard key={salon.id} salon={salon} />
            ))}
          </div>
        )}
      </section>

      {/* DYNAMIC STEPS: COMMENT ÇA MARCHE (Configurable by Admin) */}
      {config.steps && config.steps.filter((s) => s.isVisible).length > 0 && (
        <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {config.steps
              .filter((s) => s.isVisible)
              .map((st) => (
                <div
                  key={st.id}
                  className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 relative overflow-hidden group hover:border-[#C9A45C]/40 transition-colors"
                >
                  <span className="absolute top-4 right-5 text-4xl font-serif-luxury italic text-[#C9A45C]/25 font-bold">
                    {st.stepNumber}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[#201e19] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center mb-4">
                    {getDynamicIcon(st.iconName)}
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">{st.title}</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">{st.description}</p>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* DYNAMIC CUSTOM SECTIONS (Added dynamically by SuperAdmin!) */}
      {config.customSections &&
        config.customSections
          .filter((sec) => sec.isVisible)
          .map((sec) => (
            <section
              key={sec.id}
              className="py-14 border-t border-[#1c1c24] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full"
            >
              <div className="mb-8">
                <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {sec.badgeText}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{sec.title}</h2>
                {sec.description && (
                  <p className="text-xs text-stone-400 mt-1 max-w-2xl leading-relaxed">
                    {sec.description}
                  </p>
                )}
              </div>

              {sec.layout === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {sec.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#161619] border border-[#282830] hover:border-[#C9A45C]/40 rounded-2xl p-6 flex flex-col justify-between transition-colors"
                    >
                      <div>
                        {item.tag && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#221c0e] text-[#E5C378] border border-[#C9A45C]/30 mb-3">
                            {item.tag}
                          </span>
                        )}
                        <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                        <p className="text-xs text-stone-400 leading-relaxed">{item.description}</p>
                      </div>
                      {item.linkText && (
                        <a
                          href={item.linkUrl || '#'}
                          className="mt-4 text-xs font-bold text-[#C9A45C] hover:underline flex items-center gap-1"
                        >
                          <span>{item.linkText}</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {sec.layout === 'features' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sec.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#141418] border border-[#23232c] rounded-2xl p-4 flex items-start gap-3.5"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#221c0e] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.title}</h4>
                        <p className="text-xs text-stone-400 mt-1 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sec.layout === 'banner' && (
                <div className="bg-gradient-to-r from-[#1c1a16] via-[#16161a] to-[#111114] border border-[#C9A45C]/30 rounded-3xl p-8 sm:p-10 shadow-xl">
                  <div className="max-w-2xl space-y-3">
                    <h3 className="text-xl sm:text-2xl font-bold text-white font-serif-luxury">
                      {sec.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                      {sec.description}
                    </p>
                    <div className="pt-2 flex flex-wrap gap-4">
                      {sec.items.map((it) => (
                        <div
                          key={it.id}
                          className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-stone-200"
                        >
                          <span className="font-bold text-[#C9A45C]">{it.title} : </span>
                          <span>{it.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          ))}

      {/* AVIS CLIENTS ("Ils réservent avec Barber Cuts") */}
      <section className="py-14 bg-[#111113] border-t border-[#1f1f23]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold">AVIS</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Ils réservent avec Barber Cuts
            </h2>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-12 bg-[#161619] rounded-2xl border border-[#27272c]">
              <Star className="w-10 h-10 mx-auto mb-3 text-stone-600" />
              <p className="text-sm text-stone-400">Aucun avis pour le moment.</p>
              <p className="text-xs text-stone-500 mt-1">
                Les avis apparaîtront ici dès que des clients auront noté leur rendez-vous.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.slice(0, 6).map((rev) => (
                <div
                  key={rev.id}
                  className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1 mb-3">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-stone-200 leading-relaxed italic mb-4">« {rev.comment} »</p>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-3 border-t border-[#242429]">
                    <span className="font-bold text-white">{rev.author}</span>
                    <span className="text-stone-500">• {rev.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* TÉMOIGNAGES (CLIENTS & PROFESSIONNELS) */}
      <section id="testimonies-section" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5" />
              TÉMOIGNAGES
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Ils nous font confiance</h2>
            <p className="text-xs text-stone-400 mt-2 max-w-xl leading-relaxed">
              Des clients satisfaits et des gérants de salons qui font grandir leur activité avec Barber Cuts.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {testimonials.map((testimony, index) => (
              <button
                key={testimony.id}
                onClick={() => setActiveTestimony(index)}
                aria-label={`Voir le témoignage de ${testimony.name}`}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  activeTestimony === index ? 'bg-[#C9A45C] w-6' : 'bg-[#3a3a40] hover:bg-[#57575f]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grand témoignage actif */}
          <div className="lg:col-span-1 bg-gradient-to-b from-[#1b1913] to-[#151518] border border-[#C9A45C]/30 rounded-3xl p-7 flex flex-col justify-between relative overflow-hidden">
            <Quote className="absolute -top-3 -right-3 w-24 h-24 text-[#C9A45C]/10" />
            {activeTestimonyData ? (
              <>
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: activeTestimonyData.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-stone-100 leading-relaxed italic">
                    « {activeTestimonyData.quote} »
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-6 mt-6 border-t border-[#2a2820]">
                  <div className="w-10 h-10 rounded-full bg-[#C9A45C] text-[#101010] font-bold text-xs flex items-center justify-center shrink-0">
                    {activeTestimonyData.initials}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{activeTestimonyData.name}</h4>
                    <p className="text-[11px] text-[#C9A45C]">{activeTestimonyData.role}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative z-10 text-left py-4">
                <Quote className="w-6 h-6 text-[#C9A45C] mb-3" />
                <h4 className="text-sm font-bold text-white">Aucun témoignage pour l’instant</h4>
                <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                  Les avis de vos clients s’afficheront ici dès le premier retour.
                </p>
              </div>
            )}
          </div>

          {/* Liste compacte des témoignages */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {testimonials.length === 0 && (
              <div className="sm:col-span-2 flex items-center justify-center rounded-2xl border border-dashed border-[#2a2a2e] p-8 text-center text-xs text-stone-500">
                Aucun avis client enregistré pour le moment.
              </div>
            )}
            {testimonials.map((testimony, index) => (
              <button
                key={testimony.id}
                onClick={() => setActiveTestimony(index)}
                className={`text-left bg-[#151518] border rounded-2xl p-5 transition-all cursor-pointer ${
                  activeTestimony === index
                    ? 'border-[#C9A45C]/50 shadow-[0_0_20px_rgba(201,164,92,0.08)]'
                    : 'border-[#26262b] hover:border-[#3d3d44]'
                }`}
              >
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: testimony.rating }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-stone-300 leading-relaxed line-clamp-3 mb-3">{testimony.quote}</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#24242a] border border-[#3a3a42] text-[11px] font-bold text-stone-200 flex items-center justify-center shrink-0">
                    {testimony.initials}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[11px] font-bold text-white truncate">{testimony.name}</span>
                    <span className="block text-[10px] text-stone-500 truncate">{testimony.role}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* DYNAMIC FAQ SECTION */}
      {config.faqs && config.faqs.filter((f) => f.isVisible).length > 0 && (
        <section className="py-14 bg-[#0f0f12] border-t border-[#1f1f26]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center justify-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                FOIRE AUX QUESTIONS
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                Tout ce que vous devez savoir
              </h2>
            </div>

            <div className="space-y-3">
              {config.faqs
                .filter((f) => f.isVisible)
                .map((faq, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div
                      key={faq.id}
                      className="bg-[#16161b] border border-[#272732] rounded-2xl overflow-hidden transition-colors"
                    >
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-[#C9A45C] transition-colors cursor-pointer"
                      >
                        <span>{faq.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#C9A45C] transition-transform duration-200 shrink-0 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-5 sm:px-5 sm:pb-6 text-xs text-stone-300 leading-relaxed border-t border-[#22222b] pt-3">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* PRO CTA BANNER (BARBER CUTS BUSINESS ERP) */}
      {config.proCta?.isVisible !== false && (
        <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#1c1a16] via-[#161619] to-[#121214] border border-[#C9A45C]/30 p-8 sm:p-12 shadow-2xl">
            <div className="relative z-10 max-w-2xl space-y-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#C9A45C]">
                {config.proCta.badge || 'BARBER CUTS BUSINESS'}
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight font-serif-luxury">
                {config.proCta.title || 'Développez votre salon avec notre ERP SaaS tout-en-un.'}
              </h2>
              <p className="text-sm text-stone-300 leading-relaxed">
                {config.proCta.description ||
                  'Planning en direct, gestion de caisse et Mobile Money, relances automatiques WhatsApp, fidélisation CRM, gestion des stocks et multi-succursales.'}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-3">
                <a
                  href={config.proCta.primaryButtonLink || '/tarifs'}
                  className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-[0_0_20px_rgba(201,164,92,0.3)] cursor-pointer"
                >
                  {config.proCta.primaryButtonText || 'Découvrir les Tarifs Salons'}
                </a>
                <a
                  href={config.proCta.secondaryButtonLink || '/inscription'}
                  className="bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b42] font-semibold text-sm px-6 py-3 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {config.proCta.secondaryButtonText || 'Inscrire mon salon'}
                </a>
                {config.proCta.showExistingProLink && (
                  <a
                    href="/app/tableau-de-bord"
                    className="text-stone-400 hover:text-white text-xs underline underline-offset-4 ml-2"
                  >
                    Espace pro existant
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="mt-auto bg-[#0a0a0c] border-t border-[#1a1a1d] py-12 text-xs text-stone-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1c1a16] border border-[#C9A45C]/30 flex items-center justify-center text-[#C9A45C]">
                  <Scissors className="w-4 h-4" />
                </div>
                <span className="text-lg font-bold text-white">
                  Barber<span className="text-[#C9A45C]">Cuts</span>
                </span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                La plateforme SaaS ERP et Marketplace leader des barbershops d'élite.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">CLIENTS</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#salons-section" className="hover:text-white transition-colors">
                    Trouver un salon
                  </a>
                </li>
                {communes.map((commune) => (
                  <li key={commune}>
                    <button
                      onClick={() => setSelectedCommune(commune)}
                      className="hover:text-white transition-colors"
                    >
                      Salons à {commune}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">
                PROFESSIONNELS
              </h4>
              <ul className="space-y-2">
                <li>
                  <a href="/tarifs" className="text-[#E5C378] hover:underline font-semibold transition-colors">
                    Tarifs & Formules Salons
                  </a>
                </li>
                <li>
                  <a href="/inscription" className="hover:text-white transition-colors">
                    Inscrire un établissement
                  </a>
                </li>
                <li>
                  <a href="/app/tableau-de-bord" className="hover:text-white transition-colors">
                    Espace salon
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">INFORMATIONS</h4>
              <p className="text-xs text-stone-400 leading-relaxed">
                Les établissements affichés proviennent des données publiées dans la plateforme.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-[#19191c] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-400">
            <span>© 2026 Barber Cuts. Tous droits réservés.</span>
            <div className="flex gap-4">
              <span>Conditions d'utilisation</span>
              <span>Politique de confidentialité</span>
              <span>Sécurité des paiements</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
