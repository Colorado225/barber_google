import type { SaaSPlan } from '../types';

export type SaasBillingPeriod = 'monthly' | 'yearly';

export const ANNUAL_BILLING_DISCOUNT_RATE = 0.15;

export interface ResolvedPlanBilling {
  billingPeriod: SaasBillingPeriod;
  billedPriceXof: number;
  monthlyEquivalentXof: number;
  annualSavingsXof: number;
  discountPercent: number;
  supportsPeriodChoice: boolean;
}

export interface SaasPlanSelectionIntent {
  planSlug: string;
  billingPeriod: SaasBillingPeriod;
}

const PLAN_SELECTION_SESSION_KEY = 'barbercuts_selected_plan_intent';

export function normalizeSaasBillingPeriod(
  value: unknown,
  fallback: SaasBillingPeriod = 'monthly',
): SaasBillingPeriod {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'yearly') return 'yearly';
    if (normalized === 'monthly') return 'monthly';
  }
  return fallback;
}

/**
 * Calcule le tarif réel d'un forfait pour la période sélectionnée,
 * en cohérence exacte avec `private.resolve_saas_subscription_terms` côté PostgreSQL :
 * - Forfait annuel natif (`plan.billingPeriod === 'yearly'`) : reste facturé annuellement au prix du forfait.
 * - Forfait mensuel (`plan.billingPeriod === 'monthly'`) avec sélection annuelle :
 *   `round(priceXof * 12 * 0.85)` facturé pour 12 mois, soit `-15 %`.
 */
export function resolvePlanBilling(
  plan: Pick<SaaSPlan, 'priceXof' | 'billingPeriod'>,
  selectedPeriod: SaasBillingPeriod,
): ResolvedPlanBilling {
  const safePrice = Math.max(0, Math.round(Number(plan.priceXof) || 0));

  if (plan.billingPeriod === 'yearly') {
    return {
      billingPeriod: 'yearly',
      billedPriceXof: safePrice,
      monthlyEquivalentXof: Math.round(safePrice / 12),
      annualSavingsXof: 0,
      discountPercent: 0,
      supportsPeriodChoice: false,
    };
  }

  if (selectedPeriod === 'yearly') {
    const billedPriceXof = Math.round(safePrice * 12 * (1 - ANNUAL_BILLING_DISCOUNT_RATE));
    const fullYearPriceXof = safePrice * 12;
    return {
      billingPeriod: 'yearly',
      billedPriceXof,
      monthlyEquivalentXof: Math.round(billedPriceXof / 12),
      annualSavingsXof: Math.max(0, fullYearPriceXof - billedPriceXof),
      discountPercent: Math.round(ANNUAL_BILLING_DISCOUNT_RATE * 100),
      supportsPeriodChoice: true,
    };
  }

  return {
    billingPeriod: 'monthly',
    billedPriceXof: safePrice,
    monthlyEquivalentXof: safePrice,
    annualSavingsXof: 0,
    discountPercent: 0,
    supportsPeriodChoice: true,
  };
}

export function formatSaasBillingPeriodLabel(period: SaasBillingPeriod): string {
  return period === 'yearly' ? 'Facturation annuelle (-15%)' : 'Facturation mensuelle';
}

export function parsePlanSelectionFromSearch(search: string): SaasPlanSelectionIntent | null {
  try {
    const params = new URLSearchParams(search);
    const rawPlan = params.get('plan')?.trim() ?? '';
    const rawBilling = params.get('billing');
    if (!rawPlan && !rawBilling) return null;
    return {
      planSlug: rawPlan.slice(0, 100),
      billingPeriod: normalizeSaasBillingPeriod(rawBilling, 'monthly'),
    };
  } catch {
    return null;
  }
}

export function savePlanSelectionIntent(intent: SaasPlanSelectionIntent): void {
  if (typeof window === 'undefined') return;
  try {
    const clean: SaasPlanSelectionIntent = {
      planSlug: intent.planSlug.trim().slice(0, 100),
      billingPeriod: normalizeSaasBillingPeriod(intent.billingPeriod, 'monthly'),
    };
    if (!clean.planSlug && clean.billingPeriod === 'monthly') return;
    window.sessionStorage?.setItem(PLAN_SELECTION_SESSION_KEY, JSON.stringify(clean));
  } catch {
    // ignore storage errors
  }
}

export function readPlanSelectionIntent(search?: string): SaasPlanSelectionIntent | null {
  if (search) {
    const fromSearch = parsePlanSelectionFromSearch(search);
    if (fromSearch) return fromSearch;
  }
  if (typeof window === 'undefined') return null;
  const fromWindowSearch = parsePlanSelectionFromSearch(window.location?.search ?? '');
  if (fromWindowSearch) return fromWindowSearch;
  try {
    const raw = window.sessionStorage?.getItem(PLAN_SELECTION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const planSlug = typeof parsed.planSlug === 'string' ? parsed.planSlug.trim().slice(0, 100) : '';
    const billingPeriod = normalizeSaasBillingPeriod(parsed.billingPeriod, 'monthly');
    if (!planSlug && billingPeriod === 'monthly') return null;
    return { planSlug, billingPeriod };
  } catch {
    return null;
  }
}

export function clearPlanSelectionIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(PLAN_SELECTION_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function buildPlanSelectionQuery(intent: SaasPlanSelectionIntent | null): string {
  if (!intent) return '';
  const params = new URLSearchParams();
  if (intent.planSlug) params.set('plan', intent.planSlug);
  params.set('billing', intent.billingPeriod);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
