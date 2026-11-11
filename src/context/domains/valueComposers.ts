// Composition des valeurs de contexte par domaine (extrait de l'ancien
// AppContext.tsx monolithique) : chaque compositrice sélectionne la surface
// publique du domaine et stabilise les références par useMemo.
import { useMemo } from 'react';

import type { useAppointmentsDomainState } from './AppointmentsDomainContext';
import type { useClientsDomainState } from './ClientsDomainContext';
import type { useFinanceDomainState } from './FinanceDomainContext';
import type { useMarketplaceDomainState } from './MarketplaceDomainContext';
import type { useNotificationsDomainState } from './NotificationsDomainContext';

export function useMarketplaceValue(marketplaceDomain: ReturnType<typeof useMarketplaceDomainState>) {
  const value = useMemo(
    () => ({
      salons: marketplaceDomain.salons,
      branches: marketplaceDomain.branches,
      reviews: marketplaceDomain.reviews,
      marketplaceLoading: marketplaceDomain.marketplaceLoading,
      marketplaceError: marketplaceDomain.marketplaceError,
      refreshMarketplace: marketplaceDomain.refreshMarketplace,
      addReview: marketplaceDomain.addReview,
      bookPublicAppointment: marketplaceDomain.bookPublicAppointment,
      cancelPublicBooking: marketplaceDomain.cancelPublicBooking,
      setSalonPublished: marketplaceDomain.setSalonPublished,
      updateSalonDetails: marketplaceDomain.updateSalonDetails,
    }),
    [
      marketplaceDomain.salons,
      marketplaceDomain.branches,
      marketplaceDomain.reviews,
      marketplaceDomain.marketplaceLoading,
      marketplaceDomain.marketplaceError,
      marketplaceDomain.refreshMarketplace,
      marketplaceDomain.addReview,
      marketplaceDomain.bookPublicAppointment,
      marketplaceDomain.cancelPublicBooking,
      marketplaceDomain.setSalonPublished,
      marketplaceDomain.updateSalonDetails,
    ],
  );
  return value;
}

export function useAppointmentsValue(appointmentsDomain: ReturnType<typeof useAppointmentsDomainState>) {
  const value = useMemo(
    () => ({
      appointments: appointmentsDomain.appointments,
      services: appointmentsDomain.services,
      staff: appointmentsDomain.staff,
      bookAppointment: appointmentsDomain.bookAppointment,
      updateAppointmentStatus: appointmentsDomain.updateAppointmentStatus,
      updateAppointmentDetails: appointmentsDomain.updateAppointmentDetails,
      cancelAppointment: appointmentsDomain.cancelAppointment,
      registerWalkIn: appointmentsDomain.registerWalkIn,
      startWalkIn: appointmentsDomain.startWalkIn,
      completeWalkIn: appointmentsDomain.completeWalkIn,
      updateAppointment: appointmentsDomain.updateAppointment,
      deleteAppointment: appointmentsDomain.deleteAppointment,
      addService: appointmentsDomain.addService,
      updateService: appointmentsDomain.updateService,
      deleteService: appointmentsDomain.deleteService,
      setServiceActive: appointmentsDomain.setServiceActive,
      addStaff: appointmentsDomain.addStaff,
      updateStaff: appointmentsDomain.updateStaff,
      deleteStaff: appointmentsDomain.deleteStaff,
    }),
    [
      appointmentsDomain.appointments,
      appointmentsDomain.services,
      appointmentsDomain.staff,
      appointmentsDomain.bookAppointment,
      appointmentsDomain.updateAppointmentStatus,
      appointmentsDomain.updateAppointmentDetails,
      appointmentsDomain.cancelAppointment,
      appointmentsDomain.registerWalkIn,
      appointmentsDomain.startWalkIn,
      appointmentsDomain.completeWalkIn,
      appointmentsDomain.updateAppointment,
      appointmentsDomain.deleteAppointment,
      appointmentsDomain.addService,
      appointmentsDomain.updateService,
      appointmentsDomain.deleteService,
      appointmentsDomain.setServiceActive,
      appointmentsDomain.addStaff,
      appointmentsDomain.updateStaff,
      appointmentsDomain.deleteStaff,
    ],
  );
  return value;
}

export function useClientsValue(clientsDomain: ReturnType<typeof useClientsDomainState>) {
  const value = useMemo(
    () => ({
      clients: clientsDomain.clients,
      loyaltyRewards: clientsDomain.loyaltyRewards,
      loyaltyTransactions: clientsDomain.loyaltyTransactions,
      loyaltyAccounts: clientsDomain.loyaltyAccounts,
      loyaltyLedger: clientsDomain.loyaltyLedger,
      loyaltySettings: clientsDomain.loyaltySettings,
      refreshLoyalty: clientsDomain.refreshLoyalty,
      addLoyaltyReward: clientsDomain.addLoyaltyReward,
      updateLoyaltyReward: clientsDomain.updateLoyaltyReward,
      deleteLoyaltyReward: clientsDomain.deleteLoyaltyReward,
      updateLoyaltySettings: clientsDomain.updateLoyaltySettings,
      redeemRewardForClient: clientsDomain.redeemRewardForClient,
      creditPointsToClient: clientsDomain.creditPointsToClient,
      addClient: clientsDomain.addClient,
      updateClientNotes: clientsDomain.updateClientNotes,
      updateClient: clientsDomain.updateClient,
      deleteClient: clientsDomain.deleteClient,
    }),
    [
      clientsDomain.clients,
      clientsDomain.loyaltyRewards,
      clientsDomain.loyaltyTransactions,
      clientsDomain.loyaltyAccounts,
      clientsDomain.loyaltyLedger,
      clientsDomain.loyaltySettings,
      clientsDomain.refreshLoyalty,
      clientsDomain.addLoyaltyReward,
      clientsDomain.updateLoyaltyReward,
      clientsDomain.deleteLoyaltyReward,
      clientsDomain.updateLoyaltySettings,
      clientsDomain.redeemRewardForClient,
      clientsDomain.creditPointsToClient,
      clientsDomain.addClient,
      clientsDomain.updateClientNotes,
      clientsDomain.updateClient,
      clientsDomain.deleteClient,
    ],
  );
  return value;
}

