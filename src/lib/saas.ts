import type { SaaSPlan, SaaSSubscription, PlatformMetrics } from '../types';
import {
  HONEST_CASH_RECONCILIATION_FEATURE,
  HONEST_COMMISSION_FEATURE,
  HONEST_MARKETPLACE_SHOWCASE_FEATURE,
  HONEST_MULTI_BRANCH_FEATURE,
  HONEST_PRESTIGE_SUPPORT_FEATURE,
  HONEST_REPORTS_FEATURE,
  NOTIFICATION_CHANNEL_HONEST_FEATURE,
  normalizeSaasPlanFeatures,
} from './notifications';
import { normalizeSaasBillingPeriod, type SaasBillingPeriod } from './saasPricing';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

const DEFAULT_PLANS: SaaSPlan[] = [
  {
    id: 'starter',
    name: 'Starter Solo',
    slug: 'starter',
    priceXof: 15000,
    billingPeriod: 'monthly',
    description: 'Idéal pour barbier solo ou débutant qui lance son activité avec une gestion rigoureuse.',
    features: [
      '1 barbier / 1 fauteuil',
      'Planning et réservations illimités',
      'Caisse & encaissements (Espèces + Mobile Money)',
      'Fichier clients CRM & historique',
      'Fiche de présence sur la Marketplace',
      'Lien & QR code de réservation',
    ],
    maxStaff: 1,
    maxBranches: 1,
    isPopular: false,
    isActive: true,
    badgeText: 'Solo & Débutant',
    displayOrder: 1,
    subscribersCount: 1,
  },
  {
    id: 'pro',
    name: 'Pro Équipe',
    slug: 'pro',
    priceXof: 35000,
    billingPeriod: 'monthly',
    description:
      'Le choix de référence pour les salons en pleine croissance cherchant à maximiser leur rentabilité.',
    features: [
      "Jusqu'à 5 barbiers",
      HONEST_COMMISSION_FEATURE,
      'Module Clients de passage (Walk-in en direct)',
      'Programme de fidélité et récompenses automatisé',
      'Personnalisation complète de la vitrine (3 thèmes)',
      NOTIFICATION_CHANNEL_HONEST_FEATURE,
      'Gestion des dépenses et alertes de stock bas',
    ],
    maxStaff: 5,
    maxBranches: 1,
    isPopular: true,
    isActive: true,
    badgeText: 'Plus Populaire',
    displayOrder: 2,
    subscribersCount: 2,
  },
  {
    id: 'prestige',
    name: 'Prestige & Chaînes',
    slug: 'prestige',
    priceXof: 75000,
    billingPeriod: 'monthly',
    description: 'Conçu pour les barbershops haut de gamme et les chaînes multi-établissements.',
    features: [
      'Barbiers et fauteuils illimités',
      HONEST_MULTI_BRANCH_FEATURE,
      HONEST_REPORTS_FEATURE,
      HONEST_CASH_RECONCILIATION_FEATURE,
      HONEST_MARKETPLACE_SHOWCASE_FEATURE,
      HONEST_PRESTIGE_SUPPORT_FEATURE,
    ],
    maxStaff: null,
    maxBranches: 5,
    isPopular: false,
    isActive: true,
    badgeText: 'Haut de Gamme',
    displayOrder: 3,
    subscribersCount: 0,
  },
];

const LOCAL_STORAGE_KEY_PLANS = 'barbercuts_saas_plans';

function getLocalPlans(): SaaSPlan[] {
  if (typeof window === 'undefined') return DEFAULT_PLANS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PLANS);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(DEFAULT_PLANS));
      return DEFAULT_PLANS;
    }
    const parsed = JSON.parse(raw) as SaaSPlan[];
    return parsed.map((plan) => ({
      ...plan,
      features: normalizeSaasPlanFeatures(Array.isArray(plan.features) ? plan.features : []),
    }));
  } catch {
    return DEFAULT_PLANS;
  }
}

