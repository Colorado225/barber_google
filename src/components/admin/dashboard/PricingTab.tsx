// Onglet « Tarifs & Forfaits SaaS » : cartes forfaits publiés + brouillons,
// paiement SaaS à valider et accès à l'éditeur de forfait.
import React from 'react';
import { Check, Edit3, Plus } from 'lucide-react';
import type { SaaSPlan } from '../../../types';
import type { SaaSPlanDraft, SaaSPlanInput } from '../../../lib/saas';
import { resolvePlanBilling } from '../../../lib/saasPricing';
import { SectionLoadingFallback, lazyNamed } from '../../common/ViewLoader';

const SaasPaymentReviewPanel = lazyNamed(() => import('../SaasPaymentReviewPanel'), 'SaasPaymentReviewPanel');

type PlanCardView = SaaSPlanInput & { subscribersCount?: number };

/** Fusionne forfaits publiés et brouillons orphelins en cartes affichables. */
export function buildPricingCards(
  plans: SaaSPlan[],
  planDrafts: SaaSPlanDraft[],
): Array<{ view: PlanCardView; draft: SaaSPlanDraft | undefined; draftOnly: boolean }> {
  return [
    ...plans.map((plan) => ({
      view: plan as PlanCardView,
      draft: planDrafts.find((d) => d.planId === plan.id),
      draftOnly: false,
    })),
    ...planDrafts
      .filter((d) => !plans.some((p) => p.id === d.planId))
      .map((d) => ({ view: { ...d.plan, subscribersCount: 0 } as PlanCardView, draft: d, draftOnly: true })),
  ];
}

export const PricingTab: React.FC<{
  plans: SaaSPlan[];
  planDrafts: SaaSPlanDraft[];
  formatPrice: (amount: number) => string;
  onOpenPlanEditor: (plan: SaaSPlan | null, draft: SaaSPlanInput | null) => void;
  onPublishDraft: (planId: string) => Promise<void>;
  onDiscardDraft: (planId: string) => Promise<void>;
  onPaymentDecision: () => void;
}> = ({
  plans,
  planDrafts,
  formatPrice,
  onOpenPlanEditor,
  onPublishDraft,
  onDiscardDraft,
  onPaymentDecision,
}) => {
  const pricingCards = buildPricingCards(plans, planDrafts);
  return (
    <React.Suspense fallback={<SectionLoadingFallback label="Chargement des paiements SaaS…" />}>
      {/* TAB 2: PRICING PLANS */}
      <div className="space-y-6">
        <SaasPaymentReviewPanel formatPrice={formatPrice} onDecision={onPaymentDecision} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Tarifs & Forfaits SaaS</h1>
            <p className="text-xs text-stone-400 mt-1">
              Chaque modification peut être publiée immédiatement sur la page Tarifs, ou enregistrée en
              brouillon pour être publiée plus tard. Les salons déjà abonnés conservent leur tarif d’origine.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenPlanEditor(null, null)}
            className="px-4 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Forfait</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricingCards.map(({ view: plan, draft, draftOnly }) => (
            <div
              key={plan.id}
              className={`rounded-3xl bg-[#0c0c10] border transition-all flex flex-col justify-between relative overflow-hidden ${
                plan.isPopular
                  ? 'border-[#C9A45C] shadow-lg shadow-[#C9A45C]/5'
                  : 'border-[#1e1e26] hover:border-[#33333d]'
              } ${!plan.isActive ? 'opacity-60' : ''}`}
            >
              {plan.badgeText && (
                <div className="absolute top-0 right-0 bg-[#C9A45C] text-[#101010] text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                  {plan.badgeText}
                </div>
              )}

              <div className="p-6 space-y-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    {!plan.isActive && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/60 text-red-400 border border-red-800/50">
                        Inactif
                      </span>
                    )}
                    {draftOnly && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-300 border border-amber-500/40">
                        Brouillon · non publié
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-1 min-h-[32px] line-clamp-2">{plan.description}</p>
                </div>

                <div className="border-y border-[#181820] py-4 space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-[#E5C378]">{formatPrice(plan.priceXof)}</span>
                    <span className="text-xs text-stone-400">
                      {plan.billingPeriod === 'yearly' ? '/ an' : '/ mois'}
                    </span>
                  </div>
                  {plan.billingPeriod === 'monthly' && (
                    <p className="text-[11px] text-stone-400">
                      Annuel (-15%) : {formatPrice(resolvePlanBilling(plan, 'yearly').billedPriceXof)} / an
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#111116] border border-[#1c1c24]">
                    <span className="text-[10px] text-stone-400 block uppercase">Capacité Staff</span>
                    <span className="font-bold text-white">
                      {plan.maxStaff === null ? 'Illimité' : `${plan.maxStaff} barbier(s)`}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#111116] border border-[#1c1c24]">
                    <span className="text-[10px] text-stone-400 block uppercase">Succursales</span>
                    <span className="font-bold text-white">
                      {plan.maxBranches === 1 ? '1 salon' : `${plan.maxBranches} salons max`}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Avantages Inclus ({plan.features.length})
                  </div>
                  <ul className="space-y-2 text-xs text-stone-300">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#C9A45C] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {draft && (
                <div className="mx-6 mb-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200 space-y-2">
                  <div className="font-semibold">Brouillon en attente · non publié</div>
                  <div>
                    {draft.plan.name} — {formatPrice(draft.plan.priceXof)}{' '}
                    {draft.plan.billingPeriod === 'yearly' ? '/ an' : '/ mois'}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void onPublishDraft(draft.planId)}
                      className="px-3 py-1.5 rounded-lg bg-[#C9A45C] text-[#101010] font-bold"
                    >
                      Publier le brouillon
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDiscardDraft(draft.planId)}
                      className="px-3 py-1.5 rounded-lg bg-[#181820] text-stone-300"
                    >
                      Abandonner
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 bg-[#101014] border-t border-[#1a1a22] flex items-center justify-between">
                <div className="text-xs text-stone-400">
                  <span className="font-semibold text-stone-300">{plan.subscribersCount ?? 0}</span> salon(s)
                  abonné(s)
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPlanEditor(
                      draftOnly ? null : (plans.find((p) => p.id === plan.id) ?? null),
                      draft?.plan ?? null,
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#1a1a22] hover:bg-[#22222c] text-stone-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#C9A45C]" />
                  <span>Modifier</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </React.Suspense>
  );
};
