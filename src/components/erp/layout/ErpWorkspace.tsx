// Espace de travail ERP : alertes de synchronisation/suspension, rendu de la
// vue active et modales d'action rapide (RDV, encaissement, client de passage).
import React, { Suspense } from 'react';
import { SectionLoadingFallback, lazyNamed } from '../../common/ViewLoader';
import type { Appointment, Salon } from '../../../types';
import type { ErpTab } from '../ErpLayout';

const DashboardView = lazyNamed(() => import('../DashboardView'), 'DashboardView');
const CashRegisterView = lazyNamed(() => import('../CashRegisterView'), 'CashRegisterView');
const ServicesView = lazyNamed(() => import('../ServicesView'), 'ServicesView');
const StaffView = lazyNamed(() => import('../StaffView'), 'StaffView');
const FinanceExpensesView = lazyNamed(() => import('../FinanceExpensesView'), 'FinanceExpensesView');
const InventoryView = lazyNamed(() => import('../InventoryView'), 'InventoryView');
const SalonProfileSettingsView = lazyNamed(
  () => import('../SalonProfileSettingsView'),
  'SalonProfileSettingsView',
);
const MarketplaceShowcaseView = lazyNamed(
  () => import('../MarketplaceShowcaseView'),
  'MarketplaceShowcaseView',
);
const SaaSPlanView = lazyNamed(() => import('../SaaSPlanView'), 'SaaSPlanView');
const SalonQrCodeView = lazyNamed(() => import('../SalonQrCodeView'), 'SalonQrCodeView');
const ReportsView = lazyNamed(() => import('../ReportsView'), 'ReportsView');
const ClientsView = lazyNamed(() => import('../ClientsView'), 'ClientsView');
const PlanningView = lazyNamed(() => import('../PlanningView'), 'PlanningView');
const LoyaltyView = lazyNamed(() => import('../LoyaltyView'), 'LoyaltyView');
const NewAppointmentModal = lazyNamed(() => import('../NewAppointmentModal'), 'NewAppointmentModal');
const NewPaymentModal = lazyNamed(() => import('../NewPaymentModal'), 'NewPaymentModal');
const WalkInModal = lazyNamed(() => import('../WalkInModal'), 'WalkInModal');
const WalkInView = lazyNamed(() => import('../WalkInView'), 'WalkInView');
const OnlineRequestsView = lazyNamed(() => import('../OnlineRequestsView'), 'OnlineRequestsView');
const NotificationsView = lazyNamed(() => import('../NotificationsView'), 'NotificationsView');

export const ErpWorkspace: React.FC<{
  activeSalon: Salon;
  visibleActiveTab: ErpTab;
  syncError: string | null;
  onSyncNow: () => void;
  /** Ré-ouvre la modale RDV (depuis le tableau de bord). */
  reopenAppointment: () => void;
  openWalkIn: () => void;
  openPayment: () => void;
  openPaymentWith: (appointment: Appointment) => void;
  /** Modale walk-in : état contrôlé par le layout. */
  isWalkInOpen: boolean;
  onCloseWalkIn: () => void;
  onWalkInCreated: () => void;
  isNewAppointmentOpen: boolean;
  onCloseAppointment: () => void;
  /** Créneau pré-sélectionné de la modale RDV (provenant du planning/dashboard). */
  newAppointmentSlot: { date?: string; time?: string; staffId?: string };
  isNewPaymentOpen: boolean;
  onClosePayment: () => void;
  preselectedAppointment: Appointment | null;
}> = ({
  activeSalon,
  visibleActiveTab,
  syncError,
  onSyncNow,
  reopenAppointment,
  openWalkIn,
  openPayment,
  openPaymentWith,
  isWalkInOpen,
  onCloseWalkIn,
  onWalkInCreated,
  isNewAppointmentOpen,
  onCloseAppointment,
  newAppointmentSlot,
  isNewPaymentOpen,
  onClosePayment,
  preselectedAppointment,
}) => (
  <>
    {/* Corps de l'onglet actif */}
    <main key={activeSalon.id} className="p-4 sm:p-6 lg:p-8 flex-1">
      {syncError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-800/60 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-200"
        >
          <span>{syncError}</span>
          <button
            type="button"
            onClick={() => onSyncNow()}
            className="px-3 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800/60 text-white font-semibold cursor-pointer"
          >
            Synchroniser
          </button>
        </div>
      )}
      {activeSalon.status === 'suspended' && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-xs text-red-200"
        >
          <p className="font-bold">
            Salon suspendu par l’administration : la vitrine marketplace et les réservations publiques sont
            désactivées.
          </p>
          {activeSalon.suspensionReason && (
            <p className="text-red-300/90 mt-1">Motif : {activeSalon.suspensionReason}</p>
          )}
        </div>
      )}
      <Suspense fallback={<SectionLoadingFallback label="Chargement de la vue ERP…" />}>
        {visibleActiveTab === 'dashboard' && (
          <DashboardView
            onOpenNewAppointment={reopenAppointment}
            onOpenWalkIn={openWalkIn}
            onOpenNewPayment={openPayment}
          />
        )}

        {visibleActiveTab === 'walk_in' && (
          <WalkInView onOpenNewWalkIn={openWalkIn} onOpenPayment={openPaymentWith} />
        )}

        {visibleActiveTab === 'online_requests' && <OnlineRequestsView />}
        {visibleActiveTab === 'notifications' && <NotificationsView />}
        {visibleActiveTab === 'calendar' && <PlanningView onOpenWalkIn={openWalkIn} />}

        {visibleActiveTab === 'cash' && <CashRegisterView />}

        {visibleActiveTab === 'loyalty' && <LoyaltyView />}

        {visibleActiveTab === 'crm' && <ClientsView />}

        {visibleActiveTab === 'services' && <ServicesView />}

        {visibleActiveTab === 'staff' && <StaffView />}

        {visibleActiveTab === 'expenses' && <FinanceExpensesView />}

        {visibleActiveTab === 'inventory' && <InventoryView />}

        {visibleActiveTab === 'marketplace_showcase' && <MarketplaceShowcaseView />}

        {visibleActiveTab === 'reports' && <ReportsView />}

        {visibleActiveTab === 'qr_code' && <SalonQrCodeView />}

        {visibleActiveTab === 'storefront' && <SalonProfileSettingsView />}

        {visibleActiveTab === 'saas' && <SaaSPlanView />}
      </Suspense>
    </main>

    {/* ACCUEIL CLIENT SANS RENDEZ-VOUS */}
    {isWalkInOpen && (
      <Suspense fallback={null}>
        <WalkInModal onClose={onCloseWalkIn} onCreated={onWalkInCreated} />
      </Suspense>
    )}

    {/* QUICK NEW APPOINTMENT MODAL */}
    {isNewAppointmentOpen && (
      <Suspense fallback={null}>
        <NewAppointmentModal
          onClose={onCloseAppointment}
          initialDate={newAppointmentSlot.date}
          initialTime={newAppointmentSlot.time}
          initialStaffId={newAppointmentSlot.staffId}
        />
      </Suspense>
    )}

    {/* QUICK NEW PAYMENT MODAL */}
    {isNewPaymentOpen && (
      <Suspense fallback={null}>
        <NewPaymentModal
          onClose={onClosePayment}
          preselectedAppointmentId={preselectedAppointment?.id}
          defaultAmount={preselectedAppointment?.price}
          defaultClientName={preselectedAppointment?.clientName || ''}
        />
      </Suspense>
    )}
  </>
);
