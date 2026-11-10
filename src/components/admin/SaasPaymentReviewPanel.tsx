import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { getSaasPaymentsForReview, reviewSaasPayment, type SaaSPaymentReviewItem } from '../../lib/saas';

const METHOD_LABELS: Record<string, string> = {
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
  cash: 'Espèces',
  other: 'Autre',
};

interface SaasPaymentReviewPanelProps {
  formatPrice: (amount: number) => string;
  onDecision?: () => void;
  listPayments?: typeof getSaasPaymentsForReview;
  decidePayment?: typeof reviewSaasPayment;
}

/**
 * File de validation des paiements d'abonnement déclarés par les salons.
 * Une souscription n'est activée qu'après « Confirmer » ; « Rejeter » exige un motif.
 * Chaque décision est tracée côté serveur (platform_audit_logs).
 */
export const SaasPaymentReviewPanel: React.FC<SaasPaymentReviewPanelProps> = ({
  formatPrice,
  onDecision,
  listPayments = getSaasPaymentsForReview,
  decidePayment = reviewSaasPayment,
}) => {
  const [items, setItems] = useState<SaaSPaymentReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listPayments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [listPayments]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (item: SaaSPaymentReviewItem, decision: 'confirm' | 'reject') => {
    if (decision === 'reject' && reason.trim().length < 3) {
      setError('Indiquez un motif de rejet (3 caractères minimum).');
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      await decidePayment(item.id, decision, decision === 'reject' ? reason.trim() : undefined);
      setRejectingId(null);
      setReason('');
      await load();
      onDecision?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Décision impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#27272c] bg-[#121216] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white">Paiements d’abonnement à valider</h2>
          <p className="text-xs text-stone-400">
            Un abonnement n’est activé qu’après confirmation du paiement. Chaque décision est enregistrée dans
            le journal d’audit.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-[#1d1d22] border border-[#2a2a31] text-xs text-stone-300 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-stone-500">Aucun paiement en attente de validation.</p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-[#26262c] bg-[#0f0f12] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs text-stone-300 space-y-0.5">
                <div className="font-bold text-white">{item.salonName}</div>
                <div>
                  Forfait : <strong className="text-white">{item.planName}</strong> · Montant :{' '}
                  <strong className="text-[#E5C378]">{formatPrice(item.amountXof)}</strong>
                </div>
                <div>
                  {METHOD_LABELS[item.method] ?? item.method} · Référence :{' '}
                  <strong className="text-white">{item.reference}</strong> · Déclaré le{' '}
                  {new Date(item.declaredAt).toLocaleString('fr-FR')}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => decide(item, 'confirm')}
                  disabled={busyId === item.id}
                  className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmer</span>
                </button>
                <button
                  onClick={() => {
                    setRejectingId(rejectingId === item.id ? null : item.id);
                    setReason('');
                  }}
                  disabled={busyId === item.id}
                  className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Rejeter</span>
                </button>
              </div>
            </div>

            {rejectingId === item.id && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  placeholder="Motif du rejet (visible par le salon)"
                  className="flex-1 rounded-lg bg-[#0a0a0c] border border-[#26262c] px-3 py-2 text-xs text-white"
                />
                <button
                  onClick={() => decide(item, 'reject')}
                  disabled={busyId === item.id}
                  className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold disabled:opacity-50"
                >
                  Confirmer le rejet
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
