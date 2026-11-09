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
    description: 'Le choix de référence pour les salons en pleine croissance cherchant à maximiser leur rentabilité.',
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

/**
 * Récupère les forfaits actifs pour l'affichage public (Marketplace, page Tarifs, onboarding)
 */
export async function getSaasPlans(): Promise<SaaSPlan[]> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('get_saas_plans');
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row: Record<string, unknown>) => ({
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
        }));
      }
    } catch {
      // repli local
    }
  }

  return getLocalPlans().filter((p) => p.isActive);
}

/**
 * Récupère tous les forfaits (y compris inactifs et compteurs d'abonnés) pour la console Super Admin
 */
export async function getAllSaasPlans(): Promise<SaaSPlan[]> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('get_all_saas_plans');
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row: Record<string, unknown>) => ({
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
          subscribersCount: row.subscribers_count ? Number(row.subscribers_count) : 0,
        }));
      }
    } catch {
      // repli local
    }
  }

  return getLocalPlans();
}

/**
 * Sauvegarde ou modifie un forfait depuis la console Super Admin.
 * Le nouveau prix et les nouveaux avantages s'appliqueront à la Marketplace et aux futurs souscripteurs.
 */
export async function saveSaasPlan(plan: SaaSPlan): Promise<SaaSPlan> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.rpc('save_saas_plan', {
        p_id: plan.id,
        p_name: plan.name,
        p_slug: plan.slug,
        p_price_xof: plan.priceXof,
        p_billing_period: plan.billingPeriod,
        p_description: plan.description,
        p_features: plan.features,
        p_max_staff: plan.maxStaff,
        p_max_branches: plan.maxBranches,
        p_is_popular: plan.isPopular,
        p_is_active: plan.isActive,
        p_badge_text: plan.badgeText ?? null,
        p_display_order: plan.displayOrder,
      });

      if (!error && data) {
        // mettre aussi à jour le cache local
        const local = getLocalPlans();
        const index = local.findIndex((p) => p.id === plan.id);
        if (index >= 0) {
          local[index] = plan;
        } else {
          local.push(plan);
        }
        setLocalPlans(local);
        return plan;
      }
    } catch {
      // repli local
    }
  }

  const local = getLocalPlans();
  const index = local.findIndex((p) => p.id === plan.id);
  if (index >= 0) {
    local[index] = { ...plan, updatedAt: new Date().toISOString() };
  } else {
    local.push({
      ...plan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  setLocalPlans(local);
  return plan;
}

/**
 * Souscrit un salon à un forfait ou met à niveau son offre.
 * Enregistre un instantané exact du tarif au moment de la souscription.
 */
export async function subscribeSalonToPlan(
  salonId: string,
  planId: string,
): Promise<SaaSSubscription> {
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
export async function getSalonSubscription(
  salonId: string,
): Promise<SaaSSubscription | null> {
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
 * Récupère les métriques de la plateforme pour la console Super Admin
 */
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
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

  // Calcul basé sur les données locales
  const plans = getLocalPlans();
  const subs = Object.values(getLocalSubscriptions());
  const mrr = subs.reduce((acc, curr) => acc + (curr.priceAtSubscription || 0), 0);

  return {
    totalSalons: Math.max(subs.length, 3),
    publishedSalons: 2,
    activeSubscriptions: Math.max(subs.length, 3),
    estimatedMrrXof: mrr > 0 ? mrr : 85000,
    plansCount: plans.length,
    totalAppointments: 142,
    totalRevenueXof: 1120000,
  };
}
