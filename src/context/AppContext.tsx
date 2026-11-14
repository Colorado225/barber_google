import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Appointment,
  AppointmentBalance,
  AppointmentNotification,
  AppointmentStatus,
  CashSession,
  Client,
  ErpBranch,
  ErpDashboardMetrics,
  Expense,
  ExpenseEvent,
  FinancialSummary,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltyReward,
  LoyaltySettings,
  LoyaltyTransaction,
  NotificationDispatchResult,
  NotificationHealthSummary,
  NotificationProbeResult,
  PaymentEntryKind,
  PaymentMethod,
  PaymentTransaction,
  RealtimeSyncStatus,
  Review,
  Salon,
  Service,
  StaffMember,
  StockItem,
  StockMovement,
  StockMovementType,
  Supplier,
} from '../types';
import type { salonApi as salonApiFn } from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { resolveSalonTimezone, shiftCalendarDays, zonedToday } from '../lib/businessTime';
import { createDomainCache } from '../lib/domainCache';
import { getActiveMemberships, upsertWorkspaceSalon } from '../lib/erpSalonSelection';
import { mapPublicSalon, type PublicBooking, type PublicBookingInput } from '../lib/marketplace';
import type { RealtimeClientLike, RealtimeDomain, SalonRealtimeController } from '../lib/realtimeSync';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
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
  financeRange,
  useFinanceDomain,
  useFinanceDomainState,
  type DashboardMetricsParams,
} from './domains/FinanceDomainContext';
import {
  MarketplaceDomainContext,
  useMarketplaceDomain,
  useMarketplaceDomainState,
  type MarketplaceViewMode,
} from './domains/MarketplaceDomainContext';
import {
  NotificationsDomainContext,
  useNotificationsDomain,
  useNotificationsDomainState,
} from './domains/NotificationsDomainContext';
import type { SalonApiClient } from './domains/shared';

export type { AppMode, DashboardMetricsParams, SalonApiClient, Toast };
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

