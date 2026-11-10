// Opérations de paiement du domaine finance : encaissements, vérifications
// Mobile Money, corrections de journal et soldes de rendez-vous.
// L'état (transactions) et le rechargement restent la propriété de
// useFinanceDomainState — aucune seconde source de vérité n'est créée ici.
import { useCallback } from 'react';
import type { AppointmentBalance, PaymentEntryKind, PaymentMethod, PaymentTransaction } from '../../../types';
import type { DomainSharedDeps } from '../shared';
import type { SyncAfterFinanceFn } from './financeShared';

export interface PaymentOperationsDeps extends Pick<
  DomainSharedDeps,
  'activeSalonId' | 'resolveApi' | 'requireActiveSalon' | 'addToast' | 'newIdempotencyKey'
> {
  syncAfterFinance: SyncAfterFinanceFn;
}

export interface PaymentOperationsValue {
  recordPayment: (payment: {
    appointmentId: string;
    amount: number;
    method: PaymentMethod;
    providerReference?: string;
    reason?: string;
    idempotencyKey?: string;
  }) => Promise<PaymentTransaction>;
  confirmPendingPayment: (
    paymentId: string,
    providerReference: string,
    settlementNote: string,
  ) => Promise<PaymentTransaction>;
  rejectPendingPayment: (paymentId: string, reason: string) => Promise<PaymentTransaction>;
  recordPaymentCorrection: (correction: {
    originalEntryId: string;
    kind: Exclude<PaymentEntryKind, 'payment'>;
    amount: number;
    reason: string;
    providerReference?: string;
    settlementNote?: string;
    idempotencyKey?: string;
  }) => Promise<PaymentTransaction>;
  getAppointmentBalance: (appointmentId: string) => Promise<AppointmentBalance>;
}

export function usePaymentOperations(deps: PaymentOperationsDeps): PaymentOperationsValue {
  const { activeSalonId, resolveApi, requireActiveSalon, addToast, newIdempotencyKey, syncAfterFinance } =
    deps;

  const recordPayment = useCallback(
    async (payment: {
      appointmentId: string;
      amount: number;
      method: PaymentMethod;
      providerReference?: string;
      reason?: string;
      idempotencyKey?: string;
    }): Promise<PaymentTransaction> => {
      const salonId = requireActiveSalon().id;
      if (!payment.appointmentId) throw new Error('Un rendez-vous est requis pour encaisser.');
      if (!Number.isInteger(payment.amount) || payment.amount <= 0) {
        throw new Error('Le montant doit être un entier positif en FCFA.');
      }
      const api = await resolveApi(salonId);
      const saved = await api.payments.record({
        appointmentId: payment.appointmentId,
        amount: payment.amount,
        method: payment.method,
        idempotencyKey: payment.idempotencyKey ?? newIdempotencyKey(),
        providerReference: payment.providerReference ?? null,
        reason: payment.reason ?? '',
      });
      await syncAfterFinance(payment.appointmentId);
      addToast(
        saved.status === 'pending'
          ? 'Paiement Mobile Money enregistré en attente de vérification manuelle.'
          : 'Encaissement enregistré dans le journal de caisse.',
        'success',
      );
      return saved;
    },
    [requireActiveSalon, resolveApi, newIdempotencyKey, syncAfterFinance, addToast],
  );

  const confirmPendingPayment = useCallback(
    async (paymentId: string, providerReference: string, settlementNote: string) => {
      const salonId = requireActiveSalon().id;
      const api = await resolveApi(salonId);
      const saved = await api.payments.confirm(paymentId, providerReference, settlementNote);
      await syncAfterFinance(saved.appointmentId);
      addToast('Paiement vérifié manuellement et confirmé.', 'success');
      return saved;
    },
    [requireActiveSalon, resolveApi, syncAfterFinance, addToast],
  );

  const rejectPendingPayment = useCallback(
    async (paymentId: string, reason: string) => {
      const salonId = requireActiveSalon().id;
      const api = await resolveApi(salonId);
      const saved = await api.payments.reject(paymentId, reason);
      await syncAfterFinance(saved.appointmentId);
      addToast('Paiement en attente rejeté.', 'info');
      return saved;
    },
    [requireActiveSalon, resolveApi, syncAfterFinance, addToast],
  );

  const recordPaymentCorrection = useCallback(
    async (correction: {
      originalEntryId: string;
      kind: Exclude<PaymentEntryKind, 'payment'>;
      amount: number;
      reason: string;
      providerReference?: string;
      settlementNote?: string;
      idempotencyKey?: string;
    }): Promise<PaymentTransaction> => {
      if (!Number.isInteger(correction.amount) || correction.amount <= 0) {
        throw new Error('Le montant de correction doit être un entier positif en FCFA.');
      }
      const salonId = requireActiveSalon().id;
      const api = await resolveApi(salonId);
      const saved = await api.payments.correct({
        originalEntryId: correction.originalEntryId,
        kind: correction.kind,
        amount: correction.amount,
        reason: correction.reason,
        idempotencyKey: correction.idempotencyKey ?? newIdempotencyKey(),
        providerReference: correction.providerReference ?? null,
        settlementNote: correction.settlementNote ?? '',
      });
      await syncAfterFinance(saved.appointmentId);
      addToast('Correction enregistrée dans le journal (écriture liée, motif conservé).', 'success');
      return saved;
    },
    [requireActiveSalon, resolveApi, newIdempotencyKey, syncAfterFinance, addToast],
  );

  const getAppointmentBalance = useCallback(
    async (appointmentId: string): Promise<AppointmentBalance> => {
      const api = await resolveApi(activeSalonId);
      return api.payments.balance(appointmentId);
    },
    [resolveApi, activeSalonId],
  );

  return {
    recordPayment,
    confirmPendingPayment,
    rejectPendingPayment,
    recordPaymentCorrection,
    getAppointmentBalance,
  };
}
