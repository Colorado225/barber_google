import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { RuleResult } from './cashRules';
import {
  closeCashSession,
  confirmCashPayment,
  openCashSession,
  reconcileCashSession,
  recordCashCorrection,
  rejectCashPayment,
  type CashCommandPort,
  type CloseSessionDraft,
  type ConfirmDraft,
  type OpenSessionDraft,
} from './cashCommands';
import type { CorrectionDraft } from './cashRules';

/**
 * Pont React entre la vue de caisse et les commandes. Gère l'occupation, l'erreur affichée
 * et le rafraîchissement des données financières après un succès.
 * Une validation refusée affiche son message sans appeler la base.
 */
export function useCashRegisterCommands() {
  const app = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const port: CashCommandPort = useMemo(
    () => ({
      openNewCashSession: app.openNewCashSession,
      closeCurrentCashSession: app.closeCurrentCashSession,
      reconcileCashSession: app.reconcileCashSession,
      confirmPendingPayment: app.confirmPendingPayment,
      rejectPendingPayment: app.rejectPendingPayment,
      recordPaymentCorrection: app.recordPaymentCorrection,
    }),
    [app],
  );

  const execute = useCallback(
    async (command: () => Promise<RuleResult<void>>): Promise<boolean> => {
      setError(null);
      setBusy(true);
      try {
        const result = await command();
        if (!result.ok) {
          setError(result.error);
          return false;
        }
        await app.refreshFinance();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Opération impossible.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [app],
  );

  return {
    busy,
    error,
    clearError: () => setError(null),
    openSession: (draft: OpenSessionDraft) => execute(() => openCashSession(port, draft)),
    closeSession: (draft: CloseSessionDraft) => execute(() => closeCashSession(port, draft)),
    reconcileSession: (sessionId: string, note: string) =>
      execute(() => reconcileCashSession(port, sessionId, note)),
    confirmPayment: (draft: ConfirmDraft) => execute(() => confirmCashPayment(port, draft)),
    rejectPayment: (paymentId: string, reason: string) =>
      execute(() => rejectCashPayment(port, paymentId, reason)),
    recordCorrection: (originalEntryId: string, draft: CorrectionDraft) =>
      execute(() => recordCashCorrection(port, originalEntryId, draft)),
  };
}
