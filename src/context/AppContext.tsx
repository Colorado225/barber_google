import React, { createContext, useContext, useState, useEffect } from 'react';
import { useServicesDomain } from '../features/services/useServicesDomain';
import { useStaffDomain } from '../features/staff/useStaffDomain';
import { useClientCommands } from '../features/clients/useClientCommands';
import { useLoyaltyRewardsDomain } from '../features/loyalty/useLoyaltyRewardsDomain';
import { useLoyaltyProgramDomain } from '../features/loyalty/useLoyaltyProgramDomain';
import { useNotificationsDomain } from '../features/notifications/useNotificationsDomain';
import { useAppointmentsDomain } from '../features/appointments/useAppointmentsDomain';
import { useFinanceDomain } from '../features/finance/useFinanceDomain';
import { newIdempotencyKey } from '../features/shared/idempotency';
import { useExpensesDomain } from '../features/expenses/useExpensesDomain';
import { useStockDomain } from '../features/stock/useStockDomain';
import {
  Salon,
  Service,
  StaffMember,
  Appointment,
  Client,
  PaymentTransaction,
  CashSession,
  Expense,
  StockItem,
  PaymentMethod,
  PaymentEntryKind,
  FinancialSummary,
  AppointmentBalance,
  AppointmentStatus,
  Review,
  LoyaltyReward,
  LoyaltyTransaction,
  LoyaltySettings,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  AppointmentNotification,
  NotificationDispatchResult,
} from '../types';
import { salonApi, ApiError } from '../lib/api';
import {
  listMarketplaceSalons,
  bookMarketplaceAppointment,
  cancelMarketplaceBooking,
  updateSalonProfile,
  setSalonPublication,
  mapPublicSalon,
  type PublicBooking,
  type PublicBookingInput,
} from '../lib/marketplace';
import { useOptionalAuth } from './AuthContext';
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

