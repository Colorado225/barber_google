// Opérations dépenses du domaine finance : création, justificatifs,
// contrepassation, correction liée et suppression motivée (jamais
// silencieuse). L'état (expenses/expenseEvents) et le rechargement restent
// la propriété de useFinanceDomainState — aucune seconde source de vérité.
import { useCallback } from 'react';
import type React from 'react';
import type { Expense } from '../../../types';
import { getApiErrorMessage } from '../../../lib/apiError';
import type { DomainSharedDeps } from '../shared';
import type { LoadFinanceFn } from './financeShared';

export interface ExpenseOperationsDeps extends Pick<
  DomainSharedDeps,
  'resolveApi' | 'requireActiveSalon' | 'domainCache' | 'memberships' | 'formatPrice' | 'addToast'
> {
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  loadFinance: LoadFinanceFn;
}

export interface ExpenseOperationsValue {
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<Expense | void>;
  attachExpenseReceipt: (
    expenseId: string,
    attachment: { path: string; name: string; mime: string; size: number },
  ) => Promise<Expense>;
  reverseExpense: (expenseId: string, reason: string) => Promise<Expense>;
  correctExpense: (input: {
    originalExpenseId: string;
    title: string;
    category: Expense['category'];
    amount: number;
    date: string;
    reason: string;
    branchId?: string | null;
    notes?: string;
    receiptRef?: string | null;
    supplierId?: string | null;
  }) => Promise<Expense>;
  deleteExpense: (id: string, reason?: string) => void;
}

export function useExpenseOperations(deps: ExpenseOperationsDeps): ExpenseOperationsValue {
  const {
    resolveApi,
    requireActiveSalon,
    domainCache,
    memberships,
    formatPrice,
    addToast,
    setExpenses,
    loadFinance,
  } = deps;

  const addExpense = useCallback(
    async (data: Omit<Expense, 'id'>): Promise<Expense> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const created = await api.expenses.create({
          title: data.title,
          category: data.category,
          amount: data.amount,
          date: data.date,
          notes: data.notes || '',
          branchId: data.branchId ?? memberships.find((m) => m.salonId === salonId)?.branchId ?? null,
          receiptRef: data.receiptRef ?? '',
          supplierId: data.supplierId ?? null,
          attachmentPath: data.attachmentPath ?? null,
          attachmentName: data.attachmentName ?? null,
          attachmentMime: data.attachmentMime ?? null,
          attachmentSize: data.attachmentSize ?? null,
        });
        setExpenses((prev) => [created, ...prev]);
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'dashboard');
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast(`Dépense de ${formatPrice(created.amount)} enregistrée`, 'success');
        return created;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Enregistrement de la dépense impossible'), 'error');
        throw error;
      }
    },
    [
      requireActiveSalon,
      resolveApi,
      memberships,
      domainCache,
      loadFinance,
      addToast,
      formatPrice,
      setExpenses,
    ],
  );

  const attachExpenseReceipt = useCallback(
    async (
      expenseId: string,
      attachment: { path: string; name: string; mime: string; size: number },
    ): Promise<Expense> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const updated = await api.expenses.attachReceipt(expenseId, attachment);
        setExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)));
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast('Justificatif rattaché à la dépense.', 'success');
        return updated;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Ajout du justificatif impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadFinance, addToast, setExpenses],
  );

  const reverseExpense = useCallback(
    async (expenseId: string, reason: string): Promise<Expense> => {
      try {
        const trimmed = reason.trim();
        if (trimmed.length < 3) {
          throw new Error('Veuillez indiquer un motif d’au moins 3 caractères pour contrepasser.');
        }
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const reversal = await api.expenses.reverse(expenseId, trimmed);
        const refreshed = await api.expenses.list();
        setExpenses(refreshed);
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'dashboard');
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast('Dépense annulée par contrepassation (historique conservé).', 'info');
        return reversal;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Contrepassation de la dépense impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadFinance, addToast, setExpenses],
  );

  const correctExpense = useCallback(
    async (input: {
      originalExpenseId: string;
      title: string;
      category: Expense['category'];
      amount: number;
      date: string;
      reason: string;
      branchId?: string | null;
      notes?: string;
      receiptRef?: string | null;
      supplierId?: string | null;
    }): Promise<Expense> => {
      try {
        if (input.reason.trim().length < 3) {
          throw new Error('Veuillez indiquer un motif de correction d’au moins 3 caractères.');
        }
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const replacement = await api.expenses.correct(input);
        const refreshed = await api.expenses.list();
        setExpenses(refreshed);
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'dashboard');
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast('Dépense corrigée par écriture liée (historique conservé).', 'success');
        return replacement;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Correction de la dépense impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadFinance, addToast, setExpenses],
  );

  const deleteExpense = useCallback(
    (id: string, reason?: string) => {
      if (!reason || reason.trim().length < 3) {
        addToast(
          'Les dépenses ne sont jamais supprimées silencieusement : utilisez la contrepassation avec motif.',
          'info',
        );
        return;
      }
      void reverseExpense(id, reason).catch(() => {});
    },
    [addToast, reverseExpense],
  );

  return {
    addExpense,
    attachExpenseReceipt,
    reverseExpense,
    correctExpense,
    deleteExpense,
  };
}
