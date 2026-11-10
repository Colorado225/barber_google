/**
 * Commandes financières : validation locale, puis appel de la base. Le port est injecté pour tester chaque
 * commande sans réseau. Une erreur de validation n'appelle jamais la base.
 */
import type { AppointmentBalance, CashSession, FinancialSummary, PaymentTransaction } from '../../types';
import type {
  PaymentCorrectionInput,
  PaymentListParams,
  RecordPaymentInput,
} from '../../services/api/shared';
import {
  assertNonNegativeInteger,
  assertPaymentRequest,
  assertPositiveInteger,
  CASH_SESSIONS_LIMIT,
  FINANCE_PAYMENTS_LIMIT,
  financeRange,
  type PaymentRequest,
} from './financeRules';

export interface FinanceCommandPort {
  payments: {
    list: (params: PaymentListParams) => Promise<PaymentTransaction[]>;
    record: (data: RecordPaymentInput) => Promise<PaymentTransaction>;
    correct: (data: PaymentCorrectionInput) => Promise<PaymentTransaction>;
    confirm: (
      paymentId: string,
      providerReference: string,
      settlementNote: string,
    ) => Promise<PaymentTransaction>;
    reject: (paymentId: string, reason: string) => Promise<PaymentTransaction>;
    balance: (appointmentId: string) => Promise<AppointmentBalance>;
  };
  cash: {
    sessions: (limit?: number) => Promise<CashSession[]>;
    open: (branchId: string, openingBalance: number, note?: string) => Promise<CashSession>;
    close: (sessionId: string, countedBalance: number, note?: string) => Promise<CashSession>;
    reconcile: (sessionId: string, note: string) => Promise<CashSession>;
  };
  reports: {
    summary: (from: string, to: string) => Promise<FinancialSummary>;
  };
}

export interface FinanceReadPermissions {
  payments: boolean;
  cash: boolean;
  reports: boolean;
}

export interface FinanceSnapshot {
  payments: PaymentTransaction[];
  sessions: CashSession[];
  summary: FinancialSummary | null;
}

/**
 * Charge uniquement les données autorisées par le rôle actif. Une lecture non autorisée n'est pas émise :
 * la liste correspondante reste vide, ou le résumé reste absent.
 */
export async function fetchFinanceSnapshot(
  getPort: () => FinanceCommandPort,
  permissions: FinanceReadPermissions,
  now?: Date,
): Promise<FinanceSnapshot> {
  const { from, to, monthStart } = financeRange(now);
  const port = getPort();
  const [payments, sessions, summary] = await Promise.all([
    permissions.payments
      ? port.payments.list({ from, to, limit: FINANCE_PAYMENTS_LIMIT })
      : Promise.resolve([] as PaymentTransaction[]),
    permissions.cash ? port.cash.sessions(CASH_SESSIONS_LIMIT) : Promise.resolve([] as CashSession[]),
    permissions.reports
      ? port.reports.summary(monthStart, to)
      : Promise.resolve(null as FinancialSummary | null),
  ]);
  return { payments, sessions, summary };
}

export async function recordPayment(
  port: FinanceCommandPort,
  payment: PaymentRequest & {
    providerReference?: string;
    reason?: string;
    idempotencyKey?: string;
  },
  newKey: () => string,
): Promise<PaymentTransaction> {
  assertPaymentRequest(payment);
  return port.payments.record({
    appointmentId: payment.appointmentId,
    amount: payment.amount,
    method: payment.method,
    idempotencyKey: payment.idempotencyKey ?? newKey(),
    providerReference: payment.providerReference ?? null,
    reason: payment.reason ?? '',
  });
}

/** Correction demandée par l'interface : clé d'idempotence, référence et note sont optionnelles. */
export type CorrectionRequest = Omit<
  PaymentCorrectionInput,
  'idempotencyKey' | 'providerReference' | 'settlementNote'
> & {
  idempotencyKey?: string;
  providerReference?: string;
  settlementNote?: string;
};

export async function correctPayment(
  port: FinanceCommandPort,
  correction: CorrectionRequest,
  newKey: () => string,
): Promise<PaymentTransaction> {
  assertPositiveInteger(correction.amount, 'Le montant de correction doit être un entier positif en FCFA.');
  return port.payments.correct({
    originalEntryId: correction.originalEntryId,
    kind: correction.kind,
    amount: correction.amount,
    reason: correction.reason,
    idempotencyKey: correction.idempotencyKey ?? newKey(),
    providerReference: correction.providerReference ?? null,
    settlementNote: correction.settlementNote ?? '',
  });
}

export function confirmPendingPayment(
  port: FinanceCommandPort,
  paymentId: string,
  providerReference: string,
  settlementNote: string,
): Promise<PaymentTransaction> {
  return port.payments.confirm(paymentId, providerReference, settlementNote);
}

export function rejectPendingPayment(port: FinanceCommandPort, paymentId: string, reason: string) {
  return port.payments.reject(paymentId, reason);
}

export async function closeCashSession(
  port: FinanceCommandPort,
  sessionId: string | undefined,
  countedBalance: number,
  notes?: string,
): Promise<CashSession> {
  if (!sessionId) throw new Error('Aucune session de caisse ouverte à clôturer.');
  assertNonNegativeInteger(countedBalance, 'Le montant compté doit être un entier positif ou nul en FCFA.');
  return port.cash.close(sessionId, countedBalance, notes ?? '');
}

export async function openCashSession(
  port: FinanceCommandPort,
  branchId: string,
  openingBalance: number,
  note?: string,
): Promise<CashSession> {
  assertNonNegativeInteger(openingBalance, 'Le fond de caisse doit être un entier positif ou nul en FCFA.');
  return port.cash.open(branchId, openingBalance, note ?? '');
}

export function reconcileCashSession(
  port: FinanceCommandPort,
  sessionId: string,
  note: string,
): Promise<CashSession> {
  return port.cash.reconcile(sessionId, note);
}
