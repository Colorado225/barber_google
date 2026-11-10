import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Check, ArrowRight, ShieldCheck, Smartphone, Zap, Users, Store, Ban } from 'lucide-react';
import type { SaaSPlan } from '../../types';
import { getSaasPlans } from '../../lib/saas';
import {
  parsePlanSelectionFromSearch,
  resolvePlanBilling,
  savePlanSelectionIntent,
  type SaasBillingPeriod,
} from '../../lib/saasPricing';
import { SMS_UNAVAILABLE_MESSAGE, SMS_UNAVAILABLE_TITLE } from '../../lib/notifications';
import { useOptionalApp } from '../../context/AppContext';

export const PricingView: React.FC = () => {
  const { formatPrice } = useOptionalApp();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<SaasBillingPeriod>(() => {
    if (typeof window === 'undefined') return 'monthly';
    return parsePlanSelectionFromSearch(window.location.search)?.billingPeriod ?? 'monthly';
  });

  // La bascule n'a de sens que si au moins un forfait actif propose le choix de période
  // (forfait configuré au mois). Un catalogue 100 % annuel natif ne permet aucune remise :
  // la bascule est masquée plutôt que d'afficher une promesse « -15 % » non enregistrable.
  const catalogSupportsPeriodChoice = plans.some((p) => p.billingPeriod !== 'yearly');
  const showBillingSwitcher = loading || plans.length === 0 || catalogSupportsPeriodChoice;

  useEffect(() => {
    let isMounted = true;
    const fetchPlans = async () => {
      setLoading(true);
      try {
        const data = await getSaasPlans();
        if (isMounted) setPlans(data);
      } catch {
        // ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchPlans();

    const handlePlansUpdated = () => {
      fetchPlans();
    };
    window.addEventListener('saas_plans_updated', handlePlansUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('saas_plans_updated', handlePlansUpdated);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* Hero Section */}
      <section className="relative pt-16 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#18181c] border border-[#C9A45C]/40 text-[#E5C378] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tarifs Transparents & Sans Surprise</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
          La plateforme tout-en-un pour faire <span className="text-[#C9A45C]">prospérer votre salon</span>
        </h1>

        <p className="text-sm sm:text-base text-stone-400 max-w-2xl mx-auto">
          Gestion de planning, caisse Mobile Money, programme de fidélité et présence garantie sur la
          Marketplace de référence. Choisissez la formule adaptée à votre rythme.
        </p>

        {/* Billing Switcher ; masqué si aucun forfait actif ne propose le choix de période
            (catalogue 100 % annuel natif, sans remise possible) */}
        {showBillingSwitcher && (
          <div data-testid="pricing-billing-toggle" className="pt-6 flex items-center justify-center">
            <div className="p-1 rounded-2xl bg-[#161619] border border-[#26262b] flex items-center gap-1">
              <button
                type="button"
                aria-pressed={billingPeriod === 'monthly'}
                onClick={() => setBillingPeriod('monthly')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-[#C9A45C] text-[#101010] shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Facturation Mensuelle
              </button>
              <button
                type="button"
                aria-pressed={billingPeriod === 'yearly'}
                onClick={() => setBillingPeriod('yearly')}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  billingPeriod === 'yearly'
                    ? 'bg-[#C9A45C] text-[#101010] shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span>Facturation Annuelle</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  -15% Économies
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Plans Pricing Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {loading ? (
          <div className="text-center py-12 text-stone-500">Chargement des tarifs en direct…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => {
              const billing = resolvePlanBilling(plan, billingPeriod);

              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl bg-[#131315] border flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                    plan.isPopular
                      ? 'border-[#C9A45C] shadow-2xl shadow-[#C9A45C]/10 md:-translate-y-2'
                      : 'border-[#222227] hover:border-[#383842]'
                  }`}
                >
                  {/* Popular Badge */}
                  {plan.badgeText && (
                    <div className="bg-[#C9A45C] text-[#101010] text-[11px] font-black uppercase text-center py-1.5 px-4 tracking-wider">
                      {plan.badgeText}
                    </div>
                  )}

                  <div className="p-8 space-y-6 flex-1">
                    <div>
                      <h3 className="text-2xl font-black text-white">{plan.name}</h3>
                      <p className="mt-2 text-xs text-stone-400 min-h-[36px]">{plan.description}</p>
                    </div>

                    {/* Price display */}
                    <div className="border-y border-[#202025] py-5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black text-white">
                          {formatPrice(billing.monthlyEquivalentXof)}
                        </span>
                        <span className="text-xs text-stone-400 font-semibold">/ mois</span>
                      </div>
                      <div className="text-[11px] text-stone-400 mt-1">
                        {!billing.supportsPeriodChoice
                          ? `Forfait annuel (${formatPrice(billing.billedPriceXof)} / an · 12 mois)`
                          : billing.billingPeriod === 'yearly'
                            ? `Facturé annuellement (${formatPrice(billing.billedPriceXof)} / an · économisez ${formatPrice(billing.annualSavingsXof)})`
                            : 'Sans engagement, résiliable à tout moment'}
                      </div>
                    </div>

                    {/* Capacity indicators */}
                    <div className="flex items-center gap-3 text-xs text-stone-300">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#C9A45C]" />
                        <span>
                          {plan.maxStaff === null ? 'Coiffeurs illimités' : `${plan.maxStaff} coiffeur(s)`}
                        </span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-[#C9A45C]" />
                        <span>
                          {plan.maxBranches === 1 ? '1 succursale' : `${plan.maxBranches} succursales`}
                        </span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="space-y-3 pt-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">
                        Inclus dans cette offre :
                      </div>
                      <ul className="space-y-2.5 text-xs text-stone-300">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-[#C9A45C]/20 text-[#C9A45C] flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                            <span className="leading-relaxed">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* CTA Action */}
                  <div className="p-8 pt-0">
                    <Link
                      to={`/inscription?plan=${encodeURIComponent(plan.slug)}&billing=${billing.billingPeriod}`}
                      onClick={() =>
                        savePlanSelectionIntent({
                          planSlug: plan.slug,
                          billingPeriod: billing.billingPeriod,
                        })
                      }
                      className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                        plan.isPopular
                          ? 'bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010]'
                          : 'bg-[#1e1e24] hover:bg-[#272730] text-white border border-[#2e2e36]'
                      }`}
                    >
                      <span>Démarrer avec {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Transparence sur les canaux de notification & périmètre fonctionnel */}
        <div
          data-testid="pricing-sms-unavailable-notice"
          className="mt-10 rounded-2xl border border-[#27272e] bg-[#141417] p-5 flex items-start gap-3 text-xs text-stone-300"
        >
          <Ban className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-bold text-white">{SMS_UNAVAILABLE_TITLE} & périmètre réel</p>
            <p className="text-stone-400 leading-relaxed">
              {SMS_UNAVAILABLE_MESSAGE} La disponibilité effective des rappels automatiques dépend de
              l’activation des clés opérateur et de la validation des modèles WhatsApp.
            </p>
            <p className="text-stone-400 leading-relaxed">
              Côté gestion, les fiches équipe permettent de configurer et d’afficher le taux de commission (%)
              de chaque membre, sans calcul automatique des montants dus par période, et les exports
              comptables de caisse ne sont pas encore disponibles.
            </p>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="p-6 rounded-2xl bg-[#141417] border border-[#222227] space-y-2">
            <Smartphone className="w-6 h-6 text-[#C9A45C] mx-auto" />
            <h4 className="text-sm font-bold text-white">Règlement Mobile Money</h4>
            <p className="text-xs text-stone-400">
              Déclarez votre règlement par Mobile Money (Wave, Orange Money, MTN MoMo), virement bancaire ou
              espèces.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#141417] border border-[#222227] space-y-2">
            <ShieldCheck className="w-6 h-6 text-[#C9A45C] mx-auto" />
            <h4 className="text-sm font-bold text-white">Sans Engagement & Tarif Garanti</h4>
            <p className="text-xs text-stone-400">
              Modifiez ou annulez à tout moment. Votre tarif souscrit est garanti pendant toute la durée
              active.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#141417] border border-[#222227] space-y-2">
            <Zap className="w-6 h-6 text-[#C9A45C] mx-auto" />
            <h4 className="text-sm font-bold text-white">Activation après vérification</h4>
            <p className="text-xs text-stone-400">
              Votre espace ERP démarre dès l’inscription ; l’abonnement payant s’active après vérification du
              paiement déclaré.
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-white">Foire aux questions</h3>
            <p className="text-xs text-stone-400">Tout ce que vous devez savoir avant de vous lancer.</p>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-[#141416] border border-[#222226] space-y-2">
              <h5 className="text-sm font-bold text-white">
                Comment mes clients réservent-ils sur la Marketplace ?
              </h5>
              <p className="text-xs text-stone-400 leading-relaxed">
                Dès la publication de votre salon, les clients découvrent votre établissement, vos prestations
                et vos disponibilités en temps réel. Ils reçoivent un jeton de réservation pour suivre leur
                rendez-vous sans avoir à installer d'application lourde.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#141416] border border-[#222226] space-y-2">
              <h5 className="text-sm font-bold text-white">
                Que se passe-t-il si les prix des forfaits changent ?
              </h5>
              <p className="text-xs text-stone-400 leading-relaxed">
                Vous bénéficiez du principe de droits acquis (Grandfathering) : votre tarif souscrit initial
                demeure garanti sans hausse inattendue tant que votre abonnement reste actif. Les nouveaux
                tarifs ne s'appliquent qu'aux souscripteurs ultérieurs.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#141416] border border-[#222226] space-y-2">
              <h5 className="text-sm font-bold text-white">Puis-je changer de formule en cours de route ?</h5>
              <p className="text-xs text-stone-400 leading-relaxed">
                Absolument. Vous pouvez passer d'un forfait Starter à un forfait Pro en 1 clic directement
                depuis votre espace ERP (onglet « Abonnement ») pour débloquer davantage de barbiers et de
                fonctionnalités.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
