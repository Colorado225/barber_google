import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type { NotificationProbeResult, PlatformNotificationHealthSummary } from '../types';
import { mapNotificationProbe, mapPlatformNotificationHealth } from './notifications';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'platform_operator' | 'financial_auditor';
  lastLogin: string;
}

export interface SalonPaymentSummary {
  id: string;
  status: 'pending' | 'confirmed' | 'rejected';
  amountXof?: number;
  method?: string;
  reference?: string;
  declaredAt?: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface PendingSubscriptionSummary {
  id: string;
  planId: string;
  planName?: string;
  priceXof?: number;
  billingPeriod?: 'monthly' | 'yearly';
  payment: SalonPaymentSummary | null;
}

export interface SalonAdminDetail {
  id: string;
  name: string;
  slug?: string;
  organizationId?: string;
  organizationName: string;
  commune: string;
  city?: string;
  phone: string;
  email?: string;
  isPublished: boolean;
  isVerified: boolean;
  verifiedAt?: string;
  status: 'active' | 'suspended';
  suspendedAt?: string;
  suspensionReason?: string;
  subscriptionId?: string;
  planId: string;
  planName: string;
  priceAtSubscription?: number;
  subscriptionStatus?: 'pending_payment' | 'trialing' | 'active' | 'past_due' | 'cancelled';
  subscriptionBillingPeriod?: 'monthly' | 'yearly';
  subscriptionStartedAt?: string;
  currentPeriodEnd?: string;
  latestPayment: SalonPaymentSummary | null;
  pendingSubscription: PendingSubscriptionSummary | null;
  staffCount?: number;
  serviceCount?: number;
  appointmentsCount?: number;
  completedAppointmentsCount?: number;
  cancelledAppointmentsCount?: number;
  totalRevenueXof?: number;
  collectedGrossXof?: number;
  refundsXof?: number;
  pendingPaymentsXof?: number;
  rating?: number;
  reviewCount?: number;
  totalReviewCount?: number;
  publicationDate?: string;
  createdAt: string;
}

export interface MarketplaceReviewItem {
  id: string;
  salonId: string;
  salonName: string;
  salonSlug?: string;
  salonStatus?: 'active' | 'suspended';
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
  isVerified: boolean;
  isHidden: boolean;
  moderatedAt?: string;
  moderatedBy?: string;
  moderationReason?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorUserId?: string;
  actorRole?: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeValues: Record<string, unknown> | null;
  afterValues: Record<string, unknown> | null;
  reason?: string;
  details: Record<string, unknown>;
}

export interface AdminRpcClient {
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}

const SUPERADMIN_SESSION_KEY = 'barbercuts_superadmin_session';

/**
 * Compte unique autorisé à administrer la plateforme.
 * La vérification réelle se fait côté serveur (Supabase Auth + table `platform_admins`) :
 * ce module ne fait que relayer le résultat.
 */
export const SUPERADMIN_EMAIL = 'dominiquek051@gmail.com';

const SUPERADMIN_ACCESS_DENIED = 'Identifiants super-administrateur invalides ou accès non autorisé.';
const ADMIN_DB_NOT_CONFIGURED = 'Administration impossible : la base de données n’est pas configurée.';

function clearSuperAdminSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SUPERADMIN_SESSION_KEY);
  localStorage.removeItem(SUPERADMIN_SESSION_KEY);
}

/**
 * Lecture synchrone du cache de session (interface uniquement).
 * Ce cache n'est PAS une preuve d'accès : seul `verifySuperAdminAccess` fait foi.
 */
export function getSuperAdminSession(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SUPERADMIN_SESSION_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as AdminUser;
    return cached.email?.toLowerCase() === SUPERADMIN_EMAIL ? cached : null;
  } catch {
    return null;
  }
}

function cacheSuperAdminSession(admin: AdminUser): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SUPERADMIN_SESSION_KEY, JSON.stringify(admin));
}

