import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/ToastContainer';
import { MarketplaceHome } from './components/marketplace/MarketplaceHome';
import { SalonDetailModal } from './components/marketplace/SalonDetailModal';
import { RegisterSalonModal } from './components/marketplace/RegisterSalonModal';
import { ClientBookingsModal } from './components/marketplace/ClientBookingsModal';
import { ErpLayout } from './components/erp/ErpLayout';

import { OnboardingWizardPage } from './components/erp/OnboardingWizardPage';

const AppContent: React.FC = () => {
  const {
    mode,
    selectedSalonForModal,
    setSelectedSalonForModal,
    isOnboardingOpen
  } = useApp();

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] flex flex-col font-sans selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* Top Global Navigation Bar */}
      <Navbar />

      {/* Main View: Marketplace OR Business ERP */}
      <main className="flex-1 flex flex-col">
        {mode === 'marketplace' ? <MarketplaceHome /> : <ErpLayout />}
      </main>

      {/* Global Overlays & Modals */}
      {selectedSalonForModal && (
        <SalonDetailModal
          salon={selectedSalonForModal}
          onClose={() => setSelectedSalonForModal(null)}
        />
      )}

      {/* Onboarding Flow for Salon Owners */}
      {isOnboardingOpen && <OnboardingWizardPage />}

      <RegisterSalonModal />
      <ClientBookingsModal />
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
