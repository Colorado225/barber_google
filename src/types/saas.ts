// Types SaaS : forfaits, abonnements et métriques plateforme (console Super Admin).

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
