import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { Appointment, RealtimeSyncStatus, Salon } from '../types';
import { getApiErrorMessage } from '../lib/apiError';
import { resolveSalonTimezone } from '../lib/businessTime';
import { createDomainCache } from '../lib/domainCache';
import { getActiveMemberships } from '../lib/erpSalonSelection';
import type { RealtimeClientLike, SalonRealtimeController } from '../lib/realtimeSync';
import { useOptionalAuth } from './AuthContext';
import {
  UIContext,
  useOptionalUI,
  useUI,
  useUiFeedback,
  useUiFeedbackState,
  type AppMode,
  type Toast,
} from './UIContext';
import {
  AppointmentsDomainContext,
  useAppointmentsDomain,
  useAppointmentsDomainState,
} from './domains/AppointmentsDomainContext';
import {
  ClientsDomainContext,
  useClientsDomain,
  useClientsDomainState,
} from './domains/ClientsDomainContext';
import {
  FinanceDomainContext,
  useFinanceDomain,
  useFinanceDomainState,
  type DashboardMetricsParams,
} from './domains/FinanceDomainContext';
import {
  MarketplaceDomainContext,
  useMarketplaceDomain,
  useMarketplaceDomainState,
} from './domains/MarketplaceDomainContext';
import {
  NotificationsDomainContext,
  useNotificationsDomain,
  useNotificationsDomainState,
} from './domains/NotificationsDomainContext';
import {
  useAppointmentsValue,
  useClientsValue,
  useFinanceValue,
  useMarketplaceValue,
  useNotificationsValue,
} from './domains/valueComposers';
import type { SalonApiClient } from './domains/shared';
import type { AppContextType, AppContextValue } from './appContextValue';
import {
  INITIAL_APPOINTMENTS,
  INITIAL_CLIENTS,
  INITIAL_EXPENSES,
  INITIAL_LOYALTY_REWARDS,
  INITIAL_LOYALTY_TRANSACTIONS,
  INITIAL_REVIEWS,
  INITIAL_SALONS,
  INITIAL_SERVICES,
  INITIAL_STAFF,
  INITIAL_TRANSACTIONS,
  INITIAL_STOCKS,
} from './appContextValue';
import { loadSalonApi, useWorkspaceSync } from './useWorkspaceSync';

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export type { AppMode, AppContextType, AppContextValue, DashboardMetricsParams, SalonApiClient, Toast };
export {
  INITIAL_APPOINTMENTS,
  INITIAL_CLIENTS,
  INITIAL_EXPENSES,
  INITIAL_LOYALTY_REWARDS,
  INITIAL_LOYALTY_TRANSACTIONS,
  INITIAL_REVIEWS,
  INITIAL_SALONS,
  INITIAL_SERVICES,
  INITIAL_STAFF,
  INITIAL_STOCKS,
  INITIAL_TRANSACTIONS,
};
export {
  useAppointmentsDomain,
  useClientsDomain,
  useFinanceDomain,
  useMarketplaceDomain,
  useNotificationsDomain,
  useOptionalUI,
  useUI,
  useUiFeedback,
};

