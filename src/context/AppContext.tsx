import React, { createContext, useContext, useState, useEffect } from 'react';
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
  AppointmentStatus,
  Review,
  LoyaltyReward,
  LoyaltyTransaction,
  LoyaltySettings
} from '../types';
import { salonApi, ApiError } from '../lib/api';
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
  services: Service[];
  staff: StaffMember[];
  appointments: Appointment[];
  clients: Client[];
  transactions: PaymentTransaction[];
  cashSession: CashSession | null;
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
    serviceId: string;
    staffId: string;
    date: string;
    time: string;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus, reason?: string) => void;
  updateAppointmentDetails: (appointmentId: string, updates: Partial<Appointment>) => void;
  cancelAppointment: (appointmentId: string) => void;

  // POS / Cash operations
  recordPayment: (payment: {
    appointmentId?: string;
    clientName: string;
    amount: number;
    method: PaymentMethod;
    type: 'full' | 'deposit';
  }) => PaymentTransaction;
  closeCurrentCashSession: (actualCashAmount: number, notes?: string) => void;
  openNewCashSession: (openingBalance: number) => void;

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

  // Salon Onboarding / Settings
  updateSalonDetails: (salonId: string, updates: Partial<Salon>) => void;

  // User registration in ERP status (Admin Total visibility)
  // Loyalty Program CRUD & Redemption
  loyaltyRewards: LoyaltyReward[];
  loyaltyTransactions: LoyaltyTransaction[];
  loyaltySettings: LoyaltySettings | null;
  addLoyaltyReward: (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => void;
  updateLoyaltyReward: (id: string, updates: Partial<LoyaltyReward>) => void;
  deleteLoyaltyReward: (id: string) => void;
  updateLoyaltySettings: (settings: Partial<LoyaltySettings>) => void;
  redeemRewardForClient: (clientId: string, rewardId: string) => { success: boolean; error?: string };
  creditPointsToClient: (clientId: string, points: number, reason: string) => void;

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
  const { memberships, isAuthenticated } = useOptionalAuth();
  const [mode, setMode] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'marketplace';
    return window.location.pathname.toLowerCase().startsWith('/app') ? 'erp' : 'marketplace';
  });
  const [activeSalonId, setActiveSalonId] = useState<string>('');
  const [salons, setSalons] = useState<Salon[]>(INITIAL_SALONS);
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(INITIAL_TRANSACTIONS);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [stocks, setStocks] = useState<StockItem[]>(INITIAL_STOCKS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedSalonForModal, setSelectedSalonForModal] = useState<Salon | null>(null);

  // User registration in ERP (used to conditionally show 'Admin Total')

  // Loyalty Program State
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>(INITIAL_LOYALTY_REWARDS);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>(INITIAL_LOYALTY_TRANSACTIONS);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);

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

  // ----- Chargement initial depuis Supabase -----
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const reloadWorkspace = async (salonId: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const api = salonApi(salonId);
      const today = new Date().toISOString().slice(0, 10);
      const [data, appointments] = await Promise.all([
        api.workspace(),
        api.appointments.list({ from: today }),
      ]);
      setSalons([{ id: data.salon.id, name: data.salon.name }]);
      setClients(data.clients);
      setServices(data.services);
      setStaff(data.staff);
      setExpenses(data.expenses);
      setStocks(data.stock);
      setLoyaltyRewards(data.rewards);
      setReviews(data.reviews);
      setAppointments(appointments);
      setCashSession(null);
      setLoyaltySettings(null);
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
    clientEmail,
    serviceId,
    staffId,
    date,
    time,
    paymentMethod,
    notes
  }: {
    salonId: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    serviceId: string;
    staffId: string;
    date: string;
    time: string;
    paymentMethod: PaymentMethod;
    notes?: string;
  }): Promise<{ success: boolean; error?: string; appointment?: Appointment }> => {
    const selectedService = services.find((s) => s.id === serviceId);
    if (!selectedService) {
      return { success: false, error: 'Prestation introuvable' };
    }

    const error = memberships.some((membership) => membership.salonId === salonId)
      ? 'La réservation n’est pas encore disponible : le contrôle de disponibilité et la création sécurisée ne sont pas migrés.'
      : 'La réservation nécessite une session Supabase et une adhésion active à ce salon.';
    addToast(error, 'error');
    return { success: false, error };
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
      addToast(`Statut mis à jour : ${saved.status}`, 'info');
    }, 'Transition de statut refusée par Supabase.');
  };

  const updateAppointmentDetails = (appointmentId: string, updates: Partial<Appointment>) => {
    void appointmentId;
    void updates;
    addToast('La modification des détails du rendez-vous n’est pas encore prise en charge par l’API.', 'error');
  };

  const cancelAppointment = (appointmentId: string) => {
    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).appointments.cancel(
        appointmentId,
        'Annulé par un membre du salon'
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      addToast('Rendez-vous annulé.', 'info');
    }, 'Annulation du rendez-vous impossible.');
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

  const updateLoyaltySettings = (updates: Partial<LoyaltySettings>) => {
    void updates;
    addToast('Le paramétrage de fidélité n’est pas encore pris en charge par une API persistante.', 'error');
  };

  const redeemRewardForClient = (clientId: string, rewardId: string): { success: boolean; error?: string } => {
    void clientId;
    void rewardId;
    const error = 'L’utilisation de récompenses n’est pas encore prise en charge par une API persistante.';
    addToast(error, 'error');
    return { success: false, error };
  };

  const creditPointsToClient = (clientId: string, points: number, reason: string) => {
    void clientId;
    void points;
    void reason;
    addToast('L’ajustement des points n’est pas encore pris en charge par une API persistante.', 'error');
  };

  const recordPayment = (_payment: {
    appointmentId?: string;
    clientName: string;
    amount: number;
    method: PaymentMethod;
    type: 'full' | 'deposit';
  }): PaymentTransaction => {
    const error = 'Les paiements ne sont pas encore reliés à une API de caisse persistante.';
    addToast(error, 'error');
    throw new Error(error);
  };

  const closeCurrentCashSession = (_actualCashAmount: number, _notes?: string) => {
    addToast('La clôture de caisse n’est pas encore reliée à une API persistante.', 'error');
  };

  const openNewCashSession = (_openingBalance: number) => {
    addToast('L’ouverture de caisse n’est pas encore reliée à une API persistante.', 'error');
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

    const service = services.find((s) => s.id === merged.serviceId);
    const duration = service?.durationMinutes ?? merged.durationMinutes;
    const startsAt = toIso(merged.date, merged.time);
    const endsAt = new Date(Date.parse(startsAt) + duration * 60000).toISOString();

    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).appointments.reschedule(appointmentId, {
        staffId: merged.staffId === "any" || !merged.staffId ? current.staffId : merged.staffId,
        serviceId: merged.serviceId,
        startsAt,
        endsAt,
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
      const created = await salonApi(requireActiveSalon().id).expenses.create({
        title: data.title,
        category: data.category,
        amount: data.amount,
        date: data.date,
        notes: data.notes || ''
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
    void salonId;
    void updates;
    addToast(
      'La modification du profil n’est pas disponible : aucune API persistante n’est configurée pour ces champs.',
      'error'
    );
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
        services,
        staff,
        appointments,
        clients,
        transactions,
        cashSession,
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
        loyaltySettings,
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
        recordPayment,
        closeCurrentCashSession,
        openNewCashSession,
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