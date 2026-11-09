import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type { MarketplaceReviewItem, PlatformAuditEntry, SalonAdminDetail } from './superadmin';

/**
 * Client des opérations SuperAdmin persistées en base (RPC `platform_*`).
 *
 * Règles :
 * - Aucune décision n'est mémorisée localement : sans Supabase, chaque opération échoue.
 * - Le contrôle d'accès est fait côté serveur (`is_platform_superadmin()`), jamais ici.
 * - Les réponses sont relayées telles quelles : aucune valeur n'est complétée côté client.
 */

const NOT_CONFIGURED = 'Base de données non configurée : opération indisponible.';

/** Messages d'erreur serveur déjà rédigés en français ; sinon message générique. */
function friendlyMessage(message: string | undefined): string {
  if (!message) return 'L’opération a échoué côté serveur.';
  return message;
}

async function callRpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error(NOT_CONFIGURED);
  }
  const { data, error } = await getSupabaseClient().rpc(name, params);
  if (error) {
    throw new Error(friendlyMessage(error.message));
  }
  return data as T;
}

// ----------------------------------------------------------------------------------------------
// Représentations renvoyées par la base
// ----------------------------------------------------------------------------------------------

export interface PlatformSalonRow {
  id: string;
  name: string;
  organization_name: string | null;
  city: string | null;
  commune: string | null;
  is_published: boolean;
  is_verified: boolean;
  platform_status: 'active' | 'suspended';
  platform_status_reason: string | null;
  publication_date: string | null;
  plan_id: string | null;
  plan_name: string | null;
  price_at_subscription: number | null;
  billing_period: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
}

interface ReviewRow {
  id: string;
  salon_id: string;
  salon_name: string;
  author: string;
  rating: number;
  comment: string | null;
  verified: boolean;
  created_at: string;
  platform_hidden: boolean;
  platform_hidden_reason: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_email: string | null;
}

export interface PlatformAdminRow {
  user_id: string;
  role: string;
  created_at: string;
  email: string | null;
}

export interface PlatformSalonStatusResult {
  id: string;
  platform_status: 'active' | 'suspended';
  is_published: boolean;
}

export function mapPlatformSalon(row: PlatformSalonRow): SalonAdminDetail {
  return {
    id: row.id,
    name: row.name,
    organizationName: row.organization_name ?? '',
    commune: row.commune ?? '',
    // La liste admin ne renvoie pas le téléphone ni l'e-mail du salon : ils restent vides.
    phone: '',
    email: undefined,
    isPublished: row.is_published === true,
    isVerified: row.is_verified === true,
    planId: row.plan_id ?? '',
    planName: row.plan_name ?? '',
    priceAtSubscription: row.price_at_subscription ?? 0,
    status: row.platform_status === 'suspended' ? 'suspended' : 'active',
    statusReason: row.platform_status_reason ?? undefined,
    subscriptionStatus: row.subscription_status ?? undefined,
    billingPeriod: row.billing_period ?? undefined,
    currentPeriodEnd: row.current_period_end ?? undefined,
    createdAt: row.publication_date ?? '',
  };
}

export function mapPlatformReview(row: ReviewRow): MarketplaceReviewItem {
  return {
    id: row.id,
    salonId: row.salon_id,
    salonName: row.salon_name,
    author: row.author,
    rating: row.rating,
    comment: row.comment ?? '',
    createdAt: row.created_at,
    isVerified: row.verified === true,
    isHidden: row.platform_hidden === true,
    hiddenReason: row.platform_hidden_reason ?? undefined,
  };
}

export function mapPlatformAudit(row: AuditRow): PlatformAuditEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id ?? '',
    actorEmail: row.actor_email,
    details: row.details ?? {},
  };
}

// ----------------------------------------------------------------------------------------------
// Lectures
// ----------------------------------------------------------------------------------------------

export async function listPlatformSalons(): Promise<SalonAdminDetail[]> {
  const rows = await callRpc<PlatformSalonRow[]>('platform_list_salons');
  return (rows ?? []).map(mapPlatformSalon);
}

export async function listPlatformReviews(): Promise<MarketplaceReviewItem[]> {
  const rows = await callRpc<ReviewRow[]>('platform_list_reviews');
  return (rows ?? []).map(mapPlatformReview);
}

export async function listPlatformAuditLogs(limit = 100): Promise<PlatformAuditEntry[]> {
  const rows = await callRpc<AuditRow[]>('platform_list_audit_logs', { p_limit: limit });
  return (rows ?? []).map(mapPlatformAudit);
}

export async function listPlatformAdmins(): Promise<PlatformAdminRow[]> {
  return (await callRpc<PlatformAdminRow[]>('platform_list_admins')) ?? [];
}

// ----------------------------------------------------------------------------------------------
// Décisions (chacune est tracée dans platform_audit_logs côté serveur)
// ----------------------------------------------------------------------------------------------

/** Suspension (motif obligatoire) ou réactivation (sans motif). Une suspension retire le salon de la marketplace. */
export async function setPlatformSalonStatus(
  salonId: string,
  status: 'active' | 'suspended',
  reason?: string,
): Promise<PlatformSalonStatusResult> {
  return callRpc<PlatformSalonStatusResult>('platform_set_salon_status', {
    p_salon_id: salonId,
    p_status: status,
    p_reason: reason ?? null,
  });
}

export async function setPlatformSalonVerification(salonId: string, verified: boolean): Promise<void> {
  await callRpc('platform_set_salon_verification', { p_salon_id: salonId, p_verified: verified });
}

