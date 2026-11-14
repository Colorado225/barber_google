import React from 'react';
import { Link } from 'react-router-dom';
import { Salon } from '../../types';
import { useMarketplaceApp } from '../../context/useMarketplaceApp';
import { useOptionalAuth } from '../../context/AuthContext';
import { isSalonRecommendedByHistory, useMarketplaceContent } from '../../lib/marketplace-content';
import { Heart, MapPin, Sparkles, Star } from 'lucide-react';

interface SalonCardProps {
  salon: Salon;
}

export const SalonCard: React.FC<SalonCardProps> = ({ salon }) => {
  const { setSelectedSalonForModal, formatPrice, isFavoriteSalon, toggleFavoriteSalon, searchedCategories } =
    useMarketplaceApp();
  const { isAuthenticated, user } = useOptionalAuth();
  const { config } = useMarketplaceContent();
  const isLoggedIn = Boolean(isAuthenticated && user);
  const isFavorite = isFavoriteSalon(salon.id);
  const isRecommended = isSalonRecommendedByHistory(salon, searchedCategories, config.categories);

  const typeLabels: Record<string, string> = {
    barbershop: 'Barbershop',
    salon_femme: 'Salon femme',
    salon_mixte: 'Salon mixte',
    institut: 'Institut de beauté',
  };

  return (
    <div
      onClick={() => setSelectedSalonForModal(salon)}
      className="group bg-[#161619] hover:bg-[#1c1c20] border border-[#27272c] hover:border-[#C9A45C]/50 rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col shadow-lg hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transform hover:-translate-y-1"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#111113]">
        {salon.coverImage ? (
          <img
            src={salon.coverImage}
            alt={salon.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          // Pas d'image de couverture : fond neutre plutôt qu'une image cassée.
          <div aria-hidden="true" className="w-full h-full bg-gradient-to-br from-[#1f1f24] to-[#0c0c0e]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#161619] via-transparent to-black/30" />

        {/* Type Badge */}
        <div className="absolute top-3 left-3">
          <span className="text-[11px] font-medium bg-[#141416]/80 backdrop-blur-md text-stone-200 px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
            {salon.type ? typeLabels[salon.type] : 'Type non renseigné'}
          </span>
        </div>

        {/* Verified Badge & Favorite Heart Toggle */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          {salon.isVerified && (
            <span className="text-[10px] font-semibold bg-[#C9A45C]/20 backdrop-blur-md text-[#E5C378] px-2 py-0.5 rounded-full border border-[#C9A45C]/40 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Certifié
            </span>
          )}

          <button
            type="button"
            data-testid={`favorite-toggle-${salon.id}`}
            aria-pressed={isFavorite}
            aria-label={
              isLoggedIn
                ? isFavorite
                  ? `Retirer ${salon.name} des favoris`
                  : `Ajouter ${salon.name} aux favoris`
                : `Connectez-vous pour ajouter ${salon.name} aux favoris`
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

        {/* Next Slot pill */}
        <div className="absolute bottom-3 left-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{salon.nextAvailableSlot}</span>
          </div>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          {isRecommended && (
            <span
              data-testid={`recommended-badge-${salon.id}`}
              title="Recommandé selon vos recherches de catégories récentes"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E5C378] mb-1"
            >
              <Sparkles className="w-3 h-3 text-[#C9A45C]" aria-hidden="true" />
              <span>Recommandé</span>
            </span>
          )}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              {salon.logo && (
                <img
                  src={salon.logo}
                  alt={salon.name}
                  className="w-7 h-7 rounded-lg object-cover border border-[#C9A45C]/40 shrink-0"
                />
              )}
              <h3 className="text-base font-bold text-white group-hover:text-[#C9A45C] transition-colors line-clamp-1">
                {salon.name}
              </h3>
            </div>
            {salon.rating !== undefined && salon.reviewCount !== undefined && (
              <div className="flex items-center gap-1 text-xs font-semibold text-amber-300 shrink-0">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{salon.rating.toFixed(1)}</span>
                <span className="text-stone-400 font-normal">({salon.reviewCount})</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span className="line-clamp-1">{[salon.commune, salon.quarter].filter(Boolean).join(', ')}</span>
          </div>
        </div>

        {/* Price & Action */}
        <div className="pt-3 border-t border-[#242428] flex items-center justify-between text-xs">
          <div>
            <span className="text-stone-400 block text-[11px]">
              {salon.avgPrice !== undefined && salon.minPrice === undefined ? 'Prix moyen' : 'À partir de'}
            </span>
            <span className="font-bold text-[#E5C378] text-sm tabular-nums">
              {salon.minPrice !== undefined
                ? formatPrice(salon.minPrice)
                : salon.avgPrice !== undefined
                  ? formatPrice(salon.avgPrice)
                  : 'Non renseigné'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {salon.isDemo ? (
              <span className="text-[11px] font-medium text-stone-500 px-2.5 py-1.5 rounded-lg bg-[#1d1d21] border border-stone-800">
                Démo
              </span>
            ) : (
              <Link
                to={`/salons/${salon.slug || salon.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-medium text-stone-400 hover:text-[#C9A45C] px-2.5 py-1.5 rounded-lg bg-[#1d1d21] hover:bg-[#25252b] border border-stone-800 transition-colors"
              >
                Vitrine
              </Link>
            )}

            <span className="text-xs font-semibold text-stone-300 group-hover:text-white bg-[#222226] group-hover:bg-[#C9A45C] group-hover:text-[#101010] px-3 py-1.5 rounded-lg transition-all">
              Réserver
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
