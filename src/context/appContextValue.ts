// Contrat public du contexte applicatif (extrait de l'ancien AppContext.tsx
// monolithique) : valeur de contexte, type ERP et états initiaux de test.
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
import type { PublicBooking, PublicBookingInput } from '../lib/marketplace';
import type { AppMode, Toast } from './UIContext';
import type { DashboardMetricsParams } from './domains/FinanceDomainContext';

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

export type AppContextType = Omit<AppContextValue, 'activeSalon'> & { activeSalon: Salon };
