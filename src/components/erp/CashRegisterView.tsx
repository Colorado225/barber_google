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
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Caisse</h1>
          <p className="mt-1 text-[#a9a9a9]">Sessions, journal et vérifications manuelles</p>
        </div>
        <div className="flex w-full gap-2 min-[480px]:w-auto">
          {canOpen && !cashSession && (
            <button
              type="button"
              onClick={() => setOpenForm(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C9A45C] px-4 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#d4b26a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white min-[480px]:flex-none"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Ouvrir une session
            </button>
          )}
          {canClose && cashSession && (
            <button
              type="button"
              onClick={() => {
                setCloseForm(cashSession);
                setCounted(String(cashSession.theoreticalBalance));
              }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#222226] px-4 text-sm font-semibold text-stone-200 transition-colors hover:bg-[#2b2b30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] min-[480px]:flex-none"
            >
              <Lock className="h-4 w-4" aria-hidden="true" /> Clôturer
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
          <div className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4 sm:p-5">
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
          <div className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4 sm:p-5">
            <div className="flex items-center justify-between text-sm text-[#a9a9a9]">
              <span>Espèces entrées</span>
              <Unlock className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-emerald-400 mt-2">+{formatPrice(cashSession.totalCashIn)}</p>
            <p className="text-[11px] text-stone-500 mt-1">Sorties {formatPrice(cashSession.totalCashOut)}</p>
          </div>
          <div className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4 sm:p-5">
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
          <div className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4 sm:p-5">
            <div className="flex items-center justify-between text-sm text-[#a9a9a9]">
              <span>En attente</span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xl font-bold text-amber-400 mt-2">{pending.length}</p>
            <p className="text-[11px] text-stone-500 mt-1">Paiements à vérifier</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2a2a2b] bg-[#151516] px-4 py-10 text-center text-[#a9a9a9] sm:p-6 sm:py-10">
          <Receipt className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Aucune session de caisse ouverte</p>
          <p className="mt-1 text-sm">Les encaissements en espèces nécessitent une session ouverte.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-[#151516] p-4 sm:p-5">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-amber-300">
            <AlertTriangle className="h-5 w-5" /> Paiements en attente de vérification
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
                <div className="flex w-full gap-2 min-[420px]:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmForm(t);
                      setConfirmRef(t.providerReference ?? '');
                    }}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-900/40 px-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] min-[420px]:flex-none min-[420px]:text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectForm(t)}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-red-900/30 px-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] min-[420px]:flex-none min-[420px]:text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Rejeter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-[#f7f6f2]">Journal des écritures</h2>
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
                  <div className="flex w-full items-center justify-between gap-3 min-[420px]:w-auto min-[420px]:justify-start">
                    <span className={`font-bold ${signed < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {signed < 0 ? '' : '+'}
                      {formatPrice(signed)}
                    </span>
                    {canReverse && (
                      <button
                        type="button"
                        onClick={() => openCorrection(t)}
                        className="flex min-h-11 items-center gap-1 rounded-xl bg-[#222226] px-3 text-sm text-stone-300 transition-colors hover:bg-[#2b2b30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] min-[420px]:text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Corriger
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-[#f7f6f2]">Historique des sessions</h2>
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
                    type="button"
                    onClick={() => setReconcileForm(s)}
                    className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-sky-900/30 px-3 text-sm font-semibold text-sky-300 transition-colors hover:bg-sky-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] min-[420px]:w-auto min-[420px]:text-xs"
                  >
                    <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Rapprocher
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
              className="min-h-11 w-full rounded-xl bg-red-900/40 px-4 text-sm font-bold text-red-300 transition-colors hover:bg-red-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
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
        .input { width: 100%; background: #111113; border: 1px solid #29292e; border-radius: 0.75rem; padding: 0.625rem 0.75rem; font-size: 0.875rem; color: #fff; }
        input.input, select.input { min-height: 2.75rem; }
        .input:focus { outline: none; border-color: #C9A45C; }
        .btn-gold { min-height: 2.75rem; background: #C9A45C; color: #101010; font-weight: 700; font-size: 0.875rem; padding: 0.75rem; border-radius: 0.75rem; }
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
  <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/85 p-0 backdrop-blur-md sm:items-center sm:p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="max-h-[calc(100dvh-0.75rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl border border-[#2b2b30] bg-[#161619] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-[#222226] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
        >
          <XCircle className="h-5 w-5" aria-hidden="true" />
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
