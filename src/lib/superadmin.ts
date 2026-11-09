import { useSyncExternalStore } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type { Salon, SaaSPlan, SaaSSubscription } from '../types';
import { getAllSaasPlans, getPlatformMetrics } from './saas';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'platform_operator' | 'financial_auditor';
  lastLogin: string;
}

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
  /** Indicateurs réels non fournis par la liste publique : `undefined` tant qu'ils ne sont pas branchés. */
  appointmentsCount?: number;
  totalRevenueXof?: number;
  createdAt: string;
}

export interface MarketplaceReviewItem {
  id: string;
  salonId: string;
  salonName: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
  isVerified: boolean;
  isFlagged?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  performedBy: string;
  severity: 'info' | 'warning' | 'critical';
}

const SUPERADMIN_SESSION_KEY = 'barbercuts_superadmin_session';
const SALON_ADMIN_OVERRIDE_KEY = 'barbercuts_admin_salon_overrides';
export const SALON_ADMIN_OVERRIDES_EVENT = 'admin_salons_updated';
const REVIEWS_MODERATION_KEY = 'barbercuts_admin_reviews';
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
 * Journalise une action administrative
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

/**
 * Récupère le journal d'audit
 */
export function getAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) {
      const initialLogs: AuditLogEntry[] = [
        {
          id: 'log_init_1',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          action: 'Initialisation des modules de gestion multi-ERP',
          target: 'Plateforme Globale',
          performedBy: 'Système',
          severity: 'info',
        },
        {
          id: 'log_init_2',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          action: 'Application de la politique tarifaire SaaS 2026',
          target: 'Catalogue Forfaits',
          performedBy: SUPERADMIN_EMAIL,
          severity: 'info',
        },
      ];
      localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(initialLogs));
      return initialLogs;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export type SalonAdminOverrides = Record<string, Partial<SalonAdminDetail>>;

/** Lecture brute des overrides SuperAdmin (vérification, publication, suspension, formule…). */
export function getSalonAdminOverrides(): SalonAdminOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SALON_ADMIN_OVERRIDE_KEY);
    return raw ? (JSON.parse(raw) as SalonAdminOverrides) : {};
  } catch {
    return {};
  }
}

/**
 * Applique les décisions du SuperAdmin aux salons affichés côté client.
 * - Un salon suspendu n'est jamais visible sur la marketplace.
 * - La publication est celle décidée par l'admin, sinon celle de la base.
 * - La certification (badge) est celle décidée par l'admin, sinon celle de la base.
 * Source unique de vérité : la marketplace et l'administration utilisent cette même règle.
 */
export function applySalonAdminOverrides<
  T extends { id: string; isVerified?: boolean; isPublishedOnMarketplace?: boolean },
>(salons: T[], overrides: SalonAdminOverrides = getSalonAdminOverrides()): T[] {
  return salons.map((salon) => {
    const override = overrides[salon.id];
    if (!override) return salon;
    const isSuspended = override.status === 'suspended';
    return {
      ...salon,
      isVerified: override.isVerified ?? salon.isVerified,
      isPublishedOnMarketplace:
        !isSuspended && (override.isPublished ?? salon.isPublishedOnMarketplace === true),
    };
  });
}

/**
 * Vrai si le SuperAdmin a suspendu ou retiré ce salon de la marketplace.
 * Ne se fonde que sur les décisions admin (et non sur le flag de base) : utile pour les vues
 * dont la donnée de base n'est pas complète, comme la vitrine publique d'un salon.
 */
export function isSalonHiddenByAdmin(
  salonId: string,
  overrides: SalonAdminOverrides = getSalonAdminOverrides(),
): boolean {
  const override = overrides[salonId];
  return Boolean(override && (override.status === 'suspended' || override.isPublished === false));
}

/** Un salon est en ligne sur la marketplace s'il est publié et son accès n'est pas suspendu. */
export function isSalonLiveOnMarketplace(salon: Pick<SalonAdminDetail, 'isPublished' | 'status'>): boolean {
  return salon.isPublished && salon.status === 'active';
}

let cachedOverridesRaw: string | null = null;
let cachedOverrides: SalonAdminOverrides = {};

