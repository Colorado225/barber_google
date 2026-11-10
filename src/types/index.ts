export type SalonType = 'barbershop' | 'salon_femme' | 'salon_mixte' | 'institut';

export type PaymentMethod = 'wave' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'cash' | 'card';

export interface OpeningHour {
  day: string;
  open: string;
  close: string;
  isOpen: boolean;
}

export interface SalonGalleryItem {
  id: string;
  url: string;
  title: string;
  description: string;
  isCover?: boolean;
}

export interface Salon {
  id: string;
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  type?: SalonType;
  timezone?: string;
  logo?: string;
  coverImage?: string;
  gallery?: string[];
  galleryItems?: SalonGalleryItem[];
  rating?: number;
  reviewCount?: number;
  country?: string;
  city?: string;
  commune?: string;
  quarter?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  openingHours?: OpeningHour[];
  paymentMethods?: PaymentMethod[];
  minPrice?: number;
  currency?: string;
  nextAvailableSlot?: string;
  isRecommended?: boolean;
  isPopular?: boolean;
  isVerified?: boolean;
  verifiedAt?: string;
  status?: 'active' | 'suspended';
  suspendedAt?: string;
  suspensionReason?: string;
  isPublishedOnMarketplace?: boolean;
  featuredPrestations?: string[];
  publicationDate?: string;
  subscriptionPlanId?: string;
  ownerName?: string;
  /** Fiche fictive du mode démonstration (VITE_MARKETPLACE_DEMO=true). Jamais un salon réel. */
  isDemo?: boolean;
}

export type ServiceCategory = 'coupe' | 'barbe' | 'tresses' | 'soins' | 'coloration' | 'visage' | 'combo';

export interface Service {
  id: string;
  salonId: string;
  name: string;
  category: ServiceCategory;
  description: string;
  price: number;
  durationMinutes: number;
  /** Temps de préparation éventuel (0 par défaut), ignoré dans le calcul métier pour l'instant. */
  prepMinutes?: number;
  popular?: boolean;
  /** Une prestation inactive reste dans l'historique mais n'est plus réservable. */
  isActive?: boolean;
}

export type StaffRole = 'master_barber' | 'barber' | 'colorist' | 'stylist' | 'manager';

export interface StaffMember {
  id: string;
  salonId: string;
  name: string;
  role: StaffRole;
  avatar?: string;
  specialties: string[];
  rating?: number;
  commissionRate: number; // e.g. 30%
  phone: string;
  /** Email facultatif : un employé n'a pas nécessairement de compte de connexion. */
  email?: string;
  /** Succursale d'affectation (null = toutes). */
  branchId?: string | null;
  isAvailable: boolean;
  /** Statut actif/inactif du profil métier. */
  isActive?: boolean;
  /** Prestations maîtrisées. */
  serviceIds?: string[];
  /** Identité de connexion éventuelle, distincte du profil métier. */
  userId?: string | null;
}

export type AppointmentStatus =
  'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'refunded';

export interface Appointment {
  id: string;
  salonId: string;
  branchId?: string;
  clientId?: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  serviceName: string;
  price: number;
  staffId: string | null;
  staffName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  source: 'marketplace' | 'direct' | 'whatsapp' | 'phone' | 'walk_in';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  /** Horodatages serveur (source de vérité du calendrier). */
  startsAt?: string;
  endsAt?: string;
  /** Clients de passage : arrivée, début et fin réels de la prestation. */
  arrivalAt?: string;
  serviceStartedAt?: string;
  serviceCompletedAt?: string;
}

export type ClientSegment = 'new' | 'active' | 'loyal' | 'vip' | 'inactive' | 'to_reactivate';

export interface Client {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  email?: string;
  segment: ClientSegment;
  totalSpent?: number;
  visitsCount?: number;
  lastVisit?: string;
  favoriteService: string;
  preferredBarber?: string;
  notes: string;
  loyaltyPoints?: number;
  totalPointsEarned?: number;
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'vip';
}

export type PaymentEntryKind = 'payment' | 'refund' | 'payment_reversal' | 'refund_reversal';
export type PaymentSettlementMode = 'cash_drawer' | 'manual_confirmed' | 'manual_rejected';

export interface PaymentTransaction {
  id: string;
  salonId: string;
  branchId?: string;
  appointmentId?: string;
  appointmentAmount?: number;
  serviceName?: string;
  clientName: string;
  amount: number;
  method: PaymentMethod;
  kind: PaymentEntryKind;
  type: 'full' | 'deposit' | 'balance';
  reference: string;
  providerReference?: string;
  status: 'completed' | 'pending' | 'cancelled';
  date: string;
  time: string;
  createdAt?: string;
  cashSessionId?: string;
  originalEntryId?: string;
  reason?: string;
  settlementMode?: PaymentSettlementMode;
  settlementNote?: string;
}