function setLocalPlans(plans: SaaSPlan[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(plans));
    window.dispatchEvent(new CustomEvent('saas_plans_updated'));
  } catch {
    // ignore
  }
}

/** Champs éditables d'un forfait (sans les compteurs calculés par le serveur). */
export type SaaSPlanInput = Omit<SaaSPlan, 'subscribersCount' | 'createdAt' | 'updatedAt'>;

/** Brouillon en attente : version non publiée d'un forfait, visible uniquement du super administrateur. */
export interface SaaSPlanDraft {
  planId: string;
  plan: SaaSPlanInput;
  updatedAt: string;
}

export type SaaSPlanSaveStatus = 'published' | 'draft' | 'local';

function planFromRow(row: Record<string, unknown>): SaaSPlan {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    priceXof: Number(row.price_xof),
    billingPeriod: (row.billing_period as 'monthly' | 'yearly') || 'monthly',
    description: String(row.description || ''),
    features: normalizeSaasPlanFeatures(Array.isArray(row.features) ? (row.features as string[]) : []),
    maxStaff: row.max_staff ? Number(row.max_staff) : null,
    maxBranches: Number(row.max_branches || 1),
    isPopular: Boolean(row.is_popular),
    isActive: Boolean(row.is_active),
    badgeText: row.badge_text ? String(row.badge_text) : null,
    displayOrder: Number(row.display_order || 0),
  };
}

function planToPayload(plan: SaaSPlanInput): Record<string, unknown> {
  return {
    name: plan.name,
    slug: plan.slug,
    price_xof: plan.priceXof,
    billing_period: plan.billingPeriod,
    description: plan.description,
    features: plan.features,
    max_staff: plan.maxStaff,
    max_branches: plan.maxBranches,
    is_popular: plan.isPopular,
    is_active: plan.isActive,
    badge_text: plan.badgeText ?? null,
    display_order: plan.displayOrder,
  };
}

function planFromPayload(planId: string, payload: Record<string, unknown>): SaaSPlanInput {
  return {
    id: planId,
    name: String(payload.name ?? ''),
    slug: String(payload.slug ?? ''),
    priceXof: Number(payload.price_xof ?? 0),
    billingPeriod: (payload.billing_period as 'monthly' | 'yearly') || 'monthly',
    description: String(payload.description ?? ''),
    features: normalizeSaasPlanFeatures(
      Array.isArray(payload.features) ? (payload.features as string[]) : [],
    ),
    maxStaff:
      payload.max_staff === null || payload.max_staff === undefined ? null : Number(payload.max_staff),
    maxBranches: Number(payload.max_branches ?? 1),
    isPopular: Boolean(payload.is_popular),
    isActive: payload.is_active === undefined ? true : Boolean(payload.is_active),
    badgeText: payload.badge_text ? String(payload.badge_text) : null,
    displayOrder: Number(payload.display_order ?? 0),
  };
}

function notifyPlansUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('saas_plans_updated'));
}

/**
 * Forfaits affichés publiquement (page Tarifs).
 * Avec Supabase configuré, la lecture ne retombe jamais sur le stockage du navigateur : une erreur est remontée.
 */
export async function getSaasPlans(): Promise<SaaSPlan[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient().rpc('get_saas_plans');
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => planFromRow(row));
  }

  return getLocalPlans().filter((p) => p.isActive);
}

/**
 * Tous les forfaits (y compris inactifs et compteurs d'abonnés) pour la console Super Admin.
 */
export async function getAllSaasPlans(): Promise<SaaSPlan[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient().rpc('get_all_saas_plans');
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
      ...planFromRow(row),
      subscribersCount: row.subscribers_count ? Number(row.subscribers_count) : 0,
    }));
  }

  return getLocalPlans();
}

/**
 * Enregistre un forfait et le publie immédiatement sur la page Tarifs.
 * Conservé pour les appelants existants ; l'éditeur utilise saveSaasPlanWorkflow.
 */
export async function saveSaasPlan(plan: SaaSPlan): Promise<SaaSPlan> {
  await saveSaasPlanWorkflow(plan, true);
  return plan;
}

