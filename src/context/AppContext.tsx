import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  NotificationDispatchResult
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
  startWalkIn: (appointmentId: string, staffId?: string | null) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  completeWalkIn: (appointmentId: string) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;

  // POS / Cash operations (Lot 6 — journal Supabase immuable)
  recordPayment: (payment: {
    appointmentId: string;
    amount: number;
    method: PaymentMethod;
    providerReference?: string;
    reason?: string;
    idempotencyKey?: string;
  }) => Promise<PaymentTransaction>;
  confirmPendingPayment: (paymentId: string, providerReference: string, settlementNote: string) => Promise<PaymentTransaction>;
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
  closeCurrentCashSession: (actualCashAmount: number, notes?: string, sessionId?: string) => Promise<CashSession>;
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
  bookPublicAppointment: (input: Omit<PublicBookingInput, 'idempotencyKey'> & { idempotencyKey?: string }) =>
    Promise<{ success: boolean; booking?: PublicBooking; error?: string }>;
  cancelPublicBooking: (salonId: string, appointmentId: string, cancelToken: string, reason: string) =>
    Promise<{ success: boolean; booking?: PublicBooking; error?: string }>;
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
  redeemRewardForClient: (clientId: string, rewardId: string) => Promise<{ success: boolean; error?: string }>;
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
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(INITIAL_TRANSACTIONS);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [stocks, setStocks] = useState<StockItem[]>(INITIAL_STOCKS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedSalonForModal, setSelectedSalonForModal] = useState<Salon | null>(null);

  // User registration in ERP (used to conditionally show 'Admin Total')

  // Loyalty Program State
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>(INITIAL_LOYALTY_REWARDS);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccount[]>([]);
  const [loyaltyLedger, setLoyaltyLedger] = useState<LoyaltyLedgerEntry[]>([]);
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);

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
      const message =
        error instanceof ApiError ? error.message : fallbackMessage;
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
      setMarketplaceError(error instanceof Error ? error.message : 'Le chargement de la marketplace a échoué.');
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

  // Journal réel relu depuis Supabase ; le nom du client est résolu localement.
  const loyaltyTransactions = useMemo<LoyaltyTransaction[]>(() => {
    const byId = new Map(clients.map((client) => [client.id, client]));
    return loyaltyLedger.map((entry) => {
      const client = byId.get(entry.clientId);
      return {
        id: entry.id,
        salonId: entry.salonId,
        clientId: entry.clientId,
        clientName: client?.name ?? 'Client',
        clientPhone: client?.phone,
        points: entry.points,
        type: entry.kind,
        description: entry.reason,
        rewardId: entry.rewardId ?? undefined,
        appointmentId: entry.appointmentId ?? undefined,
        createdAt: entry.createdAt,
      };
    });
  }, [loyaltyLedger, clients]);

  const financeRange = () => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
      .toISOString().slice(0, 10);
    return { from, to, monthStart: `${to.slice(0, 8)}01` };
  };

  // Charge uniquement les données financières autorisées par le rôle actif.
  const loadFinance = async (salonId: string) => {
    const api = salonApi(salonId);
    const { from, to, monthStart } = financeRange();
    const [payments, sessions, summary] = await Promise.all([
      hasPermission('payments.read', salonId)
        ? api.payments.list({ from, to, limit: 500 })
        : Promise.resolve([] as PaymentTransaction[]),
      hasPermission('cash.read', salonId)
        ? api.cash.sessions(50)
        : Promise.resolve([] as CashSession[]),
      hasPermission('reports.read', salonId)
        ? api.reports.summary(monthStart, to)
        : Promise.resolve(null as FinancialSummary | null),
    ]);
    setTransactions(payments);
    setCashSessions(sessions);
    setCashSession(sessions.find((s) => s.status === 'open') ?? null);
    setFinancialSummary(summary);
  };

  // Fidélité : soldes et journal tenus par la base, lecture seule côté client.
  const loadLoyalty = async (salonId: string) => {
    if (!hasPermission('loyalty.read', salonId)) {
      setLoyaltyAccounts([]);
      setLoyaltyLedger([]);
      return;
    }
    const api = salonApi(salonId);
    const [program, accounts, ledger] = await Promise.all([
      api.loyalty.program(),
      api.loyalty.accounts(),
      api.loyalty.ledger(150),
    ]);
    setLoyaltySettings(program);
    setLoyaltyAccounts(accounts);
    setLoyaltyLedger(ledger);
  };

  const loadNotifications = async (salonId: string) => {
    if (!hasPermission('appointments.read', salonId)) {
      setNotifications([]);
      return;
    }
    setNotifications(await salonApi(salonId).notifications.list(200));
  };

  const reloadWorkspace = async (salonId: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const api = salonApi(salonId);
      // Inclut la veille pour ne pas perdre un client de passage encore actif.
      const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const [data, appointments] = await Promise.all([
        api.workspace(),
        api.appointments.list({ from }),
      ]);
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
        comment: review.comment
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

  const bookAppointment = async ({
    salonId,
    clientName,
    clientPhone,
    clientId,
    serviceId,
    staffId,
    date,
    time,
    source,
    notes
  }: {
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
  }): Promise<{ success: boolean; error?: string; appointment?: Appointment }> => {
    const selectedService = services.find((s) => s.id === serviceId);
    if (!selectedService) {
      return { success: false, error: 'Prestation introuvable' };
    }
    if (!memberships.some((membership) => membership.salonId === salonId)) {
      const error = 'La réservation nécessite une session Supabase et une adhésion active à ce salon.';
      addToast(error, 'error');
      return { success: false, error };
    }

    try {
      // La disponibilité, la durée, le montant et l'affectation sont vérifiés
      // côté serveur (RPC create_appointment). « any » laisse le serveur choisir.
      // Le règlement sera enregistré en caisse (lot 6) : paymentMethod n'est pas
      // persisté à la réservation.
      const created = await salonApi(salonId).appointments.create({
        serviceId,
        startsAt: toIso(date, time),
        clientName,
        clientPhone,
        clientId: clientId ?? null,
        staffId: staffId === 'any' || !staffId ? null : staffId,
        source: source ?? 'direct',
        notes: notes ?? '',
      });
      setAppointments((prev) => [created, ...prev]);
      addToast('Rendez-vous enregistré au planning.', 'success');
      return { success: true, appointment: created };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Erreur lors de la réservation.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const updateAppointmentStatus = (
    appointmentId: string,
    status: AppointmentStatus,
    reason?: string
  ) => {
    if (!hasActiveMembership) {
      addToast('Modification indisponible sans adhésion active à ce salon.', 'error');
      return;
    }

    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).appointments.transition(
        appointmentId,
        status,
        status === 'cancelled' || status === 'no_show'
          ? reason || 'Motif non précisé'
          : undefined
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      await Promise.all([loadNotifications(requireActiveSalon().id), loadLoyalty(requireActiveSalon().id)]);
      addToast(`Statut mis à jour : ${saved.status}`, 'info');
    }, 'Transition de statut refusée par Supabase.');
  };

  const updateAppointmentDetails = (appointmentId: string, updates: Partial<Appointment>) => {
    // Réaffectation de barbier, changement de prestation/horaire : même chemin
    // sécurisé que l'édition du planning (RPC reschedule_appointment).
    updateAppointment(appointmentId, updates);
  };

  const cancelAppointment = (appointmentId: string) => {
    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).appointments.cancel(
        appointmentId,
        'Annulé par un membre du salon'
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      await loadNotifications(requireActiveSalon().id);
      addToast('Rendez-vous annulé.', 'info');
    }, 'Annulation du rendez-vous impossible.');
  };

  // ----- Clients de passage (sans rendez-vous) -----
  const registerWalkIn = async (data: {
    serviceId: string;
    clientName?: string;
    clientPhone?: string;
    clientId?: string | null;
    staffId?: string | null;
    branchId?: string | null;
    startImmediately?: boolean;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; appointment?: Appointment; error?: string }> => {
    try {
      const salonId = requireActiveSalon().id;
      if (!memberships.some((m) => m.salonId === salonId)) {
        throw new Error('Une adhésion active à ce salon est requise.');
      }
      const created = await salonApi(salonId).appointments.registerWalkIn({
        serviceId: data.serviceId,
        idempotencyKey: data.idempotencyKey ?? newIdempotencyKey(),
        clientName: data.clientName ?? null,
        clientPhone: data.clientPhone ?? null,
        clientId: data.clientId ?? null,
        staffId: data.staffId ?? null,
        branchId: data.branchId ?? null,
        startImmediately: data.startImmediately ?? false,
        notes: data.notes ?? '',
      });
      setAppointments((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      addToast(
        created.status === 'in_progress'
          ? 'Client de passage installé : prestation démarrée.'
          : 'Client de passage ajouté à la file d’attente.',
        'success'
      );
      return { success: true, appointment: created };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Accueil du client de passage impossible.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const startWalkIn = async (appointmentId: string, staffId?: string | null) => {
    try {
      const saved = await salonApi(requireActiveSalon().id).appointments.startWalkIn(appointmentId, staffId ?? null);
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? saved : a)));
      addToast('Prestation démarrée.', 'success');
      return { success: true, appointment: saved };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Démarrage impossible.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const completeWalkIn = async (appointmentId: string) => {
    try {
      const saved = await salonApi(requireActiveSalon().id).appointments.completeWalkIn(appointmentId);
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? saved : a)));
      // La fin de prestation met l'invitation à laisser un avis dans la file.
      await loadNotifications(requireActiveSalon().id);
      addToast('Prestation terminée. Vous pouvez encaisser.', 'success');
      return { success: true, appointment: saved };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Clôture de la prestation impossible.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  // Loyalty Program Handlers
  const addLoyaltyReward = (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).rewards.create({
        name: reward.name,
        description: reward.description,
        pointsCost: reward.pointsCost,
        category: reward.category,
        discountPercentage: reward.discountPercentage,
        freeServiceName: reward.freeServiceName,
        isActive: reward.isActive
      });
      setLoyaltyRewards((prev) => [created, ...prev]);
      addToast(`Récompense "${created.name}" ajoutée au catalogue !`, 'success');
    }, "Ajout de la récompense impossible");
  };

  const updateLoyaltyReward = (id: string, updates: Partial<LoyaltyReward>) => {
    void remote(async () => {
      const current = loyaltyRewards.find((r) => r.id === id);
      if (!current) return;
      const merged = { ...current, ...updates };
      const saved = await salonApi(requireActiveSalon().id).rewards.update(id, {
        name: merged.name,
        description: merged.description,
        pointsCost: merged.pointsCost,
        category: merged.category,
        discountPercentage: merged.discountPercentage,
        freeServiceName: merged.freeServiceName,
        isActive: merged.isActive
      });
      setLoyaltyRewards((prev) => prev.map((r) => (r.id === id ? saved : r)));
      addToast('Récompense mise à jour.', 'success');
    }, 'Modification de la récompense impossible');
  };

  const deleteLoyaltyReward = (id: string) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).rewards.remove(id);
      setLoyaltyRewards((prev) => prev.filter((r) => r.id !== id));
      addToast('Récompense supprimée.', 'info');
    }, 'Suppression de la récompense impossible');
  };

  const updateLoyaltySettings = async (updates: Partial<LoyaltySettings>) => {
    const salonId = requireActiveSalon().id;
    try {
      const saved = await salonApi(salonId).loyalty.setProgram(updates);
      setLoyaltySettings(saved);
      await loadLoyalty(salonId);
      addToast('Programme de fidélité enregistré.', 'success');
    } catch (error) {
      addToast(error instanceof ApiError ? error.message : 'Enregistrement du programme impossible.', 'error');
    }
  };

  const redeemRewardForClient = async (clientId: string, rewardId: string): Promise<{ success: boolean; error?: string }> => {
    const salonId = requireActiveSalon().id;
    try {
      const result = await salonApi(salonId).loyalty.redeem(clientId, rewardId);
      await Promise.all([loadLoyalty(salonId), reloadWorkspace(salonId)]);
      addToast(`Récompense utilisée. Nouveau solde : ${result.points_balance} points.`, 'success');
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Utilisation de la récompense impossible.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const creditPointsToClient = async (clientId: string, points: number, reason: string) => {
    const salonId = requireActiveSalon().id;
    try {
      const result = await salonApi(salonId).loyalty.adjust(clientId, points, reason);
      await loadLoyalty(salonId);
      addToast(`Solde ajusté : ${result.points_balance} points.`, 'success');
    } catch (error) {
      addToast(error instanceof ApiError ? error.message : 'Ajustement des points impossible.', 'error');
    }
  };

  const refreshLoyalty = async () => {
    if (!activeSalonId) return;
    await loadLoyalty(activeSalonId);
  };

  const refreshNotifications = async () => {
    if (!activeSalonId) return;
    await loadNotifications(activeSalonId);
  };

  const dispatchNotifications = async (): Promise<NotificationDispatchResult | null> => {
    const salonId = requireActiveSalon().id;
    try {
      const result = await salonApi(salonId).notifications.dispatch(50);
      await loadNotifications(salonId);
      if (!result.providerConfigured) {
        addToast(
          'Aucun fournisseur d’envoi configuré : la file est conservée. Ajoutez RESEND_API_KEY ou WHATSAPP_TOKEN dans les secrets Supabase.',
          'error',
        );
      } else if (result.processed === 0) {
        addToast('Aucun message à envoyer pour le moment.', 'info');
      } else {
        addToast(
          `${result.processed} message(s) traité(s) : ${result.sent} envoyé(s), ${result.failed} échec(s), ${result.skipped} ignoré(s).`,
          result.failed > 0 ? 'error' : result.sent > 0 ? 'success' : 'info',
        );
      }
      return result;
    } catch (error) {
      addToast(error instanceof ApiError ? error.message : 'Traitement de la file impossible.', 'error');
      return null;
    }
  };

  const retryNotification = async (id: string) => {
    const salonId = requireActiveSalon().id;
    try {
      await salonApi(salonId).notifications.retry(id);
      await loadNotifications(salonId);
      addToast('Message replacé dans la file d’envoi.', 'success');
    } catch (error) {
      addToast(error instanceof ApiError ? error.message : 'Relance impossible.', 'error');
    }
  };

  const newIdempotencyKey = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  };

  const paymentStatusFromBalance = (balance: AppointmentBalance, billed: number): Appointment['paymentStatus'] => {
    if (billed > 0 && balance.collected >= billed) return 'paid';
    if (balance.collected > 0) return 'deposit_paid';
    if (balance.refunded > 0) return 'refunded';
    return 'unpaid';
  };

  const syncAfterFinance = async (appointmentId?: string) => {
    const salonId = requireActiveSalon().id;
    await loadFinance(salonId);
    // Un encaissement confirmé déclenche les points de fidélité côté base.
    await loadLoyalty(salonId);
    if (appointmentId) {
      const balance = await salonApi(salonId).payments.balance(appointmentId);
      setAppointments((prev) => prev.map((a) => (
        a.id === appointmentId ? { ...a, paymentStatus: paymentStatusFromBalance(balance, a.price) } : a
      )));
    }
  };

  const refreshFinance = async () => {
    await loadFinance(requireActiveSalon().id);
  };

  const recordPayment = async (payment: {
    appointmentId: string;
    amount: number;
    method: PaymentMethod;
    providerReference?: string;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<PaymentTransaction> => {
    const salonId = requireActiveSalon().id;
    if (!payment.appointmentId) throw new Error('Un rendez-vous est requis pour encaisser.');
    if (!Number.isInteger(payment.amount) || payment.amount <= 0) {
      throw new Error('Le montant doit être un entier positif en FCFA.');
    }
    const saved = await salonApi(salonId).payments.record({
      appointmentId: payment.appointmentId,
      amount: payment.amount,
      method: payment.method,
      idempotencyKey: payment.idempotencyKey ?? newIdempotencyKey(),
      providerReference: payment.providerReference ?? null,
      reason: payment.reason ?? '',
    });
    await syncAfterFinance(payment.appointmentId);
    addToast(
      saved.status === 'pending'
        ? 'Paiement Mobile Money enregistré en attente de vérification manuelle.'
        : 'Encaissement enregistré dans le journal de caisse.',
      'success'
    );
    return saved;
  };

  const confirmPendingPayment = async (paymentId: string, providerReference: string, settlementNote: string) => {
    const saved = await salonApi(requireActiveSalon().id).payments.confirm(paymentId, providerReference, settlementNote);
    await syncAfterFinance(saved.appointmentId);
    addToast('Paiement vérifié manuellement et confirmé.', 'success');
    return saved;
  };

  const rejectPendingPayment = async (paymentId: string, reason: string) => {
    const saved = await salonApi(requireActiveSalon().id).payments.reject(paymentId, reason);
    await syncAfterFinance(saved.appointmentId);
    addToast('Paiement en attente rejeté.', 'info');
    return saved;
  };

  const recordPaymentCorrection = async (correction: {
    originalEntryId: string;
    kind: Exclude<PaymentEntryKind, 'payment'>;
    amount: number;
    reason: string;
    providerReference?: string;
    settlementNote?: string;
    idempotencyKey?: string;
  }): Promise<PaymentTransaction> => {
    if (!Number.isInteger(correction.amount) || correction.amount <= 0) {
      throw new Error('Le montant de correction doit être un entier positif en FCFA.');
    }
    const saved = await salonApi(requireActiveSalon().id).payments.correct({
      originalEntryId: correction.originalEntryId,
      kind: correction.kind,
      amount: correction.amount,
      reason: correction.reason,
      idempotencyKey: correction.idempotencyKey ?? newIdempotencyKey(),
      providerReference: correction.providerReference ?? null,
      settlementNote: correction.settlementNote ?? '',
    });
    await syncAfterFinance(saved.appointmentId);
    addToast('Correction enregistrée dans le journal (écriture liée, motif conservé).', 'success');
    return saved;
  };

  const getAppointmentBalance = useCallback(async (appointmentId: string): Promise<AppointmentBalance> => {
    return salonApi(activeSalonId).payments.balance(appointmentId);
  }, [activeSalonId]);

  const closeCurrentCashSession = async (actualCashAmount: number, notes?: string, sessionId?: string): Promise<CashSession> => {
    const target = sessionId ?? cashSession?.id;
    if (!target) throw new Error('Aucune session de caisse ouverte à clôturer.');
    if (!Number.isInteger(actualCashAmount) || actualCashAmount < 0) {
      throw new Error('Le montant compté doit être un entier positif ou nul en FCFA.');
    }
    const saved = await salonApi(requireActiveSalon().id).cash.close(target, actualCashAmount, notes ?? '');
    await loadFinance(requireActiveSalon().id);
    addToast('Session de caisse clôturée.', 'success');
    return saved;
  };

  const openNewCashSession = async (openingBalance: number, branchId?: string, note?: string): Promise<CashSession> => {
    const salonId = requireActiveSalon().id;
    const targetBranch = branchId
      ?? memberships.find((m) => m.salonId === salonId)?.branchId
      ?? branches[0]?.id;
    if (!targetBranch) throw new Error('Aucune succursale disponible pour ouvrir une caisse.');
    if (!Number.isInteger(openingBalance) || openingBalance < 0) {
      throw new Error('Le fond de caisse doit être un entier positif ou nul en FCFA.');
    }
    const saved = await salonApi(salonId).cash.open(targetBranch, openingBalance, note ?? '');
    await loadFinance(salonId);
    addToast('Session de caisse ouverte.', 'success');
    return saved;
  };

  const reconcileCashSession = async (sessionId: string, note: string): Promise<CashSession> => {
    const saved = await salonApi(requireActiveSalon().id).cash.reconcile(sessionId, note);
    await loadFinance(requireActiveSalon().id);
    addToast('Session de caisse rapprochée.', 'success');
    return saved;
  };

  // ----- Prestations (persistées dans Supabase) -----
  /** Lot 3 : une prestation n'est jamais supprimée, elle est désactivée. */
  const setServiceActive = (id: string, isActive: boolean) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).services.setActive(id, isActive);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, isActive } : s)));
      addToast(isActive ? 'Prestation réactivée.' : 'Prestation désactivée (retirée de la réservation).', 'info');
    }, 'Changement de statut de la prestation impossible');
  };

  const addService = (data: Omit<Service, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).services.create({
        name: data.name,
        category: data.category,
        description: data.description,
        price: data.price,
        durationMinutes: data.durationMinutes,
        prepMinutes: data.prepMinutes ?? 0,
        popular: Boolean(data.popular)
      });
      setServices((prev) => [...prev, created]);
      addToast('Prestation ajoutée au catalogue !', 'success');
    }, 'Ajout de la prestation impossible');
  };

  const updateService = (id: string, updates: Partial<Service>) => {
    void remote(async () => {
      const current = services.find((s) => s.id === id);
      if (!current) return;
      const merged = { ...current, ...updates };
      const saved = await salonApi(requireActiveSalon().id).services.update(id, {
        name: merged.name,
        category: merged.category,
        description: merged.description,
        price: merged.price,
        durationMinutes: merged.durationMinutes,
        prepMinutes: merged.prepMinutes ?? 0,
        popular: Boolean(merged.popular)
      });
      setServices((prev) => prev.map((s) => (s.id === id ? saved : s)));
      addToast('Prestation mise à jour.', 'success');
    }, 'Modification de la prestation impossible');
  };

  const deleteService = (id: string) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).services.remove(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      addToast('Prestation supprimée.', 'info');
    }, 'Suppression de la prestation impossible');
  };

  // ----- Équipe -----
  const addStaff = (data: Omit<StaffMember, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).staff.create({
        name: data.name,
        role: data.role,
        phone: data.phone,
        specialties: data.specialties,
        commissionRate: data.commissionRate,
        isAvailable: data.isAvailable
      });
      setStaff((prev) => [...prev, created]);
      addToast(`${created.name} a été ajouté à l'équipe !`, 'success');
    }, 'Ajout du collaborateur impossible');
  };

  const updateStaff = (id: string, updates: Partial<StaffMember>) => {
    void remote(async () => {
      const current = staff.find((m) => m.id === id);
      if (!current) return;
      const merged = { ...current, ...updates };
      const saved = await salonApi(requireActiveSalon().id).staff.update(id, {
        name: merged.name,
        role: merged.role,
        phone: merged.phone,
        specialties: merged.specialties,
        commissionRate: merged.commissionRate,
        isAvailable: merged.isAvailable
      });
      setStaff((prev) => prev.map((m) => (m.id === id ? saved : m)));
      addToast('Collaborateur mis à jour.', 'success');
    }, 'Modification du collaborateur impossible');
  };

  const deleteStaff = (id: string) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).staff.remove(id);
      setStaff((prev) => prev.filter((m) => m.id !== id));
      addToast('Collaborateur retiré.', 'info');
    }, 'Suppression du collaborateur impossible');
  };

  // ----- Clients -----
  const addClient = (data: Omit<Client, 'id' | 'totalSpent' | 'visitsCount' | 'lastVisit'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).clients.create({
        name: data.name,
        phone: data.phone,
        email: data.email || '',
        segment: data.segment,
        favoriteService: data.favoriteService,
        notes: data.notes
      });
      setClients((prev) => [created, ...prev]);
      addToast(`Client ${created.name} ajouté au CRM !`, 'success');
    }, 'Ajout du client impossible');
  };

  const updateClientNotes = (clientId: string, notes: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).clients.update(clientId, {
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        segment: client.segment,
        favoriteService: client.favoriteService,
        notes
      });
      setClients((prev) => prev.map((c) => (c.id === clientId ? saved : c)));
      addToast('Fiche client mise à jour.', 'success');
    }, 'Mise à jour de la note impossible');
  };

  const updateClient = (clientId: string, updates: Partial<Client>) => {
    void remote(async () => {
      const current = clients.find((c) => c.id === clientId);
      if (!current) return;
      const merged = { ...current, ...updates };
      const saved = await salonApi(requireActiveSalon().id).clients.update(clientId, {
        name: merged.name,
        phone: merged.phone,
        email: merged.email || '',
        segment: merged.segment,
        favoriteService: merged.favoriteService,
        notes: merged.notes
      });
      setClients((prev) => prev.map((c) => (c.id === clientId ? saved : c)));
      addToast('Client mis à jour.', 'success');
    }, 'Modification du client impossible');
  };

  const deleteClient = (clientId: string) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).clients.remove(clientId);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      addToast('Client supprimé.', 'info');
    }, 'Suppression du client impossible');
  };

  /** Les opérations ERP nécessitent une adhésion Supabase active au salon. */
  const hasActiveMembership = memberships.some(
    (membership) => membership.status === 'active' && membership.salonId === activeSalonId
  );
  const toIso = (date: string, time: string) => `${date}T${time.slice(0, 5)}:00.000Z`;

  const updateAppointment = (appointmentId: string, updates: Partial<Appointment>) => {
    const current = appointments.find((a) => a.id === appointmentId);
    if (!current) return;
    const merged = { ...current, ...updates };

    if (!hasActiveMembership) {
      addToast('Modification indisponible sans adhésion active à ce salon.', 'error');
      return;
    }

    // La fin et le montant sont recalculés côté serveur depuis la prestation :
    // le client n'envoie que le début, le service, le collaborateur et les notes.
    const startsAt = toIso(merged.date, merged.time);

    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).appointments.reschedule(appointmentId, {
        staffId: merged.staffId === "any" || !merged.staffId ? current.staffId : merged.staffId,
        serviceId: merged.serviceId,
        startsAt,
        notes: merged.notes ?? ''
      });
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      addToast('Rendez-vous modifié.', 'success');
    }, 'Modification du rendez-vous impossible (créneau indisponible ?)');
  };

  const deleteAppointment = (appointmentId: string) => {
    // Les rendez-vous ne sont jamais supprimés : l'historique est conservé.
    void remote(async () => {
      if (!hasActiveMembership) throw new Error('Annulation indisponible sans adhésion active au salon.');
      const saved = await salonApi(requireActiveSalon().id).appointments.cancel(
        appointmentId,
        'Annulé depuis le planning'
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      addToast('Rendez-vous annulé, historique conservé.', 'info');
    }, 'Annulation du rendez-vous impossible');
  };

  const addExpense = (data: Omit<Expense, 'id'>) => {
    void remote(async () => {
      const salonId = requireActiveSalon().id;
      const created = await salonApi(salonId).expenses.create({
        title: data.title,
        category: data.category,
        amount: data.amount,
        date: data.date,
        notes: data.notes || '',
        branchId: data.branchId ?? memberships.find((m) => m.salonId === salonId)?.branchId ?? null,
        receiptRef: data.receiptRef ?? '',
      });
      setExpenses((prev) => [created, ...prev]);
      addToast(`Dépense de ${formatPrice(created.amount)} enregistrée`, 'success');
    }, 'Enregistrement de la dépense impossible');
  };

  const deleteExpense = (id: string) => {
    void id;
    addToast("La suppression d'une dépense n'est pas prise en charge par l'API.", 'error');
  };

  const addStockItem = (data: Omit<StockItem, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).stock.create({
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        minThreshold: data.minThreshold,
        unitCost: data.unitCost,
        supplier: data.supplier
      });
      setStocks((prev) => [...prev, created]);
      addToast(`Produit ${created.name} ajouté au stock`, 'success');
    }, 'Ajout du produit impossible');
  };

  const adjustStockQuantity = (id: string, delta: number) => {
    const item = stocks.find((entry) => entry.id === id);
    if (!item) {
      addToast('Produit introuvable.', 'error');
      return;
    }
    const quantity = item.quantity + delta;
    if (quantity < 0) {
      addToast('La quantité ne peut pas être négative.', 'error');
      return;
    }
    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).stock.update(id, {
        name: item.name,
        category: item.category,
        quantity,
        minThreshold: item.minThreshold,
        unitCost: item.unitCost,
        supplier: item.supplier
      });
      setStocks((prev) => prev.map((entry) => (entry.id === id ? saved : entry)));
      addToast('Stock ajusté.', 'info');
    }, 'Ajustement du stock impossible');
  };

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
      if (updates.featuredPrestations !== undefined) profile.featured_service_ids = updates.featuredPrestations;
      if (updates.galleryItems !== undefined) {
        profile.gallery = updates.galleryItems.map((item) => ({ url: item.url, title: item.title, description: item.description }));
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
    input: Omit<PublicBookingInput, 'idempotencyKey'> & { idempotencyKey?: string }
  ): Promise<{ success: boolean; booking?: PublicBooking; error?: string }> => {
    try {
      const idempotencyKey = input.idempotencyKey
        ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
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
    salonId: string, appointmentId: string, cancelToken: string, reason: string
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
        reloadWorkspace
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