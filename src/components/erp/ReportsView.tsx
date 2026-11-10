import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  buildServicePerformance,
  computeFinancialTotals,
  ServicePerformanceScope,
} from '../../lib/analytics';
import { resolveErpPeriodRange } from '../../lib/businessTime';
import { ErpDashboardMetrics, FinancialSummary } from '../../types';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Clock,
  FileText,
  CheckCircle2,
  Info,
} from 'lucide-react';

const METHOD_LABELS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  moov_money: 'Moov Money',
  cash: 'Espèces',
  card: 'Carte bancaire',
};

type ReportPeriodKey = 'month' | '30d' | 'year';

export const ReportsView: React.FC = () => {
  const {
    activeSalon,
    salonTimezone,
    appointments,
    services,
    transactions,
    expenses,
    loadDashboardMetrics,
    loadFinancialSummary,
    formatPrice,
  } = useApp();
  const [period, setPeriod] = useState<ReportPeriodKey>('month');
  const [serviceScope, setServiceScope] = useState<ServicePerformanceScope>('completed');
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [metrics, setMetrics] = useState<ErpDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => resolveErpPeriodRange(period, salonTimezone), [period, salonTimezone]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadFinancialSummary(from, to), loadDashboardMetrics({ from, to, dayFilter: 'all' })])
      .then(([sum, dash]) => {
        if (cancelled) return;
        setSummary(sum);
        setMetrics(dash);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Rapport indisponible.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSalon.id, from, to, loadFinancialSummary, loadDashboardMetrics]);

  const salonAppointments = useMemo(
    () => appointments.filter((a) => a.salonId === activeSalon.id),
    [appointments, activeSalon.id],
  );
  const salonServices = useMemo(
    () => services.filter((s) => s.salonId === activeSalon.id),
    [services, activeSalon.id],
  );
  const salonTransactions = useMemo(
    () => transactions.filter((t) => t.salonId === activeSalon.id),
    [transactions, activeSalon.id],
  );
  const salonExpenses = useMemo(
    () => expenses.filter((e) => e.salonId === activeSalon.id),
    [expenses, activeSalon.id],
  );

  const localTotals = useMemo(
    () =>
      computeFinancialTotals(salonTransactions, salonAppointments, salonExpenses, {
        from,
        to,
        timeZone: salonTimezone,
      }),
    [salonTransactions, salonAppointments, salonExpenses, from, to, salonTimezone],
  );

  const effectiveSummary = useMemo(() => {
    if (summary) return summary;
    if (metrics && metrics.permissions.canViewFinance) {
      return {
        revenueCollected: metrics.kpis.revenueCollectedNet ?? 0,
        revenueBilled: metrics.kpis.revenueBilled ?? 0,
        outstanding: metrics.kpis.outstanding ?? 0,
        refunds: metrics.kpis.refunds ?? 0,
        expenses: metrics.kpis.expensesNet ?? 0,
        netBalance: metrics.kpis.netMargin ?? 0,
        pendingAmount: metrics.kpis.pendingPaymentsAmount ?? 0,
        paymentCount: metrics.kpis.confirmedPaymentCount ?? 0,
        byMethod: metrics.byMethod,
      };
    }
    return null;
  }, [summary, metrics]);

  const performance = useMemo(() => {
    if (metrics && metrics.permissions.canViewAppointments) {
      const rows = metrics.servicePerformance.map((srv) => {
        const volume = serviceScope === 'billed' ? srv.billedVolume : srv.completedVolume;
        const totalGeneratedRevenue = serviceScope === 'billed' ? srv.billedRevenue : srv.completedRevenue;
        return {
          id: srv.serviceId,
          name: srv.name,
          category: srv.category,
          price: srv.price,
          durationMinutes: srv.durationMinutes,
          volume,
          totalGeneratedRevenue,
          completedVolume: srv.completedVolume,
          completedRevenue: srv.completedRevenue,
          billedVolume: srv.billedVolume,
          billedRevenue: srv.billedRevenue,
          cancelledVolume: srv.cancelledVolume,
          noShowVolume: srv.noShowVolume,
          revenueShare: 0,
          volumeShare: 0,
        };
      });
      const totalRev = rows.reduce((acc, r) => acc + r.totalGeneratedRevenue, 0);
      const totalVol = rows.reduce((acc, r) => acc + r.volume, 0);
      rows.forEach((r) => {
        r.revenueShare = totalRev > 0 ? Math.round((r.totalGeneratedRevenue / totalRev) * 100) : 0;
        r.volumeShare = totalVol > 0 ? Math.round((r.volume / totalVol) * 100) : 0;
      });
      return rows.sort((a, b) => b.totalGeneratedRevenue - a.totalGeneratedRevenue || b.volume - a.volume);
    }
    return buildServicePerformance(salonAppointments, salonServices, 'revenue', {
      from,
      to,
      scope: serviceScope,
      timeZone: salonTimezone,
    });
  }, [metrics, serviceScope, salonAppointments, salonServices, from, to, salonTimezone]);

  const realizedRevenue =
    metrics?.kpis.revenueRealized !== null && metrics?.kpis.revenueRealized !== undefined
      ? metrics.kpis.revenueRealized
      : localTotals.realizedRevenue;

  const cards = effectiveSummary
    ? [
        {
          label: 'Encaissé net',
          hint: 'Confirmé net des remboursements',
          value: formatPrice(effectiveSummary.revenueCollected),
          icon: Wallet,
          color: 'text-[#E5C378]',
        },
        {
          label: 'Facturé (RDV actifs)',
          hint: 'Hors annulés et absents',
          value: formatPrice(effectiveSummary.revenueBilled),
          icon: FileText,
          color: 'text-[#f7f6f2]',
        },
        {
          label: 'CA réalisé (terminés)',
          hint: 'Statut completed uniquement',
          value: formatPrice(realizedRevenue),
          icon: CheckCircle2,
          color: 'text-emerald-400',
        },
        {
          label: 'Reste à encaisser',
          hint: 'Facturé actif − encaissé',
          value: formatPrice(effectiveSummary.outstanding),
          icon: Clock,
          color: 'text-amber-300',
        },
        {
          label: 'Remboursements',
          hint: 'Écritures confirmées',
          value: formatPrice(effectiveSummary.refunds),
          icon: TrendingDown,
          color: 'text-red-400',
        },
        {
          label: 'Dépenses nettes',
          hint: 'Contrepassations déduites',
          value: formatPrice(effectiveSummary.expenses),
          icon: Receipt,
          color: 'text-red-400',
        },
        {
          label: 'Résultat net',
          hint: 'Encaissé net − dépenses nettes',
          value: formatPrice(effectiveSummary.netBalance),
          icon: effectiveSummary.netBalance >= 0 ? TrendingUp : TrendingDown,
          color: effectiveSummary.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          label: 'Paiements confirmés',
          hint: `En attente : ${formatPrice(effectiveSummary.pendingAmount)}`,
          value: String(effectiveSummary.paymentCount),
          icon: BarChart3,
          color: 'text-[#f7f6f2]',
        },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Rapports</h1>
          <p className="text-[#a9a9a9] mt-1">
            Finances & activité de {activeSalon.name} · {from} → {to} · Fuseau{' '}
            <span className="text-[#E5C378] font-mono text-xs">{salonTimezone}</span>
          </p>
        </div>
        <div className="flex gap-1 bg-[#151516] border border-[#2a2a2b] rounded-lg p-1">
          {(
            [
              ['month', 'Mois en cours'],
              ['30d', '30 jours'],
              ['year', 'Année'],
            ] as [ReportPeriodKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${period === key ? 'bg-[#C9A45C] text-[#101010]' : 'text-stone-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg p-3"
        >
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-stone-400">Chargement du rapport…</p>}

      {effectiveSummary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#a9a9a9]">{card.label}</span>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <p className={`text-xl font-bold mt-2 ${card.color}`}>{card.value}</p>
                  <p className="text-[11px] text-stone-500 mt-1">{card.hint}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
            <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">Encaissements nets par moyen</h2>
            {Object.keys(effectiveSummary.byMethod).length === 0 ? (
              <p className="text-sm text-[#a9a9a9]">Aucun encaissement confirmé sur la période.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(effectiveSummary.byMethod)
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, amount]) => (
                    <div
                      key={method}
                      className="flex items-center justify-between text-sm py-1.5 border-b border-[#232326]"
                    >
                      <span className="text-[#a9a9a9]">{METHOD_LABELS[method] || method}</span>
                      <span className={`font-semibold ${amount < 0 ? 'text-red-400' : 'text-[#f7f6f2]'}`}>
                        {formatPrice(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <p className="text-[11px] text-stone-500 mt-3">
              Les remboursements et contrepassations sont déduits. Les paiements en attente ne sont pas
              comptabilisés.
            </p>
          </div>
        </>
      )}

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#f7f6f2]">
              {serviceScope === 'completed'
                ? 'Prestations par chiffre d’affaires réalisé (terminés)'
                : 'Prestations par chiffre d’affaires facturé actif'}
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Période {from} → {to} ({salonTimezone}) · Rendez-vous annulés et absents exclus ·{' '}
              {metrics ? 'Agrégat serveur complet' : 'Calculé sur la fenêtre chargée'}
            </p>
          </div>

          <div className="flex bg-[#111113] border border-[#27272c] rounded-lg p-1 text-xs">
            <button
              type="button"
              onClick={() => setServiceScope('completed')}
              className={`px-2.5 py-1 rounded-md font-semibold ${
                serviceScope === 'completed'
                  ? 'bg-[#C9A45C] text-[#101010]'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Réalisées (completed)
            </button>
            <button
              type="button"
              onClick={() => setServiceScope('billed')}
              className={`px-2.5 py-1 rounded-md font-semibold ${
                serviceScope === 'billed' ? 'bg-[#C9A45C] text-[#101010]' : 'text-stone-400 hover:text-white'
              }`}
            >
              Facturées actives
            </button>
          </div>
        </div>

        {performance.length === 0 ? (
          <p className="text-sm text-[#a9a9a9]">Aucune prestation au catalogue.</p>
        ) : (
          <div className="space-y-2">
            {performance.map((srv) => (
              <div
                key={srv.id}
                className="flex items-center justify-between text-sm py-2 border-b border-[#232326]"
              >
                <div className="min-w-0">
                  <span className="text-[#f7f6f2] truncate">{srv.name}</span>
                  <span className="text-[11px] text-[#a9a9a9] ml-2">
                    {srv.volume} RDV {serviceScope === 'completed' ? 'réalisés' : 'actifs'}
                    {srv.cancelledVolume + srv.noShowVolume > 0 && (
                      <span className="text-stone-500">
                        {' '}
                        · {srv.cancelledVolume + srv.noShowVolume} annulé(s)/absent(s) exclu(s)
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-semibold text-[#E5C378]">
                    {formatPrice(srv.totalGeneratedRevenue)}
                  </span>
                  <span className="text-[11px] text-stone-500 ml-2">({srv.revenueShare}%)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Définitions métier explicites */}
      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-5 text-xs text-stone-400 space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-stone-200">
          <Info className="w-4 h-4 text-[#C9A45C]" />
          <span>
            Définitions des indicateurs ({from} → {to} · {salonTimezone})
          </span>
        </div>
        <p>
          <strong className="text-stone-200">Encaissé net :</strong> paiements confirmés nets des
          remboursements et contrepassations enregistrés sur la période (hors paiements en attente).
        </p>
        <p>
          <strong className="text-stone-200">Facturé actif vs Réalisé :</strong> le facturé couvre les
          rendez-vous non annulés et non absents ; le réalisé ne retient que les rendez-vous au statut{' '}
          <span className="font-mono text-stone-300">completed</span>.
        </p>
      </div>
    </div>
  );
};