/**
 * Enregistre une modification de forfait.
 * - publish = true : visible immédiatement sur la page Tarifs (et pour les nouveaux souscripteurs).
 * - publish = false : enregistrée en brouillon, la version publiée ne change pas.
 * Les abonnements existants conservent leur tarif d'origine dans les deux cas.
 * Sans Supabase configuré (développement local), la modification est seulement enregistrée dans ce navigateur.
 */
export async function saveSaasPlanWorkflow(
  plan: SaaSPlanInput,
  publish: boolean,
): Promise<SaaSPlanSaveStatus> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient().rpc('save_saas_plan_workflow', {
      p_id: plan.id,
      p_payload: planToPayload(plan),
      p_publish: publish,
    });
    if (error) throw new Error(error.message);
    notifyPlansUpdated();
    return publish ? 'published' : 'draft';
  }

  const local = getLocalPlans();
  const index = local.findIndex((p) => p.id === plan.id);
  const now = new Date().toISOString();
  if (index >= 0) {
    local[index] = { ...plan, updatedAt: now };
  } else {
    local.push({ ...plan, createdAt: now, updatedAt: now });
  }
  setLocalPlans(local);
  return 'local';
}

/** Brouillons en attente (super administrateur uniquement). */
export async function getSaasPlanDrafts(): Promise<SaaSPlanDraft[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseClient().rpc('get_saas_plan_drafts');
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => {
    const planId = String(row.plan_id);
    return {
      planId,
      plan: planFromPayload(planId, (row.payload ?? {}) as Record<string, unknown>),
      updatedAt: String(row.updated_at),
    };
  });
}

/** Publie le brouillon d'un forfait sur la page Tarifs. */
export async function publishSaasPlanDraft(planId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('publish_saas_plan_draft', { p_id: planId });
  if (error) throw new Error(error.message);
  notifyPlansUpdated();
}

/** Abandonne le brouillon d'un forfait ; la version publiée reste inchangée. */
export async function discardSaasPlanDraft(planId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('discard_saas_plan_draft', { p_id: planId });
  if (error) throw new Error(error.message);
  notifyPlansUpdated();
}

export type SaaSPaymentMethod = 'mobile_money' | 'bank_transfer' | 'cash' | 'other';

export interface PendingSaaSSubscription {
  id: string;
  planId: string;
  planName: string;
  priceXof: number;
  billingPeriod: 'monthly' | 'yearly';
  createdAt: string;
  payment: {
    id: string;
    method: SaaSPaymentMethod;
    reference: string;
    status: 'pending' | 'confirmed' | 'rejected';
    declaredAt: string;
    decisionReason: string | null;
  } | null;
}

export interface SaaSPaymentReviewItem {
  id: string;
  salonId: string;
  salonName: string;
  planId: string;
  planName: string;
  billingPeriod?: SaasBillingPeriod;
  amountXof: number;
  method: SaaSPaymentMethod;
  reference: string;
  declaredAt: string;
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('Abonnements indisponibles : la base de données n’est pas configurée.');
  }
}

function subscriptionFromRpc(data: Record<string, unknown>, plan: SaaSPlan | undefined): SaaSSubscription {
  return {
    id: String(data.id),
    salonId: String(data.salon_id),
    planId: String(data.plan_id),
    status: (data.status as SaaSSubscription['status']) || 'pending_payment',
    priceAtSubscription: Number(data.price_at_subscription),
    billingPeriod: (data.billing_period as 'monthly' | 'yearly') || 'monthly',
    featuresSnapshot: Array.isArray(data.features_snapshot) ? (data.features_snapshot as string[]) : [],
    startedAt: String(data.started_at),
    currentPeriodEnd: String(data.current_period_end),
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          currentPriceXof: plan.priceXof,
          description: plan.description,
          features: plan.features,
          badgeText: plan.badgeText,
          maxStaff: plan.maxStaff,
          maxBranches: plan.maxBranches,
        }
      : undefined,
  };
}

