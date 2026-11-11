// Opérations de caisse du domaine finance : ouverture, clôture et
// rapprochement des sessions. L'état (cashSession/cashSessions) et le
// rechargement restent la propriété de useFinanceDomainState — aucune
// seconde source de vérité n'est créée ici.
import { useCallback } from 'react';
import type { CashSession, ErpBranch } from '../../../types';
import type { DomainSharedDeps } from '../shared';
import type { LoadFinanceFn } from './financeShared';

export interface CashOperationsDeps extends Pick<
  DomainSharedDeps,
  'resolveApi' | 'requireActiveSalon' | 'domainCache' | 'memberships' | 'addToast'
> {
  /** Identifiant de la session ouverte (cashSession?.id côté racine). */
  cashSessionId: string | null | undefined;
  branches: ErpBranch[];
  loadFinance: LoadFinanceFn;
}

export interface CashOperationsValue {
  closeCurrentCashSession: (
    actualCashAmount: number,
    notes?: string,
    sessionId?: string,
  ) => Promise<CashSession>;
  openNewCashSession: (openingBalance: number, branchId?: string, note?: string) => Promise<CashSession>;
  reconcileCashSession: (sessionId: string, note: string) => Promise<CashSession>;
}

export function useCashOperations(deps: CashOperationsDeps): CashOperationsValue {
  const {
    resolveApi,
    requireActiveSalon,
    domainCache,
    memberships,
    addToast,
    cashSessionId,
    branches,
    loadFinance,
  } = deps;

  const closeCurrentCashSession = useCallback(
    async (actualCashAmount: number, notes?: string, sessionId?: string): Promise<CashSession> => {
      const target = sessionId ?? cashSessionId;
      if (!target) throw new Error('Aucune session de caisse ouverte à clôturer.');
      if (!Number.isInteger(actualCashAmount) || actualCashAmount < 0) {
        throw new Error('Le montant compté doit être un entier positif ou nul en FCFA.');
      }
      const salonId = requireActiveSalon().id;
      const api = await resolveApi(salonId);
      const saved = await api.cash.close(target, actualCashAmount, notes ?? '');
      domainCache.invalidate(salonId, 'finance');
      await loadFinance(salonId, undefined, { force: true });
      addToast('Session de caisse clôturée.', 'success');
      return saved;
    },
    [cashSessionId, requireActiveSalon, resolveApi, domainCache, loadFinance, addToast],
  );

  const openNewCashSession = useCallback(
    async (openingBalance: number, branchId?: string, note?: string): Promise<CashSession> => {
      const salonId = requireActiveSalon().id;
      const targetBranch =
        branchId ?? memberships.find((m) => m.salonId === salonId)?.branchId ?? branches[0]?.id;
      if (!targetBranch) throw new Error('Aucune succursale disponible pour ouvrir une caisse.');
      if (!Number.isInteger(openingBalance) || openingBalance < 0) {
        throw new Error('Le fond de caisse doit être un entier positif ou nul en FCFA.');
      }
      const api = await resolveApi(salonId);
      const saved = await api.cash.open(targetBranch, openingBalance, note ?? '');
      domainCache.invalidate(salonId, 'finance');
      await loadFinance(salonId, undefined, { force: true });
      addToast('Session de caisse ouverte.', 'success');
      return saved;
    },
    [requireActiveSalon, memberships, branches, resolveApi, domainCache, loadFinance, addToast],
  );

  const reconcileCashSession = useCallback(
    async (sessionId: string, note: string): Promise<CashSession> => {
      const salonId = requireActiveSalon().id;
      const api = await resolveApi(salonId);
      const saved = await api.cash.reconcile(sessionId, note);
      domainCache.invalidate(salonId, 'finance');
      await loadFinance(salonId, undefined, { force: true });
      addToast('Session de caisse rapprochée.', 'success');
      return saved;
    },
    [requireActiveSalon, resolveApi, domainCache, loadFinance, addToast],
  );

  return {
    closeCurrentCashSession,
    openNewCashSession,
    reconcileCashSession,
  };
}