function readRawSalonAdminOverrides(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(SALON_ADMIN_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

function getSalonAdminOverridesSnapshot(): SalonAdminOverrides {
  const raw = readRawSalonAdminOverrides();
  if (raw !== cachedOverridesRaw) {
    cachedOverridesRaw = raw;
    cachedOverrides = getSalonAdminOverrides();
  }
  return cachedOverrides;
}

function subscribeToSalonAdminOverrides(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SALON_ADMIN_OVERRIDE_KEY) listener();
  };
  window.addEventListener(SALON_ADMIN_OVERRIDES_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SALON_ADMIN_OVERRIDES_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Hook réactif : la vue publique se met à jour dès qu'un SuperAdmin modifie un salon. */
export function useSalonAdminOverrides(): SalonAdminOverrides {
  return useSyncExternalStore(
    subscribeToSalonAdminOverrides,
    getSalonAdminOverridesSnapshot,
    getSalonAdminOverridesSnapshot,
  );
}

/** Tarifs officiels des forfaits SaaS (identiques au schéma `saas_plans`). */
const OFFICIAL_PLANS: Record<string, { name: string; priceXof: number }> = {
  starter: { name: 'Starter Solo', priceXof: 15000 },
  pro: { name: 'Pro Équipe', priceXof: 35000 },
  prestige: { name: 'Prestige & Chaînes', priceXof: 75000 },
};

/**
 * Liste consolidée des salons pour l'administration.
 *
 * Aucune donnée n'est inventée : seuls les champs renvoyés par la base sont repris.
 * Les champs absents (organisation, téléphone, formule, indicateurs) restent vides ou
 * `undefined` et l'interface l'indique explicitement.
 */
export function getAdminSalonsList(baseSalons: Salon[]): SalonAdminDetail[] {
  const overrides = getSalonAdminOverrides();

  return baseSalons.map((salon) => {
    const plan = salon.subscriptionPlanId ? OFFICIAL_PLANS[salon.subscriptionPlanId] : undefined;
    const base: SalonAdminDetail = {
      id: salon.id,
      name: salon.name,
      organizationName: '',
      commune: salon.commune ?? '',
      phone: salon.phone ?? '',
      email: salon.email,
      isPublished: salon.isPublishedOnMarketplace === true,
      isVerified: salon.isVerified === true,
      planId: salon.subscriptionPlanId ?? '',
      planName: plan?.name ?? '',
      priceAtSubscription: plan?.priceXof ?? 0,
      status: 'active',
      appointmentsCount: undefined,
      totalRevenueXof: undefined,
      createdAt: salon.publicationDate ?? '',
    };

    if (overrides[salon.id]) {
      return { ...base, ...overrides[salon.id] };
    }
    return base;
  });
}

/**
 * Met à jour le statut ou le forfait d'un salon depuis le superadmin
 */
export function updateSalonByAdmin(salonId: string, updates: Partial<SalonAdminDetail>, adminEmail: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SALON_ADMIN_OVERRIDE_KEY);
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[salonId] = { ...(overrides[salonId] || {}), ...updates };
    localStorage.setItem(SALON_ADMIN_OVERRIDE_KEY, JSON.stringify(overrides));

    const actionDesc = updates.status
      ? `Modification statut : ${updates.status}`
      : updates.isPublished !== undefined
        ? `Visibilité marketplace : ${updates.isPublished ? 'Publié' : 'Masqué'}`
        : updates.isVerified !== undefined
          ? `Certification : ${updates.isVerified ? 'accordée' : 'retirée'}`
          : updates.planName
            ? `Changement de formule : ${updates.planName}`
            : 'Mise à jour des paramètres salon';

    logAdminAction(
      actionDesc,
      `Salon ${salonId}`,
      adminEmail,
      updates.status === 'suspended' ? 'warning' : 'info',
    );
    window.dispatchEvent(new CustomEvent(SALON_ADMIN_OVERRIDES_EVENT));
  } catch {
    // ignore
  }
}

/**
 * Liste des avis modérables
 */
export function getMarketplaceReviews(): MarketplaceReviewItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REVIEWS_MODERATION_KEY);
    if (!raw) {
      const initial: MarketplaceReviewItem[] = [
        {
          id: 'rev_1',
          salonId: 'salon_1',
          salonName: 'Le Roi du Dégradé',
          author: 'Marc K.',
          rating: 5,
          comment: 'Dégradé américain parfait, salon propre et équipe à l’heure. Très satisfait.',
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          isVerified: true,
        },
        {
          id: 'rev_2',
          salonId: 'salon_2',
          salonName: 'Gentlemen Barbershop Abidjan',
          author: 'Ibrahim D.',
          rating: 5,
          comment: 'Soin de barbe impeccable avec serviette chaude. Prise en charge rapide sans attente.',
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          isVerified: true,
        },
        {
          id: 'rev_3',
          salonId: 'salon_1',
          salonName: 'Le Roi du Dégradé',
          author: 'Anonyme',
          rating: 4,
          comment: 'Bonne ambiance, un peu de monde le samedi mais travail très pro.',
          createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
          isVerified: false,
        },
      ];
      localStorage.setItem(REVIEWS_MODERATION_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Suppression / modération d'un avis
 */
export function deleteReviewByAdmin(reviewId: string, adminEmail: string) {
  if (typeof window === 'undefined') return;
  try {
    const list = getMarketplaceReviews().filter((r) => r.id !== reviewId);
    localStorage.setItem(REVIEWS_MODERATION_KEY, JSON.stringify(list));
    logAdminAction(`Suppression de l’avis ${reviewId}`, 'Modération Avis', adminEmail, 'warning');
    window.dispatchEvent(new CustomEvent('admin_reviews_updated'));
  } catch {
    // ignore
  }
}
