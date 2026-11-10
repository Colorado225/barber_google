/**
 * Règles financières (fonctions pures). Les montants sont des entiers en FCFA. Les soldes et les statuts de
 * paiement sont tenus par la base ; ces fonctions ne font que les valider ou les dériver pour l'affichage.
 */
import type { Appointment, AppointmentBalance, CashSession, PaymentMethod } from '../../types';

/** Nombre maximal d'écritures de paiement chargées pour la période. */
export const FINANCE_PAYMENTS_LIMIT = 500;
/** Nombre maximal de sessions de caisse chargées. */
export const CASH_SESSIONS_LIMIT = 50;
/** Période de rapport : 12 mois glissants, du premier jour du 11e mois précédent à aujourd'hui (UTC). */
export const FINANCE_RANGE_MONTHS = 12;

export function financeRange(now: Date = new Date()) {
  const to = now.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (FINANCE_RANGE_MONTHS - 1), 1))
    .toISOString()
    .slice(0, 10);
  return { from, to, monthStart: `${to.slice(0, 8)}01` };
}

/** Statut de paiement d'un rendez-vous dérivé du solde serveur et du montant facturé. */
export function paymentStatusFromBalance(
  balance: AppointmentBalance,
  billed: number,
): Appointment['paymentStatus'] {
  if (billed > 0 && balance.collected >= billed) return 'paid';
  if (balance.collected > 0) return 'deposit_paid';
  if (balance.refunded > 0) return 'refunded';
  return 'unpaid';
}

export interface PaymentRequest {
  appointmentId: string;
  amount: number;
  method: PaymentMethod;
}

/** Contrôle avant encaissement : rendez-vous requis, montant entier strictement positif. */
export function assertPaymentRequest(payment: Pick<PaymentRequest, 'appointmentId' | 'amount'>): void {
  if (!payment.appointmentId) throw new Error('Un rendez-vous est requis pour encaisser.');
  assertPositiveInteger(payment.amount, 'Le montant doit être un entier positif en FCFA.');
}

export function assertPositiveInteger(amount: number, message: string): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(message);
}

export function assertNonNegativeInteger(amount: number, message: string): void {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(message);
}

/**
 * Succursale de l'ouverture de caisse : celle demandée, sinon celle de l'adhésion active, sinon la première.
 * Aucune succursale : erreur explicite, aucun appel n'est fait.
 */
export function resolveOpeningBranch(
  requested: string | undefined,
  membershipBranchId: string | null | undefined,
  branches: ReadonlyArray<{ id: string }>,
): string {
  const target = requested ?? membershipBranchId ?? branches[0]?.id;
  if (!target) throw new Error('Aucune succursale disponible pour ouvrir une caisse.');
  return target;
}

export function currentOpenSession(sessions: CashSession[]): CashSession | null {
  return sessions.find((s) => s.status === 'open') ?? null;
}

/** Message affiché après un encaissement, selon le statut renvoyé par la base. */
export function paymentRecordedMessage(status: string): string {
  return status === 'pending'
    ? 'Paiement Mobile Money enregistré en attente de vérification manuelle.'
    : 'Encaissement enregistré dans le journal de caisse.';
}
