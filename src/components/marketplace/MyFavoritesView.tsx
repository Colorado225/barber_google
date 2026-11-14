import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, LogIn } from 'lucide-react';
import { useOptionalApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { applyStrictPortalPrivacy } from '../../lib/portalIsolation';
import { SalonCard } from './SalonCard';

export const MyFavoritesView: React.FC = () => {
  const { salons, favoriteSalonIds, marketplaceLoading } = useOptionalApp();
  const { isAuthenticated, user } = useOptionalAuth();
  const isLoggedIn = Boolean(isAuthenticated && user);

  useEffect(() => applyStrictPortalPrivacy({ title: 'Mes favoris — Barber Cuts' }), []);

  const favoriteSalons = useMemo(() => {
    if (!isLoggedIn || favoriteSalonIds.length === 0) return [];
    const favoriteSet = new Set(favoriteSalonIds);
    return salons.filter((salon) => favoriteSet.has(salon.id) && salon.status !== 'suspended');
  }, [isLoggedIn, favoriteSalonIds, salons]);

  return (
    <div
      data-testid="my-favorites-view"
      className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8 flex-1"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#232328] pb-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#C9A45C] font-semibold flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 fill-[#C9A45C] text-[#C9A45C]" aria-hidden="true" />
            Espace client
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Mes favoris</h1>
          <p className="text-xs sm:text-sm text-stone-400 mt-1">
            Retrouvez rapidement les barbershops et salons que vous avez enregistrés.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#16161b] hover:bg-[#1e1e25] border border-[#2a2a33] text-xs font-semibold text-stone-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Explorer la marketplace</span>
        </Link>
      </header>

      {!isLoggedIn ? (
        <div className="max-w-xl mx-auto bg-[#161619] border border-[#27272c] rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1f1b13] border border-[#C9A45C]/30 text-[#C9A45C] flex items-center justify-center mx-auto">
            <LogIn className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-white">Connectez-vous pour retrouver vos favoris</h2>
          <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
            La liste des salons favoris est liée à votre compte afin de les conserver sur tous vos appareils.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/connexion"
              className="px-5 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] text-xs font-bold transition-colors"
            >
              Se connecter
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-[#222228] hover:bg-[#2c2c34] text-stone-200 text-xs font-semibold transition-colors"
            >
              Parcourir les salons
            </Link>
          </div>
        </div>
      ) : marketplaceLoading && favoriteSalons.length === 0 ? (
        <p className="text-sm text-stone-400">Chargement de vos salons favoris…</p>
      ) : favoriteSalons.length === 0 ? (
        <div
          data-testid="my-favorites-empty"
          className="max-w-xl mx-auto bg-[#161619] border border-[#27272c] rounded-3xl p-8 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#1c1618] border border-rose-500/25 text-rose-400 flex items-center justify-center mx-auto">
            <Heart className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-white">Vous n’avez encore aucun salon favori</h2>
          <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
            Cliquez sur l’icône cœur présente sur la fiche d’un salon pour l’ajouter ici et y accéder en un
            clic.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b46c] text-[#101010] text-xs font-bold transition-colors"
            >
              Découvrir les salons
            </Link>
          </div>
        </div>
      ) : (
        <div data-testid="my-favorites-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteSalons.map((salon) => (
            <SalonCard key={salon.id} salon={salon} />
          ))}
        </div>
      )}
    </div>
  );
};
