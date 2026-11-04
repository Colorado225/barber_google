import React, { useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Building2, Menu, Scissors, Store, X } from 'lucide-react';
import { useOptionalApp } from '../../context/AppContext';

export const Navbar: React.FC = () => {
  const routed = useInRouterContext();
  const { mode, setMode, activeSalon } = useOptionalApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const homeLink = routed ? (
    <Link to="/" className="flex items-center gap-3 group text-left">
      <div className="w-10 h-10 rounded-xl bg-[#1b1a17] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] group-hover:scale-105 transition-all">
        <Scissors className="w-5 h-5 rotate-90" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-white">
          Barber<span className="text-[#C9A45C]">Cuts</span>
        </span>
        <span className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium">
          {mode === 'erp' ? 'Business ERP' : 'Marketplace'}
        </span>
      </div>
    </Link>
  ) : (
    <button onClick={() => setMode('marketplace')} className="flex items-center gap-3 group text-left">
      <div className="w-10 h-10 rounded-xl bg-[#1b1a17] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] group-hover:scale-105 transition-all">
        <Scissors className="w-5 h-5 rotate-90" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-white">
          Barber<span className="text-[#C9A45C]">Cuts</span>
        </span>
        <span className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium">
          Marketplace
        </span>
      </div>
    </button>
  );

  const authLinks = routed ? (
    <>
      <Link to="/connexion" className="text-sm font-medium text-stone-300 hover:text-white">
        Connexion
      </Link>
      <Link
        to="/inscription"
        className="bg-[#C9A45C] text-[#101010] font-semibold text-sm px-4 py-2 rounded-lg"
      >
        Inscrire mon salon
      </Link>
      <Link
        to="/app/tableau-de-bord"
        className="text-sm font-medium text-stone-300 hover:text-[#C9A45C] flex items-center gap-2"
      >
        <Store className="w-4 h-4" />
        Espace professionnel
      </Link>
    </>
  ) : (
    <>
      <button onClick={() => setMode('marketplace')} className="text-sm font-medium text-white">
        Explorer
      </button>
      <span className="text-sm text-stone-500">Connectez-vous pour accéder à votre espace.</span>
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-[#101010]/95 backdrop-blur-md border-b border-[#232326]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[4.5rem] flex items-center justify-between">
        <div className="flex items-center gap-6">
          {homeLink}
          {mode === 'erp' && activeSalon && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#18181b] border border-[#2d2d32] text-xs text-stone-300">
              <Building2 className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span className="font-medium text-white">{activeSalon.name}</span>
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-5">{authLinks}</nav>

        <div className="flex md:hidden items-center gap-2">
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
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="md:hidden bg-[#141416] border-b border-[#232326] px-4 pt-3 pb-6 flex flex-col gap-3">
          {routed ? (
            <>
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm text-stone-200">
                Explorer les salons
              </Link>
              <Link to="/connexion" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm text-stone-200">
                Connexion
              </Link>
              <Link to="/inscription" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm text-stone-200">
                Inscrire un salon
              </Link>
              <Link to="/app/tableau-de-bord" onClick={() => setMobileMenuOpen(false)} className="py-2 text-sm text-[#C9A45C]">
                Espace professionnel
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
