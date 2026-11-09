import type { SaaSPlan, SaaSSubscription, PlatformMetrics } from '../types';
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
      "Calcul automatique des commissions d'équipe",
      'Module Clients de passage (Walk-in en direct)',
      'Programme de fidélité et récompenses automatisé',
      'Personnalisation complète de la vitrine (3 thèmes)',
      'Rappels SMS & WhatsApp anti-no-show',
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
      'Multi-succursales & gestion de réseau centralisée',
      'Rapports financiers et bilans comptables consolidés',
      'Export comptable et réconciliation des caisses',
      'Mise en avant prioritaire sur la Marketplace',
      'Support technique VIP prioritaire 7j/7',
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
const LOCAL_STORAGE_KEY_SUBS = 'barbercuts_saas_subscriptions';

function getLocalPlans(): SaaSPlan[] {
  if (typeof window === 'undefined') return DEFAULT_PLANS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PLANS);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(DEFAULT_PLANS));
      return DEFAULT_PLANS;
    }
    return JSON.parse(raw) as SaaSPlan[];
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

function getLocalSubscriptions(): Record<string, SaaSSubscription> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_SUBS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalSubscription(salonId: string, sub: SaaSSubscription) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalSubscriptions();
    current[salonId] = sub;
    localStorage.setItem(LOCAL_STORAGE_KEY_SUBS, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('saas_subscription_updated', { detail: { salonId } }));
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
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
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
    features: Array.isArray(payload.features) ? (payload.features as string[]) : [],
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

/**
 * Souscrit un salon à un forfait ou met à niveau son offre.
 * Enregistre un instantané exact du tarif au moment de la souscription.
 */
export async function subscribeSalonToPlan(salonId: string, planId: string): Promise<SaaSSubscription> {
  const allPlans = await getAllSaasPlans();
  const targetPlan = allPlans.find((p) => p.id === planId);
  if (!targetPlan) {
    throw new Error("Ce forfait d'abonnement n'existe pas ou est indisponible.");
  }

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('subscribe_salon_to_plan', {
        p_salon_id: salonId,
        p_plan_id: planId,
      });

      if (!error && data) {
        const sub: SaaSSubscription = {
          id: String(data.id),
          salonId: String(data.salon_id),
          planId: String(data.plan_id),
          status: 'active',
          priceAtSubscription: Number(data.price_at_subscription),
          billingPeriod: data.billing_period as 'monthly' | 'yearly',
          featuresSnapshot: Array.isArray(data.features_snapshot)
            ? (data.features_snapshot as string[])
            : targetPlan.features,
          startedAt: String(data.started_at),
          currentPeriodEnd: String(data.current_period_end),
          plan: {
            id: targetPlan.id,
            name: targetPlan.name,
            slug: targetPlan.slug,
            currentPriceXof: targetPlan.priceXof,
            description: targetPlan.description,
            features: targetPlan.features,
            badgeText: targetPlan.badgeText,
            maxStaff: targetPlan.maxStaff,
            maxBranches: targetPlan.maxBranches,
          },
        };
        setLocalSubscription(salonId, sub);
        return sub;
      }
    } catch {
      // repli local
    }
  }

  // Repli local
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 86400000);
  const localSub: SaaSSubscription = {
    id: `sub_${Date.now()}`,
    salonId,
    planId,
    status: 'active',
    priceAtSubscription: targetPlan.priceXof,
    billingPeriod: targetPlan.billingPeriod,
    featuresSnapshot: [...targetPlan.features],
    startedAt: now.toISOString(),
    currentPeriodEnd: nextMonth.toISOString(),
    plan: {
      id: targetPlan.id,
      name: targetPlan.name,
      slug: targetPlan.slug,
      currentPriceXof: targetPlan.priceXof,
      description: targetPlan.description,
      features: targetPlan.features,
      badgeText: targetPlan.badgeText,
      maxStaff: targetPlan.maxStaff,
      maxBranches: targetPlan.maxBranches,
    },
  };
  setLocalSubscription(salonId, localSub);
  return localSub;
}

/**
 * Récupère l'abonnement actif d'un salon avec son tarif d'origine et son plan actuel.
 */
export async function getSalonSubscription(salonId: string): Promise<SaaSSubscription | null> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('get_salon_subscription', {
        p_salon_id: salonId,
      });

      if (!error && data && data.id) {
        const subData = data as Record<string, unknown>;
        const planData = (subData.plan || {}) as Record<string, unknown>;
        return {
          id: String(subData.id),
          salonId: String(subData.salon_id),
          planId: String(subData.plan_id),
          status: (subData.status as SaaSSubscription['status']) || 'active',
          priceAtSubscription: Number(subData.price_at_subscription),
          billingPeriod: (subData.billing_period as 'monthly' | 'yearly') || 'monthly',
          featuresSnapshot: Array.isArray(subData.features_snapshot)
            ? (subData.features_snapshot as string[])
            : [],
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
    } catch {
      // repli local
    }
  }

  const local = getLocalSubscriptions();
  if (local[salonId]) return local[salonId];

  // Si aucun abonnement explicite n'est enregistré pour ce salon, on simule le plan 'starter' actif
  const plans = await getAllSaasPlans();
  const starter = plans.find((p) => p.id === 'starter') || DEFAULT_PLANS[0];
  const defaultSub: SaaSSubscription = {
    id: `sub_default_${salonId}`,
    salonId,
    planId: starter.id,
    status: 'active',
    priceAtSubscription: starter.priceXof,
    billingPeriod: 'monthly',
    featuresSnapshot: starter.features,
    startedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    currentPeriodEnd: new Date(Date.now() + 23 * 86400000).toISOString(),
    plan: {
      id: starter.id,
      name: starter.name,
      slug: starter.slug,
      currentPriceXof: starter.priceXof,
      description: starter.description,
      features: starter.features,
      badgeText: starter.badgeText,
      maxStaff: starter.maxStaff,
      maxBranches: starter.maxBranches,
    },
  };
  setLocalSubscription(salonId, defaultSub);
  return defaultSub;
}

/**
 * Récupère les métriques de la plateforme pour la console Super Admin.
 *
 * Renvoie `null` si la RPC échoue ou si Supabase n'est pas configuré : aucune valeur
 * de repli n'est inventée. L'interface affiche alors « — ».
 */
export async function getPlatformMetrics(): Promise<PlatformMetrics | null> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('get_platform_metrics');
      if (!error && data) {
        const d = data as Record<string, unknown>;
        return {
          totalSalons: Number(d.total_salons || 0),
          publishedSalons: Number(d.published_salons || 0),
          activeSubscriptions: Number(d.active_subscriptions || 0),
          estimatedMrrXof: Number(d.estimated_mrr_xof || 0),
          plansCount: Number(d.plans_count || 0),
          totalAppointments: Number(d.total_appointments || 0),
          totalRevenueXof: Number(d.total_revenue_xof || 0),
        };
      }
    } catch {
      // repli local
    }
  }

  return null;
}
