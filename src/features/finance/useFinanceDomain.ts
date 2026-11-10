import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { salonApi } from '../../lib/api';
import type {
  Appointment,
  AppointmentBalance,
  CashSession,
  FinancialSummary,
  PaymentMethod,
  PaymentTransaction,
  Salon,
} from '../../types';
import { newIdempotencyKey } from '../shared/idempotency';
import {
  closeCashSession,
  confirmPendingPayment as confirmPendingPaymentCommand,
  correctPayment,
  fetchFinanceSnapshot,
  type CorrectionRequest,
  openCashSession,
  reconcileCashSession as reconcileCashSessionCommand,
  recordPayment as recordPaymentCommand,
  rejectPendingPayment as rejectPendingPaymentCommand,
} from './financeCommands';
import {
  currentOpenSession,
  paymentRecordedMessage,
  paymentStatusFromBalance,
  resolveOpeningBranch,
} from './financeRules';

export interface FinanceDomainDeps {
  hasPermission: (permission: string, salonId?: string) => boolean;
  requireActiveSalon: () => Salon;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeSalonId: string;
  memberships: ReadonlyArray<{ salonId: string; branchId: string | null }>;
  branches: ReadonlyArray<{ id: string }>;
  /** Un encaissement confirmé déclenche les points de fidélité côté base. */
  loadLoyalty: (salonId: string) => Promise<void>;
  setAppointments: Dispatch<SetStateAction<Appointment[]>>;
}

/**
 * Domaine finances : encaissements, corrections, paiements Mobile Money en attente, soldes et sessions de caisse.
 * Chaque écriture est suivie d'un rechargement serveur : l'état affiché n'est jamais calculé localement.
 */
export function useFinanceDomain({
  hasPermission,
  requireActiveSalon,
  addToast,
  activeSalonId,
  memberships,
  branches,
  loadLoyalty,
  setAppointments,
}: FinanceDomainDeps) {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);

  // Charge uniquement les données financières autorisées par le rôle actif.
  const loadFinance = async (salonId: string) => {
    const snapshot = await fetchFinanceSnapshot(() => salonApi(salonId), {
      payments: hasPermission('payments.read', salonId),
      cash: hasPermission('cash.read', salonId),
      reports: hasPermission('reports.read', salonId),
    });
    setTransactions(snapshot.payments);
    setCashSessions(snapshot.sessions);
    setCashSession(currentOpenSession(snapshot.sessions));
    setFinancialSummary(snapshot.summary);
  };

  const syncAfterFinance = async (appointmentId?: string) => {
    const salonId = requireActiveSalon().id;
    await loadFinance(salonId);
    await loadLoyalty(salonId);
    if (appointmentId) {
      const balance = await salonApi(salonId).payments.balance(appointmentId);
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId ? { ...a, paymentStatus: paymentStatusFromBalance(balance, a.price) } : a,
        ),
      );
    }
  };

  const refreshFinance = async () => {
    await loadFinance(requireActiveSalon().id);
  };

  const recordPayment = async (payment: {
    appointmentId: string;
    amount: number;
    method: PaymentMethod;
    providerReference?: string;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<PaymentTransaction> => {
    const salonId = requireActiveSalon().id;
    const saved = await recordPaymentCommand(salonApi(salonId), payment, newIdempotencyKey);
    await syncAfterFinance(payment.appointmentId);
    addToast(paymentRecordedMessage(saved.status), 'success');
    return saved;
  };

  const confirmPendingPayment = async (
    paymentId: string,
    providerReference: string,
    settlementNote: string,
  ) => {
    const saved = await confirmPendingPaymentCommand(
      salonApi(requireActiveSalon().id),
      paymentId,
      providerReference,
      settlementNote,
    );
    await syncAfterFinance(saved.appointmentId);
    addToast('Paiement vérifié manuellement et confirmé.', 'success');
    return saved;
  };

  const rejectPendingPayment = async (paymentId: string, reason: string) => {
    const saved = await rejectPendingPaymentCommand(salonApi(requireActiveSalon().id), paymentId, reason);
    await syncAfterFinance(saved.appointmentId);
    addToast('Paiement en attente rejeté.', 'info');
    return saved;
  };

  const recordPaymentCorrection = async (correction: CorrectionRequest): Promise<PaymentTransaction> => {
    const saved = await correctPayment(salonApi(requireActiveSalon().id), correction, newIdempotencyKey);
    await syncAfterFinance(saved.appointmentId);
    addToast('Correction enregistrée dans le journal (écriture liée, motif conservé).', 'success');
    return saved;
  };

  const getAppointmentBalance = useCallback(
    async (appointmentId: string): Promise<AppointmentBalance> => {
      return salonApi(activeSalonId).payments.balance(appointmentId);
    },
    [activeSalonId],
  );

  const closeCurrentCashSession = async (
    actualCashAmount: number,
    notes?: string,
    sessionId?: string,
  ): Promise<CashSession> => {
    const saved = await closeCashSession(
      salonApi(requireActiveSalon().id),
      sessionId ?? cashSession?.id,
      actualCashAmount,
      notes,
    );
    await loadFinance(requireActiveSalon().id);
    addToast('Session de caisse clôturée.', 'success');
    return saved;
  };

  const openNewCashSession = async (
    openingBalance: number,
    branchId?: string,
    note?: string,
  ): Promise<CashSession> => {
    const salonId = requireActiveSalon().id;
    const membership = memberships.find((m) => m.salonId === salonId);
    const targetBranch = resolveOpeningBranch(branchId, membership?.branchId, branches);
    const saved = await openCashSession(salonApi(salonId), targetBranch, openingBalance, note);
    await loadFinance(salonId);
    addToast('Session de caisse ouverte.', 'success');
    return saved;
  };

  const reconcileCashSession = async (sessionId: string, note: string): Promise<CashSession> => {
    const saved = await reconcileCashSessionCommand(salonApi(requireActiveSalon().id), sessionId, note);
    await loadFinance(requireActiveSalon().id);
    addToast('Session de caisse rapprochée.', 'success');
    return saved;
  };

  return {
    transactions,
    cashSession,
    cashSessions,
    financialSummary,
    loadFinance,
    refreshFinance,
    syncAfterFinance,
    recordPayment,
    confirmPendingPayment,
    rejectPendingPayment,
    recordPaymentCorrection,
    getAppointmentBalance,
    closeCurrentCashSession,
    openNewCashSession,
    reconcileCashSession,
  };
}
