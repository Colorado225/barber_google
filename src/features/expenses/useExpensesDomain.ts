import { useState } from 'react';
import { salonApi } from '../../lib/api';
import type { Expense, Salon } from '../../types';

export interface ExpensesDomainDeps {
  requireActiveSalon: () => Salon;
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  formatPrice: (amount: number) => string;
  memberships: ReadonlyArray<{ salonId: string; branchId?: string | null }>;
}

/**
 * Domaine dépenses : état local et création. La suppression n'est pas prise en charge par l'API
 * et le signale honnêtement. Les noms exposés sont ceux du contexte.
 */
export function useExpensesDomain({
  requireActiveSalon,
  remote,
  addToast,
  formatPrice,
  memberships,
}: ExpensesDomainDeps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const addExpense = (data: Omit<Expense, 'id'>) => {
    void remote(async () => {
      const salonId = requireActiveSalon().id;
      const created = await salonApi(salonId).expenses.create({
        title: data.title,
        category: data.category,
        amount: data.amount,
        date: data.date,
        notes: data.notes || '',
        branchId: data.branchId ?? memberships.find((m) => m.salonId === salonId)?.branchId ?? null,
        receiptRef: data.receiptRef ?? '',
      });
      setExpenses((prev) => [created, ...prev]);
      addToast(`Dépense de ${formatPrice(created.amount)} enregistrée`, 'success');
    }, 'Enregistrement de la dépense impossible');
  };

  const deleteExpense = (id: string) => {
    void id;
    addToast("La suppression d'une dépense n'est pas prise en charge par l'API.", 'error');
  };

  return { expenses, setExpenses, addExpense, deleteExpense };
}
