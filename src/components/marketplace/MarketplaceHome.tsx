import React, { useState, useMemo, useEffect } from 'react';
import { useOptionalApp } from '../../context/AppContext';
import { SalonCard } from './SalonCard';
import { useSalonDeepLink } from '../../hooks/useSalonDeepLink';
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
  Smartphone
} from 'lucide-react';

const HERO_VIDEO_SRC = `/assets/video/${encodeURI(
  'Modern Classics Barbershop 📍Charlotte,NC Elite design for the future of barber industry.mp4'
)}`;

export const MarketplaceHome: React.FC = () => {
  const {
    salons,
    setMode,
    reviews,
    addToast,
    setSelectedSalonForModal
  } = useOptionalApp();

  // QR code links (/?salon=<slug>) open the salon's booking profile directly.
  useSalonDeepLink({
    salons,
    setSelectedSalonForModal,
    setMode,
    onNotFound: () =>
      addToast("Ce lien QR ne correspond à aucun salon publié.", 'error')
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommune, setSelectedCommune] = useState('all');
  const [activeTestimony, setActiveTestimony] = useState(0);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      [...new Set(salons.map((salon) => salon.commune).filter((commune): commune is string => Boolean(commune)))].sort(),
    [salons]
  );

  const filteredSalons = useMemo(() => {
    return salons.filter((salon) => {
      if (salon.isPublishedOnMarketplace !== true) return false;
      const matchQuery =
        !searchQuery.trim() ||
        salon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (salon.tagline ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (salon.commune ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchCommune =
        selectedCommune === 'all' ||
        (salon.commune ?? '').toLowerCase() === selectedCommune.toLowerCase();

      return matchQuery && matchCommune;
    });
  }, [salons, searchQuery, selectedCommune]);

  // Testimonials: dedicated testimonials + top client reviews
  // Testimonials are built from real client reviews only.
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
        .toUpperCase()
    }));
  }, [reviews]);

  const activeTestimonyData = testimonials.length
    ? testimonials[activeTestimony % testimonials.length]
    : null;

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col">
      {/* HERO SECTION */}
      <section className="relative isolate min-h-[620px] overflow-hidden border-b border-[#1f1f23] bg-[#17130d] md:min-h-[680px]">
        {!prefersReducedMotion && !videoUnavailable && (
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
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0d0d0e]/95 via-[#0d0d0e]/75 to-[#0d0d0e]/45" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d0d0e] via-[#0d0d0e]/10 to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-[620px] w-full max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8 md:min-h-[680px]">
          <div className="w-full max-w-4xl">
            <p className="mb-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d9b66e]">
              <span aria-hidden="true" className="h-px w-8 bg-[#C9A45C]" />
              Découvrir les salons
            </p>

            <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Votre style mérite
              <br className="hidden sm:block" />{' '}
              <span className="font-serif-luxury font-normal italic text-[#d9b66e]">
                l’excellence.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-stone-200 sm:text-lg">
              Parcourez les salons qui ont publié leurs informations sur Barber Cuts. Recherchez par nom ou commune pour explorer les résultats disponibles.
            </p>

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
                const top =
                  salonSection.getBoundingClientRect().top + window.scrollY - headerOffset - 16;

                window.scrollTo({
                  top,
                  behavior: prefersReducedMotion ? 'auto' : 'smooth'
                });
              }}
            >
              <div className="relative flex min-w-0 flex-1 items-center rounded-xl border border-transparent transition focus-within:border-[#C9A45C]/60 focus-within:bg-white/[0.03] focus-within:ring-2 focus-within:ring-[#C9A45C]/25">
                <Search aria-hidden="true" className="pointer-events-none absolute left-4 h-4 w-4 text-[#d9b66e]" />
                <label htmlFor="marketplace-search" className="sr-only">
                  Rechercher un salon, une spécialité ou une commune
                </label>
                <input
                  id="marketplace-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Salon, spécialité ou commune"
                  className="w-full rounded-xl bg-transparent py-4 pl-11 pr-4 text-sm text-white placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A45C]/75"
                />
              </div>

              <div aria-hidden="true" className="hidden h-9 w-px bg-white/10 sm:block" />

              <div className="relative w-full rounded-xl border border-transparent transition focus-within:border-[#C9A45C]/60 focus-within:bg-white/[0.03] focus-within:ring-2 focus-within:ring-[#C9A45C]/25 sm:w-56">
                <MapPin aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d9b66e]" />
                <label htmlFor="marketplace-commune" className="sr-only">
                  Filtrer les salons par commune
                </label>
                <select
                  id="marketplace-commune"
                  value={selectedCommune}
                  onChange={(event) => setSelectedCommune(event.target.value)}
                  className="w-full cursor-pointer appearance-none rounded-xl bg-transparent py-4 pl-11 pr-10 text-sm text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A45C]/75"
                >
                  <option value="all" className="bg-[#17171a] text-white">Toutes les communes</option>
                  {communes.map((commune) => (
                    <option key={commune} value={commune} className="bg-[#17171a] text-white">
                      {commune}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              </div>

              <button
                type="submit"
                className="flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#C9A45C] px-6 py-4 text-sm font-bold text-[#101010] shadow-md transition-colors hover:bg-[#d6b36a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111112] sm:w-auto"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                <span>Trouver mon salon</span>
              </button>
            </form>

            <p className="mt-4 flex items-center gap-2 text-xs text-stone-300">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#d9b66e]" />
              Les résultats reflètent les salons publiés sur la plateforme.
            </p>
          </div>
        </div>
      </section>

      <section id="salons-section" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              ÉTABLISSEMENTS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Salons publiés
            </h2>
          </div>
          <span className="text-xs text-stone-400 hidden sm:inline">
            {filteredSalons.length} établissement(s)
          </span>
        </div>

        {filteredSalons.length === 0 ? (
          <div className="text-center py-12 bg-[#141417] rounded-2xl border border-[#25252a]">
            <p className="text-stone-400 text-sm">
              Aucun salon réel n’est actuellement publié dans la marketplace.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCommune('all');
              }}
              className="mt-3 text-xs text-[#C9A45C] font-semibold hover:underline"
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

      {/* SECTION: COMMENT ÇA MARCHE (01 Trouvez, 02 Réservez, 03 Payez) */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 relative overflow-hidden group hover:border-[#C9A45C]/40 transition-colors">
            <span className="absolute top-4 right-5 text-4xl font-serif-luxury italic text-[#C9A45C]/25 font-bold">
              01
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#201e19] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center mb-4">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Trouvez</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Comparez les salons réputés, leurs prestations, photos réelles et avis vérifiés près de chez vous.
            </p>
          </div>

          <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 relative overflow-hidden group hover:border-[#C9A45C]/40 transition-colors">
            <span className="absolute top-4 right-5 text-4xl font-serif-luxury italic text-[#C9A45C]/25 font-bold">
              02
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#201e19] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Réservez</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Choisissez votre barbier favori et un créneau réellement disponible sans attendre au salon.
            </p>
          </div>

          <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-6 relative overflow-hidden group hover:border-[#C9A45C]/40 transition-colors">
            <span className="absolute top-4 right-5 text-4xl font-serif-luxury italic text-[#C9A45C]/25 font-bold">
              03
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#201e19] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center mb-4">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Payez</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Réglez sereinement sur place ou par Mobile Money : Wave, Orange Money, MTN MoMo, Moov.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION: AVIS CLIENTS ("Ils réservent avec Barber Cuts") */}
      <section className="py-14 bg-[#111113] border-t border-[#1f1f23]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold">
              AVIS
            </span>
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
                    <p className="text-sm text-stone-200 leading-relaxed italic mb-4">
                      « {rev.comment} »
                    </p>
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

      {/* SECTION: TÉMOIGNAGES (CLIENTS & PROFESSIONNELS) */}
      <section id="testimonies-section" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5" />
              TÉMOIGNAGES
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Ils nous font confiance
            </h2>
            <p className="text-xs text-stone-400 mt-2 max-w-xl leading-relaxed">
              Des clients satisfaits et des gérants de salons qui font grandir leur activité avec Barber Cuts.
            </p>
          </div>

          {/* Témoignage mis en avant */}
          <div className="flex items-center gap-2 shrink-0">
            {testimonials.map((testimony, index) => (
              <button
                key={testimony.id}
                onClick={() => setActiveTestimony(index)}
                aria-label={`Voir le témoignage de ${testimony.name}`}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${activeTestimony === index
                    ? 'bg-[#C9A45C] w-6'
                    : 'bg-[#3a3a40] hover:bg-[#57575f]'
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
                className={`text-left bg-[#151518] border rounded-2xl p-5 transition-all cursor-pointer ${activeTestimony === index
                    ? 'border-[#C9A45C]/50 shadow-[0_0_20px_rgba(201,164,92,0.08)]'
                    : 'border-[#26262b] hover:border-[#3d3d44]'
                  }`}
              >
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: testimony.rating }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-stone-300 leading-relaxed line-clamp-3 mb-3">
                  {testimony.quote}
                </p>
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

      {/* SECTION: PRO CTA BANNER (BARBER CUTS BUSINESS ERP) */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#1c1a16] via-[#161619] to-[#121214] border border-[#C9A45C]/30 p-8 sm:p-12 shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#C9A45C]">
              BARBER CUTS BUSINESS
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight font-serif-luxury">
              Développez votre salon avec notre ERP SaaS tout-en-un.
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              Planning en direct, gestion de caisse et Mobile Money, relances automatiques WhatsApp, fidélisation CRM, gestion des stocks et multi-succursales.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-3">
              <a
                href="/inscription"
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-[0_0_20px_rgba(201,164,92,0.3)] cursor-pointer"
              >
                Inscrire mon salon
              </a>
              <a
                href="/app/tableau-de-bord"
                className="bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b42] font-semibold text-sm px-6 py-3 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                Accéder à l’espace professionnel
              </a>
            </div>
          </div>
        </div>
      </section>

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
                La plateforme de découverte et de gestion des salons.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">
                CLIENTS
              </h4>
              <ul className="space-y-2">
                <li><a href="#salons-section" className="hover:text-white transition-colors">Trouver un salon</a></li>
                {communes.map((commune) => (
                  <li key={commune}>
                    <button onClick={() => setSelectedCommune(commune)} className="hover:text-white transition-colors">
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
                  <a href="/inscription" className="hover:text-white transition-colors">Inscrire un établissement</a>
                </li>
                <li><a href="/app/tableau-de-bord" className="hover:text-white transition-colors">Espace professionnel</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">
                INFORMATIONS
              </h4>
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
