import React, { Suspense } from 'react';
import { Outlet, useInRouterContext, useLocation } from 'react-router-dom';
import { AppProvider, useOptionalApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/ToastContainer';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';
import { SiteAnnouncementBar } from './components/common/SiteAnnouncementBar';
import { lazyNamed } from './components/common/ViewLoader';
import { useMarketplaceContent, useMarketplaceContentServerSync } from './lib/marketplace-content';
import { useSiteMetadata } from './hooks/useSiteMetadata';
import { isBookingSecretRoute } from './lib/portalIsolation';

const SalonDetailModal = lazyNamed(
  () => import('./components/marketplace/SalonDetailModal'),
  'SalonDetailModal',
);

/** Synchronise langue et métadonnées SEO avec la route courante, hors /admin, portail réservation et fiches salon. */
const SiteMetadataSync: React.FC<{ metadata: Parameters<typeof useSiteMetadata>[0] }> = ({ metadata }) => {
  const { pathname } = useLocation();
  useSiteMetadata(metadata, {
    skip: pathname.startsWith('/admin') || isBookingSecretRoute(pathname) || pathname.startsWith('/salons/'),
    pathname,
  });
  return null;
};

/** Masque le bandeau d'annonce global (et ses liens tiers éventuels) sur le portail secret de réservation. */
const RoutedAnnouncementBar: React.FC<{
  announcement: Parameters<typeof SiteAnnouncementBar>[0]['announcement'];
}> = ({ announcement }) => {
  const { pathname } = useLocation();
  if (isBookingSecretRoute(pathname)) return null;
  return <SiteAnnouncementBar announcement={announcement} />;
};

const AppContent: React.FC = () => {
  // `useInRouterContext` permet de rendre le shell hors routeur (tests SSR).
  const routed = useInRouterContext();
  const { selectedSalonForModal, setSelectedSalonForModal } = useOptionalApp();
  // Configuration globale (annonce, SEO) publiée en base par le SuperAdmin : mise à jour en direct.
  const { config } = useMarketplaceContent();
  // Hydrate le store avec le contenu réellement publié (aucun effet sans Supabase configuré).
  useMarketplaceContentServerSync();

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col font-sans selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* Bandeau d'annonce global (désactivé par défaut et isolé hors portail réservation) */}
      {routed ? (
        <RoutedAnnouncementBar announcement={config.announcement} />
      ) : (
        <SiteAnnouncementBar announcement={config.announcement} />
      )}

      {routed && <SiteMetadataSync metadata={config.siteMetadata} />}

      {/* Top Global Navigation Bar */}
      <Navbar />

      {/* vue de la route courante. Hors routeur (tests SSR) on affiche la marketplace. */}
      <main className="flex-1 flex flex-col">{routed ? <Outlet /> : <MarketplaceHome />}</main>

      {/* Global Overlays & Modals */}
      {selectedSalonForModal && (
        <Suspense fallback={null}>
          <SalonDetailModal salon={selectedSalonForModal} onClose={() => setSelectedSalonForModal(null)} />
        </Suspense>
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
