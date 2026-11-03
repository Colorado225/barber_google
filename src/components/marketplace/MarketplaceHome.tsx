import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SalonCard } from './SalonCard';
import { useSalonDeepLink } from '../../hooks/useSalonDeepLink';
import {
  Search,
  MapPin,
  Smartphone,
  BellRing,
  Clock,
  Scissors,
  Sparkles,
  ArrowRight,
  Star,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  Quote,
  Send,
  Crown,
  Store
} from 'lucide-react';

export const MarketplaceHome: React.FC = () => {
  const {
    salons,
    setMode,
    setIsRegisterSalonOpen,
    reviews,
    isRegisteredInErp,
    setAuthStartView,
    addToast,
    setSelectedSalonForModal
  } = useApp();

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [activeTestimony, setActiveTestimony] = useState(0);

  const communes = ['all', 'Cocody', 'Marcory', 'Plateau', 'Treichville', 'Yopougon'];

  const categories = [
    { id: 'coupe', label: 'Coupe' },
    { id: 'barbe', label: 'Barbe' },
    { id: 'tresses', label: 'Tresses' },
    { id: 'soins', label: 'Soins capillaires' },
    { id: 'coloration', label: 'Coloration' },
    { id: 'visage', label: 'Soin visage' }
  ];

  const filteredSalons = useMemo(() => {
    return salons.filter((salon) => {
      if (salon.isPublishedOnMarketplace === false) return false;
      const matchQuery =
        !searchQuery.trim() ||
        salon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        salon.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        salon.commune.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCommune =
        selectedCommune === 'all' ||
        salon.commune.toLowerCase() === selectedCommune.toLowerCase();

      return matchQuery && matchCommune;
    });
  }, [salons, searchQuery, selectedCommune]);

  const recommendedSalons = useMemo(() => {
    return filteredSalons.filter((s) => s.isRecommended);
  }, [filteredSalons]);

  const popularSalons = useMemo(() => {
    return filteredSalons.filter((s) => s.isPopular);
  }, [filteredSalons]);

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

  const plans = [
    {
      id: 'essentiel',
      name: 'Essentiel',
      price: '0',
      period: '/ mois',
      description: 'Pour les barbiers indépendants qui démarrent.',
      features: ['1 salon · 2 collaborateurs', 'Réservations en ligne illimitées', 'Fiche salon publique', 'Rappels WhatsApp & SMS'],
      cta: 'Commencer gratuitement',
      highlighted: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '15 000',
      period: 'FCFA / mois',
      description: 'Le plus choisi par les barbershops à forte activité.',
      features: [
        'Salon & collaborateurs illimités',
        'Planning en direct + caisse Mobile Money',
        'CRM & programme de fidélité',
        'Gestion des stocks et dépenses',
        'Rapports et statistiques avancés'
      ],
      cta: 'Choisir Pro',
      highlighted: true
    },
    {
      id: 'business',
      name: 'Business',
      price: '35 000',
      period: 'FCFA / mois',
      description: 'Pour les franchises et networks multi-succursales.',
      features: [
        'Tout le plan Pro',
        'Multi-succursales & multi-caisses',
        'Rôles, permissions et audit des ventes',
        'Export comptable et API',
        'Accompagnement dédié 7j/7'
      ],
      cta: 'Parler à l’équipe',
      highlighted: false
    }
  ];

  const handleNewsletterSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      addToast('Veuillez saisir une adresse e-mail valide.', 'error');
      return;
    }
    addToast('Merci ! Vous êtes bien inscrit à la newsletter Barber Cuts.', 'success');
    setNewsletterEmail('');
  };

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col">
      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden border-b border-[#1f1f23]">
        {/* Ambient Dark Luxury Background */}
        <div className="absolute inset-0 bg-radial from-[#1e1b14]/50 via-[#0d0d0e] to-[#0d0d0e] pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#C9A45C]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          {/* Location Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1c1c1f] border border-[#2d2d33] text-xs font-semibold text-[#E5C378] mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#C9A45C] animate-ping" />
            <span>Abidjan · Côte d'Ivoire</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15] mb-5">
            Votre style mérite{' '}
            <span className="font-serif-luxury italic text-[#C9A45C] font-normal">
              l'excellence.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-stone-300 max-w-2xl mb-8 leading-relaxed font-normal">
            Trouvez les meilleurs barbershops et salons de beauté, comparez les prix et réservez votre créneau en quelques secondes.
          </p>

          {/* Search Box Card */}
          <div className="w-full max-w-3xl bg-[#17171a] border border-[#2c2c32] p-2.5 sm:p-3 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-2 mb-6">
            {/* Input 1: Service / Salon search */}
            <div className="relative flex-1 w-full flex items-center">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Salon, prestation (dégradé, tresses...)"
                className="w-full bg-transparent pl-10 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-stone-400 focus:outline-none"
              />
            </div>

            <div className="hidden sm:block w-[1px] h-8 bg-[#2d2d33]" />

            {/* Input 2: Commune selector */}
            <div className="relative w-full sm:w-60 flex items-center">
              <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5" />
              <select
                value={selectedCommune}
                onChange={(e) => setSelectedCommune(e.target.value)}
                className="w-full bg-transparent pl-10 pr-6 py-2.5 text-xs sm:text-sm text-stone-200 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="all" className="bg-[#17171a] text-white">Toutes communes</option>
                <option value="Cocody" className="bg-[#17171a] text-white">Cocody</option>
                <option value="Marcory" className="bg-[#17171a] text-white">Marcory</option>
                <option value="Plateau" className="bg-[#17171a] text-white">Plateau</option>
                <option value="Treichville" className="bg-[#17171a] text-white">Treichville</option>
                <option value="Yopougon" className="bg-[#17171a] text-white">Yopougon</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => {
                const el = document.getElementById('salons-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto bg-[#C9A45C] hover:bg-[#d6b36a] text-[#101010] font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Rechercher</span>
            </button>
          </div>

          {/* Quick Categories Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(isActive ? null : cat.id);
                    setSearchQuery(isActive ? '' : cat.label);
                  }}
                  className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${isActive
                    ? 'bg-[#C9A45C] border-[#C9A45C] text-[#101010] font-bold shadow-[0_0_12px_rgba(201,164,92,0.3)]'
                    : 'bg-[#151518] border-[#29292e] text-stone-300 hover:text-white hover:border-stone-500'
                    }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* USP Highlights Bar */}
          <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 mt-10 border-t border-[#1e1e23] text-left">
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[#141416] border border-[#222226]">
              <div className="w-10 h-10 rounded-xl bg-[#1d1b15] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Mobile Money</h4>
                <p className="text-[11px] text-stone-400">Wave, Orange, MTN, Moov</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[#141416] border border-[#222226]">
              <div className="w-10 h-10 rounded-xl bg-[#1d1b15] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Rappels</h4>
                <p className="text-[11px] text-stone-400">Par WhatsApp et SMS</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[#141416] border border-[#222226]">
              <div className="w-10 h-10 rounded-xl bg-[#1d1b15] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">24/7</h4>
                <p className="text-[11px] text-stone-400">Réservation en ligne en direct</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: SÉLECTION - SALONS RECOMMANDÉS */}
      <section id="salons-section" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              SÉLECTION
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Salons recommandés
            </h2>
          </div>
          <span className="text-xs text-stone-400 hidden sm:inline">
            {recommendedSalons.length} établissements d'excellence
          </span>
        </div>

        {recommendedSalons.length === 0 ? (
          <div className="text-center py-12 bg-[#141417] rounded-2xl border border-[#25252a]">
            <p className="text-stone-400 text-sm">Aucun salon ne correspond à votre recherche.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCommune('all');
                setSelectedCategory(null);
              }}
              className="mt-3 text-xs text-[#C9A45C] font-semibold hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedSalons.map((salon) => (
              <SalonCard key={salon.id} salon={salon} />
            ))}
          </div>
        )}
      </section>

      {/* SECTION: TENDANCE - LES PLUS POPULAIRES */}
      <section className="py-14 bg-[#111113] border-y border-[#1f1f23]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                TENDANCE
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                Les plus populaires
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCommune('Cocody')}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${selectedCommune === 'Cocody'
                  ? 'bg-[#C9A45C] text-[#101010] font-bold border-[#C9A45C]'
                  : 'bg-[#18181b] border-[#29292e] text-stone-300'
                  }`}
              >
                Cocody
              </button>
              <button
                onClick={() => setSelectedCommune('Marcory')}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${selectedCommune === 'Marcory'
                  ? 'bg-[#C9A45C] text-[#101010] font-bold border-[#C9A45C]'
                  : 'bg-[#18181b] border-[#29292e] text-stone-300'
                  }`}
              >
                Marcory
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularSalons.map((salon) => (
              <SalonCard key={salon.id} salon={salon} />
            ))}
          </div>
        </div>
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

      {/* SECTION: TARIFS (BILLING / FORMULES SAAS) */}
      <section id="billing-section" className="py-16 bg-[#111113] border-y border-[#1f1f23]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold">
              TARIFS
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
              Des formules simples, sans engagement
            </h2>
            <p className="text-sm text-stone-400 mt-3 leading-relaxed">
              Tous les prix sont en FCFA. Paiement par Mobile Money (Wave, Orange, MTN, Moov), carte bancaire ou virement. Sans frais d’installation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-7 flex flex-col ${plan.highlighted
                    ? 'bg-gradient-to-b from-[#1e1b14] to-[#151518] border-2 border-[#C9A45C] shadow-[0_0_35px_rgba(201,164,92,0.15)] md:-mt-3'
                    : 'bg-[#161619] border border-[#27272c]'
                  }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C9A45C] text-[#101010] text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    Le plus choisi
                  </span>
                )}

                <div className="flex items-center gap-2 mb-1">
                  <Store className={`w-4 h-4 ${plan.highlighted ? 'text-[#C9A45C]' : 'text-stone-500'}`} />
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                </div>
                <p className="text-xs text-stone-400 mb-5 min-h-[32px]">{plan.description}</p>

                <div className="flex items-baseline gap-1.5 mb-6">
                  <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-xs text-stone-400">{plan.period}</span>
                </div>

                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-stone-300">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-[1px] ${plan.highlighted ? 'text-[#C9A45C]' : 'text-stone-500'}`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => { setAuthStartView('signup'); setIsRegisterSalonOpen(true); }}
                  className={`w-full font-bold text-sm py-3 rounded-xl transition-all cursor-pointer ${plan.highlighted
                      ? 'bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] shadow-lg'
                      : 'bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b42]'
                    }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-stone-500 mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#C9A45C]" /> Annulation à tout moment</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#C9A45C]" /> Factures conformes</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#C9A45C]" /> 14 jours d’essai offert</span>
          </p>
        </div>
      </section>

      {/* SECTION: NEWSLETTER */}
      <section id="newsletter-section" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="relative rounded-3xl overflow-hidden bg-[#151518] border border-[#27272c] px-6 py-10 sm:px-12 sm:py-12">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#C9A45C]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold">
                NEWSLETTER
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 leading-tight">
                Le meilleur du grooming, chaque semaine.
              </h2>
              <p className="text-sm text-stone-400 mt-3 leading-relaxed max-w-md">
                Nouveaux salons partenaires, offres exclusives, tendances coupe et conseils pour gérer votre établissement. Un e-mail par semaine, zéro spam.
              </p>
            </div>

            <form onSubmit={handleNewsletterSubmit} className="w-full">
              <div className="flex flex-col sm:flex-row gap-2.5 p-2 bg-[#0f0f11] border border-[#2c2c32] rounded-2xl">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="votre@email.com"
                  aria-label="Votre adresse e-mail"
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  S’abonner
                </button>
              </div>
              <p className="text-[11px] text-stone-500 mt-3">
                En vous abonnant, vous acceptez notre politique de confidentialité. Désinscription en un clic.
              </p>
            </form>
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
              <button
                onClick={() => { setAuthStartView('signup'); setIsRegisterSalonOpen(true); }}
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-[0_0_20px_rgba(201,164,92,0.3)] cursor-pointer"
              >
                Inscrire mon salon
              </button>

              {isRegisteredInErp && <button
                onClick={() => setMode('erp')}
                className="bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b42] font-semibold text-sm px-6 py-3 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>Accéder à l'ERP Pro</span>
                <ArrowRight className="w-4 h-4 text-[#C9A45C]" />
              </button>}
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
                La plateforme de référence des barbershops et salons de beauté en Afrique francophone. Née à Abidjan.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">
                CLIENTS
              </h4>
              <ul className="space-y-2">
                <li><a href="#salons-section" className="hover:text-white transition-colors">Trouver un salon</a></li>
                <li><button onClick={() => setSelectedCommune('Cocody')} className="hover:text-white transition-colors">Salons à Cocody</button></li>
                <li><button onClick={() => setSelectedCommune('Marcory')} className="hover:text-white transition-colors">Salons à Marcory</button></li>
                <li><button onClick={() => setSelectedCommune('Plateau')} className="hover:text-white transition-colors">Salons au Plateau</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">
                PROFESSIONNELS
              </h4>
              <ul className="space-y-2">
                {isRegisteredInErp && <li>
                  <button onClick={() => setMode('erp')} className="hover:text-white transition-colors">
                    Barber Cuts Business ERP
                  </button>
                </li>}
                <li>
                  <button onClick={() => { setAuthStartView('signup'); setIsRegisterSalonOpen(true); }} className="hover:text-white transition-colors">
                    Inscrire un établissement
                  </button>
                </li>
                {isRegisteredInErp && <li>
                  <button onClick={() => setMode('erp')} className="hover:text-white transition-colors">
                    Tarifs & Formules SaaS
                  </button>
                </li>}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider mb-3">
                CÔTE D'IVOIRE & AFRIQUE
              </h4>
              <p className="text-xs text-stone-400 leading-relaxed">
                Disponible à Abidjan, Yamoussoukro, Bouaké, San Pedro. Bientôt disponible à Dakar, Douala, Yaoundé et Cotonou.
              </p>
              <div className="mt-3 text-stone-400 flex items-center gap-1.5">
                <span>Devise : FCFA (XOF)</span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-[#19191c] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-400">
            <span>© 2026 Barber Cuts. Abidjan, Côte d'Ivoire. Tous droits réservés.</span>
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

