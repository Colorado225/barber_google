// Moteur de synchronisation de l'espace salon (extrait de l'ancien
// AppContext.tsx monolithique) : chargement initial du workspace, resynchronisation
// ciblée des domaines après événement temps réel et abonnements Supabase Realtime.
import React, { useCallback, useEffect, useRef } from 'react';
import type {
  Appointment,
  CashSession,
  FinancialSummary,
  PaymentTransaction,
  RealtimeSyncStatus,
  Salon,
  StockItem,
  Supplier,
  LoyaltyReward,
  Review,
  ErpBranch,
  Client,
  Service,
  StaffMember,
  Expense,
  AppointmentNotification,
} from '../types';
import type { salonApi as salonApiFn } from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { resolveSalonTimezone, shiftCalendarDays, zonedToday } from '../lib/businessTime';
import type { createDomainCache } from '../lib/domainCache';
import { upsertWorkspaceSalon } from '../lib/erpSalonSelection';
import { mapPublicSalon } from '../lib/marketplace';
import type { RealtimeClientLike, RealtimeDomain, SalonRealtimeController } from '../lib/realtimeSync';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { financeRange } from './domains/FinanceDomainContext';
import type { AppMode } from './UIContext';
import type { SalonApiClient } from './domains/shared';
import type { SalonMembership } from './AuthContext';

// Chargement paresseux du client API ERP et de Realtime :
// le bundle public marketplace ne télécharge jamais le module api ni realtimeSync.
let salonApiLoader: Promise<typeof salonApiFn> | null = null;
export function loadSalonApi(): Promise<typeof salonApiFn> {
  if (!salonApiLoader) {
    salonApiLoader = import('../lib/api').then((m) => m.salonApi);
  }
  return salonApiLoader;
}

let realtimeModuleLoader: Promise<typeof import('../lib/realtimeSync')> | null = null;
function loadRealtimeSyncModule(): Promise<typeof import('../lib/realtimeSync')> {
  if (!realtimeModuleLoader) {
    realtimeModuleLoader = import('../lib/realtimeSync');
  }
  return realtimeModuleLoader;
}

function appointmentWindowStart(timeZone: string): string {
  const today = zonedToday(timeZone);
  const weekAgo = shiftCalendarDays(today, -7);
  const monthStart = `${today.slice(0, 7)}-01`;
  return monthStart < weekAgo ? monthStart : weekAgo;
}