/**
 * Vérifie côté serveur que la session Supabase courante appartient au super administrateur
 * (e-mail unique + ligne `platform_admins` avec le rôle super_admin).
 * Sans configuration Supabase, aucun accès n'est accordé.
 */
export async function verifySuperAdminAccess(): Promise<AdminUser | null> {
  if (!isSupabaseConfigured()) {
    clearSuperAdminSession();
    return null;
  }
  try {
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      clearSuperAdminSession();
      return null;
    }
    if (user.email?.toLowerCase() !== SUPERADMIN_EMAIL) {
      clearSuperAdminSession();
      await client.auth.signOut();
      return null;
    }
    const { data: row, error } = await client
      .from('platform_admins')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || row?.role !== 'super_admin') {
      clearSuperAdminSession();
      await client.auth.signOut();
      return null;
    }
    const admin: AdminUser = {
      id: user.id,
      email: SUPERADMIN_EMAIL,
      name: user.user_metadata?.full_name || 'SuperAdmin Principal',
      role: 'super_admin',
      lastLogin: new Date().toISOString(),
    };
    cacheSuperAdminSession(admin);
    return admin;
  } catch {
    clearSuperAdminSession();
    return null;
  }
}

/**
 * Connexion à la console SuperAdmin : Supabase Auth uniquement, compte unique,
 * puis vérification serveur du rôle. Aucun mot de passe maître.
 */
export async function loginSuperAdmin(email: string, password: string): Promise<AdminUser> {
  const cleanEmail = email.trim().toLowerCase();

  // Même message pour une mauvaise adresse et un mauvais mot de passe : pas d'énumération.
  if (cleanEmail !== SUPERADMIN_EMAIL) {
    throw new Error(SUPERADMIN_ACCESS_DENIED);
  }
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Authentification serveur non configurée : la console super administrateur est indisponible.',
    );
  }

  try {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error || !data.user) throw new Error(SUPERADMIN_ACCESS_DENIED);
  } catch {
    throw new Error(SUPERADMIN_ACCESS_DENIED);
  }

  const admin = await verifySuperAdminAccess();
  if (!admin) {
    throw new Error(SUPERADMIN_ACCESS_DENIED);
  }
  return admin;
}

/**
 * Déconnexion de la console SuperAdmin
 */
export function logoutSuperAdmin(): void {
  if (typeof window === 'undefined') return;
  clearSuperAdminSession();
  if (isSupabaseConfigured()) {
    void getSupabaseClient().auth.signOut();
  }
  window.dispatchEvent(new CustomEvent('superadmin_session_changed'));
}

/** Un salon est en ligne sur la marketplace s'il est publié et son accès n'est pas suspendu. */
export function isSalonLiveOnMarketplace(salon: Pick<SalonAdminDetail, 'isPublished' | 'status'>): boolean {
  return salon.isPublished && salon.status === 'active';
}

export function validateAuditReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    throw new Error('Un motif est obligatoire (entre 3 et 500 caractères).');
  }
  return trimmed;
}

function resolveRpcClient(clientOverride?: AdminRpcClient): AdminRpcClient {
  if (clientOverride) return clientOverride;
  if (!isSupabaseConfigured()) {
    throw new Error(ADMIN_DB_NOT_CONFIGURED);
  }
  return getSupabaseClient();
}

const str = (row: Record<string, unknown>, key: string, fallback = ''): string =>
  typeof row[key] === 'string' ? (row[key] as string) : fallback;

