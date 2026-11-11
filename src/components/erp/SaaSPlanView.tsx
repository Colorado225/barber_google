import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Check,
  ShieldCheck,
  Calendar,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  Users,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react';
import { useOptionalApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import type { SaaSPlan, SaaSSubscription } from '../../types';
import { SMS_UNAVAILABLE_MESSAGE, SMS_UNAVAILABLE_TITLE } from '../../lib/notifications';
import {
  declareSaasPayment,
  getPendingSalonSubscription,
  getSaasPlans,
  getSalonSubscription,
  subscribeSalonToPlan,
  type PendingSaaSSubscription,
  type SaaSPaymentMethod,
} from '../../lib/saas';
import {
  clearPlanSelectionIntent,
  readPlanSelectionIntent,
  resolvePlanBilling,
  type SaasBillingPeriod,
} from '../../lib/saasPricing';

const PAYMENT_METHODS: Array<{ value: SaaSPaymentMethod; label: string }> = [
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'cash', label: 'Espèces' },
  { value: 'other', label: 'Autre' },
];

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export interface SaaSPlanViewProps {
  loadPlans?: typeof getSaasPlans;
  loadSubscription?: typeof getSalonSubscription;
  loadPending?: typeof getPendingSalonSubscription;
  subscribeToPlan?: typeof subscribeSalonToPlan;
  declarePayment?: typeof declareSaasPayment;
}

