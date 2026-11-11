// Page d'accueil publique de la marketplace : orchestre l'état de recherche,
// le contenu piloté par le SuperAdmin et la composition des sections
// (héros, catalogue, étapes, témoignages, FAQ, pied de page) — l'extraction
// des blocs visuels vit dans ./home/.
import React, { useState, useMemo, useEffect } from 'react';
import { useInRouterContext } from 'react-router-dom';
import { useOptionalApp } from '../../context/AppContext';
import type { MarketplaceDemoData } from '../../lib/marketplace-demo';
import { listSavedBookings, type SavedBooking } from '../../lib/bookingVault';
import { FeaturedSectionCard } from './FeaturedSectionCard';
import { useSalonDeepLink } from '../../hooks/useSalonDeepLink';
import { useMarketplaceContent } from '../../lib/marketplace-content';
import { isSlowOrConstrainedNetwork } from '../../lib/networkHints';
import { PromoBanner, HomeHero, TrustBanner } from './home/HomeHero';
import { CategoryFilter, SavedBookingsBanner, SalonsSection } from './home/HomeCatalog';
import { StepsSection, CustomSections, ReviewsSection } from './home/HomeSections';
import { TestimonialsSection, type HomeTestimony } from './home/HomeTestimonials';
import { FaqSection, ProCtaBanner, SiteFooter } from './home/HomeFooterBlocks';

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
  const { config: storedConfig } = useMarketplaceContent();
  // Mode démonstration (opt-in, VITE_MARKETPLACE_DEMO=true) : données fictives « [DÉMO] ».
  // Jamais transmises à l'administration (la source `salons` et la configuration stockée restent intactes).
  const [demoData, setDemoData] = useState<MarketplaceDemoData | null>(null);
  useEffect(() => {
    // Accès optionnel : `import.meta.env` est absent hors Vite (tests Node).
    if (import.meta.env?.VITE_MARKETPLACE_DEMO !== 'true') return;
    let cancelled = false;
    void import('../../lib/marketplace-demo').then((module) => {
      if (!cancelled) setDemoData(module.DEMO_DATA);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // Contenus de sections : la configuration stockée, remplacée par les contenus démo en mode démo.
  const config = useMemo(
    () => (demoData ? { ...storedConfig, ...demoData.content } : storedConfig),
    [storedConfig, demoData],
  );

  const featuredSections = useMemo(
    () =>
      (config.featuredSections ?? [])
        .filter((feature) => feature.isVisible)
        .slice()
        .sort((a, b) => a.order - b.order),
    [config.featuredSections],
  );

  // Seuls les salons publiés et actifs (non suspendus) sont affichés côté public.
  const marketplaceSalons = useMemo(
    () => salons.filter((salon) => salon.isPublishedOnMarketplace === true && salon.status !== 'suspended'),
    [salons],
  );

  // QR code links (/?salon=<slug>) open the salon's booking profile directly.
  useSalonDeepLink({
    salons: marketplaceSalons,
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
  const [slowNetwork] = useState(() => isSlowOrConstrainedNetwork());
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

  const demoSalons = demoData?.salons ?? [];
  const demoMode = marketplaceSalons.length === 0 && demoSalons.length > 0;
  const listedSalons = demoMode ? demoSalons : marketplaceSalons;

  const communes = useMemo(
    () =>
      [
        ...new Set(
          listedSalons.map((salon) => salon.commune).filter((commune): commune is string => Boolean(commune)),
        ),
      ].sort(),
    [listedSalons],
  );

  // Filter visible salons (suspension / publication already applied) by search and commune
  const filteredSalons = useMemo(() => {
    return listedSalons.filter((salon) => {
      const matchQuery =
        !searchQuery.trim() ||
        salon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (salon.tagline ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (salon.commune ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchCommune =
        selectedCommune === 'all' || (salon.commune ?? '').toLowerCase() === selectedCommune.toLowerCase();

      return matchQuery && matchCommune;
    });
  }, [listedSalons, searchQuery, selectedCommune]);

  // Témoignages : avis réels ; à défaut, avis fictifs étiquetés en mode démo uniquement.
  const testimonials = useMemo<HomeTestimony[]>(() => {
    const initialsOf = (name: string) =>
      name
        .split(' ')
        .map((part) => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();
    if (reviews.length > 0) {
      return reviews.slice(0, 4).map((rev) => ({
        id: rev.id,
        name: rev.author,
        role: rev.verified ? 'Client vérifié' : 'Client',
        quote: rev.comment,
        rating: rev.rating,
        initials: initialsOf(rev.author),
      }));
    }
    return (demoData?.testimonials ?? []).map((demo) => ({
      id: demo.id,
      name: demo.author,
      role: demo.role,
      quote: demo.comment,
      rating: demo.rating,
      initials: initialsOf(demo.author),
    }));
  }, [reviews, demoData]);

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col">
      {/* Bannière promotionnelle optionnelle (pilotée par le SuperAdmin) */}
      <PromoBanner banner={config.promoBanner} />

      {/* Héros configurable avec recherche */}
      <HomeHero
        hero={config.hero}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedCommune={selectedCommune}
        onCommuneChange={setSelectedCommune}
        communes={communes}
        prefersReducedMotion={prefersReducedMotion}
        slowNetwork={slowNetwork}
        videoUnavailable={videoUnavailable}
        onVideoError={() => setVideoUnavailable(true)}
      />

      {/* Bandeau de réassurance dynamique (géré par l'administration) */}
      <TrustBanner items={(config.trustItems ?? []).filter((t) => t.isVisible)} />

      {/* Sections à la une (créées et ordonnées par le SuperAdmin) */}
      {featuredSections.length > 0 && (
        <section
          aria-label="Sections à la une"
          className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredSections.map((feature) => (
              <FeaturedSectionCard key={feature.id} feature={feature} />
            ))}
          </div>
        </section>
      )}

      {/* Filtre par styles / prestations */}
      {(config.categories ?? []).filter((c) => c.isVisible).length > 0 && (
        <CategoryFilter
          categories={config.categories}
          selectedCategorySlug={selectedCategorySlug}
          onSelect={(slug, query) => {
            setSelectedCategorySlug(slug);
            setSearchQuery(query);
          }}
        />
      )}

      {/* Réservations mémorisées sur cet appareil */}
      <SavedBookingsBanner savedBookings={savedBookings} routed={routed} />

      {/* Salons publiés */}
      <SalonsSection
        salons={filteredSalons}
        demoMode={demoMode}
        loading={marketplaceLoading}
        error={marketplaceError}
        onResetFilters={() => {
          setSearchQuery('');
          setSelectedCommune('all');
          setSelectedCategorySlug(null);
        }}
      />

      {/* Étapes « comment ça marche » (configurables par l'administration) */}
      {(config.steps ?? []).filter((s) => s.isVisible).length > 0 && (
        <StepsSection steps={config.steps.filter((s) => s.isVisible)} />
      )}

      {/* Sections personnalisées dynamiques (ajoutées par le SuperAdmin) */}
      <CustomSections customSections={config.customSections ?? []} />

      {/* Avis clients réels */}
      <ReviewsSection reviews={reviews} />

      {/* Témoignages (clients & professionnels) */}
      <TestimonialsSection items={testimonials} activeIndex={activeTestimony} onSelect={setActiveTestimony} />

      {/* FAQ dynamique */}
      {(config.faqs ?? []).filter((f) => f.isVisible).length > 0 && (
        <FaqSection faqs={config.faqs} openIndex={openFaqIndex} onToggle={setOpenFaqIndex} />
      )}

      {/* Bannière CTA pro (ERP Barber Cuts Business) */}
      <ProCtaBanner cta={config.proCta} />

      {/* Pied de page */}
      <SiteFooter
        siteMetadata={config.siteMetadata}
        communes={communes}
        onSelectCommune={setSelectedCommune}
      />
    </div>
  );
};
