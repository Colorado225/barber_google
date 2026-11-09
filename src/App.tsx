import React from 'react';
import { Outlet, useInRouterContext, useLocation } from 'react-router-dom';
import { AppProvider, useOptionalApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/ToastContainer';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';
import { SalonDetailModal } from './components/marketplace/SalonDetailModal';
import { SiteAnnouncementBar } from './components/common/SiteAnnouncementBar';
import { useMarketplaceContent } from './lib/marketplace-content';
import { useSiteMetadata } from './hooks/useSiteMetadata';

/** Synchronise titre et meta description avec la configuration, hors pages /admin (rendu dans le routeur uniquement). */
const SiteMetadataSync: React.FC<{ metadata: Parameters<typeof useSiteMetadata>[0] }> = ({ metadata }) => {
  const { pathname } = useLocation();
  useSiteMetadata(metadata, { skip: pathname.startsWith('/admin') });
  return null;
};

const AppContent: React.FC = () => {
  // `useInRouterContext` permet de rendre le shell hors routeur (tests SSR).
  const routed = useInRouterContext();
  const { mode, selectedSalonForModal, setSelectedSalonForModal } = useOptionalApp();
  // Configuration globale (annonce, SEO) gérée par le SuperAdmin : mise à jour en direct.
  const { config } = useMarketplaceContent();

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col font-sans selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* Bandeau d'annonce global (désactivé par défaut) */}
      <SiteAnnouncementBar announcement={config.announcement} />

      {routed && <SiteMetadataSync metadata={config.siteMetadata} />}

      {/* Top Global Navigation Bar */}
      <Navbar />

      {/* vue de la route courante. Hors routeur (tests SSR) on affiche la marketplace. */}
      <main className="flex-1 flex flex-col">{routed ? <Outlet /> : <MarketplaceHome />}</main>

      {/* Global Overlays & Modals */}
      {selectedSalonForModal && (
        <SalonDetailModal salon={selectedSalonForModal} onClose={() => setSelectedSalonForModal(null)} />
      )}

      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