/** Dépendances du moteur de synchronisation, fournies par AppProvider. */
export interface WorkspaceSyncDeps {
  mode: AppMode;
  isAuthenticated: boolean;
  hasActiveMembership: boolean;
  activeSalonId: string;
  resolvedMembership: SalonMembership | null;
  apiClientFactory?: (salonId: string) => SalonApiClient;
  realtimeClient?: RealtimeClientLike;
  hasPermission: (permission: string, salonId?: string) => boolean;
  resolveApi: (salonId: string) => Promise<SalonApiClient>;
  domainCache: ReturnType<typeof createDomainCache>;
  membershipsRef: React.MutableRefObject<SalonMembership[]>;
  activeSalonIdRef: React.MutableRefObject<string>;
  syncEpochRef: React.MutableRefObject<number>;
  loadedTargetSalonRef: React.MutableRefObject<string | null>;
  salonTimezoneRef: React.MutableRefObject<string>;
  realtimeControllerRef: React.MutableRefObject<SalonRealtimeController | null>;
  hasPermissionRef: React.MutableRefObject<(permission: string, salonId?: string) => boolean>;
  resetSalonDomainState: () => void;
  setActiveSalonIdState: React.Dispatch<React.SetStateAction<string>>;
  setIsSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncError: React.Dispatch<React.SetStateAction<string | null>>;
  setLastSyncedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setRealtimeStatus: React.Dispatch<React.SetStateAction<RealtimeSyncStatus>>;
  setWorkspaceLoadedSalonId: React.Dispatch<React.SetStateAction<string | null>>;
  setSalons: React.Dispatch<React.SetStateAction<Salon[]>>;
  setBranches: React.Dispatch<React.SetStateAction<ErpBranch[]>>;
  setReviews: React.Dispatch<React.SetStateAction<Review[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setLoyaltyRewards: React.Dispatch<React.SetStateAction<LoyaltyReward[]>>;
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  setStaff: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  setStocks: React.Dispatch<React.SetStateAction<StockItem[]>>;
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<PaymentTransaction[]>>;
  setCashSessions: React.Dispatch<React.SetStateAction<CashSession[]>>;
  setCashSession: React.Dispatch<React.SetStateAction<CashSession | null>>;
  setFinancialSummary: React.Dispatch<React.SetStateAction<FinancialSummary | null>>;
  setNotifications: React.Dispatch<React.SetStateAction<AppointmentNotification[]>>;
  loadFinance: (
    salonId: string,
    isGuardActive?: () => boolean,
    options?: { force?: boolean; timeZone?: string },
  ) => Promise<void>;
  loadLoyalty: (
    salonId: string,
    isGuardActive?: () => boolean,
    options?: { force?: boolean },
  ) => Promise<void>;
  loadNotifications: (
    salonId: string,
    isGuardActive?: () => boolean,
    options?: { force?: boolean },
  ) => Promise<void>;
}

export function useWorkspaceSync(deps: WorkspaceSyncDeps) {
  const {
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
  } = deps;

  const reloadWorkspace = useCallback(
    async (salonId: string) => {
      const epoch = ++syncEpochRef.current;
      const isCurrent = () => syncEpochRef.current === epoch && activeSalonIdRef.current === salonId;
      setIsSyncing(true);
      setSyncError(null);
      try {
        domainCache.invalidateSalon(salonId);
        const api = await resolveApi(salonId);
        const data = await domainCache.getOrLoad(salonId, 'workspace', () => api.workspace(), {
          force: true,
        });
        if (!isCurrent()) return;
        const mappedSalon = mapPublicSalon(data.salon as Record<string, unknown>);
        const resolvedTz = resolveSalonTimezone(mappedSalon, data.branches);
        if (typeof (api as { setTimeZone?: (tz?: string | null) => void }).setTimeZone === 'function') {
          (api as { setTimeZone: (tz?: string | null) => void }).setTimeZone(resolvedTz);
        }
        setDomainSalons((prev) => upsertWorkspaceSalon(prev, mappedSalon, membershipsRef.current));
        setDomainBranches(data.branches);
        setDomainClients(data.clients);
        setDomainServices(data.services);
        setDomainStaff(data.staff);
        setDomainExpenses(data.expenses);
        setDomainStocks(data.stock);
        setDomainSuppliers(data.suppliers ?? []);
        setDomainLoyaltyRewards(data.rewards);
        setDomainReviews(data.reviews);
        const from = appointmentWindowStart(resolvedTz);
        const [appointmentsList] = await Promise.all([
          domainCache.getOrLoad(
            salonId,
            'appointments',
            () => api.appointments.list({ from, timeZone: resolvedTz }),
            { force: true },
          ),
          loadDomainFinance(salonId, isCurrent, { force: true, timeZone: resolvedTz }),
          loadDomainLoyalty(salonId, isCurrent, { force: true }),
          loadDomainNotifications(salonId, isCurrent, { force: true }),
        ]);
        if (!isCurrent()) return;
        setDomainAppointments(appointmentsList);
        setWorkspaceLoadedSalonId(salonId);
        setLastSyncedAt(new Date().toISOString());
      } catch (error) {
        if (isCurrent()) {
          setSyncError(getApiErrorMessage(error, 'Le chargement de cet espace a échoué.'));
        }
      } finally {
        if (isCurrent()) {
          setIsSyncing(false);
        }
      }
    },
    [
      domainCache,
      resolveApi,
      setDomainSalons,
      setDomainBranches,
      setDomainReviews,
      setDomainClients,
      setDomainLoyaltyRewards,
      loadDomainLoyalty,
      setDomainServices,
      setDomainStaff,
      setDomainAppointments,
      setDomainExpenses,
      setDomainStocks,
      setDomainSuppliers,
      loadDomainFinance,
      loadDomainNotifications,
      activeSalonIdRef,
      membershipsRef,
      syncEpochRef,
      setIsSyncing,
      setSyncError,
      setLastSyncedAt,
      setWorkspaceLoadedSalonId,
    ],
  );

  const syncWorkspaceDomains = useCallback(
    async (salonId: string, domains: Set<RealtimeDomain>) => {
      const epoch = syncEpochRef.current;
      const guardActive = () => syncEpochRef.current === epoch && activeSalonIdRef.current === salonId;
      const api = await resolveApi(salonId);
      const tz = salonTimezoneRef.current;
      if (typeof (api as { setTimeZone?: (tz?: string | null) => void }).setTimeZone === 'function') {
        (api as { setTimeZone: (tz?: string | null) => void }).setTimeZone(tz);
      }
      const perm = hasPermissionRef.current;
      const tasks: Promise<void>[] = [];

      if (domains.has('appointments') && perm('appointments.read', salonId)) {
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        const from = appointmentWindowStart(tz);
        tasks.push(
          api.appointments.list({ from, timeZone: tz }).then((list) => {
            if (!guardActive()) return;
            setDomainAppointments(list);
          }),
        );
      }

      if (domains.has('notifications') && perm('appointments.read', salonId)) {
        domainCache.invalidate(salonId, 'notifications');
        tasks.push(loadDomainNotifications(salonId, guardActive, { force: true }));
      }

      if (domains.has('finance')) {
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'dashboard');
        const { from, to, monthStart } = financeRange(tz);
        tasks.push(
          Promise.all([
            perm('payments.read', salonId)
              ? api.payments.list({ from, to, limit: 500 })
              : Promise.resolve([] as PaymentTransaction[]),
            perm('cash.read', salonId) ? api.cash.sessions(50) : Promise.resolve([] as CashSession[]),
            perm('reports.read', salonId)
              ? api.reports.summary(monthStart, to)
              : Promise.resolve(null as FinancialSummary | null),
          ]).then(([payments, sessions, summary]) => {
            if (!guardActive()) return;
            setDomainTransactions(payments);
            setDomainCashSessions(sessions);
            setDomainCashSession(sessions.find((s) => s.status === 'open') ?? null);
            setDomainFinancialSummary(summary);
          }),
        );
        if (perm('loyalty.read', salonId)) {
          domainCache.invalidate(salonId, 'loyalty');
          tasks.push(loadDomainLoyalty(salonId, guardActive, { force: true }));
        }
      }

      await Promise.all(tasks);
      if (guardActive()) {
        setSyncError(null);
        setLastSyncedAt(new Date().toISOString());
      }
    },
    [
      resolveApi,
      domainCache,
      setDomainAppointments,
      loadDomainNotifications,
      setDomainTransactions,
      setDomainCashSessions,
      setDomainCashSession,
      setDomainFinancialSummary,
      loadDomainLoyalty,
      activeSalonIdRef,
      hasPermissionRef,
      salonTimezoneRef,
      syncEpochRef,
      setSyncError,
      setLastSyncedAt,
    ],
  );