export const AppProvider: React.FC<{
  children: React.ReactNode;
  realtimeClient?: RealtimeClientLike;
  apiClientFactory?: (salonId: string) => SalonApiClient;
}> = ({ children, realtimeClient, apiClientFactory }) => {
  const { memberships, activeMembership, selectSalon, isAuthenticated, hasPermission } = useOptionalAuth();
  const ui = useUiFeedbackState();
  const { mode, setMode, addToast, formatPrice } = ui;

  const domainCache = useMemo(() => createDomainCache(), []);

  const resolveApi = useCallback(
    async (salonId: string): Promise<SalonApiClient> => {
      if (apiClientFactory) return apiClientFactory(salonId);
      const factory = await loadSalonApi();
      return factory(salonId);
    },
    [apiClientFactory],
  );

  const remote = useCallback(
    async (action: () => Promise<void>, fallbackMessage: string) => {
      try {
        await action();
      } catch (error) {
        addToast(getApiErrorMessage(error, fallbackMessage), 'error');
      }
    },
    [addToast],
  );

  const [activeSalonId, setActiveSalonIdState] = useState<string>('');
  const [workspaceLoadedSalonId, setWorkspaceLoadedSalonId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeSyncStatus>('disconnected');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const activeSalonIdRef = useRef(activeSalonId);
  activeSalonIdRef.current = activeSalonId;
  const membershipsRef = useRef(memberships);
  membershipsRef.current = memberships;
  const loadedTargetSalonRef = useRef<string | null>(null);
  const syncEpochRef = useRef(0);
  const hasPermissionRef = useRef(hasPermission);
  hasPermissionRef.current = hasPermission;
  const realtimeControllerRef = useRef<SalonRealtimeController | null>(null);

  const activeMemberships = useMemo(() => getActiveMemberships(memberships), [memberships]);
  const resolvedMembership = useMemo(() => {
    if (activeMembership && activeMembership.status === 'active') return activeMembership;
    return activeMemberships[0] ?? null;
  }, [activeMembership, activeMemberships]);

  const hasActiveMembership = memberships.some(
    (membership) => membership.status === 'active' && membership.salonId === activeSalonId,
  );

  // Refs pont pour coordonner les mutations entre domaines sans couplage circulaire.
  const reloadWorkspaceRef = useRef<(salonId: string) => Promise<void>>(async () => {});
  const loadLoyaltyRef = useRef<
    (salonId: string, isGuardActive?: () => boolean, options?: { force?: boolean }) => Promise<void>
  >(async () => {});
  const loadNotificationsRef = useRef<
    (salonId: string, isGuardActive?: () => boolean, options?: { force?: boolean }) => Promise<void>
  >(async () => {});
  const setAppointmentsRef = useRef<React.Dispatch<React.SetStateAction<Appointment[]>>>(() => {});
  const activeSalonRef = useRef<Salon | null>(null);

  const requireActiveSalon = useCallback((): Salon => {
    if (!activeSalonRef.current) {
      throw new Error('Aucun salon réel n’est chargé pour cette session.');
    }
    return activeSalonRef.current;
  }, []);

  const marketplaceDomain = useMarketplaceDomainState({
    resolveApi,
    domainCache,
    addToast,
    remote,
    newIdempotencyKey,
    mode,
  });

  const activeSalon = useMemo(
    () => marketplaceDomain.salons.find((s) => s.id === activeSalonId) ?? null,
    [marketplaceDomain.salons, activeSalonId],
  );
  activeSalonRef.current = activeSalon;

  const salonTimezone = useMemo(
    () => resolveSalonTimezone(activeSalon, marketplaceDomain.branches),
    [activeSalon, marketplaceDomain.branches],
  );
  const salonTimezoneRef = useRef(salonTimezone);
  salonTimezoneRef.current = salonTimezone;

  const notificationsDomain = useNotificationsDomainState({
    resolveApi,
    domainCache,
    activeSalonId,
    requireActiveSalon,
    hasPermissionRef,
    addToast,
  });
  loadNotificationsRef.current = notificationsDomain.loadNotifications;

  const clientsDomain = useClientsDomainState({
    resolveApi,
    domainCache,
    activeSalonId,
    requireActiveSalon,
    hasPermissionRef,
    addToast,
    remote,
    reloadWorkspace: (salonId) => reloadWorkspaceRef.current(salonId),
  });
  loadLoyaltyRef.current = clientsDomain.loadLoyalty;

  const appointmentsDomain = useAppointmentsDomainState({
    resolveApi,
    domainCache,
    requireActiveSalon,
    memberships,
    hasActiveMembership,
    addToast,
    remote,
    newIdempotencyKey,
    salonTimezone,
    loadNotifications: (salonId, guard, opts) => loadNotificationsRef.current(salonId, guard, opts),
    loadLoyalty: (salonId, guard, opts) => loadLoyaltyRef.current(salonId, guard, opts),
  });
  setAppointmentsRef.current = appointmentsDomain.setAppointments;

  const financeDomain = useFinanceDomainState({
    resolveApi,
    domainCache,
    activeSalonId,
    requireActiveSalon,
    memberships,
    hasPermissionRef,
    addToast,
    remote,
    formatPrice,
    newIdempotencyKey,
    branches: marketplaceDomain.branches,
    salonTimezone,
    loadLoyalty: (salonId, guard, opts) => loadLoyaltyRef.current(salonId, guard, opts),
    setAppointments: (updater) => setAppointmentsRef.current(updater),
  });

  const {
    resetMarketplaceDomain,
    setSalons: setDomainSalons,
    setBranches: setDomainBranches,
    setReviews: setDomainReviews,
  } = marketplaceDomain;
  const {
    resetAppointmentsDomain,
    setServices: setDomainServices,
    setStaff: setDomainStaff,
    setAppointments: setDomainAppointments,
  } = appointmentsDomain;
  const {
    resetClientsDomain,
    setClients: setDomainClients,
    setLoyaltyRewards: setDomainLoyaltyRewards,
    loadLoyalty: loadDomainLoyalty,
  } = clientsDomain;
  const {
    resetFinanceDomain,
    setExpenses: setDomainExpenses,
    setStocks: setDomainStocks,
    setSuppliers: setDomainSuppliers,
    setTransactions: setDomainTransactions,
    setCashSessions: setDomainCashSessions,
    setCashSession: setDomainCashSession,
    setFinancialSummary: setDomainFinancialSummary,
    loadFinance: loadDomainFinance,
  } = financeDomain;
  const {
    resetNotificationsDomain,
    loadNotifications: loadDomainNotifications,
    setNotifications: setDomainNotifications,
  } = notificationsDomain;

  const resetSalonDomainState = useCallback(() => {
    setWorkspaceLoadedSalonId(null);
    resetMarketplaceDomain();
    resetAppointmentsDomain();
    resetClientsDomain();
    resetFinanceDomain();
    resetNotificationsDomain();
    setLastSyncedAt(null);
    setSyncError(null);
  }, [
    resetMarketplaceDomain,
    resetAppointmentsDomain,
    resetClientsDomain,
    resetFinanceDomain,
    resetNotificationsDomain,
  ]);

  const setActiveSalonId = useCallback(
    (nextSalonId: string) => {
      if (membershipsRef.current.length > 0) {
        const accepted = selectSalon(nextSalonId);
        if (!accepted) return;
      }
      setActiveSalonIdState((prev) => {
        if (prev === nextSalonId) return prev;
        activeSalonIdRef.current = nextSalonId;
        syncEpochRef.current += 1;
        return nextSalonId;
      });
    },
    [selectSalon],
  );

  const { reloadWorkspace, syncNow } = useWorkspaceSync({
    mode,
    isAuthenticated,
    hasActiveMembership,
    activeSalonId,
    resolvedMembership,
    apiClientFactory,
    realtimeClient,
    hasPermission,
    resolveApi,
    domainCache,
    membershipsRef,
    activeSalonIdRef,
    syncEpochRef,
    loadedTargetSalonRef,
    salonTimezoneRef,
    realtimeControllerRef,
    hasPermissionRef,
    resetSalonDomainState,
    setActiveSalonIdState,
    setIsSyncing,
    setSyncError,
    setLastSyncedAt,
    setRealtimeStatus,
    setWorkspaceLoadedSalonId,
    setSalons: setDomainSalons,
    setBranches: setDomainBranches,
    setReviews: setDomainReviews,
    setClients: setDomainClients,
    setLoyaltyRewards: setDomainLoyaltyRewards,
    setServices: setDomainServices,
    setStaff: setDomainStaff,
    setAppointments: setDomainAppointments,
    setExpenses: setDomainExpenses,
    setStocks: setDomainStocks,
    setSuppliers: setDomainSuppliers,
    setTransactions: setDomainTransactions,
    setCashSessions: setDomainCashSessions,
    setCashSession: setDomainCashSession,
    setFinancialSummary: setDomainFinancialSummary,
    setNotifications: setDomainNotifications,
    loadFinance: loadDomainFinance,
    loadLoyalty: loadDomainLoyalty,
    loadNotifications: loadDomainNotifications,
  });
  reloadWorkspaceRef.current = reloadWorkspace;

  const marketplaceValue = useMarketplaceValue(marketplaceDomain);

  const appointmentsValue = useAppointmentsValue(appointmentsDomain);

  const clientsValue = useClientsValue(clientsDomain);

  const financeValue = useFinanceValue(financeDomain);

  const notificationsValue = useNotificationsValue(notificationsDomain);

  const appValue = useMemo<AppContextValue>(
    () => ({
      mode,
      setMode,
      activeSalonId,
      setActiveSalonId,
      activeSalon,
      salonTimezone,
      ...marketplaceValue,
      ...appointmentsValue,
      ...clientsValue,
      ...financeValue,
      ...notificationsValue,
      toasts: ui.toasts,
      addToast: ui.addToast,
      removeToast: ui.removeToast,
      selectedSalonForModal: ui.selectedSalonForModal,
      setSelectedSalonForModal: ui.setSelectedSalonForModal,
      formatPrice: ui.formatPrice,
      isSyncing,
      syncError,
      realtimeStatus,
      lastSyncedAt,
      workspaceLoadedSalonId,
      reloadWorkspace,
      syncNow,
    }),
    [
      mode,
      setMode,
      activeSalonId,
      setActiveSalonId,
      activeSalon,
      salonTimezone,
      marketplaceValue,
      appointmentsValue,
      clientsValue,
      financeValue,
      notificationsValue,
      ui.toasts,
      ui.addToast,
      ui.removeToast,
      ui.selectedSalonForModal,
      ui.setSelectedSalonForModal,
      ui.formatPrice,
      isSyncing,
      syncError,
      realtimeStatus,
      lastSyncedAt,
      workspaceLoadedSalonId,
      reloadWorkspace,
      syncNow,
    ],
  );

  return (
    <UIContext.Provider value={ui}>
      <MarketplaceDomainContext.Provider value={marketplaceValue}>
        <AppointmentsDomainContext.Provider value={appointmentsValue}>
          <ClientsDomainContext.Provider value={clientsValue}>
            <FinanceDomainContext.Provider value={financeValue}>
              <NotificationsDomainContext.Provider value={notificationsValue}>
                <AppContext.Provider value={appValue}>{children}</AppContext.Provider>
              </NotificationsDomainContext.Provider>
            </FinanceDomainContext.Provider>
          </ClientsDomainContext.Provider>
        </AppointmentsDomainContext.Provider>
      </MarketplaceDomainContext.Provider>
    </UIContext.Provider>
  );
};

export const useAppContextOrNull = () => useContext(AppContext) ?? null;

export const useOptionalApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const useApp = (): AppContextType => {
  const context = useOptionalApp();
  if (!context.activeSalon) {
    throw new Error('useApp requires an active salon');
  }
  return { ...context, activeSalon: context.activeSalon };
};