export function useFinanceValue(financeDomain: ReturnType<typeof useFinanceDomainState>) {
  const value = useMemo(
    () => ({
      transactions: financeDomain.transactions,
      cashSession: financeDomain.cashSession,
      cashSessions: financeDomain.cashSessions,
      financialSummary: financeDomain.financialSummary,
      dashboardMetrics: financeDomain.dashboardMetrics,
      dashboardMetricsLoading: financeDomain.dashboardMetricsLoading,
      loadDashboardMetrics: financeDomain.loadDashboardMetrics,
      loadFinancialSummary: financeDomain.loadFinancialSummary,
      expenses: financeDomain.expenses,
      expenseEvents: financeDomain.expenseEvents,
      stocks: financeDomain.stocks,
      stockMovements: financeDomain.stockMovements,
      suppliers: financeDomain.suppliers,
      recordPayment: financeDomain.recordPayment,
      confirmPendingPayment: financeDomain.confirmPendingPayment,
      rejectPendingPayment: financeDomain.rejectPendingPayment,
      recordPaymentCorrection: financeDomain.recordPaymentCorrection,
      getAppointmentBalance: financeDomain.getAppointmentBalance,
      closeCurrentCashSession: financeDomain.closeCurrentCashSession,
      openNewCashSession: financeDomain.openNewCashSession,
      reconcileCashSession: financeDomain.reconcileCashSession,
      refreshFinance: financeDomain.refreshFinance,
      addExpense: financeDomain.addExpense,
      attachExpenseReceipt: financeDomain.attachExpenseReceipt,
      reverseExpense: financeDomain.reverseExpense,
      correctExpense: financeDomain.correctExpense,
      deleteExpense: financeDomain.deleteExpense,
      upsertSupplier: financeDomain.upsertSupplier,
      addStockItem: financeDomain.addStockItem,
      updateStockItemMetadata: financeDomain.updateStockItemMetadata,
      recordStockMovement: financeDomain.recordStockMovement,
      adjustStockQuantity: financeDomain.adjustStockQuantity,
    }),
    [
      financeDomain.transactions,
      financeDomain.cashSession,
      financeDomain.cashSessions,
      financeDomain.financialSummary,
      financeDomain.dashboardMetrics,
      financeDomain.dashboardMetricsLoading,
      financeDomain.loadDashboardMetrics,
      financeDomain.loadFinancialSummary,
      financeDomain.expenses,
      financeDomain.expenseEvents,
      financeDomain.stocks,
      financeDomain.stockMovements,
      financeDomain.suppliers,
      financeDomain.recordPayment,
      financeDomain.confirmPendingPayment,
      financeDomain.rejectPendingPayment,
      financeDomain.recordPaymentCorrection,
      financeDomain.getAppointmentBalance,
      financeDomain.closeCurrentCashSession,
      financeDomain.openNewCashSession,
      financeDomain.reconcileCashSession,
      financeDomain.refreshFinance,
      financeDomain.addExpense,
      financeDomain.attachExpenseReceipt,
      financeDomain.reverseExpense,
      financeDomain.correctExpense,
      financeDomain.deleteExpense,
      financeDomain.upsertSupplier,
      financeDomain.addStockItem,
      financeDomain.updateStockItemMetadata,
      financeDomain.recordStockMovement,
      financeDomain.adjustStockQuantity,
    ],
  );
  return value;
}

export function useNotificationsValue(notificationsDomain: ReturnType<typeof useNotificationsDomainState>) {
  const value = useMemo(
    () => ({
      notifications: notificationsDomain.notifications,
      notificationHealth: notificationsDomain.notificationHealth,
      notificationProbe: notificationsDomain.notificationProbe,
      refreshNotifications: notificationsDomain.refreshNotifications,
      probeNotifications: notificationsDomain.probeNotifications,
      dispatchNotifications: notificationsDomain.dispatchNotifications,
      retryNotification: notificationsDomain.retryNotification,
    }),
    [
      notificationsDomain.notifications,
      notificationsDomain.notificationHealth,
      notificationsDomain.notificationProbe,
      notificationsDomain.refreshNotifications,
      notificationsDomain.probeNotifications,
      notificationsDomain.dispatchNotifications,
      notificationsDomain.retryNotification,
    ],
  );
  return value;
}