export type AppMode = 'marketplace' | 'erp';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  activeSalonId: string;
  setActiveSalonId: (id: string) => void;
  activeSalon: Salon | null;
  salons: Salon[];
  marketplaceLoading: boolean;
  marketplaceError: string | null;
  refreshMarketplace: () => Promise<void>;
  services: Service[];
  staff: StaffMember[];
  appointments: Appointment[];
  clients: Client[];
  transactions: PaymentTransaction[];
  cashSession: CashSession | null;
  cashSessions: CashSession[];
  branches: { id: string; name: string }[];
  financialSummary: FinancialSummary | null;
  expenses: Expense[];
  stocks: StockItem[];
  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'date' | 'verified'>) => Promise<Review>;
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Marketplace selection
  selectedSalonForModal: Salon | null;
  setSelectedSalonForModal: (salon: Salon | null) => void;
  // Appointment operations
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

  // Clients de passage / sans rendez-vous
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

  // POS / Cash operations (Lot 6 — journal Supabase immuable)
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

  // Services CRUD
  addService: (service: Omit<Service, 'id'>) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  deleteService: (id: string) => void;
  setServiceActive: (id: string, isActive: boolean) => void;

  // Staff CRUD
  addStaff: (member: Omit<StaffMember, 'id'>) => void;
  updateStaff: (id: string, updates: Partial<StaffMember>) => void;
  deleteStaff: (id: string) => void;

  // CRM CRUD
  addClient: (client: Omit<Client, 'id' | 'totalSpent' | 'visitsCount' | 'lastVisit'>) => void;
  updateClientNotes: (clientId: string, notes: string) => void;
  updateClient: (clientId: string, updates: Partial<Client>) => void;
  deleteClient: (clientId: string) => void;
  updateAppointment: (appointmentId: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (appointmentId: string) => void;

  // Finance CRUD
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;

  // Inventory CRUD
  addStockItem: (item: Omit<StockItem, 'id'>) => void;
  adjustStockQuantity: (id: string, delta: number) => void;

  // Marketplace / réservation publique (Lot 7)
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

  // Salon Onboarding / Settings
  updateSalonDetails: (salonId: string, updates: Partial<Salon>) => void;

  // User registration in ERP status (Admin Total visibility)
  // Loyalty Program CRUD & Redemption
  loyaltyRewards: LoyaltyReward[];
  loyaltyTransactions: LoyaltyTransaction[];
  loyaltyAccounts: LoyaltyAccount[];
  loyaltyLedger: LoyaltyLedgerEntry[];
  loyaltySettings: LoyaltySettings | null;
  notifications: AppointmentNotification[];
  refreshNotifications: () => Promise<void>;
  dispatchNotifications: () => Promise<NotificationDispatchResult | null>;
  retryNotification: (id: string) => Promise<void>;
  refreshLoyalty: () => Promise<void>;
  addLoyaltyReward: (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => void;
  updateLoyaltyReward: (id: string, updates: Partial<LoyaltyReward>) => void;
  deleteLoyaltyReward: (id: string) => void;
  updateLoyaltySettings: (settings: Partial<LoyaltySettings>) => Promise<void>;
  redeemRewardForClient: (
    clientId: string,
    rewardId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  creditPointsToClient: (clientId: string, points: number, reason: string) => Promise<void>;

  // Helpers
  formatPrice: (amount: number) => string;
  // Synchronisation Supabase
  isSyncing: boolean;
  syncError: string | null;
  reloadWorkspace: (salonId: string) => Promise<void>;
}

type AppContextType = Omit<AppContextValue, 'activeSalon'> & { activeSalon: Salon };

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Salons réellement accessibles au compte connecté, contrôlés par Supabase RLS.
  const { memberships, isAuthenticated, hasPermission } = useOptionalAuth();
  const [mode, setMode] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'marketplace';
    return window.location.pathname.toLowerCase().startsWith('/app') ? 'erp' : 'marketplace';
  });
  const [activeSalonId, setActiveSalonId] = useState<string>('');
  const [salons, setSalons] = useState<Salon[]>(INITIAL_SALONS);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedSalonForModal, setSelectedSalonForModal] = useState<Salon | null>(null);

  // User registration in ERP (used to conditionally show 'Admin Total')

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  /**
   * Exécute une mutation Supabase et remonte l'erreur réelle dans l'UI.
   * Aucune confirmation optimiste trompeuse : le toast de succès n'est affiché
   * que dans le callback, après réponse de l'API.
   */
  const remote = async (action: () => Promise<void>, fallbackMessage: string) => {
    try {
      await action();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : fallbackMessage;
      addToast(message, 'error');
    }
  };

  // ----- Marketplace publique (Lot 7) -----
  const refreshMarketplace = async () => {
    setMarketplaceLoading(true);
    setMarketplaceError(null);
    try {
      const list = await listMarketplaceSalons();
      setSalons(list);
    } catch (error) {
      setMarketplaceError(
        error instanceof Error ? error.message : 'Le chargement de la marketplace a échoué.',
      );
    } finally {
      setMarketplaceLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== 'marketplace' || process.env.NODE_ENV === 'test') return;
    void refreshMarketplace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ----- Chargement initial depuis Supabase -----
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const reloadWorkspace = async (salonId: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const api = salonApi(salonId);
      // Inclut la veille pour ne pas perdre un client de passage encore actif.
      const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const [data, appointments] = await Promise.all([api.workspace(), api.appointments.list({ from })]);
      setSalons([mapPublicSalon(data.salon as Record<string, unknown>)]);
      setBranches(data.branches);
      setClients(data.clients);
      setServices(data.services);
      setStaff(data.staff);
      setExpenses(data.expenses);
      setStocks(data.stock);
      setLoyaltyRewards(data.rewards);
      setReviews(data.reviews);
      setAppointments(appointments);
      await loadFinance(salonId);
      await Promise.all([loadLoyalty(salonId), loadNotifications(salonId)]);
    } catch (error) {
      setSyncError(error instanceof ApiError ? error.message : 'Le chargement de cet espace a échoué.');
    } finally {
      setIsSyncing(false);
    }
  };

  const addReview = async (review: Omit<Review, 'id' | 'date' | 'verified'>): Promise<Review> => {
    try {
      const saved = await salonApi(review.salonId).reviews.create({
        author: review.author,
        rating: review.rating,
        comment: review.comment,
      });
      setReviews((prev) => [saved, ...prev]);
      return saved;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Enregistrement de l'avis impossible";
      addToast(message, 'error');
      throw error;
    }
  };

  // Charge les données du salon à l'entrée dans l'ERP. Le salon actif vient des
  // memberships autorisées par Supabase, jamais d'un identifiant choisi librement.
  useEffect(() => {
    if (mode !== 'erp' || process.env.NODE_ENV === 'test') return;
    const membership = memberships[0];
    if (membership) {
      if (activeSalonId !== membership.salonId) {
        setActiveSalonId(membership.salonId);
        return;
      }
      void reloadWorkspace(membership.salonId);
      return;
    }
    setIsSyncing(false);
    setSyncError(isAuthenticated ? 'Aucun espace actif n’est associé à ce compte.' : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeSalonId, memberships, isAuthenticated]);

  const activeSalon = salons.find((s) => s.id === activeSalonId) ?? null;

  const requireActiveSalon = (): Salon => {
    if (!activeSalon) throw new Error('Aucun salon réel n’est chargé pour cette session.');
    return activeSalon;
  };

  const formatPrice = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  // Loyalty Program Handlers
  // Catalogue de récompenses extrait (features/loyalty) : même API, déstructurée ici.
  const { loyaltyRewards, setLoyaltyRewards, addLoyaltyReward, updateLoyaltyReward, deleteLoyaltyReward } =
    useLoyaltyRewardsDomain({ requireActiveSalon, remote, addToast });

  // Fidélité : programme, soldes, journal, échanges et ajustements (features/loyalty).
  const {
    loyaltySettings,
    loyaltyAccounts,
    loyaltyLedger,
    loyaltyTransactions,
    loadLoyalty,
    updateLoyaltySettings,
    redeemRewardForClient,
    creditPointsToClient,
    refreshLoyalty,
  } = useLoyaltyProgramDomain({
    hasPermission,
    requireActiveSalon,
    addToast,
    activeSalonId,
    clients,
    reloadWorkspace,
  });

  // Notifications : file d'envoi, déclenchement serveur et relance (features/notifications).
  const { notifications, loadNotifications, refreshNotifications, dispatchNotifications, retryNotification } =
    useNotificationsDomain({ hasPermission, requireActiveSalon, addToast, activeSalonId });

  // ----- Prestations (persistées dans Supabase) -----
  // Catalogue extrait (features/services) : même API, déstructurée ici.
  const { services, setServices, setServiceActive, addService, updateService, deleteService } =
    useServicesDomain({
      requireActiveSalon,
      remote,
      addToast,
    });

  // ----- Équipe -----
  // Personnel et commandes clients extraits (features/staff, features/clients). L'état des clients
  // reste ici : il alimente la fidélité (`loyaltyTransactions`).
  const { staff, setStaff, addStaff, updateStaff, deleteStaff } = useStaffDomain({
    requireActiveSalon,
    remote,
    addToast,
  });
  const { addClient, updateClientNotes, updateClient, deleteClient } = useClientCommands({
    requireActiveSalon,
    remote,
    addToast,
    clients,
    setClients,
  });

  // Rendez-vous : planning, réservations, statuts, déplacements, passages (features/appointments).
  const {
    appointments,
    setAppointments,
    bookAppointment,
    updateAppointmentStatus,
    updateAppointmentDetails,
    updateAppointment,
    cancelAppointment,
    deleteAppointment,
    registerWalkIn,
    startWalkIn,
    completeWalkIn,
  } = useAppointmentsDomain({
    memberships,
    activeSalonId,
    services,
    requireActiveSalon,
    remote,
    addToast,
    loadNotifications,
    loadLoyalty,
  });

  // Finances : encaissements, corrections, sessions de caisse, soldes (features/finance).
  const {
    transactions,
    cashSession,
    cashSessions,
    financialSummary,
    loadFinance,
    refreshFinance,
    syncAfterFinance,
    recordPayment,
    confirmPendingPayment,
    rejectPendingPayment,
    recordPaymentCorrection,
    getAppointmentBalance,
    closeCurrentCashSession,
    openNewCashSession,
    reconcileCashSession,
  } = useFinanceDomain({
    hasPermission,
    requireActiveSalon,
    addToast,
    activeSalonId,
    memberships,
    branches,
    loadLoyalty,
    setAppointments,
  });

  // Domaines extraits (features/) : même API exposée, déstructurée ci-dessous.
  const { expenses, setExpenses, addExpense, deleteExpense } = useExpensesDomain({
    requireActiveSalon,
    remote,
    addToast,
    formatPrice,
    memberships,
  });
  const { stocks, setStocks, addStockItem, adjustStockQuantity } = useStockDomain({
    requireActiveSalon,
    remote,
    addToast,
  });

  const updateSalonDetails = (salonId: string, updates: Partial<Salon>) => {
    void remote(async () => {
      const profile: Record<string, unknown> = {};
      if (updates.name !== undefined) profile.name = updates.name;
      if (updates.slug !== undefined) profile.slug = updates.slug || null;
      if (updates.tagline !== undefined) profile.tagline = updates.tagline;
      if (updates.description !== undefined) profile.description = updates.description;
      if (updates.type !== undefined) profile.type = updates.type;
      if (updates.logo !== undefined) profile.logo_url = updates.logo || null;
      if (updates.coverImage !== undefined) profile.cover_url = updates.coverImage || null;
      if (updates.country !== undefined) profile.country = updates.country;
      if (updates.city !== undefined) profile.city = updates.city;
      if (updates.commune !== undefined) profile.commune = updates.commune;
      if (updates.quarter !== undefined) profile.quarter = updates.quarter;
      if (updates.address !== undefined) profile.address = updates.address;
      if (updates.phone !== undefined) profile.phone = updates.phone;
      if (updates.whatsapp !== undefined) profile.whatsapp = updates.whatsapp;
      if (updates.email !== undefined) profile.email = updates.email || null;
      if (updates.paymentMethods !== undefined) profile.payment_methods = updates.paymentMethods;
      if (updates.featuredPrestations !== undefined)
        profile.featured_service_ids = updates.featuredPrestations;
      if (updates.galleryItems !== undefined) {
        profile.gallery = updates.galleryItems.map((item) => ({
          url: item.url,
          title: item.title,
          description: item.description,
        }));
      } else if (updates.gallery !== undefined) {
        profile.gallery = updates.gallery.map((url) => ({ url, title: '', description: '' }));
      }
      const saved = await updateSalonProfile(salonId, profile);
      setSalons((prev) => prev.map((s) => (s.id === salonId ? saved : s)));
      addToast('Profil du salon enregistré.', 'success');
    }, 'Enregistrement du profil impossible');
  };

  const setSalonPublished = async (salonId: string, published: boolean): Promise<void> => {
    try {
      const saved = await setSalonPublication(salonId, published);
      setSalons((prev) => prev.map((s) => (s.id === salonId ? saved : s)));
      addToast(published ? 'Salon publié sur la marketplace.' : 'Salon retiré de la marketplace.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Changement de publication impossible.';
      addToast(message, 'error');
      throw error;
    }
  };

  const bookPublicAppointment = async (
    input: Omit<PublicBookingInput, 'idempotencyKey'> & { idempotencyKey?: string },
  ): Promise<{ success: boolean; booking?: PublicBooking; error?: string }> => {
    try {
      const idempotencyKey =
        input.idempotencyKey ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const booking = await bookMarketplaceAppointment({ ...input, idempotencyKey });
      return { success: true, booking };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Réservation en ligne impossible.';
      return { success: false, error: message };
    }
  };

  const cancelPublicBooking = async (
    salonId: string,
    appointmentId: string,
    cancelToken: string,
    reason: string,
  ): Promise<{ success: boolean; booking?: PublicBooking; error?: string }> => {
    try {
      const booking = await cancelMarketplaceBooking(salonId, appointmentId, cancelToken, reason);
      return { success: true, booking };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Annulation impossible.';
      return { success: false, error: message };
    }
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        activeSalonId,
        setActiveSalonId,
        activeSalon,
        salons,
        marketplaceLoading,
        marketplaceError,
        refreshMarketplace,
        services,
        staff,
        appointments,
        clients,
        transactions,
        cashSession,
        cashSessions,
        branches,
        financialSummary,
        expenses,
        stocks,
        reviews,
        addReview,
        toasts,
        addToast,
        removeToast,
        selectedSalonForModal,
        setSelectedSalonForModal,
        loyaltyRewards,
        loyaltyTransactions,
        loyaltyAccounts,
        loyaltyLedger,
        loyaltySettings,
        notifications,
        refreshNotifications,
        dispatchNotifications,
        retryNotification,
        refreshLoyalty,
        addLoyaltyReward,
        updateLoyaltyReward,
        deleteLoyaltyReward,
        updateLoyaltySettings,
        redeemRewardForClient,
        creditPointsToClient,
        bookAppointment,
        updateAppointmentStatus,
        updateAppointmentDetails,
        cancelAppointment,
        registerWalkIn,
        startWalkIn,
        completeWalkIn,
        recordPayment,
        confirmPendingPayment,
        rejectPendingPayment,
        recordPaymentCorrection,
        getAppointmentBalance,
        closeCurrentCashSession,
        openNewCashSession,
        reconcileCashSession,
        refreshFinance,
        addService,
        updateService,
        deleteService,
        setServiceActive,
        addStaff,
        updateStaff,
        deleteStaff,
        addClient,
        updateClientNotes,
        updateClient,
        deleteClient,
        updateAppointment,
        deleteAppointment,
        addExpense,
        deleteExpense,
        addStockItem,
        adjustStockQuantity,
        bookPublicAppointment,
        cancelPublicBooking,
        setSalonPublished,
        updateSalonDetails,
        formatPrice,
        isSyncing,
        syncError,
        reloadWorkspace,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

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