/**
 * Demande la souscription d'un salon à un forfait (propriétaire uniquement).
 * La demande reste « pending_payment » : rien n'est activé tant qu'un paiement n'a pas été validé
 * par le super administrateur. Aucun repli local : sans base de données, l'opération échoue.
 *
 * Lorsque `billingPeriod` est fourni ('monthly' | 'yearly'), le serveur valide la période et
 * applique la remise annuelle (-15 %) si le forfait est configuré au mois.
 */
export async function subscribeSalonToPlan(
  salonId: string,
  planId: string,
  billingPeriod?: SaasBillingPeriod,
): Promise<SaaSSubscription> {
  requireSupabase();
  // Forfaits publics actifs : get_all_saas_plans est réservé au super administrateur.
  const allPlans = await getSaasPlans();
  const targetPlan = allPlans.find((p) => p.id === planId);
  if (!targetPlan) {
    throw new Error("Ce forfait d'abonnement n'existe pas ou est indisponible.");
  }

  const normalizedPeriod = billingPeriod ? normalizeSaasBillingPeriod(billingPeriod) : undefined;
  if (targetPlan.billingPeriod === 'yearly' && normalizedPeriod === 'monthly') {
    throw new Error('Ce forfait est uniquement disponible en facturation annuelle.');
  }

  const { data, error } = await getSupabaseClient().rpc('subscribe_salon_to_plan', {
    p_salon_id: salonId,
    p_plan_id: planId,
    p_billing_period: normalizedPeriod ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('Réponse inattendue du serveur lors de la souscription.');
  }
  return subscriptionFromRpc(data as Record<string, unknown>, targetPlan);
}

/**
 * Abonnement actif d'un salon, ou `null` si aucun abonnement n'est validé.
 * Aucune valeur par défaut n'est fabriquée : un salon sans abonnement validé renvoie `null`.
 */
export async function getSalonSubscription(salonId: string): Promise<SaaSSubscription | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getSupabaseClient().rpc('get_salon_subscription', { p_salon_id: salonId });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || !(data as Record<string, unknown>).id) return null;

  const subData = data as Record<string, unknown>;
  const planData = (subData.plan || {}) as Record<string, unknown>;
  return {
    id: String(subData.id),
    salonId: String(subData.salon_id),
    planId: String(subData.plan_id),
    status: (subData.status as SaaSSubscription['status']) || 'active',
    priceAtSubscription: Number(subData.price_at_subscription),
    billingPeriod: (subData.billing_period as 'monthly' | 'yearly') || 'monthly',
    featuresSnapshot: Array.isArray(subData.features_snapshot) ? (subData.features_snapshot as string[]) : [],
    startedAt: String(subData.started_at),
    currentPeriodEnd: String(subData.current_period_end),
    cancelledAt: subData.cancelled_at ? String(subData.cancelled_at) : null,
    plan: {
      id: String(planData.id || subData.plan_id),
      name: String(planData.name || 'Plan souscrit'),
      slug: String(planData.slug || ''),
      currentPriceXof: Number(planData.current_price_xof || subData.price_at_subscription),
      description: String(planData.description || ''),
      features: Array.isArray(planData.features) ? (planData.features as string[]) : [],
      badgeText: planData.badge_text ? String(planData.badge_text) : null,
      maxStaff: planData.max_staff ? Number(planData.max_staff) : null,
      maxBranches: Number(planData.max_branches || 1),
    },
  };
}

/**
 * Demande en attente de validation d'un salon (et son dernier paiement déclaré), ou `null`.
 */
export async function getPendingSalonSubscription(salonId: string): Promise<PendingSaaSSubscription | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getSupabaseClient().rpc('get_pending_salon_subscription', {
    p_salon_id: salonId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || !(data as Record<string, unknown>).id) return null;

  const row = data as Record<string, unknown>;
  const payment = (row.payment || null) as Record<string, unknown> | null;
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    planName: String(row.plan_name),
    priceXof: Number(row.price_at_subscription),
    billingPeriod: (row.billing_period as 'monthly' | 'yearly') || 'monthly',
    createdAt: String(row.created_at),
    payment: payment
      ? {
          id: String(payment.id),
          method: payment.method as SaaSPaymentMethod,
          reference: String(payment.reference),
          status: payment.status as 'pending' | 'confirmed' | 'rejected',
          declaredAt: String(payment.declared_at),
          decisionReason: payment.decision_reason ? String(payment.decision_reason) : null,
        }
      : null,
  };
}