/** Publication ou dépublication. Refusée côté serveur pour un salon suspendu. */
export async function setPlatformSalonPublication(salonId: string, published: boolean): Promise<void> {
  await callRpc('platform_set_salon_publication', { p_salon_id: salonId, p_published: published });
}

/** Attribution manuelle d'une formule (validation administrative, motif obligatoire, période mensuelle). */
export async function assignPlatformSalonPlan(
  salonId: string,
  planId: string,
  reason: string,
): Promise<void> {
  await callRpc('platform_assign_salon_plan', { p_salon_id: salonId, p_plan_id: planId, p_reason: reason });
}

/** Masquage (motif obligatoire) ou rétablissement d'un avis. */
export async function setPlatformReviewHidden(
  reviewId: string,
  hidden: boolean,
  reason?: string,
): Promise<void> {
  await callRpc('platform_set_review_hidden', {
    p_review_id: reviewId,
    p_hidden: hidden,
    p_reason: reason ?? null,
  });
}

export async function grantPlatformAdmin(email: string, role: 'support_lead'): Promise<void> {
  await callRpc('platform_grant_admin', { p_email: email, p_role: role });
}

export async function revokePlatformAdmin(userId: string): Promise<void> {
  await callRpc('platform_revoke_admin', { p_user_id: userId });
}

// ----------------------------------------------------------------------------------------------
// Console SuperAdmin : vue d'ensemble, fiche salon 360, actions d'abonnement, journal filtrable
// (migration 20261111100000). Toutes les valeurs viennent de la base.
// ----------------------------------------------------------------------------------------------

export interface PlatformOverview {
  salons: { total: number; published: number; verified: number; suspended: number };
  subscriptions: {
    active: number;
    past_due: number;
    pending_payment: number;
    cancelled: number;
    mrr_xof: number;
    expiring_7d: number;
  };
  payments: { awaiting_review: number };
  reviews: { total: number; hidden: number };
  activity_30d: {
    appointments: number;
    appointments_completed: number;
    appointments_upcoming_7d: number;
    net_revenue_xof: number;
  };
  quota_overages: number;
  audit_24h: number;
}

export interface PlatformSalon360 {
  salon: {
    id: string;
    name: string;
    slug: string | null;
    city: string | null;
    commune: string | null;
    is_published: boolean;
    is_verified: boolean;
    platform_status: 'active' | 'suspended';
    platform_status_reason: string | null;
    publication_date: string | null;
    organization_name: string | null;
  };
  owners: Array<{ email: string | null; role: string; status: string; since: string }>;
  counts: {
    branches: number;
    staff_active: number;
    staff_total: number;
    clients: number;
    services_active: number;
    stock_low: number;
  };
  activity_30d: {
    appointments: number;
    appointments_by_status: Record<string, number>;
    net_revenue_xof: number;
    reviews: number;
    average_rating: number | null;
    hidden_reviews: number;
  };
  subscription: null | {
    id: string;
    plan_id: string;
    plan_name: string;
    status: string;
    billing_period: string;
    price_at_subscription: number;
    started_at: string;
    current_period_end: string;
    max_staff: number | null;
    max_branches: number | null;
    staff_active: number;
    branches: number;
  };
  subscription_history: Array<{
    id: string;
    plan_id: string;
    plan_name: string;
    status: string;
    billing_period: string;
    price_at_subscription: number;
    started_at: string;
    current_period_end: string;
    cancelled_at: string | null;
  }>;
  payment_declarations: Array<{
    id: string;
    amount_xof: number;
    method: string;
    reference: string;
    status: string;
    declared_at: string;
    decided_at: string | null;
    decision_reason: string | null;
  }>;
  audit: Array<{
    id: string;
    action: string;
    target_type: string;
    target_id: string;
    details: Record<string, unknown>;
    created_at: string;
    actor_email: string | null;
  }>;
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  return callRpc<PlatformOverview>('platform_dashboard_overview');
}

export async function getPlatformSalon360(salonId: string): Promise<PlatformSalon360> {
  return callRpc<PlatformSalon360>('platform_get_salon_360', { p_salon_id: salonId });
}

/** Annule l'abonnement en cours (motif obligatoire). Les données du salon sont conservées. */
export async function cancelPlatformSalonSubscription(salonId: string, reason: string): Promise<void> {
  await callRpc('platform_cancel_salon_subscription', { p_salon_id: salonId, p_reason: reason });
}

/** Prolonge la période en cours de 1 à 90 jours (motif obligatoire). */
export async function extendPlatformSalonSubscription(
  salonId: string,
  days: number,
  reason: string,
): Promise<void> {
  await callRpc('platform_extend_salon_subscription', {
    p_salon_id: salonId,
    p_days: days,
    p_reason: reason,
  });
}

export interface PlatformAuditFilters {
  action?: string | null;
  salonId?: string | null;
  since?: string | null;
  limit?: number;
}

export async function searchPlatformAuditLogs(
  filters: PlatformAuditFilters = {},
): Promise<PlatformAuditEntry[]> {
  const rows = await callRpc<AuditRow[]>('platform_search_audit_logs', {
    p_action: filters.action ?? null,
    p_salon_id: filters.salonId ?? null,
    p_since: filters.since ?? null,
    p_limit: filters.limit ?? 100,
  });
  return (rows ?? []).map(mapPlatformAudit);
}

export async function listPlatformAuditActions(): Promise<string[]> {
  return (await callRpc<string[]>('platform_audit_actions')) ?? [];
}