export const INITIAL_SALONS: Salon[] = [];
export const INITIAL_SERVICES: Service[] = [];
export const INITIAL_STAFF: StaffMember[] = [];
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_APPOINTMENTS: Appointment[] = [];
export const INITIAL_TRANSACTIONS: PaymentTransaction[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_STOCKS: StockItem[] = [];
export const INITIAL_REVIEWS: Review[] = [];
export const INITIAL_LOYALTY_REWARDS: LoyaltyReward[] = [];
export const INITIAL_LOYALTY_TRANSACTIONS: LoyaltyTransaction[] = [];

// Chargement paresseux du client API ERP et de Realtime :
// le bundle public marketplace ne télécharge jamais src/lib/api.ts ni src/lib/realtimeSync.ts.
let salonApiLoader: Promise<typeof salonApiFn> | null = null;
function loadSalonApi(): Promise<typeof salonApiFn> {
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

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function appointmentWindowStart(timeZone: string): string {
  const today = zonedToday(timeZone);
  const weekAgo = shiftCalendarDays(today, -7);
  const monthStart = `${today.slice(0, 7)}-01`;
  return monthStart < weekAgo ? monthStart : weekAgo;
}

export interface AppContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  activeSalonId: string;
  setActiveSalonId: (id: string) => void;
  activeSalon: Salon | null;
  salonTimezone: string;
  salons: Salon[];
  marketplaceLoading: boolean;
  marketplaceError: string | null;
  selectedCategory: string | null;
  setSelectedCategory: (slug: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  priceRange: [number, number] | null;
  setPriceRange: (range: [number, number] | null) => void;
  searchedCategories: string[];
  marketplaceViewMode: MarketplaceViewMode;
  setMarketplaceViewMode: (view: MarketplaceViewMode) => void;
  favoriteSalonIds: string[];
  isFavoriteSalon: (salonId: string) => boolean;
  toggleFavoriteSalon: (salonId: string) => Promise<void>;
  refreshMarketplace: () => Promise<void>;
  services: Service[];
  staff: StaffMember[];
  appointments: Appointment[];
  clients: Client[];
  transactions: PaymentTransaction[];
  cashSession: CashSession | null;
  cashSessions: CashSession[];
  branches: ErpBranch[];
  financialSummary: FinancialSummary | null;
  dashboardMetrics: ErpDashboardMetrics | null;
  dashboardMetricsLoading: boolean;
  loadDashboardMetrics: (params: DashboardMetricsParams) => Promise<ErpDashboardMetrics | null>;
  loadFinancialSummary: (from: string, to: string) => Promise<FinancialSummary | null>;
  expenses: Expense[];
  expenseEvents: ExpenseEvent[];
  stocks: StockItem[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'date' | 'verified'>) => Promise<Review>;
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  selectedSalonForModal: Salon | null;
  setSelectedSalonForModal: (salon: Salon | null) => void;
  bookAppointment: (data: {
    salonId: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    clientId?: string | null;
    serviceId: string;
    staffId: string;
    date: string;
    time: string;
    paymentMethod: PaymentMethod;
    source?: 'direct' | 'whatsapp' | 'phone';
    notes?: string;
  }) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus, reason?: string) => void;
  updateAppointmentDetails: (appointmentId: string, updates: Partial<Appointment>) => void;
  cancelAppointment: (appointmentId: string) => void;
  registerWalkIn: (data: {
    serviceId: string;
    clientName?: string;
    clientPhone?: string;
    clientId?: string | null;
    staffId?: string | null;
    branchId?: string | null;
    startImmediately?: boolean;
    notes?: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  startWalkIn: (
    appointmentId: string,
    staffId?: string | null,
  ) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  completeWalkIn: (
    appointmentId: string,
  ) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  loyaltyRewards: LoyaltyReward[];
  loyaltyTransactions: LoyaltyTransaction[];
  loyaltyAccounts: LoyaltyAccount[];
  loyaltyLedger: LoyaltyLedgerEntry[];
  loyaltySettings: LoyaltySettings | null;
  notifications: AppointmentNotification[];
  notificationHealth: NotificationHealthSummary | null;
  notificationProbe: NotificationProbeResult | null;
  refreshNotifications: () => Promise<void>;
  probeNotifications: (checkWhatsappApi?: boolean) => Promise<NotificationProbeResult | null>;
  dispatchNotifications: () => Promise<NotificationDispatchResult | null>;
  retryNotification: (id: string) => Promise<void>;
  refreshLoyalty: () => Promise<void>;
  addLoyaltyReward: (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => void;
  updateLoyaltyReward: (id: string, updates: Partial<LoyaltyReward>) => void;
  deleteLoyaltyReward: (id: string) => void;
  updateLoyaltySettings: (updates: Partial<LoyaltySettings>) => Promise<void>;
  redeemRewardForClient: (
    clientId: string,
    rewardId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  creditPointsToClient: (clientId: string, points: number, reason: string) => Promise<void>;
  recordPayment: (payment: {
    appointmentId: string;
    amount: number;
    method: PaymentMethod;
    providerReference?: string;
    reason?: string;
    idempotencyKey?: string;
  }) => Promise<PaymentTransaction>;
  confirmPendingPayment: (
    paymentId: string,
    providerReference: string,
    settlementNote: string,
  ) => Promise<PaymentTransaction>;
  rejectPendingPayment: (paymentId: string, reason: string) => Promise<PaymentTransaction>;
  recordPaymentCorrection: (correction: {
    originalEntryId: string;
    kind: Exclude<PaymentEntryKind, 'payment'>;
    amount: number;
    reason: string;
    providerReference?: string;
    settlementNote?: string;
    idempotencyKey?: string;
  }) => Promise<PaymentTransaction>;
  getAppointmentBalance: (appointmentId: string) => Promise<AppointmentBalance>;
  closeCurrentCashSession: (
    actualCashAmount: number,
    notes?: string,
    sessionId?: string,
  ) => Promise<CashSession>;
  openNewCashSession: (openingBalance: number, branchId?: string, note?: string) => Promise<CashSession>;
  reconcileCashSession: (sessionId: string, note: string) => Promise<CashSession>;
  refreshFinance: () => Promise<void>;
  addService: (service: Omit<Service, 'id'>) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  deleteService: (id: string) => void;
  setServiceActive: (id: string, isActive: boolean) => void;
  addStaff: (member: Omit<StaffMember, 'id'>) => void;
  updateStaff: (id: string, updates: Partial<StaffMember>) => void;
  deleteStaff: (id: string) => void;
  addClient: (client: Omit<Client, 'id' | 'totalSpent' | 'visitsCount' | 'lastVisit'>) => void;
  updateClientNotes: (clientId: string, notes: string) => void;
  updateClient: (clientId: string, updates: Partial<Client>) => void;
  deleteClient: (clientId: string) => void;
  updateAppointment: (appointmentId: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (appointmentId: string) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<Expense | void>;
  attachExpenseReceipt: (
    expenseId: string,
    attachment: { path: string; name: string; mime: string; size: number },
  ) => Promise<Expense>;
  reverseExpense: (expenseId: string, reason: string) => Promise<Expense>;
  correctExpense: (input: {
    originalExpenseId: string;
    title: string;
    category: Expense['category'];
    amount: number;
    date: string;
    reason: string;
    branchId?: string | null;
    notes?: string;
    receiptRef?: string | null;
    supplierId?: string | null;
  }) => Promise<Expense>;
  deleteExpense: (id: string, reason?: string) => void;
  upsertSupplier: (input: {
    id?: string | null;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string | null;
    address?: string;
    notes?: string;
    isActive?: boolean;
  }) => Promise<Supplier>;
  addStockItem: (
    item: Omit<StockItem, 'id'> & { reason?: string; branchId?: string | null },
  ) => Promise<StockItem | void>;
  updateStockItemMetadata: (id: string, item: Omit<StockItem, 'id' | 'quantity'>) => Promise<StockItem>;
  recordStockMovement: (input: {
    stockItemId: string;
    movementType: Exclude<StockMovementType, 'initial'>;
    quantityDelta: number;
    reason: string;
    branchId?: string | null;
    supplierId?: string | null;
    unitCost?: number | null;
    reference?: string | null;
    appointmentId?: string | null;
  }) => Promise<StockMovement>;
  adjustStockQuantity: (
    id: string,
    delta: number,
    reason?: string,
    movementType?: Exclude<StockMovementType, 'initial'>,
  ) => void;
  bookPublicAppointment: (
    input: Omit<PublicBookingInput, 'idempotencyKey'> & { idempotencyKey?: string },
  ) => Promise<{ success: boolean; booking?: PublicBooking; error?: string }>;
  cancelPublicBooking: (
    salonId: string,
    appointmentId: string,
    cancelToken: string,
    reason: string,
  ) => Promise<{ success: boolean; booking?: PublicBooking; error?: string }>;
  setSalonPublished: (salonId: string, published: boolean) => Promise<void>;
  updateSalonDetails: (salonId: string, updates: Partial<Salon>) => void;
  formatPrice: (amount: number) => string;
  isSyncing: boolean;
  syncError: string | null;
  realtimeStatus: RealtimeSyncStatus;
  lastSyncedAt: string | null;
  workspaceLoadedSalonId: string | null;
  reloadWorkspace: (salonId: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

type AppContextType = Omit<AppContextValue, 'activeSalon'> & { activeSalon: Salon };

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{
  children: React.ReactNode;
  realtimeClient?: RealtimeClientLike;
  apiClientFactory?: (salonId: string) => SalonApiClient;
  initialSalons?: Salon[];
}> = ({ children, realtimeClient, apiClientFactory, initialSalons }) => {
  const { user, memberships, activeMembership, selectSalon, isAuthenticated, hasPermission } =
    useOptionalAuth();
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
    initialSalons,
    isAuthenticated,
    authUserId: user?.id ?? null,
    userFavoriteIds: user?.favoriteSalonIds ?? null,
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
    ],
  );
  reloadWorkspaceRef.current = reloadWorkspace;

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
  }, [reloadWorkspace]);

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
  ]);

  const marketplaceValue = useMemo(
    () => ({
      salons: marketplaceDomain.salons,
      branches: marketplaceDomain.branches,
      reviews: marketplaceDomain.reviews,
      marketplaceLoading: marketplaceDomain.marketplaceLoading,
      marketplaceError: marketplaceDomain.marketplaceError,
      selectedCategory: marketplaceDomain.selectedCategory,
      setSelectedCategory: marketplaceDomain.setSelectedCategory,
      searchQuery: marketplaceDomain.searchQuery,
      setSearchQuery: marketplaceDomain.setSearchQuery,
      priceRange: marketplaceDomain.priceRange,
      setPriceRange: marketplaceDomain.setPriceRange,
      searchedCategories: marketplaceDomain.searchedCategories,
      marketplaceViewMode: marketplaceDomain.marketplaceViewMode,
      setMarketplaceViewMode: marketplaceDomain.setMarketplaceViewMode,
      favoriteSalonIds: marketplaceDomain.favoriteSalonIds,
      isFavoriteSalon: marketplaceDomain.isFavoriteSalon,
      toggleFavoriteSalon: marketplaceDomain.toggleFavoriteSalon,
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
      marketplaceDomain.selectedCategory,
      marketplaceDomain.setSelectedCategory,
      marketplaceDomain.searchQuery,
      marketplaceDomain.setSearchQuery,
      marketplaceDomain.priceRange,
      marketplaceDomain.setPriceRange,
      marketplaceDomain.searchedCategories,
      marketplaceDomain.marketplaceViewMode,
      marketplaceDomain.setMarketplaceViewMode,
      marketplaceDomain.favoriteSalonIds,
      marketplaceDomain.isFavoriteSalon,
      marketplaceDomain.toggleFavoriteSalon,
      marketplaceDomain.refreshMarketplace,
      marketplaceDomain.addReview,
      marketplaceDomain.bookPublicAppointment,
      marketplaceDomain.cancelPublicBooking,
      marketplaceDomain.setSalonPublished,
      marketplaceDomain.updateSalonDetails,
    ],
  );

  const appointmentsValue = useMemo(
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

  const clientsValue = useMemo(
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

  const financeValue = useMemo(
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

  const notificationsValue = useMemo(
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
