import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SalonCard } from './SalonCard';
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
  Flame
} from 'lucide-react';

export const MarketplaceHome: React.FC = () => {
  const { salons, setMode, setIsRegisterSalonOpen, reviews, isRegisteredInErp, setAuthStartView } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommune, setSelectedCommune] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
                  className={`text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                    isActive
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
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                  selectedCommune === 'Cocody'
                    ? 'bg-[#C9A45C] text-[#101010] font-bold border-[#C9A45C]'
                    : 'bg-[#18181b] border-[#29292e] text-stone-300'
                }`}
              >
                Cocody
              </button>
              <button
                onClick={() => setSelectedCommune('Marcory')}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                  selectedCommune === 'Marcory'
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((rev) => (
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
