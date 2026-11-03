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
import {
  INITIAL_SALONS,
  INITIAL_SERVICES,
  INITIAL_STAFF,
  INITIAL_CLIENTS,
  INITIAL_APPOINTMENTS,
  INITIAL_TRANSACTIONS,
  INITIAL_CASH_SESSION,
  INITIAL_EXPENSES,
  INITIAL_STOCKS,
  INITIAL_REVIEWS,
  INITIAL_LOYALTY_REWARDS,
  INITIAL_LOYALTY_TRANSACTIONS,
  INITIAL_LOYALTY_SETTINGS
} from '../data/mockData';

export type AppMode = 'marketplace' | 'erp';
export type UserRole = 'owner' | 'manager' | 'barber' | 'cashier' | 'customer';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  activeSalonId: string;
  setActiveSalonId: (id: string) => void;
  activeSalon: Salon;
  salons: Salon[];
  services: Service[];
  staff: StaffMember[];
  appointments: Appointment[];
  clients: Client[];
  transactions: PaymentTransaction[];
  cashSession: CashSession;
  expenses: Expense[];
  stocks: StockItem[];
  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'date' | 'verified'>) => Review;
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Marketplace selection
  selectedSalonForModal: Salon | null;
  setSelectedSalonForModal: (salon: Salon | null) => void;
  isRegisterSalonOpen: boolean;
  setIsRegisterSalonOpen: (open: boolean) => void;
  authStartView: 'login' | 'signup';
  setAuthStartView: (view: 'login' | 'signup') => void;
  isClientAppointmentsOpen: boolean;
  setIsClientAppointmentsOpen: (open: boolean) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;

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
  }) => { success: boolean; appointment?: Appointment; error?: string };
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => void;
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
  createSalon: (salonData: Partial<Salon>, options?: { seedDemoData?: boolean }) => Salon;
  updateSalonDetails: (salonId: string, updates: Partial<Salon>) => void;

  // SaaS Subscription
  upgradePlan: (salonId: string, planId: string, paymentMethod: PaymentMethod) => void;

  // User registration in ERP status (Admin Total visibility)
  isRegisteredInErp: boolean;
  setIsRegisteredInErp: (registered: boolean) => void;

  // Loyalty Program CRUD & Redemption
  loyaltyRewards: LoyaltyReward[];
  loyaltyTransactions: LoyaltyTransaction[];
  loyaltySettings: LoyaltySettings;
  addLoyaltyReward: (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => void;
  updateLoyaltyReward: (id: string, updates: Partial<LoyaltyReward>) => void;
  deleteLoyaltyReward: (id: string) => void;
  updateLoyaltySettings: (settings: Partial<LoyaltySettings>) => void;
  redeemRewardForClient: (clientId: string, rewardId: string) => { success: boolean; error?: string };
  creditPointsToClient: (clientId: string, points: number, reason: string) => void;

  // Helpers
  formatPrice: (amount: number) => string;
  checkSlotAvailability: (salonId: string, staffId: string, date: string, time: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'barber_cuts_state_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'marketplace';
    return window.location.pathname.toLowerCase().startsWith('/app') ? 'erp' : 'marketplace';
  });
  const [userRole, setUserRole] = useState<UserRole>('owner');
  const [activeSalonId, setActiveSalonId] = useState<string>(() => localStorage.getItem(`${LOCAL_STORAGE_KEY}_activeSalonId`) || 'salon-1');

  const [salons, setSalons] = useState<Salon[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_salons`);
    return saved ? JSON.parse(saved) : INITIAL_SALONS;
  });

  const [services, setServices] = useState<Service[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_services`);
    return saved ? JSON.parse(saved) : INITIAL_SERVICES;
  });

  const [staff, setStaff] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_staff`);
    return saved ? JSON.parse(saved) : INITIAL_STAFF;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_appointments`);
    return saved ? JSON.parse(saved) : INITIAL_APPOINTMENTS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_clients`);
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_transactions`);
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [cashSession, setCashSession] = useState<CashSession>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_cashSession`);
    return saved ? JSON.parse(saved) : INITIAL_CASH_SESSION;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_expenses`);
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [stocks, setStocks] = useState<StockItem[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_stocks`);
    return saved ? JSON.parse(saved) : INITIAL_STOCKS;
  });

  const [reviews, setReviews] = useState<Review[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_reviews`);
    return saved ? JSON.parse(saved) : INITIAL_REVIEWS;
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedSalonForModal, setSelectedSalonForModal] = useState<Salon | null>(null);
  const [isRegisterSalonOpen, setIsRegisterSalonOpen] = useState(false);
  const [authStartView, setAuthStartView] = useState<'login' | 'signup'>('signup');
  const [isClientAppointmentsOpen, setIsClientAppointmentsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // User registration in ERP (used to conditionally show 'Admin Total')
  const [isRegisteredInErp, setIsRegisteredInErp] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_isRegisteredInErp`);
    return saved !== null ? JSON.parse(saved) === true : false;
  });

  // Loyalty Program State
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_loyaltyRewards`);
    return saved ? JSON.parse(saved) : INITIAL_LOYALTY_REWARDS;
  });

  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_loyaltyTransactions`);
    return saved ? JSON.parse(saved) : INITIAL_LOYALTY_TRANSACTIONS;
  });

  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_loyaltySettings`);
    return saved ? JSON.parse(saved) : INITIAL_LOYALTY_SETTINGS;
  });

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_activeSalonId`, activeSalonId);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_salons`, JSON.stringify(salons));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_services`, JSON.stringify(services));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_staff`, JSON.stringify(staff));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_appointments`, JSON.stringify(appointments));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_clients`, JSON.stringify(clients));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_transactions`, JSON.stringify(transactions));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_cashSession`, JSON.stringify(cashSession));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_expenses`, JSON.stringify(expenses));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_stocks`, JSON.stringify(stocks));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_reviews`, JSON.stringify(reviews));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_isRegisteredInErp`, JSON.stringify(isRegisteredInErp));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_loyaltyRewards`, JSON.stringify(loyaltyRewards));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_loyaltyTransactions`, JSON.stringify(loyaltyTransactions));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_loyaltySettings`, JSON.stringify(loyaltySettings));
  }, [
    activeSalonId,
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
    isRegisteredInErp,
    loyaltyRewards,
    loyaltyTransactions,
    loyaltySettings
  ]);

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
   * Exécute une mutation serveur et remonte l'erreur réelle dans l'UI.
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

  // ----- Chargement initial depuis l'API -----
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const reloadWorkspace = async (salonId: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const data = await salonApi(salonId).workspace();
      setSalons((prev) =>
        prev.some((s) => s.id === salonId)
          ? prev
          : [
              ...prev,
              {
                ...INITIAL_SALONS[0],
                id: data.salon.id,
                name: data.salon.name,
                slug: data.salon.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
              }
            ]
      );
      setClients(data.clients);
      setServices(data.services);
      setStaff(data.staff);
      setExpenses(data.expenses);
      setStocks(data.stock);
      setLoyaltyRewards(data.rewards);
      setReviews(data.reviews);
    } catch (error) {
      // 401 = pas de session : l'utilisateur voit la marketplace, pas une erreur.
      if (error instanceof ApiError && error.status !== 401) {
        setSyncError(error.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const addReview = (review: Omit<Review, 'id' | 'date' | 'verified'>): Review => {
    // Retour immédiat pour l'UI, puis confirmation serveur.
    const created: Review = {
      ...review,
      id: `rev-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      verified: false
    };
    setReviews((prev) => [created, ...prev]);

    void remote(async () => {
      const saved = await salonApi(activeSalon.id).reviews.create({
        author: review.author,
        rating: review.rating,
        comment: review.comment
      });
      setReviews((prev) => prev.map((r) => (r.id === created.id ? saved : r)));
    }, "Enregistrement de l'avis impossible");

    return created;
  };

  const activeSalon = salons.find((s) => s.id === activeSalonId) || salons[0];

  const formatPrice = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  const checkSlotAvailability = (salonId: string, staffId: string, date: string, time: string): boolean => {
    // If staffId is 'any', check if at least one staff is available
    if (staffId === 'any') {
      const salonStaff = staff.filter((s) => s.salonId === salonId && s.isAvailable);
      const bookedStaff = appointments
        .filter((a) => a.salonId === salonId && a.date === date && a.time === time && a.status !== 'cancelled')
        .map((a) => a.staffId);
      return bookedStaff.length < salonStaff.length;
    }

    const collision = appointments.some(
      (a) =>
        a.salonId === salonId &&
        a.staffId === staffId &&
        a.date === date &&
        a.time === time &&
        a.status !== 'cancelled'
    );
    return !collision;
  };

  const bookAppointment = ({
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
  }) => {
    const selectedService = services.find((s) => s.id === serviceId);
    if (!selectedService) {
      return { success: false, error: 'Prestation introuvable' };
    }

    let assignedStaffId = staffId;
    let assignedStaffName = 'Sans préférence';

    if (staffId === 'any') {
      // Pick first available staff
      const salonStaff = staff.filter((s) => s.salonId === salonId && s.isAvailable);
      const bookedStaffIds = appointments
        .filter((a) => a.salonId === salonId && a.date === date && a.time === time && a.status !== 'cancelled')
        .map((a) => a.staffId);
      const freeStaff = salonStaff.find((s) => !bookedStaffIds.includes(s.id));
      if (!freeStaff) {
        return { success: false, error: 'Ce créneau est déjà complet pour cette heure.' };
      }
      assignedStaffId = freeStaff.id;
      assignedStaffName = freeStaff.name;
    } else {
      const staffMember = staff.find((s) => s.id === staffId);
      if (staffMember) {
        assignedStaffName = staffMember.name;
      }
      // Check collision
      const isAvailable = checkSlotAvailability(salonId, staffId, date, time);
      if (!isAvailable) {
        return { success: false, error: `Ce créneau (${time}) est déjà réservé avec ${assignedStaffName}. Veuillez choisir un autre horaire.` };
      }
    }

    const newAppointmentId = `apt-${Date.now()}`;
    const newAppointment: Appointment = {
      id: newAppointmentId,
      salonId,
      clientName,
      clientPhone,
      clientEmail,
      serviceId,
      serviceName: selectedService.name,
      price: selectedService.price,
      staffId: assignedStaffId,
      staffName: assignedStaffName,
      date,
      time,
      durationMinutes: selectedService.durationMinutes,
      status: 'confirmed',
      paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid',
      paymentMethod,
      source: 'marketplace',
      notes,
      createdAt: new Date().toISOString()
    };

    setAppointments((prev) => [newAppointment, ...prev]);

    // Update or create client in CRM
    setClients((prev) => {
      const existing = prev.find((c) => c.salonId === salonId && c.phone.replace(/\s+/g, '') === clientPhone.replace(/\s+/g, ''));
      if (existing) {
        return prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                visitsCount: c.visitsCount + 1,
                totalSpent: c.totalSpent + selectedService.price,
                lastVisit: date,
                segment: c.visitsCount + 1 >= 5 ? 'vip' : 'loyal'
              }
            : c
        );
      } else {
        const newClient: Client = {
          id: `client-${Date.now()}`,
          salonId,
          name: clientName,
          phone: clientPhone,
          email: clientEmail,
          segment: 'new',
          totalSpent: selectedService.price,
          visitsCount: 1,
          lastVisit: date,
          favoriteService: selectedService.name,
          preferredBarber: assignedStaffName,
          notes: 'Premier rendez-vous via la marketplace'
        };
        return [newClient, ...prev];
      }
    });

    // If paid by mobile money right now, record transaction
    if (paymentMethod !== 'cash') {
      const refPrefix = paymentMethod === 'wave' ? 'WAVE-CI-' : paymentMethod === 'orange_money' ? 'OM-CI-' : 'MOMO-CI-';
      const ref = refPrefix + Math.floor(1000000 + Math.random() * 9000000);
      const tx: PaymentTransaction = {
        id: `tx-${Date.now()}`,
        salonId,
        appointmentId: newAppointmentId,
        clientName,
        amount: selectedService.price,
        method: paymentMethod,
        type: 'full',
        reference: ref,
        status: 'completed',
        date,
        time,
        cashSessionId: cashSession.status === 'open' ? cashSession.id : undefined
      };
      setTransactions((prev) => [tx, ...prev]);

      // update cash session
      if (cashSession.status === 'open') {
        setCashSession((prev) => ({
          ...prev,
          totalMobileMoneyIn: prev.totalMobileMoneyIn + selectedService.price
        }));
      }
    }

    addToast(`Réservation confirmée avec succès pour le ${date} à ${time} !`, 'success');
    return { success: true, appointment: newAppointment };
  };

  const updateAppointmentStatus = (appointmentId: string, status: AppointmentStatus) => {
    const targetApt = appointments.find((a) => a.id === appointmentId);
    const wasAlreadyCompleted = targetApt?.status === 'completed';

    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
    );

    const statusLabels: Record<AppointmentStatus, string> = {
      pending: 'En attente',
      confirmed: 'Confirmé',
      checked_in: 'Client Arrivé',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
      no_show: 'No-show / Absent'
    };
    addToast(`Statut mis à jour : ${statusLabels[status]}`, 'info');

    // Automatically credit loyalty points when appointment is marked completed
    if (status === 'completed' && !wasAlreadyCompleted && targetApt && loyaltySettings.programEnabled) {
      const pointsEarned = Math.max(5, Math.floor((targetApt.price / 100) * loyaltySettings.pointsPer100Fcfa));

      // Locate or auto-create client in CRM
      let matchedClientId = '';
      setClients((prev) => {
        const found = prev.find(
          (c) =>
            c.salonId === targetApt.salonId &&
            (c.phone === targetApt.clientPhone || c.name.toLowerCase() === targetApt.clientName.toLowerCase())
        );

        if (found) {
          matchedClientId = found.id;
          const updatedPoints = (found.loyaltyPoints || 0) + pointsEarned;
          const updatedLifetime = (found.totalPointsEarned || 0) + pointsEarned;

          let updatedTier: 'bronze' | 'silver' | 'gold' | 'vip' = 'bronze';
          if (updatedLifetime >= loyaltySettings.vipThreshold) updatedTier = 'vip';
          else if (updatedLifetime >= loyaltySettings.goldThreshold) updatedTier = 'gold';
          else if (updatedLifetime >= loyaltySettings.silverThreshold) updatedTier = 'silver';

          return prev.map((c) =>
            c.id === found.id
              ? {
                  ...c,
                  loyaltyPoints: updatedPoints,
                  totalPointsEarned: updatedLifetime,
                  loyaltyTier: updatedTier,
                  visitsCount: c.visitsCount + 1,
                  totalSpent: c.totalSpent + targetApt.price,
                  lastVisit: targetApt.date
                }
              : c
          );
        } else {
          matchedClientId = `client-${Date.now()}`;
          const initialPoints = pointsEarned + loyaltySettings.welcomeBonus;
          let initialTier: 'bronze' | 'silver' | 'gold' | 'vip' = 'bronze';
          if (initialPoints >= loyaltySettings.vipThreshold) initialTier = 'vip';
          else if (initialPoints >= loyaltySettings.goldThreshold) initialTier = 'gold';
          else if (initialPoints >= loyaltySettings.silverThreshold) initialTier = 'silver';

          const newClient: Client = {
            id: matchedClientId,
            salonId: targetApt.salonId,
            name: targetApt.clientName,
            phone: targetApt.clientPhone,
            email: targetApt.clientEmail,
            segment: 'active',
            totalSpent: targetApt.price,
            visitsCount: 1,
            lastVisit: targetApt.date,
            favoriteService: targetApt.serviceName,
            preferredBarber: targetApt.staffName,
            notes: 'Client fidélisé automatiquement',
            loyaltyPoints: initialPoints,
            totalPointsEarned: initialPoints,
            loyaltyTier: initialTier
          };
          return [newClient, ...prev];
        }
      });

      // Record loyalty ledger transaction
      const newLoyaltyTx: LoyaltyTransaction = {
        id: `ltx-${Date.now()}`,
        salonId: targetApt.salonId,
        clientId: matchedClientId || `client-${Date.now()}`,
        clientName: targetApt.clientName,
        clientPhone: targetApt.clientPhone,
        points: pointsEarned,
        type: 'earned_service',
        description: `Prestation "${targetApt.serviceName}" terminée (${formatPrice(targetApt.price)})`,
        appointmentId: targetApt.id,
        createdAt: new Date().toISOString()
      };

      setLoyaltyTransactions((prev) => [newLoyaltyTx, ...prev]);
      addToast(
        `⭐ +${pointsEarned} points de fidélité crédités à ${targetApt.clientName} pour cette prestation !`,
        'success'
      );
    }
  };

  const updateAppointmentDetails = (appointmentId: string, updates: Partial<Appointment>) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, ...updates } : a))
    );
    addToast('Rendez-vous mis à jour avec succès.', 'success');
  };

  const cancelAppointment = (appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: 'cancelled' } : a))
    );
    addToast('Rendez-vous annulé.', 'info');
  };

  // Loyalty Program Handlers
  const addLoyaltyReward = (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => {
    void remote(async () => {
      const created = await salonApi(activeSalon.id).rewards.create({
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
      const saved = await salonApi(activeSalon.id).rewards.update(id, {
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
      await salonApi(activeSalon.id).rewards.remove(id);
      setLoyaltyRewards((prev) => prev.filter((r) => r.id !== id));
      addToast('Récompense supprimée.', 'info');
    }, 'Suppression de la récompense impossible');
  };

  const updateLoyaltySettings = (updates: Partial<LoyaltySettings>) => {
    setLoyaltySettings((prev) => ({ ...prev, ...updates }));
    addToast('Paramètres de fidélité enregistrés.', 'success');
  };

  const redeemRewardForClient = (clientId: string, rewardId: string): { success: boolean; error?: string } => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return { success: false, error: 'Client introuvable.' };

    const reward = loyaltyRewards.find((r) => r.id === rewardId);
    if (!reward) return { success: false, error: 'Récompense introuvable.' };

    const clientPoints = client.loyaltyPoints || 0;
    if (clientPoints < reward.pointsCost) {
      return {
        success: false,
        error: `Solde insuffisant : ${client.name} possède ${clientPoints} pts (coût : ${reward.pointsCost} pts).`
      };
    }

    const nextPoints = clientPoints - reward.pointsCost;

    // Deduct points from client
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, loyaltyPoints: nextPoints } : c))
    );

    // Update reward count
    setLoyaltyRewards((prev) =>
      prev.map((r) => (r.id === rewardId ? { ...r, timesRedeemed: r.timesRedeemed + 1 } : r))
    );

    // Add transaction ledger entry
    const newTx: LoyaltyTransaction = {
      id: `ltx-${Date.now()}`,
      salonId: activeSalonId,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      points: -reward.pointsCost,
      type: 'redeemed_reward',
      description: `Récompense utilisée : ${reward.name}`,
      rewardId: reward.id,
      rewardName: reward.name,
      createdAt: new Date().toISOString()
    };
    setLoyaltyTransactions((prev) => [newTx, ...prev]);

    addToast(
      `🎉 Récompense "${reward.name}" accordée à ${client.name} ! (-${reward.pointsCost} pts, reste : ${nextPoints} pts)`,
      'success'
    );
    return { success: true };
  };

  const creditPointsToClient = (clientId: string, points: number, reason: string) => {
    setClients((prev) => {
      const client = prev.find((c) => c.id === clientId);
      if (!client) return prev;
      const newPoints = (client.loyaltyPoints || 0) + points;
      const newLifetime = (client.totalPointsEarned || 0) + points;
      return prev.map((c) =>
        c.id === clientId ? { ...c, loyaltyPoints: newPoints, totalPointsEarned: newLifetime } : c
      );
    });

    const client = clients.find((c) => c.id === clientId);
    if (client) {
      const newTx: LoyaltyTransaction = {
        id: `ltx-${Date.now()}`,
        salonId: activeSalonId,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        points,
        type: 'manual_adjustment',
        description: reason || 'Ajustement manuel de points',
        createdAt: new Date().toISOString()
      };
      setLoyaltyTransactions((prev) => [newTx, ...prev]);
      addToast(`${points > 0 ? '+' : ''}${points} points pour ${client.name}.`, 'info');
    }
  };

  const recordPayment = ({
    appointmentId,
    clientName,
    amount,
    method,
    type
  }: {
    appointmentId?: string;
    clientName: string;
    amount: number;
    method: PaymentMethod;
    type: 'full' | 'deposit';
  }): PaymentTransaction => {
    const refCode =
      method === 'wave'
        ? `WAVE-CI-${Math.floor(1000000 + Math.random() * 9000000)}`
        : method === 'orange_money'
        ? `OM-CI-${Math.floor(1000000 + Math.random() * 9000000)}`
        : method === 'cash'
        ? `ESP-${new Date().toISOString().slice(5, 10).replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`
        : `PAY-${Math.floor(1000000 + Math.random() * 9000000)}`;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newTx: PaymentTransaction = {
      id: `tx-${Date.now()}`,
      salonId: activeSalonId,
      appointmentId,
      clientName,
      amount,
      method,
      type,
      reference: refCode,
      status: 'completed',
      date: dateStr,
      time: timeStr,
      cashSessionId: cashSession.status === 'open' ? cashSession.id : undefined
    };

    setTransactions((prev) => [newTx, ...prev]);

    // If appointment linked, update appointment
    if (appointmentId) {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId
            ? {
                ...a,
                paymentStatus: type === 'full' ? 'paid' : 'deposit_paid',
                paymentMethod: method,
                status: a.status === 'pending' ? 'confirmed' : a.status
              }
            : a
        )
      );
    }

    // Update active cash session
    if (cashSession.status === 'open') {
      setCashSession((prev) => {
        if (method === 'cash') {
          return {
            ...prev,
            totalCashIn: prev.totalCashIn + amount,
            theoreticalBalance: prev.theoreticalBalance + amount
          };
        } else {
          return {
            ...prev,
            totalMobileMoneyIn: prev.totalMobileMoneyIn + amount
          };
        }
      });
    }

    addToast(`Paiement de ${formatPrice(amount)} enregistré (${refCode})`, 'success');
    return newTx;
  };

  const closeCurrentCashSession = (actualCashAmount: number, notes?: string) => {
    const theoretical = cashSession.theoreticalBalance;
    const discrepancy = actualCashAmount - theoretical;

    setCashSession((prev) => ({
      ...prev,
      closedAt: new Date().toISOString(),
      actualBalance: actualCashAmount,
      discrepancy,
      status: 'closed',
      notes: notes || 'Clôture de journée effectuée'
    }));

    addToast(
      discrepancy === 0
        ? 'Caisse clôturée avec succès sans aucun écart !'
        : `Caisse clôturée. Écart constaté : ${formatPrice(discrepancy)}`,
      discrepancy === 0 ? 'success' : 'info'
    );
  };

  const openNewCashSession = (openingBalance: number) => {
    const newSession: CashSession = {
      id: `sess-${Date.now()}`,
      salonId: activeSalonId,
      openedAt: new Date().toISOString(),
      openingBalance,
      totalCashIn: 0,
      totalMobileMoneyIn: 0,
      totalOut: 0,
      theoreticalBalance: openingBalance,
      status: 'open',
      notes: 'Nouvelle session de caisse démarrée'
    };
    setCashSession(newSession);
    addToast(`Nouvelle session ouverte avec ${formatPrice(openingBalance)} en fond de caisse`, 'success');
  };

  // ----- Prestations (persistées côté serveur) -----
  const addService = (data: Omit<Service, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(activeSalon.id).services.create({
        name: data.name,
        category: data.category,
        description: data.description,
        price: data.price,
        durationMinutes: data.durationMinutes,
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
      const saved = await salonApi(activeSalon.id).services.update(id, {
        name: merged.name,
        category: merged.category,
        description: merged.description,
        price: merged.price,
        durationMinutes: merged.durationMinutes,
        popular: Boolean(merged.popular)
      });
      setServices((prev) => prev.map((s) => (s.id === id ? saved : s)));
      addToast('Prestation mise à jour.', 'success');
    }, 'Modification de la prestation impossible');
  };

  const deleteService = (id: string) => {
    void remote(async () => {
      await salonApi(activeSalon.id).services.remove(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      addToast('Prestation supprimée.', 'info');
    }, 'Suppression de la prestation impossible');
  };

  // ----- Équipe -----
  const addStaff = (data: Omit<StaffMember, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(activeSalon.id).staff.create({
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
      const saved = await salonApi(activeSalon.id).staff.update(id, {
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
    setStaff((prev) => prev.filter((m) => m.id !== id));
    addToast('Collaborateur retiré.', 'info');
  };

  // ----- Clients -----
  const addClient = (data: Omit<Client, 'id' | 'totalSpent' | 'visitsCount' | 'lastVisit'>) => {
    void remote(async () => {
      const created = await salonApi(activeSalon.id).clients.create({
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
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, notes } : c)));
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    void remote(async () => {
      await salonApi(activeSalon.id).clients.update(clientId, {
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        segment: client.segment,
        favoriteService: client.favoriteService,
        notes
      });
      addToast('Fiche client mise à jour.', 'success');
    }, 'Mise à jour de la note impossible');
  };

  const updateClient = (clientId: string, updates: Partial<Client>) => {
    void remote(async () => {
      const current = clients.find((c) => c.id === clientId);
      if (!current) return;
      const merged = { ...current, ...updates };
      const saved = await salonApi(activeSalon.id).clients.update(clientId, {
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
      await salonApi(activeSalon.id).clients.remove(clientId);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      addToast('Client supprimé.', 'info');
    }, 'Suppression du client impossible');
  };

  const updateAppointment = (appointmentId: string, updates: Partial<Appointment>) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, ...updates } : a))
    );
    addToast('Rendez-vous modifié.', 'success');
  };

  const deleteAppointment = (appointmentId: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
    addToast('Rendez-vous supprimé.', 'info');
  };

  const addExpense = (data: Omit<Expense, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(activeSalon.id).expenses.create({
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

  // L'API n'expose pas de suppression de dépense (journal financier) : reste local
  // et signale clairement que l'opération n'est pas persistée.
  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    addToast("Supprimée localement — l'API ne permet pas encore la suppression d'une dépense.", 'info');
  };

  const addStockItem = (data: Omit<StockItem, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(activeSalon.id).stock.create({
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
    setStocks((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
    addToast('Stock ajusté.', 'info');
  };

  const createSalon = (salonData: Partial<Salon>, options?: { seedDemoData?: boolean }): Salon => {
    const newSalon: Salon = {
      name: salonData.name || 'Mon Nouveau Salon',
      slug: (salonData.name || 'nouveau-salon').toLowerCase().replace(/\s+/g, '-'),
      tagline: salonData.tagline || 'Barbershop & Coiffure de prestige',
      description: salonData.description || 'Bienvenue dans notre établissement.',
      type: salonData.type || 'barbershop',
      coverImage: salonData.coverImage || '/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png',
      gallery: [
        salonData.coverImage || '/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png'
      ],
      rating: 5.0,
      reviewCount: 1,
      country: salonData.country || "Côte d'Ivoire",
      city: salonData.city || 'Abidjan',
      commune: salonData.commune || 'Cocody',
      quarter: salonData.quarter || 'Angré',
      address: salonData.address || 'Abidjan',
      phone: salonData.phone || '+225 00 00 00 00 00',
      whatsapp: salonData.whatsapp || salonData.phone || '+225 00 00 00 00 00',
      email: salonData.email || 'contact@salon.ci',
      openingHours: [
        { day: 'Lundi - Samedi', open: '08:30', close: '20:30', isOpen: true },
        { day: 'Dimanche', open: '10:00', close: '18:00', isOpen: true }
      ],
      paymentMethods: salonData.paymentMethods || ['wave', 'orange_money', 'cash'],
      minPrice: salonData.minPrice || 3000,
      currency: 'FCFA',
      nextAvailableSlot: 'Aujourd\'hui 14:00',
      isRecommended: true,
      isPopular: true,
      isVerified: true,
      subscriptionPlanId: 'plan-pro',
      ...salonData,
      id: `salon-${Date.now()}`,
    };

    setSalons((prev) => [newSalon, ...prev]);
    setActiveSalonId(newSalon.id);

    if (options?.seedDemoData !== false) {
    // Create a default staff member for this salon
    const defaultBarber: StaffMember = {
      id: `staff-${Date.now()}`,
      salonId: newSalon.id,
      name: 'Responsable Barbier',
      role: 'master_barber',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      specialties: ['Dégradés', 'Barbe sculptée'],
      rating: 5.0,
      commissionRate: 35,
      phone: newSalon.phone,
      isAvailable: true
    };
    setStaff((prev) => [...prev, defaultBarber]);

    // Create 2 default services
    const defaultSrv1: Service = {
      id: `srv-${Date.now()}-1`,
      salonId: newSalon.id,
      name: 'Coupe classique',
      category: 'coupe',
      description: 'Coupe soignée ciseaux et tondeuse, finitions au rasoir.',
      price: newSalon.minPrice,
      durationMinutes: 30,
      popular: true
    };
    const defaultSrv2: Service = {
      id: `srv-${Date.now()}-2`,
      salonId: newSalon.id,
      name: 'Taille & Soin Barbe',
      category: 'barbe',
      description: 'Sculpture barbe à l\'ancienne et serviette chaude.',
      price: 2500,
      durationMinutes: 25,
      popular: true
    };
    setServices((prev) => [...prev, defaultSrv1, defaultSrv2]);
    }
    setIsRegisteredInErp(true);

    addToast(`Salon « ${newSalon.name} » configuré dans cette démonstration.`, 'success');
    return newSalon;
  };

  const updateSalonDetails = (salonId: string, updates: Partial<Salon>) => {
    setSalons((prev) => prev.map((s) => (s.id === salonId ? { ...s, ...updates } : s)));
    addToast('Informations du salon mises à jour avec succès.', 'success');
  };

  const upgradePlan = (salonId: string, planId: string, paymentMethod: PaymentMethod) => {
    setSalons((prev) =>
      prev.map((s) => (s.id === salonId ? { ...s, subscriptionPlanId: planId } : s))
    );
    const planNames: Record<string, string> = {
      'plan-starter': 'Starter',
      'plan-pro': 'Pro',
      'plan-business': 'Business Multi-salons'
    };
    addToast(
      `Abonnement ${planNames[planId] || planId} activé via ${paymentMethod.toUpperCase()} !`,
      'success'
    );
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        userRole,
        setUserRole,
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
        isRegisterSalonOpen,
        setIsRegisterSalonOpen,
        authStartView,
        setAuthStartView,
        isClientAppointmentsOpen,
        setIsClientAppointmentsOpen,
        isOnboardingOpen,
        setIsOnboardingOpen,
        isRegisteredInErp,
        setIsRegisteredInErp,
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
        createSalon,
        updateSalonDetails,
        upgradePlan,
        formatPrice,
        checkSlotAvailability
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