const optStr = (row: Record<string, unknown>, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const optNum = (row: Record<string, unknown>, key: string): number | undefined => {
  const value = row[key];
  return value === null || value === undefined ? undefined : Number(value);
};

const VALID_SUBSCRIPTION_STATUSES = new Set([
  'pending_payment',
  'trialing',
  'active',
  'past_due',
  'cancelled',
]);

const VALID_PAYMENT_STATUSES = new Set(['pending', 'confirmed', 'rejected']);

function parseSubscriptionStatus(value: unknown): SalonAdminDetail['subscriptionStatus'] {
  return typeof value === 'string' && VALID_SUBSCRIPTION_STATUSES.has(value)
    ? (value as SalonAdminDetail['subscriptionStatus'])
    : undefined;
}

function parseBillingPeriod(value: unknown): 'monthly' | 'yearly' | undefined {
  if (value === 'yearly') return 'yearly';
  if (value === 'monthly') return 'monthly';
  return undefined;
}

function mapPaymentSummary(row: Record<string, unknown>, prefix: string): SalonPaymentSummary | null {
  const id = optStr(row, `${prefix}_id`);
  const statusRaw = optStr(row, `${prefix}_status`);
  if (!id || !statusRaw || !VALID_PAYMENT_STATUSES.has(statusRaw)) {
    return null;
  }
  return {
    id,
    status: statusRaw as SalonPaymentSummary['status'],
    amountXof: optNum(row, `${prefix}_amount_xof`),
    method: optStr(row, `${prefix}_method`),
    reference: optStr(row, `${prefix}_reference`),
    declaredAt: optStr(row, `${prefix}_declared_at`),
    decidedAt: optStr(row, `${prefix}_decided_at`),
    decisionReason: optStr(row, `${prefix}_decision_reason`),
  };
}

export function mapAdminSalonRow(row: Record<string, unknown>): SalonAdminDetail {
  const subscriptionStatus = parseSubscriptionStatus(row.subscription_status);
  const rawPeriodEnd = optStr(row, 'subscription_current_period_end');
  const currentPeriodEnd = subscriptionStatus === 'pending_payment' ? undefined : rawPeriodEnd;

  const pendingSubId = optStr(row, 'pending_subscription_id');
  const pendingPlanId = str(row, 'pending_subscription_plan_id');
  const pendingSubscription: PendingSubscriptionSummary | null = pendingSubId
    ? {
        id: pendingSubId,
        planId: pendingPlanId,
        planName: optStr(row, 'pending_subscription_plan_name'),
        priceXof: optNum(row, 'pending_subscription_price_xof'),
        billingPeriod: parseBillingPeriod(row.pending_subscription_billing_period),
        payment: mapPaymentSummary(row, 'pending_payment'),
      }
    : null;

  return {
    id: str(row, 'id'),
    name: str(row, 'name'),
    slug: optStr(row, 'slug'),
    organizationId: optStr(row, 'organization_id'),
    organizationName: str(row, 'organization_name'),
    commune: str(row, 'commune'),
    city: optStr(row, 'city'),
    phone: str(row, 'phone'),
    email: optStr(row, 'email'),
    isPublished: row.is_published === true,
    isVerified: row.is_verified === true,
    verifiedAt: optStr(row, 'verified_at'),
    status: row.status === 'suspended' ? 'suspended' : 'active',
    suspendedAt: optStr(row, 'suspended_at'),
    suspensionReason: optStr(row, 'suspension_reason'),
    subscriptionId: optStr(row, 'subscription_id'),
    planId: str(row, 'subscription_plan_id'),
    planName: str(row, 'subscription_plan_name'),
    priceAtSubscription: optNum(row, 'subscription_price_xof'),
    subscriptionStatus,
    subscriptionBillingPeriod: parseBillingPeriod(row.subscription_billing_period),
    subscriptionStartedAt:
      subscriptionStatus === 'pending_payment' ? undefined : optStr(row, 'subscription_started_at'),
    currentPeriodEnd,
    latestPayment: mapPaymentSummary(row, 'subscription_payment'),
    pendingSubscription,
    staffCount: optNum(row, 'staff_count'),
    serviceCount: optNum(row, 'service_count'),
    appointmentsCount: optNum(row, 'appointments_count'),
    completedAppointmentsCount: optNum(row, 'appointments_completed_count'),
    cancelledAppointmentsCount: optNum(row, 'appointments_cancelled_count'),
    totalRevenueXof: optNum(row, 'revenue_xof'),
    collectedGrossXof: optNum(row, 'collected_gross_xof'),
    refundsXof: optNum(row, 'refunds_xof'),
    pendingPaymentsXof: optNum(row, 'pending_payments_xof'),
    rating: optNum(row, 'rating'),
    reviewCount: optNum(row, 'review_count'),
    totalReviewCount: optNum(row, 'total_review_count'),
    publicationDate: optStr(row, 'publication_date'),
    createdAt: str(row, 'created_at') || str(row, 'publication_date'),
  };
}

export function mapAdminReviewRow(row: Record<string, unknown>): MarketplaceReviewItem {
  return {
    id: str(row, 'id'),
    salonId: str(row, 'salon_id'),
    salonName: str(row, 'salon_name'),
    salonSlug: optStr(row, 'salon_slug'),
    salonStatus: row.salon_status === 'suspended' ? 'suspended' : 'active',
    author: str(row, 'author'),
    rating: Number(row.rating ?? 0),
    comment: str(row, 'comment'),
    createdAt: str(row, 'created_at'),
    isVerified: row.verified === true,
    isHidden: row.is_hidden === true,
    moderatedAt: optStr(row, 'moderated_at'),
    moderatedBy: optStr(row, 'moderated_by'),
    moderationReason: optStr(row, 'moderation_reason'),
  };
}

export function mapAuditLogRow(row: Record<string, unknown>): AuditLogEntry {
  const details =
    row.details && typeof row.details === 'object' ? (row.details as Record<string, unknown>) : {};
  const beforeValues =
    row.before_values && typeof row.before_values === 'object'
      ? (row.before_values as Record<string, unknown>)
      : null;
  const afterValues =
    row.after_values && typeof row.after_values === 'object'
      ? (row.after_values as Record<string, unknown>)
      : null;
  return {
    id: str(row, 'id'),
    timestamp: str(row, 'created_at'),
    actorUserId: optStr(row, 'actor_user_id'),
    actorRole: optStr(row, 'actor_role'),
    actorEmail: optStr(row, 'actor_email'),
    action: str(row, 'action'),
    targetType: str(row, 'target_type'),
    targetId: str(row, 'target_id'),
    beforeValues,
    afterValues,
    reason: optStr(row, 'reason'),
    details,
  };
}

async function callAdminRpc<T>(
  fn: string,
  params: Record<string, unknown> | undefined,
  clientOverride?: AdminRpcClient,
): Promise<T> {
  const client = resolveRpcClient(clientOverride);
  const { data, error } = await client.rpc(fn, params);
  if (error) {
    throw new Error(error.message || `Échec de l’opération serveur (${fn}).`);
  }
  return data as T;
}

/**
 * Liste consolidée de tous les salons locataires (publiés, brouillons et suspendus) depuis Supabase.
 */
export async function getAdminSalonsList(clientOverride?: AdminRpcClient): Promise<SalonAdminDetail[]> {
  const data = await callAdminRpc<unknown>('admin_list_salons', undefined, clientOverride);
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapAdminSalonRow(row as Record<string, unknown>));
}

