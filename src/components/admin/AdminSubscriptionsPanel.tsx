import React from 'react';
import { Store, ShieldAlert, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { SalonAdminDetail, SalonPaymentSummary } from '../../lib/superadmin';
import type { getSaasPaymentsForReview, reviewSaasPayment } from '../../lib/saas';
import { SaasPaymentReviewPanel } from './SaasPaymentReviewPanel';

interface AdminSubscriptionsPanelProps {
  salons: SalonAdminDetail[];
  formatPrice: (amount: number) => string;
  onRefresh: () => void;
  onToggleSalonStatus?: (salon: SalonAdminDetail) => void;
  listPayments?: typeof getSaasPaymentsForReview;
  decidePayment?: typeof reviewSaasPayment;
}

const METHOD_LABELS: Record<string, string> = {
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
  cash: 'Espèces',
  other: 'Autre',
};

const SUBSCRIPTION_STATUS_LABELS: Record<NonNullable<SalonAdminDetail['subscriptionStatus']>, string> = {
  active: 'Abonné Actif',
  trialing: 'Période d’essai',
  pending_payment: 'Paiement en attente',
  past_due: 'Impayé / Expiré',
  cancelled: 'Annulé / Rejeté',
};

function formatBillingPeriodSuffix(period: SalonAdminDetail['subscriptionBillingPeriod']): string {
  if (period === 'yearly') return ' / an';
  if (period === 'monthly') return ' / mois';
  return '';
}

function formatPaymentDate(payment: SalonPaymentSummary): string {
  const iso = payment.decidedAt || payment.declaredAt;
  return iso ? new Date(iso).toLocaleDateString('fr-FR') : 'indisponible';
}

const PaymentBadge: React.FC<{
  payment: SalonPaymentSummary | null;
  formatPrice: (amount: number) => string;
}> = ({ payment, formatPrice }) => {
  if (!payment) {
    return <span className="text-stone-500 italic">indisponible</span>;
  }

  const statusMeta =
    payment.status === 'confirmed'
      ? {
          label: 'Confirmé',
          className: 'text-emerald-300',
          Icon: CheckCircle2,
        }
      : payment.status === 'pending'
        ? {
            label: 'En attente de validation',
            className: 'text-amber-300',
            Icon: Clock,
          }
        : {
            label: 'Rejeté',
            className: 'text-red-300',
            Icon: XCircle,
          };

  const Icon = statusMeta.Icon;
  const methodLabel = payment.method ? (METHOD_LABELS[payment.method] ?? payment.method) : 'indisponible';
  const amountLabel = payment.amountXof !== undefined ? formatPrice(payment.amountXof) : 'indisponible';

  return (
    <div className="space-y-0.5 text-[11px]">
      <div className={`font-semibold inline-flex items-center gap-1 ${statusMeta.className}`}>
        <Icon className="w-3 h-3 shrink-0" />
        <span>{statusMeta.label}</span>
        <span className="text-stone-400 font-normal">· {amountLabel}</span>
      </div>
      <div className="text-stone-400">
        {methodLabel} · Réf : {payment.reference || 'indisponible'} · {formatPaymentDate(payment)}
      </div>
      {payment.status === 'rejected' && payment.decisionReason && (
        <div className="text-red-300">Motif : {payment.decisionReason}</div>
      )}
    </div>
  );
};

export const AdminSubscriptionsPanel: React.FC<AdminSubscriptionsPanelProps> = ({
  salons,
  formatPrice,
  onRefresh,
  onToggleSalonStatus,
  listPayments,
  decidePayment,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Statuts d’Abonnement des Salons</h1>
          <p className="text-xs text-stone-400 mt-1">
            Liste construite exclusivement depuis <code className="text-stone-300">saas_subscriptions</code>{' '}
            et <code className="text-stone-300">saas_subscription_payments</code>. Toute information absente
            en base est affichée comme « indisponible ».
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2a2a36] bg-[#0f0f15] px-4 py-3 text-xs text-stone-300 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-[#C9A45C] shrink-0 mt-0.5" />
        <span>
          Les modifications manuelles ou locales de forfait sont désactivées : chaque souscription ou
          changement de formule passe par la demande du salon (espace ERP) puis par la validation serveur d’un
          paiement ci-dessous.
        </span>
      </div>

      <SaasPaymentReviewPanel
        formatPrice={formatPrice}
        onDecision={onRefresh}
        listPayments={listPayments}
        decidePayment={decidePayment}
      />

      <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#101014] border-b border-[#1a1a22] text-stone-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Salon Partenaire</th>
                <th className="py-3 px-4">Forfait Souscrit</th>
                <th className="py-3 px-4">Tarif Souscrit</th>
                <th className="py-3 px-4">Paiement (saas_subscription_payments)</th>
                <th className="py-3 px-4">Statut Abonnement / Compte</th>
                <th className="py-3 px-4">Échéance Période</th>
                <th className="py-3 px-4 text-right">Contrôle Accès</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#15151c] text-stone-300">
              {salons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    Aucun salon enregistré.
                  </td>
                </tr>
              ) : (
                salons.map((salon) => {
                  const hasPlan = Boolean(salon.planName || salon.planId);
                  const pendingDifferent =
                    salon.pendingSubscription && salon.subscriptionStatus !== 'pending_payment';
                  const displayedPayment =
                    salon.pendingSubscription?.payment &&
                    salon.pendingSubscription.payment.status === 'pending'
                      ? salon.pendingSubscription.payment
                      : salon.latestPayment;

                  return (
                    <tr key={salon.id} className="hover:bg-[#111116] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-[#C9A45C] shrink-0" />
                          <span>{salon.name}</span>
                        </div>
                        {salon.commune && (
                          <div className="text-[11px] font-normal text-stone-500 pl-5">{salon.commune}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {hasPlan ? (
                          <span className="font-semibold text-[#E5C378]">
                            {salon.planName || salon.planId}
                          </span>
                        ) : (
                          <span className="text-stone-500 italic">indisponible</span>
                        )}
                        {pendingDifferent && salon.pendingSubscription && (
                          <div className="text-[11px] text-amber-300 mt-0.5">
                            Demande en attente :{' '}
                            {salon.pendingSubscription.planName ||
                              salon.pendingSubscription.planId ||
                              'indisponible'}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-white">
                        {salon.priceAtSubscription !== undefined ? (
                          <span>
                            {formatPrice(salon.priceAtSubscription)}
                            {formatBillingPeriodSuffix(salon.subscriptionBillingPeriod)}
                          </span>
                        ) : (
                          <span className="font-normal text-stone-500 italic">indisponible</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <PaymentBadge payment={displayedPayment} formatPrice={formatPrice} />
                      </td>

                      <td className="py-3.5 px-4">
                        {salon.status === 'suspended' ? (
                          <div className="space-y-1">
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              Compte Suspendu
                            </span>
                            <div className="text-[11px] text-stone-400">
                              Contrat :{' '}
                              {salon.subscriptionStatus
                                ? SUBSCRIPTION_STATUS_LABELS[salon.subscriptionStatus]
                                : 'indisponible'}
                            </div>
                          </div>
                        ) : salon.subscriptionStatus ? (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              salon.subscriptionStatus === 'active'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : salon.subscriptionStatus === 'trialing'
                                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                  : salon.subscriptionStatus === 'pending_payment'
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    : salon.subscriptionStatus === 'past_due'
                                      ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                      : 'bg-stone-800 text-stone-300 border border-stone-700'
                            }`}
                          >
                            {SUBSCRIPTION_STATUS_LABELS[salon.subscriptionStatus]}
                          </span>
                        ) : (
                          <span className="text-stone-500 italic">indisponible</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-stone-300">
                        {salon.currentPeriodEnd ? (
                          new Date(salon.currentPeriodEnd).toLocaleDateString('fr-FR')
                        ) : (
                          <span className="text-stone-500 italic">indisponible</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {onToggleSalonStatus && (
                            <button
                              type="button"
                              onClick={() => onToggleSalonStatus(salon)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                                salon.status === 'active'
                                  ? 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40'
                                  : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40'
                              }`}
                            >
                              {salon.status === 'active' ? 'Suspendre' : 'Réactiver'}
                            </button>
                          )}
                          <span className="text-[10px] text-stone-500">
                            {displayedPayment?.status === 'pending'
                              ? 'Validation via file paiements'
                              : 'Forfait géré côté serveur'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