  const syncWorkspaceDomainsRef = useRef(syncWorkspaceDomains);
  syncWorkspaceDomainsRef.current = syncWorkspaceDomains;

  const syncNow = useCallback(async () => {
    const salonId = activeSalonIdRef.current;
    if (!salonId) return;
    if (realtimeControllerRef.current) {
      await realtimeControllerRef.current.triggerSyncNow('fallback');
      return;
    }
    await reloadWorkspace(salonId);
  }, [reloadWorkspace, activeSalonIdRef, realtimeControllerRef]);

  // Précharge en parallèle l'API et Realtime dès qu'on entre en mode ERP.
  useEffect(() => {
    if (mode !== 'erp') return;
    if (!apiClientFactory) void loadSalonApi();
    if (realtimeClient || isSupabaseConfigured()) void loadRealtimeSyncModule();
  }, [mode, apiClientFactory, realtimeClient]);

  // Charge l'espace du salon actif dans l'ERP.
  useEffect(() => {
    if (mode !== 'erp') {
      loadedTargetSalonRef.current = null;
      return;
    }
    if (process.env.NODE_ENV === 'test' && !apiClientFactory) return;

    if (resolvedMembership) {
      const targetSalonId = resolvedMembership.salonId;
      if (activeSalonIdRef.current !== targetSalonId) {
        activeSalonIdRef.current = targetSalonId;
        setActiveSalonIdState(targetSalonId);
      }
      if (loadedTargetSalonRef.current !== targetSalonId) {
        loadedTargetSalonRef.current = targetSalonId;
        resetSalonDomainState();
        void reloadWorkspace(targetSalonId);
      }
      return;
    }

    loadedTargetSalonRef.current = null;
    resetSalonDomainState();
    if (activeSalonIdRef.current !== '') {
      activeSalonIdRef.current = '';
      setActiveSalonIdState('');
    }
    setIsSyncing(false);
    setSyncError(isAuthenticated ? 'Aucun espace actif n’est associé à ce compte.' : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resolvedMembership?.salonId, isAuthenticated, apiClientFactory]);

  const canReadAppointments = Boolean(activeSalonId && hasPermission('appointments.read', activeSalonId));
  const canReadPayments = Boolean(activeSalonId && hasPermission('payments.read', activeSalonId));
  const canReadCash = Boolean(activeSalonId && hasPermission('cash.read', activeSalonId));

  // Abonnements Supabase Realtime chargés uniquement en session ERP active.
  useEffect(() => {
    if (mode !== 'erp' || !activeSalonId || !hasActiveMembership) {
      setRealtimeStatus('disconnected');
      return;
    }
    if (process.env.NODE_ENV === 'test' && !realtimeClient) {
      return;
    }
    if (!realtimeClient && !isSupabaseConfigured()) {
      setRealtimeStatus('disconnected');
      return;
    }

    let cancelled = false;
    let activeController: SalonRealtimeController | null = null;

    void loadRealtimeSyncModule().then((rt) => {
      if (cancelled) return;
      const client = realtimeClient ?? (getSupabaseClient() as unknown as RealtimeClientLike);
      const controller = rt.createSalonRealtimeSync({
        salonId: activeSalonId,
        client,
        permissions: {
          appointments: canReadAppointments,
          payments: canReadPayments,
          cash: canReadCash,
        },
        onStatusChange: (nextStatus) => {
          setRealtimeStatus(nextStatus);
        },
        onAppointmentEvent: (eventType, row) => {
          domainCache.invalidate(activeSalonId, 'appointments');
          domainCache.invalidate(activeSalonId, 'dashboard');
          setDomainAppointments((prev) =>
            rt.applyAppointmentRealtimeChange(prev, eventType, row, activeSalonId, salonTimezoneRef.current),
          );
        },
        onNotificationEvent: (eventType, row) => {
          domainCache.invalidate(activeSalonId, 'notifications');
          setDomainNotifications((prev) =>
            rt.applyNotificationRealtimeChange(prev, eventType, row, activeSalonId),
          );
        },
        onRefreshDomains: async (domains) => {
          await syncWorkspaceDomainsRef.current(activeSalonId, domains);
        },
        onSyncSuccess: (syncedAt) => {
          setLastSyncedAt(syncedAt);
        },
        onSyncError: (err) => {
          setSyncError(getApiErrorMessage(err, 'Synchronisation temps réel perturbée.'));
        },
      });
      activeController = controller;
      realtimeControllerRef.current = controller;
    });

    return () => {
      cancelled = true;
      if (activeController) {
        activeController.stop();
        if (realtimeControllerRef.current === activeController) {
          realtimeControllerRef.current = null;
        }
      }
    };
  }, [
    mode,
    activeSalonId,
    hasActiveMembership,
    canReadAppointments,
    canReadPayments,
    canReadCash,
    realtimeClient,
    domainCache,
    setDomainAppointments,
    setDomainNotifications,
    realtimeControllerRef,
    salonTimezoneRef,
    setLastSyncedAt,
    setRealtimeStatus,
    setSyncError,
  ]);
  return { reloadWorkspace, syncNow };
}
