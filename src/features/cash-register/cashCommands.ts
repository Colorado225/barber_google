/**
 * Commandes de la caisse : validation puis appel de l'action. Les dépendances sont injectées
 * (port), ce qui permet de tester chaque commande sans React ni réseau.
 * Une erreur de validation n'appelle jamais la base. Une erreur de la base remonte telle quelle.
 */
import {
  parseXofAmount,
  validateCorrection,
  validateNote,
  validateProviderReference,
  validateReason,
  type CorrectionCommand,
  type CorrectionDraft,
  type RuleResult,
} from './cashRules';

export interface CashCommandPort {
  openNewCashSession: (openingBalance: number, branchId?: string, note?: string) => Promise<unknown>;
  closeCurrentCashSession: (actualCashAmount: number, notes?: string, sessionId?: string) => Promise<unknown>;
  reconcileCashSession: (sessionId: string, note: string) => Promise<unknown>;
  confirmPendingPayment: (
    paymentId: string,
    providerReference: string,
    settlementNote: string,
  ) => Promise<unknown>;
  rejectPendingPayment: (paymentId: string, reason: string) => Promise<unknown>;
  recordPaymentCorrection: (correction: CorrectionCommand & { originalEntryId: string }) => Promise<unknown>;
}

export interface OpenSessionDraft {
  openingBalance: string;
  branchId: string;
  note: string;
}

export async function openCashSession(
  port: CashCommandPort,
  draft: OpenSessionDraft,
): Promise<RuleResult<void>> {
  const balance = parseXofAmount(draft.openingBalance, 'Le fond de caisse', { allowZero: true });
  if (!balance.ok) return balance;
  const note = validateNote(draft.note, 'La note d’ouverture');
  if (!note.ok) return note;
  await port.openNewCashSession(balance.value, draft.branchId || undefined, note.value);
  return { ok: true, value: undefined };
}

export interface CloseSessionDraft {
  sessionId: string;
  counted: string;
  note: string;
}

export async function closeCashSession(
  port: CashCommandPort,
  draft: CloseSessionDraft,
): Promise<RuleResult<void>> {
  const counted = parseXofAmount(draft.counted, 'Le montant compté', { allowZero: true });
  if (!counted.ok) return counted;
  const note = validateNote(draft.note, 'La note de clôture');
  if (!note.ok) return note;
  await port.closeCurrentCashSession(counted.value, note.value, draft.sessionId);
  return { ok: true, value: undefined };
}

export async function reconcileCashSession(
  port: CashCommandPort,
  sessionId: string,
  rawNote: string,
): Promise<RuleResult<void>> {
  const note = validateNote(rawNote, 'La note de rapprochement');
  if (!note.ok) return note;
  await port.reconcileCashSession(sessionId, note.value);
  return { ok: true, value: undefined };
}

export interface ConfirmDraft {
  paymentId: string;
  method: string;
  reference: string;
  note: string;
}

export async function confirmCashPayment(
  port: CashCommandPort,
  draft: ConfirmDraft,
): Promise<RuleResult<void>> {
  const reference = validateProviderReference(draft.method, draft.reference);
  if (!reference.ok) return reference;
  const note = validateNote(draft.note, 'La note de règlement');
  if (!note.ok) return note;
  await port.confirmPendingPayment(draft.paymentId, reference.value ?? '', note.value);
  return { ok: true, value: undefined };
}

export async function rejectCashPayment(
  port: CashCommandPort,
  paymentId: string,
  rawReason: string,
): Promise<RuleResult<void>> {
  const reason = validateReason(rawReason, 3, 'Le motif de rejet');
  if (!reason.ok) return reason;
  await port.rejectPendingPayment(paymentId, reason.value);
  return { ok: true, value: undefined };
}

export async function recordCashCorrection(
  port: CashCommandPort,
  originalEntryId: string,
  draft: CorrectionDraft,
): Promise<RuleResult<void>> {
  const correction = validateCorrection(draft);
  if (!correction.ok) return correction;
  await port.recordPaymentCorrection({ originalEntryId, ...correction.value });
  return { ok: true, value: undefined };
}
