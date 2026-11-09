import React from 'react';
import type { PlatformOverview as PlatformOverviewData } from '../../lib/platform-admin';
import type { PlatformAuditEntry } from '../../lib/superadmin';
import { useOptionalApp } from '../../context/AppContext';

interface PlatformOverviewProps {
  overview: PlatformOverviewData | null;
  loading: boolean;
  recentDecisions: PlatformAuditEntry[];
  /** Ouvre l'onglet correspondant de la console. */
  onNavigate: (tab: string) => void;
}

const Kpi: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <div className="p-5 rounded-2xl bg-[#0d0d10] border border-[#1d1d24] space-y-1">
    <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">{label}</div>
    <div className="text-2xl font-black text-white">{value}</div>
    {hint && <div className="text-[11px] text-stone-500">{hint}</div>}
  </div>
);

/**
 * Vue d'ensemble de la plateforme. Chaque indicateur est lu depuis la base (RPC `platform_dashboard_overview`).
 * Sans réponse, aucune valeur n'est affichée à la place.
 */
export const PlatformOverview: React.FC<PlatformOverviewProps> = ({
  overview,
  loading,
  recentDecisions,
  onNavigate,
}) => {
  const { formatPrice } = useOptionalApp();

  if (!overview) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-black text-white tracking-tight">Tableau de Bord Exécutif</h1>
        <p className="text-sm text-stone-400">
          {loading
            ? 'Chargement des indicateurs depuis la base…'
            : 'Indicateurs indisponibles : la base ne répond pas ou l’accès est refusé.'}
        </p>
      </div>
    );
  }

  const todo: Array<{ id: string; label: string; count: number; tab: string }> = [
    {
      id: 'payments',
      label: 'Paiements d’abonnement à valider',
      count: overview.payments.awaiting_review,
      tab: 'pricing',
    },
    {
      id: 'overages',
      label: 'Salons au-dessus de leur quota',
      count: overview.quota_overages,
      tab: 'salons',
    },
    {
      id: 'expiring',
      label: 'Abonnements échéant sous 7 jours',
      count: overview.subscriptions.expiring_7d,
      tab: 'subscriptions',
    },
    {
      id: 'past_due',
      label: 'Abonnements en impayé',
      count: overview.subscriptions.past_due,
      tab: 'subscriptions',
    },
    { id: 'hidden', label: 'Avis masqués par la plateforme', count: overview.reviews.hidden, tab: 'reviews' },
    { id: 'suspended', label: 'Salons suspendus', count: overview.salons.suspended, tab: 'salons' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Tableau de Bord Exécutif</h1>
        <p className="text-xs text-stone-400 mt-1">
          Indicateurs calculés par la base à l’instant de la consultation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Salons"
          value={overview.salons.total}
          hint={`${overview.salons.published} publiés · ${overview.salons.verified} certifiés`}
        />
        <Kpi
          label="Abonnements actifs"
          value={overview.subscriptions.active}
          hint={`${overview.subscriptions.pending_payment} en attente de paiement`}
        />
        <Kpi
          label="MRR estimé"
          value={formatPrice(overview.subscriptions.mrr_xof)}
          hint="Annuel ramené au mois"
        />
        <Kpi
          label="Revenu net 30 j"
          value={formatPrice(overview.activity_30d.net_revenue_xof)}
          hint="Paiements confirmés, remboursements déduits"
        />
        <Kpi
          label="Rendez-vous 30 j"
          value={overview.activity_30d.appointments}
          hint={`${overview.activity_30d.appointments_completed} terminés · ${overview.activity_30d.appointments_upcoming_7d} à venir (7 j)`}
        />
        <Kpi label="Avis" value={overview.reviews.total} hint={`${overview.reviews.hidden} masqués`} />
        <Kpi label="Journal 24 h" value={overview.audit_24h} hint="Décisions SuperAdmin" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">À traiter</h2>
        <ul className="divide-y divide-[#15151c] rounded-2xl border border-[#1f1f27] bg-[#0a0a0d]">
          {todo.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-3 text-xs text-stone-300">
              <span>{item.label}</span>
              <span className="flex items-center gap-3">
                <span className={`font-bold ${item.count > 0 ? 'text-[#E5C378]' : 'text-stone-500'}`}>
                  {item.count}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className="px-2.5 py-1 rounded-lg bg-[#1a1a22] hover:bg-[#242430] text-stone-300 font-semibold"
                >
                  Ouvrir
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white">Dernières décisions</h2>
        {recentDecisions.length === 0 ? (
          <p className="text-xs text-stone-500">Aucune décision enregistrée.</p>
        ) : (
          <ul className="divide-y divide-[#15151c] rounded-2xl border border-[#1f1f27]">
            {recentDecisions.slice(0, 5).map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-stone-300"
              >
                <span className="text-white">{log.action}</span>
                <span className="text-stone-500">
                  {new Date(log.createdAt).toLocaleString('fr-FR')} · {log.actorEmail ?? 'Système'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