/**
 * Déclare un paiement (virement, Mobile Money, espèces…) pour la demande en attente du salon.
 * Le montant n'est pas envoyé par le client : il est fixé par le serveur.
 */
export async function declareSaasPayment(
  salonId: string,
  method: SaaSPaymentMethod,
  reference: string,
): Promise<{ id: string; amountXof: number; status: string }> {
  requireSupabase();
  const { data, error } = await getSupabaseClient().rpc('declare_saas_payment', {
    p_salon_id: salonId,
    p_method: method,
    p_reference: reference,
  });
  if (error) throw new Error(error.message);
  const row = (data || {}) as Record<string, unknown>;
  return { id: String(row.id), amountXof: Number(row.amount_xof), status: String(row.status) };
}

/**
 * File des paiements déclarés en attente de validation (super administrateur uniquement).
 */
export async function getSaasPaymentsForReview(): Promise<SaaSPaymentReviewItem[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabaseClient().rpc('list_saas_payments_for_review');
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    salonId: String(row.salon_id),
    salonName: String(row.salon_name),
    planId: String(row.plan_id),
    planName: String(row.plan_name),
    billingPeriod:
      row.billing_period === 'yearly' || row.billing_period === 'monthly'
        ? (row.billing_period as SaasBillingPeriod)
        : undefined,
    amountXof: Number(row.amount_xof),
    method: row.method as SaaSPaymentMethod,
    reference: String(row.reference),
    declaredAt: String(row.declared_at),
  }));
}

/**
 * Décision SuperAdmin sur un paiement : confirmer (active l'abonnement) ou rejeter (motif obligatoire).
 * Chaque décision est tracée côté serveur dans platform_audit_logs.
 */
export async function reviewSaasPayment(
  paymentId: string,
  decision: 'confirm' | 'reject',
  reason?: string,
): Promise<void> {
  requireSupabase();
  const { error } = await getSupabaseClient().rpc('review_saas_payment', {
    p_payment_id: paymentId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('saas_subscription_updated', { detail: {} }));
  }
}

export interface PlatformMetricsFilter {
  from?: string | null;
  to?: string | null;
}

