import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Check,
  ShieldCheck,
  Calendar,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  Store,
  Users,
  CheckCircle2,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { useOptionalApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import type { SaaSPlan, SaaSSubscription } from '../../types';
import {
  getAllSaasPlans,
  getSalonSubscription,
  subscribeSalonToPlan,
} from '../../lib/saas';

export const SaaSPlanView: React.FC = () => {
  const { activeSalon, formatPrice, addToast } = useOptionalApp();
  const { memberships } = useOptionalAuth();

  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [subscription, setSubscription] = useState<SaaSSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const isOwner =
    memberships.length === 0 ||
    memberships.some((m) => m.salonId === activeSalon?.id && m.role === 'owner');

  const loadSubscriptionData = async () => {
    if (!activeSalon) return;
    setLoading(true);
    try {
      const [allPlans, sub] = await Promise.all([
        getAllSaasPlans(),
        getSalonSubscription(activeSalon.id),
      ]);
      setPlans(allPlans.filter((p) => p.isActive));
      setSubscription(sub);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptionData();
    const handleSubUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ salonId?: string }>;
      if (!customEvent.detail || customEvent.detail.salonId === activeSalon?.id) {
        loadSubscriptionData();
      }
    };
    window.addEventListener('saas_subscription_updated', handleSubUpdate);
    window.addEventListener('saas_plans_updated', loadSubscriptionData);
    return () => {
      window.removeEventListener('saas_subscription_updated', handleSubUpdate);
      window.removeEventListener('saas_plans_updated', loadSubscriptionData);
    };
  }, [activeSalon?.id]);

  const handleSubscribe = async (plan: SaaSPlan) => {
    if (!activeSalon) return;
    if (subscription?.planId === plan.id) {
      addToast('Votre établissement est déjà rattaché à cette offre.', 'info');
      return;
    }

    setSwitchingTo(plan.id);
    try {
      const newSub = await subscribeSalonToPlan(activeSalon.id, plan.id);
      setSubscription(newSub);
      addToast(
        `Votre salon est désormais souscrit à l'offre ${plan.name} (${formatPrice(newSub.priceAtSubscription)} / mois).`,
        'success',
      );
      await loadSubscriptionData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de la souscription', 'error');
    } finally {
      setSwitchingTo(null);
    }
  };

  if (!activeSalon) {
    return (
      <div className="p-8 text-center text-stone-500">Chargement de votre établissement…</div>
    );
  }

  const currentPlan =
    plans.find((p) => p.id === subscription?.planId) ||
    plans.find((p) => p.id === activeSalon.subscriptionPlanId) ||
    plans[0];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Banner / Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#242429] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#C9A45C]">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Abonnement SaaS & Forfaits</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Gestion de votre Formule BarberCuts
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-400">
            Retrouvez les détails de votre abonnement et faites évoluer vos quotas d'équipe en fonction de votre croissance.
          </p>
        </div>

        {/* Super Admin Quick Link for Owners */}
        {isOwner && (
          <Link
            to="/admin/console"
            className="px-4 py-2 rounded-xl bg-[#1d1d22] hover:bg-[#25252c] border border-[#C9A45C]/30 text-[#E5C378] text-xs font-bold flex items-center gap-2 transition-colors self-start sm:self-auto"
          >
            <ShieldCheck className="w-4 h-4 text-[#C9A45C]" />
            <span>Console Plateforme</span>
          </Link>
        )}
      </div>

      {/* Current Active Plan Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#17171a] to-[#121214] border border-[#C9A45C]/40 p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A45C]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Abonnement Actif
              </span>
              <span className="text-xs text-stone-400">
                Établissement : <strong className="text-white">{activeSalon.name}</strong>
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                {currentPlan ? currentPlan.name : 'Formule Active'}
              </h2>
              <span className="text-lg sm:text-xl font-bold text-[#E5C378]">
                {subscription ? formatPrice(subscription.priceAtSubscription) : currentPlan ? formatPrice(currentPlan.priceXof) : '—'}
                <span className="text-xs text-stone-400 font-normal"> / mois</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-stone-300 max-w-xl">
              {currentPlan?.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#C9A45C]" />
                <span>
                  Quota staff :{' '}
                  <strong className="text-white">
                    {currentPlan?.maxStaff === null ? 'Illimité' : `${currentPlan?.maxStaff} coiffeur(s)`}
                  </strong>
                </span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#C9A45C]" />
                <span>
                  Prochaine échéance :{' '}
                  <strong className="text-white">
                    {subscription
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : new Date(Date.now() + 30 * 86400000).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f0f12] border border-[#26262c] text-xs space-y-2 shrink-0 lg:max-w-xs">
            <div className="font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C9A45C]" />
              <span>Garantie Tarifaire (Grandfathered)</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Votre tarif souscrit de{' '}
              <strong className="text-[#E5C378]">
                {subscription ? formatPrice(subscription.priceAtSubscription) : currentPlan ? formatPrice(currentPlan.priceXof) : ''}
              </strong>{' '}
              est garanti pendant toute la durée active de votre formule.
            </p>
          </div>
        </div>
      </div>

      {/* Available Plans for Upgrading */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Changer d'Offre ou Mettre à Niveau</h2>
          <p className="text-xs text-stone-400">
            Faites évoluer votre abonnement pour débloquer de nouveaux barbiers ou des outils avancés.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent =
              subscription?.planId === plan.id ||
              (!subscription && activeSalon.subscriptionPlanId === plan.id);

            return (
              <div
                key={plan.id}
                className={`rounded-3xl bg-[#141416] border flex flex-col justify-between p-6 sm:p-7 relative transition-all ${
                  isCurrent
                    ? 'border-[#C9A45C] bg-[#171612]/30 shadow-lg'
                    : 'border-[#242429] hover:border-[#383842]'
                }`}
              >
                {/* Popular or Current tag */}
                {isCurrent ? (
                  <div className="absolute top-0 right-0 bg-[#C9A45C] text-[#101010] text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                    Votre Offre Actuelle
                  </div>
                ) : plan.badgeText ? (
                  <div className="absolute top-0 right-0 bg-[#25252c] text-[#E5C378] text-[10px] font-bold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                    {plan.badgeText}
                  </div>
                ) : null}

                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-black text-white">{plan.name}</h3>
                    <p className="text-xs text-stone-400 mt-1 min-h-[32px]">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="border-y border-[#202025] py-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[#E5C378]">
                        {formatPrice(plan.priceXof)}
                      </span>
                      <span className="text-xs text-stone-400">/ mois</span>
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="text-xs text-stone-300 font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#C9A45C]" />
                    <span>
                      {plan.maxStaff === null ? 'Barbiers illimités' : `Jusqu'à ${plan.maxStaff} coiffeurs`}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Fonctionnalités incluses :
                    </span>
                    <ul className="space-y-2 text-xs text-stone-300">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-[#C9A45C] shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action button */}
                <div className="pt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl bg-[#201f19] border border-[#C9A45C]/40 text-[#C9A45C] text-xs font-bold cursor-default"
                    >
                      Formule Active
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan)}
                      disabled={switchingTo === plan.id}
                      className="w-full py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      {switchingTo === plan.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                      <span>Choisir cette formule</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
