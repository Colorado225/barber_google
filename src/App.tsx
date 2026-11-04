import React from 'react';
import { Outlet, useInRouterContext } from 'react-router-dom';
import { AppProvider, useOptionalApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/ToastContainer';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';
import { SalonDetailModal } from './components/marketplace/SalonDetailModal';

const AppContent: React.FC = () => {
  // `useInRouterContext` permet de rendre le shell hors routeur (tests SSR).
  const routed = useInRouterContext();
  const {
    mode,
    selectedSalonForModal,
    setSelectedSalonForModal
  } = useOptionalApp();

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col font-sans selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* Top Global Navigation Bar */}
      <Navbar />

      {/* vue de la route courante. Hors routeur (tests SSR) on affiche la marketplace. */}
      <main className="flex-1 flex flex-col">
        {routed ? <Outlet /> : <MarketplaceHome />}
      </main>

      {/* Global Overlays & Modals */}
      {selectedSalonForModal && (
        <SalonDetailModal
          salon={selectedSalonForModal}
          onClose={() => setSelectedSalonForModal(null)}
        />
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
