import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, useInRouterContext, useLocation } from 'react-router-dom';
import { MarketplaceProvider } from './context/MarketplaceProvider';
import { useUI } from './context/UIContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/ToastContainer';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';
import { SiteAnnouncementBar } from './components/common/SiteAnnouncementBar';
import { lazyNamed } from './components/common/ViewLoader';
import { useMarketplaceContent } from './lib/marketplace-content';
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
  const { selectedSalonForModal, setSelectedSalonForModal } = useUI();
  // Configuration globale (annonce, SEO) gérée par le SuperAdmin : mise à jour en direct.
  const { config } = useMarketplaceContent();
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col font-sans selection:bg-[#C9A45C] selection:text-[#101010]">
      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
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
    <MarketplaceProvider>
      <AppContent />
    </MarketplaceProvider>
  );
}
