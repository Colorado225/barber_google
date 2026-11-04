import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { salonApi } from '../../lib/api';
import { buildServicePerformance } from '../../lib/analytics';
import { FinancialSummary } from '../../types';
import { BarChart3, TrendingUp, TrendingDown, Wallet, Receipt, Clock, FileText } from 'lucide-react';

const METHOD_LABELS: Record<string, string> = {
  wave: 'Wave', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo',
  moov_money: 'Moov Money', cash: 'Espèces', card: 'Carte bancaire',
};

type PeriodKey = 'month' | '30d' | 'year';

function abidjanToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function rangeFor(period: PeriodKey): { from: string; to: string } {
  const to = abidjanToday();
  if (period === 'month') return { from: `${to.slice(0, 8)}01`, to };
  if (period === 'year') return { from: `${to.slice(0, 4)}-01-01`, to };
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 29);
  return { from: d.toISOString().slice(0, 10), to };
}

export const ReportsView: React.FC = () => {
  const { activeSalon, appointments, services, formatPrice } = useApp();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => rangeFor(period), [period]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    salonApi(activeSalon.id).reports.summary(from, to)
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Rapport indisponible.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeSalon.id, from, to]);

  const salonAppointments = appointments.filter((a) => a.salonId === activeSalon.id);
  const salonServices = services.filter((s) => s.salonId === activeSalon.id);
  const performance = buildServicePerformance(salonAppointments, salonServices, 'revenue');

  const cards = summary ? [
    { label: 'Encaissé net', value: formatPrice(summary.revenueCollected), icon: Wallet, color: 'text-[#E5C378]' },
    { label: 'Facturé (RDV actifs)', value: formatPrice(summary.revenueBilled), icon: FileText, color: 'text-[#f7f6f2]' },
    { label: 'Reste à encaisser', value: formatPrice(summary.outstanding), icon: Clock, color: 'text-amber-300' },
    { label: 'Remboursements', value: formatPrice(summary.refunds), icon: TrendingDown, color: 'text-red-400' },
    { label: 'Dépenses', value: formatPrice(summary.expenses), icon: Receipt, color: 'text-red-400' },
    { label: 'Résultat net', value: formatPrice(summary.netBalance), icon: summary.netBalance >= 0 ? TrendingUp : TrendingDown, color: summary.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'En attente de vérification', value: formatPrice(summary.pendingAmount), icon: Clock, color: 'text-amber-300' },
    { label: 'Paiements confirmés', value: String(summary.paymentCount), icon: BarChart3, color: 'text-[#f7f6f2]' },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Rapports</h1>
          <p className="text-[#a9a9a9] mt-1">Finances de {activeSalon.name} · {from} → {to} (Africa/Abidjan)</p>
        </div>
        <div className="flex gap-1 bg-[#151516] border border-[#2a2a2b] rounded-lg p-1">
          {([['month', 'Mois'], ['30d', '30 jours'], ['year', 'Année']] as [PeriodKey, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${period === key ? 'bg-[#C9A45C] text-[#101010]' : 'text-stone-400 hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg p-3">{error}</p>}
      {loading && <p className="text-sm text-stone-400">Chargement du rapport…</p>}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
                  <div className="flex items-center justify-between"><span className="text-sm text-[#a9a9a9]">{card.label}</span><Icon className={`w-5 h-5 ${card.color}`} /></div>
                  <p className={`text-xl font-bold mt-2 ${card.color}`}>{card.value}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
            <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">Encaissements nets par moyen</h2>
            {Object.keys(summary.byMethod).length === 0 ? (
              <p className="text-sm text-[#a9a9a9]">Aucun encaissement confirmé sur la période.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(summary.byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between text-sm py-1.5 border-b border-[#232326]">
                    <span className="text-[#a9a9a9]">{METHOD_LABELS[method] || method}</span>
                    <span className={`font-semibold ${amount < 0 ? 'text-red-400' : 'text-[#f7f6f2]'}`}>{formatPrice(amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-stone-500 mt-3">Les remboursements et annulations sont déduits. Les paiements en attente ne sont pas comptabilisés.</p>
          </div>
        </>
      )}

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
        <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">Prestations par chiffre d'affaires facturé</h2>
        {performance.length === 0 ? (
          <p className="text-sm text-[#a9a9a9]">Aucune prestation au catalogue.</p>
        ) : (
          <div className="space-y-2">
            {performance.map((srv) => (
              <div key={srv.id} className="flex items-center justify-between text-sm py-1.5 border-b border-[#232326]">
                <div className="min-w-0">
                  <span className="text-[#f7f6f2] truncate">{srv.name}</span>
                  <span className="text-[11px] text-[#a9a9a9] ml-2">{srv.volume} RDV</span>
                </div>
                <span className="font-semibold text-[#E5C378] shrink-0">{formatPrice(srv.totalGeneratedRevenue)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-stone-500 mt-3">Basé sur les rendez-vous chargés (à partir d’aujourd’hui), pas sur la période du rapport financier.</p>
      </div>
    </div>
  );
};
