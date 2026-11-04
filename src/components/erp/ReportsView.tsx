import React from 'react';
import { useApp } from '../../context/AppContext';
import { buildServicePerformance } from '../../lib/analytics';
import { BarChart3, TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { activeSalon, appointments, transactions, expenses, services, formatPrice } = useApp();

  const salonAppointments = appointments.filter((a) => a.salonId === activeSalon.id);
  const salonTransactions = transactions.filter(
    (t) => t.salonId === activeSalon.id && t.status === 'completed'
  );
  const salonExpenses = expenses.filter((e) => e.salonId === activeSalon.id);
  const salonServices = services.filter((s) => s.salonId === activeSalon.id);

  const revenue = salonTransactions.reduce((acc, t) => acc + t.amount, 0);
  const spent = salonExpenses.reduce((acc, e) => acc + e.amount, 0);
  const margin = revenue - spent;

  const byMethod = salonTransactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.method] = (acc[t.method] || 0) + t.amount;
    return acc;
  }, {});

  const performance = buildServicePerformance(salonAppointments, salonServices, 'revenue');
  const hasData = salonTransactions.length > 0 || salonAppointments.length > 0;

  const METHOD_LABELS: Record<string, string> = {
    wave: 'Wave',
    orange_money: 'Orange Money',
    mtn_momo: 'MTN MoMo',
    moov_money: 'Moov Money',
    cash: 'Espèces',
    card: 'Carte bancaire'
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f7f6f2]">Rapports</h1>
        <p className="text-[#a9a9a9] mt-1">
          Statistiques et analyses de {activeSalon.name}
        </p>
      </div>

      {!hasData ? (
        <div className="bg-[#151516] rounded-xl border border-[#2a2a2b]">
          <div className="p-6 text-center py-12 text-[#a9a9a9]">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune donnée disponible</p>
            <p className="text-sm mt-1">
              Les rapports apparaîtront dès les premiers rendez-vous et encaissements.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#a9a9a9]">Encaissé</span>
                <Wallet className="w-5 h-5 text-[#C9A45C]" />
              </div>
              <p className="text-xl font-bold text-[#f7f6f2] mt-2">{formatPrice(revenue)}</p>
            </div>
            <div className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#a9a9a9]">Dépenses</span>
                <Receipt className="w-5 h-5 text-[#C9A45C]" />
              </div>
              <p className="text-xl font-bold text-[#f7f6f2] mt-2">{formatPrice(spent)}</p>
            </div>
            <div className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#a9a9a9]">Résultat estimé</span>
                {margin >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <p
                className={`text-xl font-bold mt-2 ${margin >= 0 ? 'text-[#E5C378]' : 'text-red-400'}`}
              >
                {formatPrice(margin)}
              </p>
            </div>
            <div className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#a9a9a9]">Rendez-vous</span>
                <BarChart3 className="w-5 h-5 text-[#C9A45C]" />
              </div>
              <p className="text-xl font-bold text-[#f7f6f2] mt-2">{salonAppointments.length}</p>
            </div>
          </div>

          <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
            <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">Encaissements par moyen</h2>
            {Object.keys(byMethod).length === 0 ? (
              <p className="text-sm text-[#a9a9a9]">Aucun encaissement enregistré.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byMethod)
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, amount]) => (
                    <div
                      key={method}
                      className="flex items-center justify-between text-sm py-1.5 border-b border-[#232326]"
                    >
                      <span className="text-[#a9a9a9]">{METHOD_LABELS[method] || method}</span>
                      <span className="font-semibold text-[#f7f6f2]">{formatPrice(amount)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
            <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">
              Prestations par chiffre d'affaires
            </h2>
            {performance.length === 0 ? (
              <p className="text-sm text-[#a9a9a9]">Aucune prestation au catalogue.</p>
            ) : (
              <div className="space-y-2">
                {performance.map((srv: { id: React.Key | null | undefined; name: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; volume: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; totalGeneratedRevenue: number; }) => (
                  <div
                    key={srv.id}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-[#232326]"
                  >
                    <div className="min-w-0">
                      <span className="text-[#f7f6f2] truncate">{srv.name}</span>
                      <span className="text-[11px] text-[#a9a9a9] ml-2">{srv.volume} RDV</span>
                    </div>
                    <span className="font-semibold text-[#E5C378] shrink-0">
                      {formatPrice(srv.totalGeneratedRevenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