export async function setSalonPublicationByAdmin(
  salonId: string,
  published: boolean,
  reason: string,
  clientOverride?: AdminRpcClient,
): Promise<SalonAdminDetail> {
  const validReason = validateAuditReason(reason);
  const data = await callAdminRpc<Record<string, unknown>>(
    'admin_set_salon_publication',
    { p_salon_id: salonId, p_published: published, p_reason: validReason },
    clientOverride,
  );
  return mapAdminSalonRow(data);
}

export async function setSalonVerificationByAdmin(
  salonId: string,
  verified: boolean,
  reason: string,
  clientOverride?: AdminRpcClient,
): Promise<SalonAdminDetail> {
  const validReason = validateAuditReason(reason);
  const data = await callAdminRpc<Record<string, unknown>>(
    'admin_set_salon_verification',
    { p_salon_id: salonId, p_verified: verified, p_reason: validReason },
    clientOverride,
  );
  return mapAdminSalonRow(data);
}

export async function setSalonStatusByAdmin(
  salonId: string,
  status: 'active' | 'suspended',
  reason: string,
  clientOverride?: AdminRpcClient,
): Promise<SalonAdminDetail> {
  const validReason = validateAuditReason(reason);
  const data = await callAdminRpc<Record<string, unknown>>(
    'admin_set_salon_status',
    { p_salon_id: salonId, p_status: status, p_reason: validReason },
    clientOverride,
  );
  return mapAdminSalonRow(data);
}

