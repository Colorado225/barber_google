import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AppointmentBalance, PaymentMethod, PaymentTransaction } from '../../types';
import { X, CreditCard, CheckCircle2, Printer, Clock, AlertTriangle } from 'lucide-react';

interface NewPaymentModalProps {
  onClose: () => void;
  preselectedAppointmentId?: string;
  defaultAmount?: number;
  defaultClientName?: string;
}

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'wave', label: 'Wave' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'mtn_momo', label: 'MTN MoMo' },
  { id: 'moov_money', label: 'Moov Money' },
  { id: 'cash', label: 'Espèces' },
  { id: 'card', label: 'Carte bancaire' },
];

export const NewPaymentModal: React.FC<NewPaymentModalProps> = ({
  onClose,
  preselectedAppointmentId,
  defaultAmount,
  defaultClientName = '',
}) => {
  const { activeSalon, formatPrice, recordPayment, getAppointmentBalance, appointments, cashSession } = useApp();

  const [linkedAptId, setLinkedAptId] = useState<string>(preselectedAppointmentId || '');
  const [amount, setAmount] = useState(String(defaultAmount ?? ''));
  const [method, setMethod] = useState<PaymentMethod>('wave');
  const [providerReference, setProviderReference] = useState('');
  const [reason, setReason] = useState('');
  const [balance, setBalance] = useState<AppointmentBalance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [createdReceipt, setCreatedReceipt] = useState<PaymentTransaction | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const payableAppointments = useMemo(
    () => appointments.filter(
      (a) => a.salonId === activeSalon.id
        && a.paymentStatus !== 'paid'
        && a.status !== 'cancelled'
        && a.status !== 'no_show'
    ),
    [appointments, activeSalon.id]
  );
  const selectedApt = appointments.find((a) => a.id === linkedAptId) ?? null;
  const isCash = method === 'cash';

  useEffect(() => {
    if (!linkedAptId) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setBalanceError(null);
    getAppointmentBalance(linkedAptId)
      .then((b) => {
        if (cancelled) return;
        setBalance(b);
        setAmount(String(b.outstanding > 0 ? b.outstanding : ''));
      })
      .catch((error) => {
        if (!cancelled) setBalanceError(error instanceof Error ? error.message : 'Solde du rendez-vous indisponible.');
      });
    return () => { cancelled = true; };
  }, [linkedAptId, getAppointmentBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    if (!linkedAptId) {
      setPaymentError('Sélectionnez un rendez-vous à encaisser.');
      return;
    }
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setPaymentError('Le montant doit être un entier positif en FCFA.');
      return;
    }
    if (balance && value > balance.outstanding) {
      setPaymentError(`Le montant dépasse le reste à payer (${formatPrice(balance.outstanding)}).`);
      return;
    }
    if (!isCash && providerReference.trim().length < 4) {
      setPaymentError('La référence de transaction opérateur est requise pour ce moyen de paiement.');
      return;
    }
    if (isCash && !cashSession) {
      setPaymentError('Ouvrez une session de caisse avant d’encaisser des espèces.');
      return;
    }
    setSubmitting(true);
    try {
      const tx = await recordPayment({
        appointmentId: linkedAptId,
        amount: value,
        method,
        providerReference: isCash ? undefined : providerReference.trim(),
        reason: reason.trim(),
      });
      setCreatedReceipt(tx);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Enregistrement du paiement impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const pending = createdReceipt?.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl shadow-2xl p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#222226] text-stone-400 hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {!createdReceipt ? (
          <div>
            <div className="mb-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C9A45C] mb-1">
                <CreditCard className="w-4 h-4" />
                <span>Caisse & Encaissement</span>
              </div>
              <h2 className="text-xl font-bold text-white">Nouvel Encaissement</h2>
              <p className="text-xs text-stone-400 mt-1">
                Lié à un rendez-vous ou à un client de passage. Les paiements Mobile Money restent en attente jusqu’à vérification manuelle.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                  Rendez-vous / passage à encaisser *
                </label>
                <select
                  value={linkedAptId}
                  onChange={(e) => setLinkedAptId(e.target.value)}
                  disabled={Boolean(preselectedAppointmentId)}
                  required
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C] disabled:opacity-70"
                >
                  <option value="">-- Sélectionner un rendez-vous ou passage --</option>
                  {payableAppointments.map((apt) => (
                    <option key={apt.id} value={apt.id}>
                      {apt.source === 'walk_in' ? '[Sans RDV] ' : ''}{apt.clientName} - {apt.serviceName} ({formatPrice(apt.price)})
                    </option>
                  ))}
                </select>
                {selectedApt && (
                  <p className="text-[11px] text-stone-500 mt-1">
                    Client : <span className="text-stone-300">{selectedApt.clientName || defaultClientName}</span>
                    {balance && <> · Reste à payer : <span className="text-[#E5C378]">{formatPrice(balance.outstanding)}</span></>}
                    {balance && balance.pending > 0 && <> · En attente : {formatPrice(balance.pending)}</>}
                  </p>
                )}
                {balanceError && <p role="alert" className="text-[11px] text-red-300 mt-1">{balanceError}</p>}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                  Montant encaissé (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  max={balance?.outstanding || undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2.5 text-base font-extrabold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1.5">
                  Moyen de paiement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                        method === m.id
                          ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                          : 'bg-[#111113] border-[#29292e] text-stone-400 hover:border-stone-500'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {!isCash && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                    Référence transaction opérateur *
                  </label>
                  <input
                    type="text"
                    required
                    value={providerReference}
                    onChange={(e) => setProviderReference(e.target.value)}
                    placeholder="Ex: WAVE-123456789"
                    className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Cette référence ne confirme pas le paiement : un responsable devra la vérifier manuellement.
                  </p>
                </div>
              )}

              {isCash && !cashSession && (
                <p role="alert" className="flex items-center gap-1.5 text-[11px] text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" /> Aucune session de caisse ouverte.
                </p>
              )}

              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                  Note (optionnel)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: acompte, solde, geste commercial"
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="pt-2">
                {paymentError && <p role="alert" className="mb-3 text-xs text-red-300">{paymentError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] disabled:opacity-60 text-[#101010] font-bold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Enregistrement…' : `Valider l'encaissement${amount ? ` de ${formatPrice(Number(amount))}` : ''}`}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4 text-center animate-in zoom-in-95">
            <div className={`w-14 h-14 rounded-full border mx-auto flex items-center justify-center ${
              pending ? 'bg-amber-950 border-amber-500/40 text-amber-400' : 'bg-emerald-950 border-emerald-500/40 text-emerald-400'
            }`}>
              {pending ? <Clock className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
            </div>

            <div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${pending ? 'text-amber-400' : 'text-emerald-400'}`}>
                {pending ? 'EN ATTENTE DE VÉRIFICATION' : 'ENCAISSEMENT CONFIRMÉ'}
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Ticket #{createdReceipt.reference}</h3>
              {pending && (
                <p className="text-xs text-stone-400 mt-1">
                  Ce paiement n’est pas encore comptabilisé. Vérifiez la référence opérateur depuis la caisse pour le confirmer.
                </p>
              )}
            </div>

            <div className="bg-[#101012] border border-[#26262a] rounded-2xl p-4 text-xs text-left space-y-2 text-stone-300 font-mono">
              <div className="text-center pb-2 border-b border-[#232326] font-sans">
                <div className="font-bold text-white text-sm">{activeSalon.name}</div>
              </div>
              <div className="flex justify-between"><span>Date & Heure :</span><span className="text-white">{createdReceipt.date} {createdReceipt.time}</span></div>
              <div className="flex justify-between"><span>Client :</span><span className="text-white font-bold">{createdReceipt.clientName}</span></div>
              <div className="flex justify-between"><span>Mode :</span><span className="text-white font-bold uppercase">{createdReceipt.method.replace('_', ' ')}</span></div>
              {createdReceipt.providerReference && (
                <div className="flex justify-between"><span>Réf. opérateur :</span><span className="text-[#C9A45C] font-bold">{createdReceipt.providerReference}</span></div>
              )}
              <div className="pt-2 border-t border-[#232326] flex justify-between text-sm font-sans font-extrabold text-white">
                <span>{pending ? 'MONTANT EN ATTENTE :' : 'TOTAL PAYÉ :'}</span>
                <span className="text-[#E5C378]">{formatPrice(createdReceipt.amount)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[#222226] hover:bg-[#2b2b30] text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4 text-[#C9A45C]" />
                <span>Imprimer</span>
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold transition-colors"
              >
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
