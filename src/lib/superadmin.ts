import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'platform_operator' | 'financial_auditor';
  lastLogin: string;
}

/**
 * Salon tel que renvoyé par `platform_list_salons` (source : base de données).
 * Aucun champ n'est complété localement : une valeur absente reste vide ou `undefined`.
 */
export interface SalonAdminDetail {
  id: string;
  name: string;
  organizationName: string;
  commune: string;
  phone: string;
  email?: string;
  isPublished: boolean;
  isVerified: boolean;
  planId: string;
  planName: string;
  priceAtSubscription: number;
  status: 'active' | 'suspended';
  statusReason?: string;
  subscriptionStatus?: string;
  billingPeriod?: string;
  currentPeriodEnd?: string;
  /** Indicateurs réels non fournis par la liste admin : `undefined` tant qu'ils ne sont pas branchés. */
  appointmentsCount?: number;
  totalRevenueXof?: number;
  createdAt: string;
}

/** Avis tel que renvoyé par `platform_list_reviews`. */
export interface MarketplaceReviewItem {
  id: string;
  salonId: string;
  salonName: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
  isVerified: boolean;
  isHidden: boolean;
  hiddenReason?: string;
}

/** Entrée du journal d'audit serveur (`platform_audit_logs`, via `platform_list_audit_logs`). */
export interface PlatformAuditEntry {
  id: string;
  createdAt: string;
  action: string;
  targetType: string;
  targetId: string;
  actorEmail: string | null;
  details: Record<string, unknown>;
}

/** Entrée du journal local : réservé au contenu CMS de la marketplace (`marketplace-content.ts`). */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  performedBy: string;
  severity: 'info' | 'warning' | 'critical';
}

const SUPERADMIN_SESSION_KEY = 'barbercuts_superadmin_session';
const AUDIT_LOG_KEY = 'barbercuts_admin_audit_log';

/**
 * Compte unique autorisé à administrer la plateforme.
 * La vérification réelle se fait côté serveur (Supabase Auth + table `platform_admins`) :
 * ce module ne fait que relayer le résultat.
 */
export const SUPERADMIN_EMAIL = 'dominiquek051@gmail.com';

const SUPERADMIN_ACCESS_DENIED = 'Identifiants super-administrateur invalides ou accès non autorisé.';

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
  logAdminAction('Connexion authentifiée via Supabase', 'Console SuperAdmin', admin.email, 'info');
  return admin;
}

/**
 * Déconnexion de la console SuperAdmin
 */
export function logoutSuperAdmin(): void {
  if (typeof window === 'undefined') return;
  const current = getSuperAdminSession();
  if (current) {
    logAdminAction('Déconnexion de la console', 'Console SuperAdmin', current.email, 'info');
  }
  clearSuperAdminSession();
  if (isSupabaseConfigured()) {
    void getSupabaseClient().auth.signOut();
  }
  window.dispatchEvent(new CustomEvent('superadmin_session_changed'));
}

/**
 * Journal LOCAL (navigateur) : limité au contenu CMS de la marketplace et aux connexions.
 * Les décisions SuperAdmin (salons, avis, formules, administrateurs) sont journalisées en base
 * par les RPC `platform_*` et lues via `listPlatformAuditLogs`.
 */
export function logAdminAction(
  action: string,
  target: string,
  performedBy: string,
  severity: 'info' | 'warning' | 'critical' = 'info',
) {
  if (typeof window === 'undefined') return;
  try {
    const current = getAuditLogs();
    const entry: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      target,
      performedBy,
      severity,
    };
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify([entry, ...current.slice(0, 99)]));
  } catch {
    // ignore
  }
}

/** Lecture du journal local (voir `logAdminAction`). */
export function getAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Un salon est en ligne sur la marketplace s'il est publié et son accès n'est pas suspendu. */
export function isSalonLiveOnMarketplace(salon: Pick<SalonAdminDetail, 'isPublished' | 'status'>): boolean {
  return salon.isPublished && salon.status === 'active';
}