export interface CashSession {
  id: string;
  salonId: string;
  branchId: string;
  registerId: string;
  registerName?: string;
  openedAt: string;
  closedAt?: string;
  reconciledAt?: string;
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  totalMobileMoneyIn: number;
  totalMobileMoneyOut: number;
  totalOut: number;
  theoreticalBalance: number;
  expectedBalance?: number;
  actualBalance?: number;
  countedBalance?: number;
  discrepancy?: number;
  difference?: number;
  status: 'open' | 'closed' | 'reconciled';
  openingNote?: string;
  closingNote?: string;
  reconciliationNote?: string;
  notes?: string;
}

export interface FinancialSummary {
  revenueBilled: number;
  revenueCollected: number;
  outstanding: number;
  refunds: number;
  expenses: number;
  netBalance: number;
  pendingAmount: number;
  paymentCount: number;
  byMethod: Record<string, number>;
}

export interface AppointmentBalance {
  appointmentId: string;
  billed: number;
  collected: number;
  outstanding: number;
  pending: number;
  refunded: number;
}

export type ExpenseCategory =
  'rent' | 'electricity' | 'water' | 'salaries' | 'products' | 'maintenance' | 'marketing' | 'other';

export type ExpenseEntryKind = 'expense' | 'expense_reversal';
export type ExpenseStatus = 'active' | 'reversed' | 'superseded';

export interface Expense {
  id: string;
  salonId: string;
  branchId?: string | null;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  /** Champ historique d'affichage ; non persisté par le journal Supabase. */
  paymentMethod?: PaymentMethod;
  notes?: string;
  receiptRef?: string;
  entryKind?: ExpenseEntryKind;
  originalExpenseId?: string | null;
  status?: ExpenseStatus;
  supplierId?: string | null;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
  reason?: string;
  reversedAt?: string | null;
  reversedBy?: string | null;
  createdBy?: string;
  createdAt?: string;
}

