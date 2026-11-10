/**
 * Règles de validation de la caisse (fonctions pures, sans React ni réseau).
 * Miroir des contrôles serveur des migrations `payment_journal` : montants entiers en FCFA,
 * motif de correction d'au moins 3 caractères, référence fournisseur hors espèces, notes de 500 caractères au plus.
 * Ces règles évitent un aller-retour inutile ; la base reste la référence.
 */

export const MAX_XOF_AMOUNT = 1_000_000_000_000;
export const MAX_NOTE_LENGTH = 500;
export const MIN_CORRECTION_REASON_LENGTH = 3;

export type RuleResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): RuleResult<T> => ({ ok: true, value });
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Montant saisi en FCFA : chiffres seulement, sans décimales ni signe. */
export function parseXofAmount(
  raw: string,
  label: string,
  options: { allowZero?: boolean } = {},
): RuleResult<number> {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) {
    return fail(`${label} : saisissez un montant entier en FCFA, sans décimales.`);
  }
  const value = Number(text);
  if (value > MAX_XOF_AMOUNT) {
    return fail(`${label} dépasse la limite autorisée.`);
  }
  if (value === 0 && !options.allowZero) {
    return fail(`${label} doit être supérieur à zéro.`);
  }
  return ok(value);
}

/** Note libre : trimmée, 500 caractères au plus. */
export function validateNote(raw: string, label = 'La note'): RuleResult<string> {
  const text = raw.trim();
  if (text.length > MAX_NOTE_LENGTH) {
    return fail(`${label} ne doit pas dépasser ${MAX_NOTE_LENGTH} caractères.`);
  }
  return ok(text);
}

/** Motif obligatoire : longueur minimale après trim, 500 caractères au plus. */
export function validateReason(raw: string, minLength: number, label: string): RuleResult<string> {
  const text = raw.trim();
  if (text.length < minLength) {
    return fail(`${label} : au moins ${minLength} caractères.`);
  }
  if (text.length > MAX_NOTE_LENGTH) {
    return fail(`${label} ne doit pas dépasser ${MAX_NOTE_LENGTH} caractères.`);
  }
  return ok(text);
}

/** Référence fournisseur : obligatoire pour tout moyen de paiement autre que les espèces. */
export function validateProviderReference(method: string, raw: string): RuleResult<string | undefined> {
  const text = raw.trim();
  if (method === 'cash') return ok(undefined);
  if (!text) {
    return fail('Une référence de transaction du fournisseur est requise pour un paiement hors espèces.');
  }
  return ok(text);
}

export interface CorrectionDraft {
  kind: 'refund' | 'payment_reversal' | 'refund_reversal';
  amount: string;
  reason: string;
  method: string;
  providerReference: string;
  settlementNote: string;
}

export interface CorrectionCommand {
  kind: CorrectionDraft['kind'];
  amount: number;
  reason: string;
  providerReference?: string;
  settlementNote?: string;
}

/** Correction de paiement : montant entier > 0, motif ≥ 3 caractères, référence hors espèces. */
export function validateCorrection(draft: CorrectionDraft): RuleResult<CorrectionCommand> {
  const amount = parseXofAmount(draft.amount, 'Le montant de correction');
  if (!amount.ok) return amount;
  const reason = validateReason(draft.reason, MIN_CORRECTION_REASON_LENGTH, 'Le motif de correction');
  if (!reason.ok) return reason;
  const reference = validateProviderReference(draft.method, draft.providerReference);
  if (!reference.ok) return reference;
  const note = validateNote(draft.settlementNote, 'La note de règlement');
  if (!note.ok) return note;
  return ok({
    kind: draft.kind,
    amount: amount.value,
    reason: reason.value,
    providerReference: reference.value,
    settlementNote: draft.method === 'cash' ? undefined : note.value,
  });
}