export async function updateSalonDetailsByAdmin(
  salonId: string,
  updates: {
    name?: string;
    organizationName?: string;
    commune?: string;
    phone?: string;
    email?: string;
  },
  reason: string,
  clientOverride?: AdminRpcClient,
): Promise<SalonAdminDetail> {
  const validReason = validateAuditReason(reason);
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.organizationName !== undefined) payload.organization_name = updates.organizationName;
  if (updates.commune !== undefined) payload.commune = updates.commune;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.email !== undefined) payload.email = updates.email;

  const data = await callAdminRpc<Record<string, unknown>>(
    'admin_update_salon_details',
    { p_salon_id: salonId, p_updates: payload, p_reason: validReason },
    clientOverride,
  );
  return mapAdminSalonRow(data);
}

export async function getAdminReviews(
  options?: { salonId?: string; includeHidden?: boolean },
  clientOverride?: AdminRpcClient,
): Promise<MarketplaceReviewItem[]> {
  const data = await callAdminRpc<unknown>(
    'admin_list_reviews',
    {
      p_salon_id: options?.salonId ?? null,
      p_include_hidden: options?.includeHidden ?? true,
    },
    clientOverride,
  );
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapAdminReviewRow(row as Record<string, unknown>));
}

export async function moderateReviewByAdmin(
  reviewId: string,
  action: 'hide' | 'restore' | 'delete',
  reason: string,
  clientOverride?: AdminRpcClient,
): Promise<{
  id: string;
  salonId: string;
  action: 'hide' | 'restore' | 'delete';
  isHidden: boolean;
  deleted: boolean;
}> {
  const validReason = validateAuditReason(reason);
  const data = await callAdminRpc<Record<string, unknown>>(
    'admin_moderate_review',
    { p_review_id: reviewId, p_action: action, p_reason: validReason },
    clientOverride,
  );
  return {
    id: str(data, 'id'),
    salonId: str(data, 'salon_id'),
    action: (str(data, 'action') as 'hide' | 'restore' | 'delete') || action,
    isHidden: data.is_hidden === true,
    deleted: data.deleted === true,
  };
}

export async function getPlatformAuditLogs(
  options?: { limit?: number; targetType?: string },
  clientOverride?: AdminRpcClient,
): Promise<AuditLogEntry[]> {
  const data = await callAdminRpc<unknown>(
    'admin_list_audit_logs',
    {
      p_limit: options?.limit ?? 100,
      p_target_type: options?.targetType ?? null,
    },
    clientOverride,
  );
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapAuditLogRow(row as Record<string, unknown>));
}

export async function getPlatformNotificationHealth(
  clientOverride?: AdminRpcClient,
): Promise<PlatformNotificationHealthSummary> {
  const data = await callAdminRpc<unknown>('platform_get_notification_health', {}, clientOverride);
  return mapPlatformNotificationHealth(data);
}

export async function probePlatformNotificationDispatcher(options?: {
  checkWhatsappApi?: boolean;
}): Promise<NotificationProbeResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(ADMIN_DB_NOT_CONFIGURED);
  }
  const { data, error } = await getSupabaseClient().functions.invoke('notifications-dispatcher', {
    body: {
      mode: 'health',
      scope: 'platform',
      check_whatsapp_api: options?.checkWhatsappApi === true,
    },
  });
  if (error) {
    throw new Error(
      `Expéditeur injoignable : ${error.message}. Vérifiez le déploiement de « notifications-dispatcher ».`,
    );
  }
  const payload = (data ?? {}) as { error?: string };
  if (payload.error) {
    throw new Error(payload.error);
  }
  return mapNotificationProbe(data);
}