export interface ExpenseEvent {
  id: string;
  salonId: string;
  expenseId: string;
  eventType: 'recorded' | 'attachment_updated' | 'reversed' | 'corrected';
  amount: number;
  reason: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Supplier {
  id: string;
  salonId: string;
  name: string;
  contactName: string;
  phone: string;
  email?: string;
  address: string;
  notes: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type StockCategory = 'shampoing' | 'gel_cire' | 'huile_barbe' | 'lames' | 'soin' | 'accessoires';

export type StockMovementType =
  'initial' | 'restock' | 'sale' | 'service_use' | 'loss' | 'adjustment' | 'return';

export interface StockItem {
  id: string;
  salonId: string;
  name: string;
  category: StockCategory;
  quantity: number;
  minThreshold: number;
  unitCost: number;
  sellingPrice?: number;
  supplierId?: string | null;
  supplier: string;
  lastRestock?: string;
  isActive?: boolean;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  salonId: string;
  branchId?: string | null;
  stockItemId: string;
  stockItemName?: string;
  supplierId?: string | null;
  supplierName?: string;
  movementType: StockMovementType;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost?: number | null;
  reason: string;
  reference?: string;
  appointmentId?: string | null;
  actorId?: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  salonId: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
  isHidden?: boolean;
  moderatedAt?: string;
  moderationReason?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonth: number;
  priceYear: number;
  isPopular?: boolean;
  features: string[];
  limits: {
    staff: number;
    branches: number;
    appointmentsPerMonth: number;
    inventory: boolean;
    whatsappAutomations: boolean;
  };
}

export type RewardCategory = 'free_service' | 'discount' | 'product' | 'vip_upgrade';

export interface LoyaltyReward {
  id: string;
  salonId: string;
  name: string;
  description: string;
  pointsCost: number;
  category: RewardCategory;
  isActive: boolean;
  timesRedeemed?: number;
  discountPercentage?: number;
  freeServiceName?: string;
  createdAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  salonId: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  points: number; // positive for earn, negative for redeem
  type: 'earned_service' | 'redeemed_reward' | 'welcome_bonus' | 'manual_adjustment' | 'reversal';
  description: string;
  rewardId?: string;
  rewardName?: string;
  appointmentId?: string;
  createdAt: string;
}

// Solde de fidélité tenu par la base (journal append-only), jamais par le navigateur.
export interface LoyaltyAccount {
  salonId: string;
  clientId: string;
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  tier: 'bronze' | 'silver' | 'gold' | 'vip';
  updatedAt: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  salonId: string;
  clientId: string;
  appointmentId?: string | null;
  rewardId?: string | null;
  kind: 'earned_service' | 'redeemed_reward' | 'welcome_bonus' | 'manual_adjustment' | 'reversal';
  points: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

export type NotificationChannel = 'email' | 'whatsapp' | 'sms';
export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface AppointmentNotification {
  id: string;
  salonId: string;
  appointmentId: string;
  channel: NotificationChannel;
  kind: 'booking_received' | 'booking_confirmed' | 'booking_cancelled' | 'reminder_24h' | 'review_request';
  recipient: string;
  status: NotificationStatus;
  scheduledAt: string;
  createdAt: string;
  sentAt?: string | null;
  error?: string | null;
  attempts: number;
  failureCount?: number;
  lastError?: string | null;
  providerMessageId?: string | null;
}

export interface NotificationCapabilities {
  email: {
    provider: string;
    supported: boolean;
    configured: boolean;
    hasApiKey: boolean;
    hasSender: boolean;
  };
  whatsapp: {
    provider: string;
    supported: boolean;
    configured: boolean;
    hasToken: boolean;
    hasPhoneNumberId: boolean;
    hasBusinessAccountId: boolean;
    templateModeEnabled: boolean;
    templatePrefixConfigured: boolean;
    templateLang: string;
    defaultCountryCode: string;
    expectedTemplates: string[];
  };
  sms: {
    provider: null | string;
    supported: false;
    configured: false;
    reason: string;
    message: string;
  };
  scheduler: {
    dispatchTokenConfigured: boolean;
    publicAppUrlConfigured: boolean;
  };
}

export interface WhatsappAuditResult {
  checked: boolean;
  phoneVerified: boolean;
  verifiedName?: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  templatesChecked: boolean;
  approvedTemplates: Array<{ name: string; status: string; language: string }>;
  missingTemplates: string[];
  error?: string | null;
}

export interface NotificationProbeResult {
  service: string;
  ok: boolean;
  providerConfigured: boolean;
  capabilities: NotificationCapabilities;
  whatsappAudit: WhatsappAuditResult | null;
  checkedAt: string;
}

export interface NotificationChannelHealth {
  supported: boolean;
  unavailableReason?: string;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  repeatedFailures: number;
  latestError: string | null;
}

export interface NotificationSchedulerHealth {
  configured: boolean;
  isEnabled: boolean;
  hasDispatchToken: boolean;
  hasEndpoint: boolean;
  batchSize: number;
  updatedAt: string | null;
  cronAvailable: boolean;
  cronScheduled: boolean;
  cronActive: boolean;
  cronSchedule: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastReturnMessage: string | null;
  httpAvailable: boolean;
  lastHttpStatus: number | null;
  lastHttpError: string | null;
  lastHttpAt: string | null;
  lastHttpPreview: string | null;
}

export interface NotificationDispatchRunRecord {
  id: string;
  salonId: string | null;
  triggerSource: 'cron' | 'manual' | 'probe';
  providerConfigured: boolean;
  emailConfigured: boolean;
  whatsappConfigured: boolean;
  whatsappTemplateMode: boolean;
  smsSupported: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  error: string | null;
  createdAt: string;
}

export interface NotificationHealthSummary {
  salonId: string;
  counts: {
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    skipped: number;
    total: number;
  };
  repeatedFailures: number;
  exhaustedFailures: number;
  recentFailures24h: number;
  overduePending: number;
  stuckSending: number;
  byChannel: {
    email: NotificationChannelHealth;
    whatsapp: NotificationChannelHealth;
    sms: NotificationChannelHealth;
  };
  repeatedFailureItems: Array<{
    id: string;
    channel: NotificationChannel;
    kind: AppointmentNotification['kind'];
    recipient: string;
    attempts: number;
    failureCount: number;
    lastAttemptAt: string | null;
    error: string | null;
  }>;
  scheduler: NotificationSchedulerHealth;
  lastRun: NotificationDispatchRunRecord | null;
  lastSalonRun: NotificationDispatchRunRecord | null;
  smsUnavailableReason: string;
}

export interface PlatformNotificationHealthSummary {
  counts: {
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    skipped: number;
    total: number;
  };
  repeatedFailures: number;
  exhaustedFailures: number;
  recentFailures24h: number;
  overduePending: number;
  stuckSending: number;
  byChannel: {
    email: NotificationChannelHealth;
    whatsapp: NotificationChannelHealth;
    sms: NotificationChannelHealth;
  };
  salonsWithIssues: Array<{
    salonId: string;
    salonName: string;
    failedCount: number;
    repeatedFailures: number;
    recentFailures24h: number;
    overduePending: number;
    latestError: string | null;
  }>;
  scheduler: NotificationSchedulerHealth;
  lastRun: NotificationDispatchRunRecord | null;
  smsUnavailableReason: string;
}

export interface NotificationAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  code:
    | 'repeated_failures'
    | 'failure_burst'
    | 'stuck_sending'
    | 'scheduler_error'
    | 'overdue_pending'
    | 'provider_missing'
    | 'whatsapp_template_disabled'
    | 'sms_unavailable';
  title: string;
  description: string;
  count?: number;
}

export interface NotificationDispatchResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  providerConfigured: boolean;
  capabilities?: NotificationCapabilities;
}

export interface LoyaltySettings {
  salonId: string;
  pointsPer100Fcfa: number; // e.g. 1 point for every 100 FCFA spent
  welcomeBonus: number; // e.g. 25 points
  silverThreshold: number; // e.g. 100 points
  goldThreshold: number; // e.g. 250 points
  vipThreshold: number; // e.g. 500 points
  programEnabled: boolean;
}

export type SalonMarketplaceSectionId =
  'hero' | 'gallery' | 'featured_services' | 'team' | 'trust' | 'location_hours' | 'reviews';

export type SalonMarketplaceLayout = 'classic' | 'elegant' | 'editorial';

export type SalonCardStyle = 'rounded-3xl' | 'rounded-2xl' | 'rounded-xl';

export interface SalonMarketplaceSection {
  id: SalonMarketplaceSectionId;
  enabled: boolean;
  position: number;
}

export interface SalonMarketplaceViewConfig {
  layout: SalonMarketplaceLayout;
  accentColor: string;
  cardStyle?: SalonCardStyle;
  sections: SalonMarketplaceSection[];
  featuredServiceIds: string[];
  visibleStaffIds: string[];
  featuredGalleryImageIds: string[];
  showAddress: boolean;
  showPhone: boolean;
  showWhatsapp: boolean;
  customTagline?: string;
  customDescription?: string;
  themeMode?: 'dark' | 'light' | 'auto';
  featuredBranchId?: string;
}

/** Fiche publique complète d'un salon sur la marketplace (données ERP réelles). */
export interface PublicSalonDetail {
  salon: Salon;
  services: Service[];
  staff: Pick<StaffMember, 'id' | 'name' | 'role' | 'specialties' | 'serviceIds'>[];
  reviews: Review[];
  branches: {
    id: string;
    name: string;
    timezone: string;
    hours: { weekday: number; isOpen: boolean; opensAt: string | null; closesAt: string | null }[];
  }[];
  rating: number | null;
  reviewCount: number;
  minPrice: number | null;
  customizer?: SalonMarketplaceViewConfig;
}

export interface SalonMarketplaceSettingsRecord {
  salonId: string;
  layout: SalonMarketplaceLayout;
  accentColor: string;
  cardStyle: SalonCardStyle;
  draftConfig: SalonMarketplaceViewConfig;
  publishedConfig: SalonMarketplaceViewConfig | null;
  isPublished: boolean;
  publishedAt?: string | null;
  updatedAt: string;
}

/** Forfait d'abonnement SaaS de la plateforme. */
export interface SaaSPlan {
  id: string;
  name: string;
  slug: string;
  priceXof: number;
  billingPeriod: 'monthly' | 'yearly';
  description: string;
  features: string[];
  maxStaff: number | null;
  maxBranches: number;
  isPopular: boolean;
  isActive: boolean;
  badgeText?: string | null;
  displayOrder: number;
  subscribersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Abonnement effectif d'un salon avec instantané tarifaire garanti (grandfathered). */
export interface SaaSSubscription {
  id: string;
  salonId: string;
  planId: string;
  status: 'pending_payment' | 'trialing' | 'active' | 'past_due' | 'cancelled';
  priceAtSubscription: number;
  billingPeriod: 'monthly' | 'yearly';
  featuresSnapshot: string[];
  startedAt: string;
  currentPeriodEnd: string;
  cancelledAt?: string | null;
  plan?: {
    id: string;
    name: string;
    slug: string;
    currentPriceXof: number;
    description: string;
    features: string[];
    badgeText?: string | null;
    maxStaff: number | null;
    maxBranches: number;
  };
}

/** Métriques globales d'exploitation pour la console Super Admin (séparées par nature, période et statut). */
export interface PlatformMetrics {
  periodFrom: string | null;
  periodTo: string | null;
  timezone: string;
  totalSalons: number;
  publishedSalons: number;
  suspendedSalons?: number;
  verifiedSalons?: number;
  activeSubscriptions: number;
  estimatedMrrXof: number;
  monthlyMrrXof: number;
  yearlyMrrXof: number;
  annualRunRateXof: number;
  subscriptionsByStatus: {
    active: number;
    trialing: number;
    pendingPayment: number;
    pastDue: number;
    cancelled: number;
  };
  subscriptionsByBillingPeriod: {
    monthly: number;
    yearly: number;
  };
  saasCollectedRevenueXof: number;
  saasConfirmedPaymentsCount: number;
  saasPendingPaymentsXof: number;
  saasPendingPaymentsCount: number;
  saasRejectedPaymentsXof: number;
  saasRejectedPaymentsCount: number;
  plansCount: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  totalAppointments: number;
  appointmentsByStatus: {
    pending: number;
    confirmed: number;
    checkedIn: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  totalRevenueXof: number;
  collectedNetRevenueXof: number;
  collectedGrossRevenueXof: number;
  refundsXof: number;
  paymentReversalsXof: number;
  refundReversalsXof: number;
  pendingPaymentsXof: number;
  pendingPaymentsCount: number;
  failedPaymentsXof: number;
  failedPaymentsCount: number;
  confirmedPaymentsCount: number;
  refundsCount: number;
  hiddenReviews?: number;
}

export interface ErpBranch {
  id: string;
  name: string;
  timezone?: string;
}

export type ErpDashboardPeriod = 'month' | '30d' | 'month_weeks' | '6m' | '12m' | 'year';

export interface ErpDashboardKpis {
  revenueCollectedNet: number | null;
  revenueCollectedGross: number | null;
  refunds: number | null;
  paymentReversals: number | null;
  refundReversals: number | null;
  pendingPaymentsAmount: number | null;
  confirmedPaymentCount: number | null;
  averageBasket: number | null;
  revenueBilled: number | null;
  revenueRealized: number | null;
  outstanding: number | null;
  expensesNet: number | null;
  netMargin: number | null;
  appointmentsTotal: number;
  appointmentsActive: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;
  appointmentsNoShow: number;
  todayAppointmentsActive: number;
  todayAppointmentsCompleted: number;
  todayAppointmentsInProgress: number;
  todayAppointmentsCancelled: number;
  todayAppointmentsNoShow: number;
}

export interface ErpDashboardMonthlyPoint {
  month: string;
  fromDate: string;
  toDate: string;
  revenueCollected: number | null;
  revenueBilled: number | null;
  revenueRealized: number | null;
  expenses: number | null;
  margin: number | null;
  completedAppointments: number;
  activeAppointments: number;
  cancelledAppointments: number;
}

export interface ErpDashboardWeeklyPoint {
  label: string;
  shortLabel: string;
  fromDate: string;
  toDate: string;
  revenueCollected: number | null;
  revenueBilled: number | null;
  revenueRealized: number | null;
  expenses: number | null;
  margin: number | null;
  completedAppointments: number;
  activeAppointments: number;
}

export interface ErpDashboardServiceStat {
  serviceId: string;
  name: string;
  category: ServiceCategory;
  price: number;
  durationMinutes: number;
  completedVolume: number;
  completedRevenue: number;
  billedVolume: number;
  billedRevenue: number;
  cancelledVolume: number;
  noShowVolume: number;
}

export interface ErpDashboardStaffStat {
  staffId: string;
  name: string;
  commissionRate: number;
  completedAppointments: number;
  completedRevenue: number;
  billedAppointments: number;
  billedRevenue: number;
  cancelledAppointments: number;
  noShowAppointments: number;
}

export interface ErpDashboardHourlySlot {
  hour: string;
  occupiedMinutes: number;
  availableMinutes: number;
  occupancyRate: number;
  activeAppointments: number;
  completedAppointments: number;
}

export interface ErpDashboardMetrics {
  periodFrom: string;
  periodTo: string;
  timezone: string;
  today: string;
  dayFilter: 'all' | 'saturday' | 'friday' | 'weekday';
  configuredStaffCount: number;
  permissions: {
    canViewFinance: boolean;
    canViewExpenses: boolean;
    canViewAppointments: boolean;
  };
  kpis: ErpDashboardKpis;
  byMethod: Record<string, number>;
  monthlySeries: ErpDashboardMonthlyPoint[];
  weeklySeries: ErpDashboardWeeklyPoint[];
  servicePerformance: ErpDashboardServiceStat[];
  staffActivity: ErpDashboardStaffStat[];
  hourlyOccupancy: ErpDashboardHourlySlot[];
}

export type RealtimeSyncStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
