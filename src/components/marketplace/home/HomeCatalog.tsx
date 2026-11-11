// Catalogue public : filtre par style, bandeau des réservations mémorisées
// sur l'appareil et grille des salons publiés.
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Sparkles, Tag } from 'lucide-react';
import type { Salon } from '../../../types';
import type { MarketplaceCategoryItem } from '../../../lib/marketplace-content';
import { setActiveBookingToken, type SavedBooking } from '../../../lib/bookingVault';
import { SalonCard } from '../SalonCard';

export const CategoryFilter: React.FC<{
  categories: MarketplaceCategoryItem[];
  selectedCategorySlug: string | null;
  /** Sélectionne un style et pré-remplit la recherche (null = tous les styles). */
  onSelect: (slug: string | null, query: string) => void;
}> = ({ categories, selectedCategorySlug, onSelect }) => (
  <>
    {' '}
    <section className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-[11px] uppercase tracking-wider font-bold text-stone-500 mr-2 shrink-0 flex items-center gap-1">
          <Tag className="w-3 h-3 text-[#C9A45C]" />
          Styles populaires :
        </span>
        <button
          onClick={() => onSelect(null, '')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
            !selectedCategorySlug
              ? 'bg-[#C9A45C] text-[#101010] font-bold'
              : 'bg-[#16161c] text-stone-300 hover:text-white border border-[#262632]'
          }`}
        >
          Tous les styles
        </button>
        {categories
          .filter((c) => c.isVisible)
          .map((cat) => {
            const isSelected = selectedCategorySlug === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() =>
                  onSelect(isSelected ? null : cat.slug, isSelected ? '' : cat.label.split(' ')[0])
                }
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
  </>
);
export const SavedBookingsBanner: React.FC<{ savedBookings: SavedBooking[]; routed: boolean }> = ({
  savedBookings,
  routed,
}) => {
  if (savedBookings.length === 0) return null;
  return (
    <>
      {' '}
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
                to="/reservation"
                state={{ bookingToken: savedBookings[0].token }}
                onClick={() => setActiveBookingToken(savedBookings[0].token)}
                className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] text-xs font-bold inline-flex items-center gap-1.5"
              >
                Suivre ma réservation <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <a
                href="/reservation"
                onClick={() => setActiveBookingToken(savedBookings[0].token)}
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
    </>
  );
};
export const SalonsSection: React.FC<{
  salons: Salon[];
  demoMode: boolean;
  loading: boolean;
  error: string | null;
  onResetFilters: () => void;
}> = ({ salons, demoMode, loading, error, onResetFilters }) => (
  <>
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
          {demoMode ? `${salons.length} fiche(s) de démonstration` : `${salons.length} établissement(s)`}
        </span>
      </div>

      {loading && <p className="text-sm text-stone-400 mb-4">Chargement des salons publiés…</p>}
      {error && (
        <p
          role="alert"
          className="text-sm text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg p-3 mb-4"
        >
          {error}
        </p>
      )}
      {demoMode && (
        <p
          role="status"
          className="text-sm text-amber-200 bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 mb-4"
        >
          Mode démonstration : salons, avis et sections ci-dessous sont fictifs. Aucun salon réel n’est publié
          pour le moment, et ces fiches ne sont pas réservables.
        </p>
      )}
      {salons.length === 0 ? (
        <div className="text-center py-12 bg-[#141417] rounded-2xl border border-[#25252a]">
          <p className="text-stone-400 text-sm">
            Aucun salon réel n’est actuellement publié dans la marketplace.
          </p>
          <button
            onClick={() => onResetFilters()}
            className="mt-3 text-xs text-[#C9A45C] font-semibold hover:underline cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {salons.map((salon) => (
            <SalonCard key={salon.id} salon={salon} />
          ))}
        </div>
      )}
    </section>
  </>
);
