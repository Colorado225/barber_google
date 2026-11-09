import React, { useEffect, useState } from 'react';
import {
  cancelPlatformSalonSubscription,
  extendPlatformSalonSubscription,
  getPlatformSalon360,
  type PlatformSalon360,
} from '../../lib/platform-admin';
import { useOptionalApp } from '../../context/AppContext';
import { ReasonDialog } from './ReasonDialog';

interface SalonDetailDrawerProps {
  salonId: string;
  onClose: () => void;
  /** Relit les listes après une action (abonnement modifié). */
  onChanged: () => void | Promise<void>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  checked_in: 'Arrivé',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

const SUB_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Paiement en attente',
  trialing: 'Essai',
  active: 'Actif',
  past_due: 'Impayé',
  cancelled: 'Annulé',
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#C9A45C]">{title}</h3>
    <div className="text-xs text-stone-300 space-y-1.5">{children}</div>
  </section>
);

/**
 * Fiche salon 360 : lecture seule de l'état d'un salon (base), plus deux actions d'abonnement tracées.
 * Aucune donnée personnelle de clients finaux n'est affichée (compteurs uniquement).
 */
export const SalonDetailDrawer: React.FC<SalonDetailDrawerProps> = ({ salonId, onClose, onChanged }) => {
  const { addToast, formatPrice } = useOptionalApp();
  const [data, setData] = useState<PlatformSalon360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [extendDays, setExtendDays] = useState(15);
  const [pendingExtend, setPendingExtend] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPlatformSalon360(salonId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Fiche indisponible.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salonId, reloadKey]);

  const refresh = async () => {
    setReloadKey((k) => k + 1);
    await onChanged();
  };

  const confirmExtend = async (reason: string) => {
    if (pendingExtend === null) return;
    await extendPlatformSalonSubscription(salonId, pendingExtend, reason);
    setPendingExtend(null);
    addToast(`Abonnement prolongé de ${pendingExtend} jour(s).`, 'success');
    await refresh();
  };

  const confirmCancel = async (reason: string) => {
    await cancelPlatformSalonSubscription(salonId, reason);
    setCancelOpen(false);
    addToast('Abonnement annulé. Les données du salon sont conservées.', 'info');
    await refresh();
  };

  const sub = data?.subscription ?? null;
  const quotaStaff =
    sub && sub.max_staff !== null
      ? `${sub.staff_active} / ${sub.max_staff}`
      : sub
        ? `${sub.staff_active} / illimité`
        : '—';
  const quotaBranches =
    sub && sub.max_branches !== null
      ? `${sub.branches} / ${sub.max_branches}`
      : sub
        ? `${sub.branches} / illimité`
        : '—';

  return (
    <div
      className="fixed inset-0 z-[110] flex justify-end bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salon-360-title"
    >
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-[#0b0b0f] border-l border-[#262632] p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="salon-360-title" className="text-lg font-black text-white">
              {data?.salon.name ?? 'Fiche salon'}
            </h2>
            {data && (
              <p className="text-xs text-stone-400">
                {data.salon.organization_name ?? '—'} · {data.salon.commune ?? data.salon.city ?? '—'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#181820] text-stone-300 text-xs font-semibold"
          >
            Fermer
          </button>
        </div>

        {loading && <p className="text-xs text-stone-500">Chargement de la fiche depuis la base…</p>}
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}

        {data && (
          <>
            <Section title="Statut">
              <p>
                Accès :{' '}
                <strong className="text-white">
                  {data.salon.platform_status === 'suspended' ? 'suspendu' : 'actif'}
                </strong>
                {data.salon.platform_status_reason ? ` (${data.salon.platform_status_reason})` : ''}
              </p>
              <p>
                Marketplace : {data.salon.is_published ? 'publié' : 'non publié'} ·{' '}
                {data.salon.is_verified ? 'certifié' : 'non certifié'}
              </p>
            </Section>

            <Section title="Propriétaires et gérants">
              {data.owners.length === 0 ? (
                <p className="text-stone-500">Aucun propriétaire rattaché.</p>
              ) : (
                data.owners.map((o, i) => (
                  <p key={`${o.email ?? 'inconnu'}-${i}`}>
                    {o.email ?? 'Compte sans e-mail'} · {o.role} ·{' '}
                    {o.status === 'active' ? 'actif' : 'suspendu'}
                  </p>
                ))
              )}
            </Section>

            <Section title="Activité (30 derniers jours)">
              <p>
                Rendez-vous : <strong className="text-white">{data.activity_30d.appointments}</strong>
                {Object.entries(data.activity_30d.appointments_by_status).map(([status, n]) => (
                  <span key={status} className="ml-2 text-stone-400">
                    {STATUS_LABELS[status] ?? status} {n}
                  </span>
                ))}
              </p>
              <p>Revenu net : {formatPrice(data.activity_30d.net_revenue_xof)}</p>
              <p>
                Avis : {data.activity_30d.reviews} visibles
                {data.activity_30d.average_rating !== null
                  ? ` · note moyenne ${data.activity_30d.average_rating}/5`
                  : ''}
                {data.activity_30d.hidden_reviews > 0 ? ` · ${data.activity_30d.hidden_reviews} masqués` : ''}
              </p>
            </Section>

            <Section title="Ressources">
              <p>
                Succursales : {data.counts.branches} · Personnel actif : {data.counts.staff_active} (total{' '}
                {data.counts.staff_total})
              </p>
              <p>
                Clients enregistrés : {data.counts.clients} · Prestations actives :{' '}
                {data.counts.services_active}
              </p>
              <p>Stock sous le seuil : {data.counts.stock_low}</p>
            </Section>

            <Section title="Abonnement et quotas">
              {sub ? (
                <>
                  <p>
                    <strong className="text-white">{sub.plan_name}</strong> ·{' '}
                    {SUB_STATUS_LABELS[sub.status] ?? sub.status} ·{' '}
                    {sub.billing_period === 'yearly' ? 'annuel' : 'mensuel'} ·{' '}
                    {formatPrice(sub.price_at_subscription)}
                  </p>
                  <p>
                    Période en cours jusqu’au {new Date(sub.current_period_end).toLocaleDateString('fr-FR')}
                  </p>
                  <p>
                    Quota personnel : {quotaStaff} · Quota succursales : {quotaBranches}
                  </p>

                  <div className="pt-2 space-y-2 border-t border-[#1c1c24]">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-stone-300" htmlFor="extend-days">
                        Prolonger de
                      </label>
                      <input
                        id="extend-days"
                        type="number"
                        min={1}
                        max={90}
                        value={extendDays}
                        onChange={(e) => setExtendDays(Number(e.target.value))}
                        className="w-20 bg-[#08080a] border border-[#202028] rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                      <span className="text-xs text-stone-300">jours (1 à 90)</span>
                      <button
                        type="button"
                        disabled={!Number.isInteger(extendDays) || extendDays < 1 || extendDays > 90}
                        onClick={() => setPendingExtend(extendDays)}
                        className="px-3 py-1.5 rounded-lg bg-[#1a1a22] hover:bg-[#242430] text-stone-200 text-xs font-semibold disabled:opacity-40"
                      >
                        Prolonger
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-red-950/40 text-red-300 border border-red-800/40 text-xs font-semibold"
                    >
                      Annuler l’abonnement
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-stone-500">Aucun abonnement en cours. Quotas non appliqués.</p>
              )}
            </Section>

            <Section title="Historique des abonnements">
              {data.subscription_history.length === 0 ? (
                <p className="text-stone-500">Aucun abonnement enregistré.</p>
              ) : (
                data.subscription_history.map((h) => (
                  <p key={h.id}>
                    {new Date(h.started_at).toLocaleDateString('fr-FR')} · {h.plan_name} ·{' '}
                    {SUB_STATUS_LABELS[h.status] ?? h.status}
                  </p>
                ))
              )}
            </Section>

            <Section title="Paiements déclarés">
              {data.payment_declarations.length === 0 ? (
                <p className="text-stone-500">Aucun paiement déclaré.</p>
              ) : (
                data.payment_declarations.map((p) => (
                  <p key={p.id}>
                    {new Date(p.declared_at).toLocaleDateString('fr-FR')} · {formatPrice(p.amount_xof)} ·{' '}
                    {p.method} · réf. {p.reference} ·{' '}
                    {p.status === 'pending'
                      ? 'à valider'
                      : p.status === 'confirmed'
                        ? 'validé'
                        : `rejeté${p.decision_reason ? ` (${p.decision_reason})` : ''}`}
                  </p>
                ))
              )}
            </Section>

            <Section title="Journal des décisions">
              {data.audit.length === 0 ? (
                <p className="text-stone-500">Aucune décision enregistrée pour ce salon.</p>
              ) : (
                data.audit.map((a) => (
                  <p key={a.id}>
                    {new Date(a.created_at).toLocaleString('fr-FR')} ·{' '}
                    <span className="text-white">{a.action}</span> · {a.actor_email ?? 'Système'}
                    {typeof a.details.reason === 'string' ? ` · motif : ${a.details.reason}` : ''}
                  </p>
                ))
              )}
            </Section>
          </>
        )}
      </aside>

      {pendingExtend !== null && (
        <ReasonDialog
          title={`Prolonger l’abonnement de ${pendingExtend} jour(s)`}
          description="La fin de période est décalée de ce nombre de jours. Le motif est conservé dans le journal."
          confirmLabel="Prolonger"
          onConfirm={confirmExtend}
          onCancel={() => setPendingExtend(null)}
        />
      )}
      {cancelOpen && (
        <ReasonDialog
          title="Annuler l’abonnement"
          description="L’abonnement passe en « annulé » et la formule est retirée du salon. Aucune donnée n’est supprimée. Les paiements en attente sont rejetés."
          confirmLabel="Annuler l’abonnement"
          tone="danger"
          onConfirm={confirmCancel}
          onCancel={() => setCancelOpen(false)}
        />
      )}
    </div>
  );
};
