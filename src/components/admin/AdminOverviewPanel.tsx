import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  MessageSquare,
  RotateCcw,
  Store,
  TrendingUp,
  AlertCircle,
  AlertOctagon,
  Bell,
} from 'lucide-react';
import type { PlatformMetrics, PlatformNotificationHealthSummary } from '../../types';
import { evaluateNotificationAlerts } from '../../lib/notifications';
import { isSalonLiveOnMarketplace, type AuditLogEntry, type SalonAdminDetail } from '../../lib/superadmin';
import { abidjanToday, rangeForMetricsPeriod, type MetricsPeriodKey } from '../../lib/metricsPeriod';

export { abidjanToday, rangeForMetricsPeriod, type MetricsPeriodKey };

function formatIsoDateFr(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatPeriodLabel(
  period: MetricsPeriodKey,
  from: string | null,
  to: string | null,
  timezone: string,
): string {
  if (period === 'all' || (!from && !to)) {
    return 'Tout l’historique';
  }
  const fromStr = from ? formatIsoDateFr(from) : 'origine';
  const toStr = to ? formatIsoDateFr(to) : 'aujourd’hui';
  return `${fromStr} → ${toStr} (${timezone})`;
}

interface AdminOverviewPanelProps {
  metrics: PlatformMetrics | null;
  metricsLoading?: boolean;
  salons: SalonAdminDetail[];
  auditLogs: AuditLogEntry[];
  notificationHealth?: PlatformNotificationHealthSummary | null;
  period: MetricsPeriodKey;
  fromDate: string | null;
  toDate: string | null;
  onPeriodChange: (period: MetricsPeriodKey, from: string | null, to: string | null) => void;
  onNavigateTab: (
    tab: 'salons' | 'reviews' | 'pricing' | 'audit' | 'subscriptions' | 'notifications',
  ) => void;
  formatPrice: (amount: number) => string;
}

export const AdminOverviewPanel: React.FC<AdminOverviewPanelProps> = ({
  metrics,
  metricsLoading = false,
  salons,
  auditLogs,
  notificationHealth = null,
  period,
  fromDate,
  toDate,
  onPeriodChange,
  onNavigateTab,
  formatPrice,
}) => {
  const today = abidjanToday();
  const [customFrom, setCustomFrom] = useState(fromDate ?? `${today.slice(0, 8)}01`);
  const [customTo, setCustomTo] = useState(toDate ?? today);
  const [customError, setCustomError] = useState<string | null>(null);

  const liveSalonsCount = salons.filter(isSalonLiveOnMarketplace).length;
  const activePeriodFrom = metrics?.periodFrom ?? fromDate;
  const activePeriodTo = metrics?.periodTo ?? toDate;
  const periodLabel = formatPeriodLabel(
    period,
    activePeriodFrom,
    activePeriodTo,
    metrics?.timezone ?? 'Africa/Abidjan',
  );

  const handlePresetClick = (nextPeriod: Exclude<MetricsPeriodKey, 'custom'>) => {
    setCustomError(null);
    const range = rangeForMetricsPeriod(nextPeriod);
    if (range.from) setCustomFrom(range.from);
    if (range.to) setCustomTo(range.to);
    onPeriodChange(nextPeriod, range.from, range.to);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) {
      setCustomError('Sélectionnez une date de début et une date de fin.');
      return;
    }
    if (customFrom > customTo) {
      setCustomError('La date de début doit précéder la date de fin.');
      return;
    }
    setCustomError(null);
    onPeriodChange('custom', customFrom, customTo);
  };

  const totalPendingAll = metrics ? metrics.saasPendingPaymentsXof + metrics.pendingPaymentsXof : 0;
  const notificationAlerts = notificationHealth
    ? evaluateNotificationAlerts({ health: notificationHealth })
    : [];
  const criticalNotifAlerts = notificationAlerts.filter((a) => a.severity === 'critical');

  return (
    <div className="space-y-6">
      {notificationHealth && criticalNotifAlerts.length > 0 && (
        <div
          role="alert"
          data-testid="overview-notification-alert"
          className="rounded-2xl border border-red-500/50 bg-red-950/35 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-100"
        >
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{criticalNotifAlerts[0].title}</p>
              <p className="text-red-200/90 mt-0.5">{criticalNotifAlerts[0].description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('notifications')}
            className="px-3 py-1.5 rounded-lg bg-red-900/70 hover:bg-red-800/80 border border-red-400/40 text-white font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Diagnostiquer</span>
          </button>
        </div>
      )}

      {/* Header + Sélecteur de période */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Tableau de Bord Exécutif</h1>
          <p className="text-xs text-stone-400 mt-1">
            Indicateurs financiers et commerciaux séparés par nature, période et statut ·{' '}
            <span className="text-[#E5C378] font-semibold">{periodLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[#0d0d10] border border-[#1d1d24] p-1 rounded-xl">
          {(
            [
              ['month', 'Mois en cours'],
              ['30d', '30 jours'],
              ['year', 'Année'],
              ['all', 'Tout'],
            ] as Array<[Exclude<MetricsPeriodKey, 'custom'>, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={metricsLoading}
              onClick={() => handlePresetClick(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                period === key
                  ? 'bg-[#C9A45C] text-[#101010]'
                  : 'text-stone-400 hover:text-white hover:bg-[#17171d]'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={metricsLoading}
            onClick={() => {
              setCustomError(null);
              onPeriodChange('custom', customFrom, customTo);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
              period === 'custom'
                ? 'bg-[#C9A45C] text-[#101010]'
                : 'text-stone-400 hover:text-white hover:bg-[#17171d]'
            }`}
          >
            Personnalisée
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <form
          onSubmit={handleApplyCustom}
          className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-[#0d0d10] border border-[#1d1d24]"
        >
          <div>
            <label
              htmlFor="metrics-from"
              className="block text-[10px] uppercase font-bold text-stone-400 mb-1"
            >
              Du
            </label>
            <input
              id="metrics-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#08080a] border border-[#25252e] text-xs text-white"
            />
          </div>
          <div>
            <label htmlFor="metrics-to" className="block text-[10px] uppercase font-bold text-stone-400 mb-1">
              Au
            </label>
            <input
              id="metrics-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#08080a] border border-[#25252e] text-xs text-white"
            />
          </div>
          <button
            type="submit"
            disabled={metricsLoading}
            className="px-4 py-2 rounded-lg bg-[#C9A45C] text-[#101010] text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Appliquer
          </button>
          {customError && (
            <div role="alert" className="flex items-center gap-1.5 text-xs text-red-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{customError}</span>
            </div>
          )}
        </form>
      )}

      {/* SECTION 1 : REVENUS RÉCURRENTS SAAS (ÉTAT ACTUEL) & PARC */}
      <section className="space-y-3" aria-label="Revenus récurrents SaaS et parc">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-stone-400">
            Revenus Récurrents SaaS & Parc (État Actuel)
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab('subscriptions')}
            className="text-xs font-bold text-[#C9A45C] hover:underline cursor-pointer"
          >
            Voir les abonnements
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MRR normalisé */}
          <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Revenu Récurrent Mensuel (MRR)
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div data-testid="metric-normalized-mrr" className="text-2xl sm:text-3xl font-black text-white">
              {metrics ? formatPrice(metrics.estimatedMrrXof) : '—'}
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold">
              {metrics ? `${metrics.activeSubscriptions} abonnement(s) actif(s)` : 'Donnée serveur'}
            </div>
            {metrics && (
              <div className="pt-2 border-t border-[#181820] text-[11px] text-stone-400 space-y-0.5">
                <div>
                  Mensuels ({metrics.subscriptionsByBillingPeriod.monthly}) :{' '}
                  <strong className="text-stone-200">{formatPrice(metrics.monthlyMrrXof)}</strong> / mois
                </div>
                <div>
                  Annuels ({metrics.subscriptionsByBillingPeriod.yearly}) :{' '}
                  <strong className="text-stone-200">{formatPrice(metrics.yearlyMrrXof)}</strong> / mois
                  (normalisés ÷ 12)
                </div>
                <div>
                  ARR annualisé :{' '}
                  <strong className="text-[#E5C378]">{formatPrice(metrics.annualRunRateXof)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Statuts d'abonnements */}
          <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Abonnements par Statut
              </span>
              <CreditCard className="w-4 h-4 text-[#C9A45C]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {metrics ? `${metrics.activeSubscriptions} actif(s)` : '—'}
            </div>
            {metrics ? (
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#181820] text-[11px] text-stone-300">
                <div>
                  Essai : <strong>{metrics.subscriptionsByStatus.trialing}</strong>
                </div>
                <div>
                  En attente :{' '}
                  <strong className="text-amber-300">{metrics.subscriptionsByStatus.pendingPayment}</strong>
                </div>
                <div>
                  Impayés : <strong className="text-red-300">{metrics.subscriptionsByStatus.pastDue}</strong>
                </div>
                <div>
                  Annulés : <strong>{metrics.subscriptionsByStatus.cancelled}</strong>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-stone-500">Ventilation indisponible</div>
            )}
          </div>

          {/* Vitrines Marketplace */}
          <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Vitrines Marketplace
              </span>
              <Store className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {liveSalonsCount} / {salons.length}
            </div>
            <div className="text-[11px] text-stone-400">Salons visibles publiquement</div>
            <div className="pt-2 border-t border-[#181820] text-[11px] text-stone-400 flex flex-wrap gap-3">
              <span>
                Certifiés :{' '}
                <strong className="text-[#E5C378]">
                  {metrics?.verifiedSalons ?? salons.filter((s) => s.isVerified).length}
                </strong>
              </span>
              <span>
                Suspendus :{' '}
                <strong className="text-red-300">
                  {metrics?.suspendedSalons ?? salons.filter((s) => s.status === 'suspended').length}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 : FLUX FINANCIERS SUR LA PÉRIODE (ENCAISSÉS vs REMBOURSEMENTS vs EN ATTENTE) */}
      <section className="space-y-3" aria-label="Flux financiers sur la période">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-stone-400">
            Flux Financiers de la Période — {periodLabel}
          </h2>
          <span className="text-[11px] text-stone-500">
            Encaissements réels séparés des revenus récurrents, remboursements et paiements en attente
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenus SaaS Encaissés */}
          <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Revenus SaaS Encaissés
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {metrics ? formatPrice(metrics.saasCollectedRevenueXof) : '—'}
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold">
              {metrics
                ? `${metrics.saasConfirmedPaymentsCount} paiement(s) d’abonnement confirmé(s)`
                : 'Paiements SaaS confirmés'}
            </div>
            {metrics && metrics.saasRejectedPaymentsCount > 0 && (
              <div className="text-[10px] text-red-300">
                Rejetés : {formatPrice(metrics.saasRejectedPaymentsXof)} ({metrics.saasRejectedPaymentsCount})
              </div>
            )}
          </div>

          {/* Encaissements Salons (Net / Brut) */}
          <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Encaissements Salons (Net)
              </span>
              <DollarSign className="w-4 h-4 text-[#C9A45C]" />
            </div>
            <div className="text-2xl font-black text-white">
              {metrics ? formatPrice(metrics.collectedNetRevenueXof) : '—'}
            </div>
            <div className="text-[11px] text-stone-400">
              {metrics ? (
                <>
                  Brut confirmé :{' '}
                  <strong className="text-stone-200">{formatPrice(metrics.collectedGrossRevenueXof)}</strong>{' '}
                  ({metrics.confirmedPaymentsCount})
                </>
              ) : (
                'Encaissements nets confirmés'
              )}
            </div>
          </div>

          {/* Remboursements & Contrepassations */}
          <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Remboursements (Salons)
              </span>
              <RotateCcw className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-black text-red-300">
              {metrics ? formatPrice(metrics.refundsXof) : '—'}
            </div>
            <div className="text-[11px] text-stone-400">
              {metrics ? `${metrics.refundsCount} remboursement(s) confirmé(s)` : 'Remboursements confirmés'}
            </div>
            {metrics && (metrics.paymentReversalsXof > 0 || metrics.refundReversalsXof > 0) && (
              <div className="text-[10px] text-stone-400">
                Annul. encaissement : {formatPrice(metrics.paymentReversalsXof)} · Annul. remb. :{' '}
                {formatPrice(metrics.refundReversalsXof)}
              </div>
            )}
          </div>

          {/* Paiements en Attente */}
          <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Paiements en Attente
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300">
              {metrics ? formatPrice(totalPendingAll) : '—'}
            </div>
            {metrics ? (
              <div className="text-[11px] text-stone-400 space-y-0.5">
                <div>
                  SaaS à valider :{' '}
                  <strong className="text-amber-200">{formatPrice(metrics.saasPendingPaymentsXof)}</strong> (
                  {metrics.saasPendingPaymentsCount})
                </div>
                <div>
                  Salons en attente :{' '}
                  <strong className="text-amber-200">{formatPrice(metrics.pendingPaymentsXof)}</strong> (
                  {metrics.pendingPaymentsCount})
                </div>
                {metrics.failedPaymentsCount > 0 && (
                  <div className="text-red-300">
                    Échoués salons : {formatPrice(metrics.failedPaymentsXof)} ({metrics.failedPaymentsCount})
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-stone-500">Hors revenus encaissés</div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3 : RENDEZ-VOUS PAR PÉRIODE ET PAR STATUT */}
      <section className="space-y-3" aria-label="Rendez-vous par période et statut">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-stone-400">
            Rendez-vous sur la Période — {periodLabel}
          </h2>
          <span className="text-[11px] text-stone-500">
            Seuls les rendez-vous au statut « terminé » (completed) sont qualifiés de réalisés
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Rendez-vous Réalisés (Terminés)
              </span>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div data-testid="metric-completed-appointments" className="text-3xl font-black text-white">
              {metrics ? metrics.completedAppointments : '—'}
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold">Statut « terminé » uniquement</div>
            {metrics && (
              <div
                data-testid="metric-completed-appointments-detail"
                className="text-[11px] text-stone-400 pt-1"
              >
                Total réservations enregistrées (tous statuts) :{' '}
                <strong className="text-stone-200">{metrics.totalAppointments}</strong> ·{' '}
                <span>{metrics.cancelledAppointments} annulé(s)</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] flex flex-col justify-between gap-3">
            <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              Ventilation des Rendez-vous par Statut
            </div>
            {metrics ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#121217] border border-emerald-500/20">
                  <div className="text-[10px] uppercase text-emerald-400 font-bold">Réalisés (Terminés)</div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {metrics.appointmentsByStatus.completed}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#121217] border border-[#1f1f28]">
                  <div className="text-[10px] uppercase text-blue-300 font-bold">Confirmés</div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {metrics.appointmentsByStatus.confirmed}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#121217] border border-[#1f1f28]">
                  <div className="text-[10px] uppercase text-amber-300 font-bold">En attente</div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {metrics.appointmentsByStatus.pending}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#121217] border border-[#1f1f28]">
                  <div className="text-[10px] uppercase text-stone-300 font-bold">Arrivés / En cours</div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {metrics.appointmentsByStatus.checkedIn + metrics.appointmentsByStatus.inProgress}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#121217] border border-red-500/20">
                  <div className="text-[10px] uppercase text-red-300 font-bold">Annulés</div>
                  <div className="text-lg font-black text-red-200 mt-0.5">
                    {metrics.appointmentsByStatus.cancelled}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#121217] border border-red-500/20">
                  <div className="text-[10px] uppercase text-orange-300 font-bold">Absences (No-show)</div>
                  <div className="text-lg font-black text-orange-200 mt-0.5">
                    {metrics.appointmentsByStatus.noShow}
                  </div>
                </div>
                <div className="sm:col-span-2 p-3 rounded-xl bg-[#121217] border border-[#1f1f28] flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-stone-400">
                    Total période (tous statuts)
                  </span>
                  <span className="text-lg font-black text-[#E5C378]">{metrics.totalAppointments}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-500">Indicateurs par statut indisponibles.</div>
            )}
          </div>
        </div>
      </section>

      {/* RACCOURCIS DE GESTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('salons')}
          className="p-5 rounded-2xl bg-[#0f0f13] hover:bg-[#141419] border border-[#202028] text-left transition-all cursor-pointer"
        >
          <Store className="w-5 h-5 text-[#C9A45C] mb-2" />
          <div className="text-sm font-bold text-white">Salons & Suspensions</div>
          <p className="text-xs text-stone-400 mt-1">
            Publier, certifier, suspendre ou réactiver des salons avec traçabilité serveur.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reviews')}
          className="p-5 rounded-2xl bg-[#0f0f13] hover:bg-[#141419] border border-[#202028] text-left transition-all cursor-pointer"
        >
          <MessageSquare className="w-5 h-5 text-blue-400 mb-2" />
          <div className="text-sm font-bold text-white">Modération des Avis</div>
          <p className="text-xs text-stone-400 mt-1">
            Masquer, rétablir ou supprimer des avis et ajuster la note publique.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('pricing')}
          className="p-5 rounded-2xl bg-[#0f0f13] hover:bg-[#141419] border border-[#202028] text-left transition-all cursor-pointer"
        >
          <DollarSign className="w-5 h-5 text-emerald-400 mb-2" />
          <div className="text-sm font-bold text-white">Tarifs & Paiements SaaS</div>
          <p className="text-xs text-stone-400 mt-1">
            Valider les paiements en attente et piloter les formules en FCFA.
          </p>
        </button>
      </div>

      {/* DERNIÈRES OPÉRATIONS D'AUDIT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Dernières Opérations Enregistrées (Audit Serveur)
          </h3>
          <button
            type="button"
            onClick={() => onNavigateTab('audit')}
            className="text-xs font-bold text-[#C9A45C] hover:underline cursor-pointer"
          >
            Voir tout le journal ({auditLogs.length})
          </button>
        </div>
        <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#101014] border-b border-[#1a1a22] text-stone-400 text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4">Horodatage</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Cible</th>
                <th className="py-2.5 px-4">Motif</th>
                <th className="py-2.5 px-4">Acteur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#15151c] text-stone-300 text-[11px]">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-stone-500">
                    Aucune opération enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                auditLogs.slice(0, 6).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-4 text-stone-500 font-mono">
                      {new Date(log.timestamp).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2.5 px-4 text-white font-semibold">{log.action}</td>
                    <td className="py-2.5 px-4 text-[#E5C378]">
                      {typeof log.details?.salon_name === 'string'
                        ? log.details.salon_name
                        : `${log.targetType}:${log.targetId}`}
                    </td>
                    <td className="py-2.5 px-4 text-stone-300">{log.reason || '—'}</td>
                    <td className="py-2.5 px-4 text-stone-400">
                      {log.actorEmail || log.actorRole || log.actorUserId?.slice(0, 8) || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