export interface SaasRpcClient {
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function mapPlatformMetricsRow(d: Record<string, unknown>): PlatformMetrics {
  const subsByStatus = asRecord(d.subscriptions_by_status);
  const subsByPeriod = asRecord(d.subscriptions_by_billing_period);
  const apptsByStatus = asRecord(d.appointments_by_status);
  const netRevenue = Number(d.collected_net_revenue_xof ?? d.total_revenue_xof ?? 0);

  return {
    periodFrom: typeof d.period_from === 'string' ? d.period_from : null,
    periodTo: typeof d.period_to === 'string' ? d.period_to : null,
    timezone: typeof d.timezone === 'string' ? d.timezone : 'Africa/Abidjan',
    totalSalons: Number(d.total_salons || 0),
    publishedSalons: Number(d.published_salons || 0),
    suspendedSalons: d.suspended_salons !== undefined ? Number(d.suspended_salons) : undefined,
    verifiedSalons: d.verified_salons !== undefined ? Number(d.verified_salons) : undefined,
    activeSubscriptions: Number(d.active_subscriptions || 0),
    estimatedMrrXof: Number(d.estimated_mrr_xof || 0),
    monthlyMrrXof: Number(d.monthly_mrr_xof || 0),
    yearlyMrrXof: Number(d.yearly_mrr_xof || 0),
    annualRunRateXof: Number(d.annual_run_rate_xof || 0),
    subscriptionsByStatus: {
      active: Number(subsByStatus.active ?? d.active_subscriptions ?? 0),
      trialing: Number(subsByStatus.trialing || 0),
      pendingPayment: Number(subsByStatus.pending_payment || 0),
      pastDue: Number(subsByStatus.past_due || 0),
      cancelled: Number(subsByStatus.cancelled || 0),
    },
    subscriptionsByBillingPeriod: {
      monthly: Number(subsByPeriod.monthly || 0),
      yearly: Number(subsByPeriod.yearly || 0),
    },
    saasCollectedRevenueXof: Number(d.saas_collected_revenue_xof || 0),
    saasConfirmedPaymentsCount: Number(d.saas_confirmed_payments_count || 0),
    saasPendingPaymentsXof: Number(d.saas_pending_payments_xof || 0),
    saasPendingPaymentsCount: Number(d.saas_pending_payments_count || 0),
    saasRejectedPaymentsXof: Number(d.saas_rejected_payments_xof || 0),
    saasRejectedPaymentsCount: Number(d.saas_rejected_payments_count || 0),
    plansCount: Number(d.plans_count || 0),
    completedAppointments: Number(d.completed_appointments ?? apptsByStatus.completed ?? 0),
    cancelledAppointments: Number(d.cancelled_appointments ?? apptsByStatus.cancelled ?? 0),
    noShowAppointments: Number(d.no_show_appointments ?? apptsByStatus.no_show ?? 0),
    totalAppointments: Number(d.total_appointments || 0),
    appointmentsByStatus: {
      pending: Number(apptsByStatus.pending || 0),
      confirmed: Number(apptsByStatus.confirmed || 0),
      checkedIn: Number(apptsByStatus.checked_in || 0),
      inProgress: Number(apptsByStatus.in_progress || 0),
      completed: Number(apptsByStatus.completed ?? d.completed_appointments ?? 0),
      cancelled: Number(apptsByStatus.cancelled ?? d.cancelled_appointments ?? 0),
      noShow: Number(apptsByStatus.no_show ?? d.no_show_appointments ?? 0),
    },
    totalRevenueXof: netRevenue,
    collectedNetRevenueXof: netRevenue,
    collectedGrossRevenueXof: Number(d.collected_gross_revenue_xof || 0),
    refundsXof: Number(d.refunds_xof || 0),
    paymentReversalsXof: Number(d.payment_reversals_xof || 0),
    refundReversalsXof: Number(d.refund_reversals_xof || 0),
    pendingPaymentsXof: Number(d.pending_payments_xof || 0),
    pendingPaymentsCount: Number(d.pending_payments_count || 0),
    failedPaymentsXof: Number(d.failed_payments_xof || 0),
    failedPaymentsCount: Number(d.failed_payments_count || 0),
    confirmedPaymentsCount: Number(d.confirmed_payments_count || 0),
    refundsCount: Number(d.refunds_count || 0),
    hiddenReviews: d.hidden_reviews !== undefined ? Number(d.hidden_reviews) : undefined,
  };
}

/**
 * Récupère les métriques de la plateforme pour la console Super Admin.
 *
 * Renvoie `null` si Supabase n'est pas configuré : aucune valeur de repli n'est inventée.
 * L'interface affiche alors « — ».
 */
export async function getPlatformMetrics(
  filter?: PlatformMetricsFilter,
  clientOverride?: SaasRpcClient,
): Promise<PlatformMetrics | null> {
  if (!clientOverride && !isSupabaseConfigured()) {
    return null;
  }

  const client = clientOverride ?? getSupabaseClient();
  const params =
    filter && (filter.from !== undefined || filter.to !== undefined)
      ? { p_from: filter.from ?? null, p_to: filter.to ?? null }
      : undefined;
  const { data, error } = await client.rpc('get_platform_metrics', params);
  if (error) {
    throw new Error(error.message || 'Impossible de charger les indicateurs de la plateforme.');
  }
  if (!data || typeof data !== 'object') {
    return null;
  }
  return mapPlatformMetricsRow(data as Record<string, unknown>);
}
