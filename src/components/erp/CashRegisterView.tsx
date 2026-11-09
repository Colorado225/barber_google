import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { CashSession, PaymentTransaction } from '../../types';
import { paymentSignedAmount } from '../../lib/analytics';
import {
  Receipt,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Wallet,
  Smartphone,
  Scale,
} from 'lucide-react';

const METHOD_LABELS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  moov_money: 'Moov Money',
  cash: 'Espèces',
  card: 'Carte',
};
const KIND_LABELS: Record<string, string> = {
  payment: 'Encaissement',
  refund: 'Remboursement',
  payment_reversal: 'Annulation paiement',
  refund_reversal: 'Annulation remboursement',
};

export const CashRegisterView: React.FC = () => {
  const {
    activeSalon,
    cashSession,
    cashSessions,
    transactions,
    branches,
    formatPrice,
    openNewCashSession,
    closeCurrentCashSession,
    reconcileCashSession,
    confirmPendingPayment,
    rejectPendingPayment,
    recordPaymentCorrection,
    refreshFinance,
  } = useApp();
  const { hasPermission } = useOptionalAuth();
  const canOpen = hasPermission('cash.open', activeSalon.id);
  const canClose = hasPermission('cash.close', activeSalon.id);
  const canReconcile = hasPermission('cash.reconcile', activeSalon.id);
  const canCorrect = hasPermission('payments.correct', activeSalon.id);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingNote, setOpeningNote] = useState('');
  const [closeForm, setCloseForm] = useState<CashSession | null>(null);
  const [counted, setCounted] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [reconcileForm, setReconcileForm] = useState<CashSession | null>(null);
  const [reconcileNote, setReconcileNote] = useState('');
  const [confirmForm, setConfirmForm] = useState<PaymentTransaction | null>(null);
  const [confirmRef, setConfirmRef] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [rejectForm, setRejectForm] = useState<PaymentTransaction | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [correctionForm, setCorrectionForm] = useState<PaymentTransaction | null>(null);
  const [correctionKind, setCorrectionKind] = useState<'refund' | 'payment_reversal' | 'refund_reversal'>(
    'refund',
  );
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionRef, setCorrectionRef] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');

  const salonTransactions = useMemo(
    () => transactions.filter((t) => t.salonId === activeSalon.id),
    [transactions, activeSalon.id],
  );
  const pending = salonTransactions.filter((t) => t.status === 'pending');
  const journal = salonTransactions.slice(0, 30);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      await refreshFinance();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opération impossible.');
    } finally {
      setBusy(false);
    }
  };

  const submitOpen = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await openNewCashSession(Number(openingBalance), branchId || undefined, openingNote);
      setOpenForm(false);
      setOpeningBalance('0');
      setOpeningNote('');
    });
  };

  const submitClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeForm) return;
    void run(async () => {
      await closeCurrentCashSession(Number(counted), closeNote, closeForm.id);
      setCloseForm(null);
      setCounted('');
      setCloseNote('');
    });
  };

  const submitReconcile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileForm) return;
    void run(async () => {
      await reconcileCashSession(reconcileForm.id, reconcileNote);
      setReconcileForm(null);
      setReconcileNote('');
    });
  };

  const submitConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmForm) return;
    void run(async () => {
      await confirmPendingPayment(confirmForm.id, confirmRef, confirmNote);
      setConfirmForm(null);
      setConfirmRef('');
      setConfirmNote('');
    });
  };

  const submitReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectForm) return;
    void run(async () => {
      await rejectPendingPayment(rejectForm.id, rejectReason);
      setRejectForm(null);
      setRejectReason('');
    });
  };

  const openCorrection = (t: PaymentTransaction) => {
    setCorrectionForm(t);
    setCorrectionKind(t.kind === 'refund' ? 'refund_reversal' : 'refund');
    setCorrectionAmount(String(t.amount));
    setCorrectionReason('');
    setCorrectionRef(t.providerReference ?? '');
    setCorrectionNote('');
  };

  const submitCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionForm) return;
    void run(async () => {
      await recordPaymentCorrection({
        originalEntryId: correctionForm.id,
        kind: correctionKind,
        amount: Number(correctionAmount),
        reason: correctionReason,
        providerReference: correctionForm.method === 'cash' ? undefined : correctionRef,
        settlementNote: correctionForm.method === 'cash' ? undefined : correctionNote,
      });
      setCorrectionForm(null);
    });
  };

  const statusBadge = (s: CashSession['status']) => {
    const map = {
      open: 'bg-emerald-950 text-emerald-300 border-emerald-500/30',
      closed: 'bg-amber-950 text-amber-300 border-amber-500/30',
      reconciled: 'bg-sky-950 text-sky-300 border-sky-500/30',
    } as const;
    const label = { open: 'Ouverte', closed: 'Clôturée', reconciled: 'Rapprochée' }[s];
    return <span className={`text-[10px] px-2 py-0.5 rounded border ${map[s]}`}>{label}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Caisse</h1>
          <p className="text-[#a9a9a9] mt-1">Sessions, journal et vérifications manuelles</p>
        </div>
        <div className="flex gap-2">
          {canOpen && !cashSession && (
            <button
              onClick={() => setOpenForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a]"
            >
              <Plus className="w-4 h-4" /> Ouvrir une session
            </button>
          )}
          {canClose && cashSession && (
            <button
              onClick={() => {
                setCloseForm(cashSession);
                setCounted(String(cashSession.theoreticalBalance));
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#222226] text-stone-200 rounded-lg font-semibold hover:bg-[#2b2b30]"
            >
              <Lock className="w-4 h-4" /> Clôturer
            </button>
          )}
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

      {cashSession ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
            <div className="flex items-center justify-between text-sm text-[#a9a9a9]">
              <span>Solde théorique</span>
              <Wallet className="w-5 h-5 text-[#C9A45C]" />
            </div>
            <p className="text-xl font-bold text-[#E5C378] mt-2">
              {formatPrice(cashSession.theoreticalBalance)}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              Fond {formatPrice(cashSession.openingBalance)} · {cashSession.registerName}
            </p>
          </div>
          <div className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
            <div className="flex items-center justify-between text-sm text-[#a9a9a9]">
              <span>Espèces entrées</span>
              <Unlock className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-emerald-400 mt-2">+{formatPrice(cashSession.totalCashIn)}</p>
            <p className="text-[11px] text-stone-500 mt-1">Sorties {formatPrice(cashSession.totalCashOut)}</p>
          </div>
          <div className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
            <div className="flex items-center justify-between text-sm text-[#a9a9a9]">
              <span>Mobile / carte</span>
              <Smartphone className="w-5 h-5 text-sky-400" />
            </div>
            <p className="text-xl font-bold text-sky-400 mt-2">
              +{formatPrice(cashSession.totalMobileMoneyIn)}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              Sorties {formatPrice(cashSession.totalMobileMoneyOut)}
            </p>
          </div>
          <div className="bg-[#151516] p-5 rounded-xl border border-[#2a2a2b]">
            <div className="flex items-center justify-between text-sm text-[#a9a9a9]">
              <span>En attente</span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xl font-bold text-amber-400 mt-2">{pending.length}</p>
            <p className="text-[11px] text-stone-500 mt-1">Paiements à vérifier</p>
          </div>
        </div>
      ) : (
        <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6 text-center py-10 text-[#a9a9a9]">
          <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune session de caisse ouverte</p>
          <p className="text-sm mt-1">Les encaissements en espèces nécessitent une session ouverte.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="bg-[#151516] rounded-xl border border-amber-500/30 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Paiements en attente de vérification
          </h2>
          {pending.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#18181b] border border-[#2a2a2b]"
            >
              <div className="min-w-0">
                <p className="text-sm text-white font-semibold">
                  {t.clientName} · {formatPrice(t.amount)}
                </p>
                <p className="text-[11px] text-stone-400">
                  {METHOD_LABELS[t.method]} · Réf {t.providerReference} · {t.date} {t.time}
                </p>
              </div>
              {canCorrect && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setConfirmForm(t);
                      setConfirmRef(t.providerReference ?? '');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-900/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-900/60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirmer
                  </button>
                  <button
                    onClick={() => setRejectForm(t)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/30 text-red-300 text-xs font-semibold hover:bg-red-900/50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-5">
        <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">Journal des écritures</h2>
        {journal.length === 0 ? (
          <p className="text-sm text-[#a9a9a9]">Aucune écriture enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {journal.map((t) => {
              const signed = paymentSignedAmount(t);
              const canReverse =
                canCorrect && t.status === 'completed' && (t.kind === 'payment' || t.kind === 'refund');
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#18181b] border border-[#2a2a2b] text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-white font-medium">
                      {t.clientName}{' '}
                      <span className="text-[11px] text-stone-500">· {KIND_LABELS[t.kind]}</span>
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {METHOD_LABELS[t.method]} · {t.date} {t.time} {t.reason ? `· ${t.reason}` : ''}
                    </p>
                    <p className="text-[10px] text-stone-500">
                      {t.status === 'pending'
                        ? 'En attente'
                        : t.status === 'cancelled'
                          ? 'Rejeté'
                          : t.settlementMode === 'manual_confirmed'
                            ? 'Vérifié manuellement'
                            : 'Tiroir caisse'}
                      {t.providerReference ? ` · ${t.providerReference}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${signed < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {signed < 0 ? '' : '+'}
                      {formatPrice(signed)}
                    </span>
                    {canReverse && (
                      <button
                        onClick={() => openCorrection(t)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#222226] text-stone-300 text-[11px] hover:bg-[#2b2b30]"
                      >
                        <RotateCcw className="w-3 h-3" /> Corriger
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-5">
        <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">Historique des sessions</h2>
        {cashSessions.length === 0 ? (
          <p className="text-sm text-[#a9a9a9]">Aucune session.</p>
        ) : (
          <div className="space-y-2">
            {cashSessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#18181b] border border-[#2a2a2b] text-sm"
              >
                <div>
                  <div className="flex items-center gap-2 text-white">
                    {statusBadge(s.status)}{' '}
                    <span className="text-[11px] text-stone-400">
                      {s.openedAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Fond {formatPrice(s.openingBalance)}
                    {s.expectedBalance !== undefined && (
                      <>
                        {' '}
                        · Attendu {formatPrice(s.expectedBalance)} · Compté{' '}
                        {formatPrice(s.countedBalance ?? 0)} · Écart {formatPrice(s.difference ?? 0)}
                      </>
                    )}
                  </p>
                </div>
                {canReconcile && s.status === 'closed' && (
                  <button
                    onClick={() => setReconcileForm(s)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-900/30 text-sky-300 text-xs font-semibold hover:bg-sky-900/50"
                  >
                    <Scale className="w-3.5 h-3.5" /> Rapprocher
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modales inline */}
      {openForm && (
        <Modal title="Ouvrir une session" onClose={() => setOpenForm(false)}>
          <form onSubmit={submitOpen} className="space-y-3">
            <Field label="Succursale">
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="input"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fond de caisse (FCFA)">
              <input
                type="number"
                min="0"
                step="1"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Note">
              <input
                type="text"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                className="input"
              />
            </Field>
            <button disabled={busy} className="btn-gold w-full">
              Ouvrir
            </button>
          </form>
        </Modal>
      )}

      {closeForm && (
        <Modal title="Clôturer la session" onClose={() => setCloseForm(null)}>
          <form onSubmit={submitClose} className="space-y-3">
            <p className="text-xs text-stone-400">
              Solde théorique :{' '}
              <span className="text-[#E5C378] font-bold">{formatPrice(closeForm.theoreticalBalance)}</span>
            </p>
            <Field label="Montant compté (FCFA)">
              <input
                type="number"
                min="0"
                step="1"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                required
                className="input"
              />
            </Field>
            {counted !== '' && (
              <p
                className={`text-xs ${Number(counted) - closeForm.theoreticalBalance === 0 ? 'text-emerald-400' : 'text-amber-300'}`}
              >
                Écart : {formatPrice(Number(counted) - closeForm.theoreticalBalance)}
              </p>
            )}
            <Field label="Note de clôture">
              <input
                type="text"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                className="input"
              />
            </Field>
            <button disabled={busy} className="btn-gold w-full">
              Clôturer
            </button>
          </form>
        </Modal>
      )}

      {reconcileForm && (
        <Modal title="Rapprocher la session" onClose={() => setReconcileForm(null)}>
          <form onSubmit={submitReconcile} className="space-y-3">
            <p className="text-xs text-stone-400">
              Écart constaté :{' '}
              <span className="text-amber-300 font-bold">{formatPrice(reconcileForm.difference ?? 0)}</span>
            </p>
            <Field label="Justification (obligatoire)">
              <textarea
                value={reconcileNote}
                onChange={(e) => setReconcileNote(e.target.value)}
                required
                minLength={3}
                className="input min-h-20"
              />
            </Field>
            <button disabled={busy} className="btn-gold w-full">
              Rapprocher
            </button>
          </form>
        </Modal>
      )}

      {confirmForm && (
        <Modal title="Vérification manuelle" onClose={() => setConfirmForm(null)}>
          <form onSubmit={submitConfirm} className="space-y-3">
            <p className="text-xs text-stone-400">
              Confirmez uniquement après avoir vérifié la référence dans le relevé marchand. Cette action
              n’interroge pas l’opérateur.
            </p>
            <Field label="Référence opérateur">
              <input
                type="text"
                value={confirmRef}
                onChange={(e) => setConfirmRef(e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Note de vérification (min. 10 caractères)">
              <textarea
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                required
                minLength={10}
                className="input min-h-20"
                placeholder="Ex: reçu vérifié dans le relevé Wave du 04/11"
              />
            </Field>
            <button disabled={busy} className="btn-gold w-full">
              Confirmer le paiement
            </button>
          </form>
        </Modal>
      )}

      {rejectForm && (
        <Modal title="Rejeter le paiement" onClose={() => setRejectForm(null)}>
          <form onSubmit={submitReject} className="space-y-3">
            <Field label="Motif du rejet">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                minLength={3}
                className="input"
              />
            </Field>
            <button
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-red-900/40 text-red-300 font-bold text-xs"
            >
              Rejeter
            </button>
          </form>
        </Modal>
      )}

      {correctionForm && (
        <Modal title="Correction / remboursement" onClose={() => setCorrectionForm(null)}>
          <form onSubmit={submitCorrection} className="space-y-3">
            <p className="text-xs text-stone-400">
              Écriture d’origine : {KIND_LABELS[correctionForm.kind]} {formatPrice(correctionForm.amount)} ·{' '}
              {METHOD_LABELS[correctionForm.method]}
            </p>
            <Field label="Type de correction">
              <select
                value={correctionKind}
                onChange={(e) => setCorrectionKind(e.target.value as typeof correctionKind)}
                className="input"
              >
                {correctionForm.kind === 'refund' ? (
                  <option value="refund_reversal">Annuler le remboursement</option>
                ) : (
                  <>
                    <option value="refund">Remboursement</option>
                    <option value="payment_reversal">Annulation du paiement</option>
                  </>
                )}
              </select>
            </Field>
            <Field label="Montant (FCFA)">
              <input
                type="number"
                min="1"
                step="1"
                max={correctionForm.amount}
                value={correctionAmount}
                onChange={(e) => setCorrectionAmount(e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Motif (obligatoire)">
              <input
                type="text"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                required
                minLength={3}
                className="input"
              />
            </Field>
            {correctionForm.method !== 'cash' && (
              <>
                <Field label="Référence opérateur">
                  <input
                    type="text"
                    value={correctionRef}
                    onChange={(e) => setCorrectionRef(e.target.value)}
                    required
                    className="input"
                  />
                </Field>
                <Field label="Note de vérification manuelle (min. 10 caractères)">
                  <textarea
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    required
                    minLength={10}
                    className="input min-h-20"
                  />
                </Field>
              </>
            )}
            <button disabled={busy} className="btn-gold w-full">
              Enregistrer la correction
            </button>
          </form>
        </Modal>
      )}

      <style>{`
        .input { width: 100%; background: #111113; border: 1px solid #29292e; border-radius: 0.75rem; padding: 0.5rem 0.75rem; font-size: 0.75rem; color: #fff; }
        .input:focus { outline: none; border-color: #C9A45C; }
        .btn-gold { background: #C9A45C; color: #101010; font-weight: 700; font-size: 0.75rem; padding: 0.75rem; border-radius: 0.75rem; }
        .btn-gold:hover { background: #d8b56d; }
        .btn-gold:disabled { opacity: 0.6; }
      `}</style>
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-white">
          <XCircle className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-xs font-semibold text-stone-300 block mb-1">{label}</label>
    {children}
  </div>
);