export const SaaSPlanView: React.FC<SaaSPlanViewProps> = ({
  loadPlans = getSaasPlans,
  loadSubscription = getSalonSubscription,
  loadPending = getPendingSalonSubscription,
  subscribeToPlan = subscribeSalonToPlan,
  declarePayment = declareSaasPayment,
}) => {
  const { activeSalon, formatPrice, addToast } = useOptionalApp();
  const { memberships } = useOptionalAuth();

  const initialIntentRef = useRef(readPlanSelectionIntent());
  const billingTouchedRef = useRef(false);

  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [subscription, setSubscription] = useState<SaaSSubscription | null>(null);
  const [pending, setPending] = useState<PendingSaaSSubscription | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<SaasBillingPeriod>(
    () => initialIntentRef.current?.billingPeriod ?? 'monthly',
  );
  const [preferredPlanSlug, setPreferredPlanSlug] = useState<string | null>(
    () => initialIntentRef.current?.planSlug || null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [method, setMethod] = useState<SaaSPaymentMethod>('mobile_money');
  const [reference, setReference] = useState('');
  const [declaring, setDeclaring] = useState(false);

  const isOwner =
    memberships.length === 0 || memberships.some((m) => m.salonId === activeSalon?.id && m.role === 'owner');

  // La bascule n'a de sens que si au moins un forfait actif propose le choix de période
  // (forfait configuré au mois). Un catalogue 100 % annuel natif ne permet aucune remise :
  // la bascule est masquée plutôt que d'afficher une promesse « -15 % » non enregistrable.
  const catalogSupportsPeriodChoice = plans.some((p) => p.billingPeriod !== 'yearly');
  const showBillingToggle = loading || plans.length === 0 || catalogSupportsPeriodChoice;

  const loadSubscriptionData = useCallback(async () => {
    if (!activeSalon) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [publicPlans, sub, waiting] = await Promise.all([
        loadPlans(),
        loadSubscription(activeSalon.id),
        loadPending(activeSalon.id),
      ]);
      setPlans(publicPlans.filter((p) => p.isActive));
      setSubscription(sub);
      setPending(waiting);
      if (!initialIntentRef.current && !billingTouchedRef.current) {
        const inferred = waiting?.billingPeriod ?? sub?.billingPeriod;
        if (inferred) {
          setBillingPeriod(inferred);
        }
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Impossible de charger votre abonnement.');
    } finally {
      setLoading(false);
    }
  }, [activeSalon, loadPlans, loadSubscription, loadPending]);

  useEffect(() => {
    loadSubscriptionData();
    const handleSubUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ salonId?: string }>;
      if (
        !customEvent.detail ||
        !customEvent.detail.salonId ||
        customEvent.detail.salonId === activeSalon?.id
      ) {
        loadSubscriptionData();
      }
    };
    window.addEventListener('saas_subscription_updated', handleSubUpdate);
    window.addEventListener('saas_plans_updated', loadSubscriptionData);
    return () => {
      window.removeEventListener('saas_subscription_updated', handleSubUpdate);
      window.removeEventListener('saas_plans_updated', loadSubscriptionData);
    };
  }, [activeSalon?.id, loadSubscriptionData]);

  const handleSelectBillingPeriod = (period: SaasBillingPeriod) => {
    billingTouchedRef.current = true;
    setBillingPeriod(period);
  };

  const handleSubscribe = async (plan: SaaSPlan) => {
    if (!activeSalon) return;
    const billing = resolvePlanBilling(plan, billingPeriod);
    if (subscription?.planId === plan.id && subscription?.billingPeriod === billing.billingPeriod) {
      addToast('Cette formule est déjà active sur votre établissement.', 'info');
      return;
    }
    setSwitchingTo(plan.id);
    try {
      await subscribeToPlan(activeSalon.id, plan.id, billing.billingPeriod);
      clearPlanSelectionIntent();
      setPreferredPlanSlug(null);
      addToast(
        billing.billingPeriod === 'yearly'
          ? `Demande annuelle enregistrée (${formatPrice(billing.billedPriceXof)} / an). Déclarez votre paiement : l’activation (12 mois) intervient après validation.`
          : 'Demande enregistrée. Déclarez votre paiement : l’activation intervient après validation.',
        'info',
      );
      await loadSubscriptionData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de la demande de souscription', 'error');
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleDeclare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSalon) return;
    if (reference.trim().length < 3) {
      addToast('Indiquez une référence de paiement (3 caractères minimum).', 'error');
      return;
    }
    setDeclaring(true);
    try {
      await declarePayment(activeSalon.id, method, reference.trim());
      setReference('');
      addToast('Paiement déclaré. Notre équipe vérifie la réception avant activation.', 'success');
      await loadSubscriptionData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de la déclaration de paiement', 'error');
    } finally {
      setDeclaring(false);
    }
  };

  if (!activeSalon) {
    return <div className="p-8 text-center text-stone-500">Chargement de votre établissement…</div>;
  }

  const hasActive = subscription !== null;
  const activePlan = hasActive ? plans.find((p) => p.id === subscription?.planId) : undefined;
  const planName = subscription?.plan?.name ?? activePlan?.name ?? '';
  const paymentStatus = pending?.payment?.status ?? null;
  const canDeclare =
    isOwner && pending !== null && (pending.payment === null || paymentStatus === 'rejected');

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Titre */}
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
            Votre formule est activée uniquement après validation du paiement par notre équipe.
          </p>
        </div>

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

      {loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          Impossible de charger votre abonnement : {loadError}
        </div>
      )}

      {/* Carte d'état de l'abonnement : uniquement des états vérifiés */}
      <div className="rounded-3xl bg-gradient-to-br from-[#17171a] to-[#121214] border border-[#C9A45C]/40 p-6 sm:p-8 relative overflow-hidden shadow-xl">
        {loading ? (
          <p className="text-sm text-stone-400">Chargement de votre abonnement…</p>
        ) : hasActive && subscription ? (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Abonnement actif
              </span>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-3xl sm:text-4xl font-black text-white">{planName}</h2>
                <span className="text-lg sm:text-xl font-bold text-[#E5C378]">
                  {formatPrice(subscription.priceAtSubscription)}
                  <span className="text-xs text-stone-400 font-normal">
                    {subscription.billingPeriod === 'yearly' ? ' / an' : ' / mois'}
                  </span>
                </span>
                {subscription.billingPeriod === 'yearly' && (
                  <span className="text-xs text-stone-400">
                    (soit {formatPrice(Math.round(subscription.priceAtSubscription / 12))} / mois · cycle 12
                    mois)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#C9A45C]" />
                  <span>
                    Quota personnel :{' '}
                    <strong className="text-white">
                      {subscription.plan?.maxStaff == null
                        ? 'Illimité'
                        : `${subscription.plan.maxStaff} coiffeur(s)`}
                    </strong>
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#C9A45C]" />
                  <span>
                    Échéance :{' '}
                    <strong className="text-white">{dateLabel(subscription.currentPeriodEnd)}</strong>
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#0f0f12] border border-[#26262c] text-xs space-y-2 shrink-0 lg:max-w-xs">
              <div className="font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#C9A45C]" />
                <span>Tarif garanti</span>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Votre tarif souscrit de{' '}
                <strong className="text-[#E5C378]">{formatPrice(subscription.priceAtSubscription)}</strong>{' '}
                reste appliqué pendant toute la durée de votre formule.
              </p>
            </div>
          </div>
        ) : pending ? (
          <div className="space-y-4">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {paymentStatus === 'pending'
                ? 'Paiement déclaré : validation en cours'
                : paymentStatus === 'rejected'
                  ? 'Paiement rejeté'
                  : 'Demande en attente de paiement'}
            </span>
            <h2 className="text-2xl font-black text-white">{pending.planName}</h2>
            <p className="text-sm text-stone-300">
              Montant à régler : <strong className="text-[#E5C378]">{formatPrice(pending.priceXof)}</strong>
              {pending.billingPeriod === 'yearly'
                ? ' (facturation annuelle, 12 mois)'
                : ' (facturation mensuelle)'}
              .
            </p>
            {paymentStatus === 'rejected' && pending.payment?.decisionReason && (
              <p className="text-xs text-red-300">
                Motif indiqué par l’équipe : {pending.payment.decisionReason}
              </p>
            )}
            {paymentStatus === 'pending' && pending.payment && (
              <p className="text-xs text-stone-400">
                Référence déclarée : <strong className="text-white">{pending.payment.reference}</strong>. La
                formule sera activée après vérification.
              </p>
            )}

            {canDeclare && (
              <form
                onSubmit={handleDeclare}
                className="grid gap-3 sm:grid-cols-[200px_1fr_auto] items-end max-w-3xl"
              >
                <label className="text-xs text-stone-400 space-y-1">
                  <span>Moyen de paiement</span>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as SaaSPaymentMethod)}
                    className="w-full rounded-xl bg-[#0f0f12] border border-[#26262c] px-3 py-2 text-sm text-white"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-stone-400 space-y-1">
                  <span>Référence de la transaction</span>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={120}
                    placeholder="Ex. numéro de transaction"
                    className="w-full rounded-xl bg-[#0f0f12] border border-[#26262c] px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  type="submit"
                  disabled={declaring}
                  className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  {declaring ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>Déclarer le paiement</span>
                </button>
              </form>
            )}
            {!isOwner && (
              <p className="text-xs text-stone-400">
                Seul le propriétaire de l’établissement peut déclarer un paiement.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-stone-500/15 text-stone-300 border border-stone-500/30 inline-block">
              Aucun abonnement validé
            </span>
            <p className="text-sm text-stone-300">
              Votre établissement n’est pas encore abonné à une formule. Choisissez-en une ci-dessous : elle
              s’activera après validation du paiement.
            </p>
          </div>
        )}
      </div>

      {/* Forfaits */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Choisir ou changer de formule</h2>
            <p className="text-xs text-stone-400">
              {isOwner
                ? 'Une nouvelle demande remplace la précédente. Votre formule actuelle reste en place jusqu’à validation.'
                : 'Seul le propriétaire de l’établissement peut demander une souscription.'}
            </p>
          </div>

          {/* Sélecteur de période mensuelle / annuelle (-15 %) ; masqué si aucun forfait actif
              ne propose le choix de période (catalogue 100 % annuel natif, sans remise possible) */}
          {showBillingToggle && (
            <div
              data-testid="saas-billing-toggle"
              className="p-1 rounded-2xl bg-[#161619] border border-[#26262b] flex items-center gap-1 self-start md:self-auto"
            >
              <button
                type="button"
                aria-pressed={billingPeriod === 'monthly'}
                onClick={() => handleSelectBillingPeriod('monthly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                onClick={() => handleSelectBillingPeriod('yearly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
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
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const billing = resolvePlanBilling(plan, billingPeriod);
            const isCurrent =
              hasActive &&
              subscription?.planId === plan.id &&
              subscription?.billingPeriod === billing.billingPeriod;
            const isPendingPlan =
              !isCurrent && pending?.planId === plan.id && pending?.billingPeriod === billing.billingPeriod;
            const isPreferred =
              !isCurrent &&
              !isPendingPlan &&
              Boolean(
                preferredPlanSlug && (plan.slug === preferredPlanSlug || plan.id === preferredPlanSlug),
              );
            const isSamePlanDifferentCycle =
              hasActive &&
              subscription?.planId === plan.id &&
              subscription?.billingPeriod !== billing.billingPeriod;

            return (
              <div
                key={plan.id}
                className={`rounded-3xl bg-[#141416] border flex flex-col justify-between p-6 sm:p-7 relative transition-all ${
                  isCurrent
                    ? 'border-[#C9A45C] bg-[#171612]/30 shadow-lg'
                    : isPreferred
                      ? 'border-[#C9A45C]/70 bg-[#171612]/20 shadow-md'
                      : 'border-[#242429] hover:border-[#383842]'
                }`}
              >
                {isCurrent ? (
                  <div className="absolute top-0 right-0 bg-[#C9A45C] text-[#101010] text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                    Formule active
                  </div>
                ) : isPendingPlan ? (
                  <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-300 border-b border-l border-amber-500/30 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                    En attente
                  </div>
                ) : isPreferred ? (
                  <div className="absolute top-0 right-0 bg-[#C9A45C]/20 text-[#E5C378] border-b border-l border-[#C9A45C]/40 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                    Sélectionnée
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

                  <div className="border-y border-[#202025] py-4 space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[#E5C378]">
                        {formatPrice(billing.billedPriceXof)}
                      </span>
                      <span className="text-xs text-stone-400">
                        {billing.billingPeriod === 'yearly' ? '/ an' : '/ mois'}
                      </span>
                    </div>
                    {billing.billingPeriod === 'yearly' && (
                      <div className="text-[11px] text-stone-400">
                        {billing.discountPercent > 0
                          ? `Soit ${formatPrice(billing.monthlyEquivalentXof)} / mois · -${billing.discountPercent}% (économisez ${formatPrice(billing.annualSavingsXof)})`
                          : `Soit ${formatPrice(billing.monthlyEquivalentXof)} / mois · engagement 12 mois`}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-stone-300 font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#C9A45C]" />
                    <span>
                      {plan.maxStaff === null ? 'Barbiers illimités' : `Jusqu'à ${plan.maxStaff} coiffeurs`}
                    </span>
                  </div>

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

                <div className="pt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl bg-[#201f19] border border-[#C9A45C]/40 text-[#C9A45C] text-xs font-bold cursor-default"
                    >
                      Formule active
                    </button>
                  ) : isPendingPlan ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl bg-[#201f19] border border-amber-500/40 text-amber-300 text-xs font-bold cursor-default"
                    >
                      Demande en attente
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan)}
                      disabled={!isOwner || switchingTo === plan.id}
                      className="w-full py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {switchingTo === plan.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                      <span>
                        {isSamePlanDifferentCycle
                          ? billing.billingPeriod === 'yearly'
                            ? 'Passer à l’annuel (-15%)'
                            : 'Passer au mensuel'
                          : 'Choisir cette formule'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          data-testid="saas-sms-unavailable-notice"
          className="rounded-2xl border border-[#26262c] bg-[#141416] p-4 flex items-start gap-3 text-xs text-stone-300"
        >
          <Ban className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white">{SMS_UNAVAILABLE_TITLE} & périmètre fonctionnel</p>
            <p className="text-stone-400 leading-relaxed">
              {SMS_UNAVAILABLE_MESSAGE} La disponibilité effective des rappels automatiques dépend de
              l’activation des clés opérateur et des modèles WhatsApp approuvés. Le suivi d’équipe affiche les
              taux de commission configurés sans calcul automatique des montants dus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
