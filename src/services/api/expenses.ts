import { mapExpense, unwrap } from './shared';
import type { DbRow, ExpenseInput, SalonApiClient } from './shared';

export async function listExpenses(supabase: SalonApiClient, salonId: string) {
  const result = await supabase
    .from('expenses')
    .select('*')
    .eq('salon_id', salonId)
    .order('spent_on', { ascending: false });
  return (unwrap(result) ?? []).map((row) => mapExpense(row as DbRow));
}
export function createExpensesApi(supabase: SalonApiClient, salonId: string) {
  return {
    expenses: {
      list: () => listExpenses(supabase, salonId),
      async create(data: ExpenseInput) {
        const result = await supabase.rpc('record_expense', {
          p_salon_id: salonId,
          p_title: data.title,
          p_category: data.category,
          p_amount: data.amount,
          p_spent_on: data.date,
          p_branch_id: data.branchId ?? null,
          p_notes: data.notes ?? '',
          p_receipt_ref: data.receiptRef ?? null,
        });
        return mapExpense(unwrap(result) as DbRow);
      },
    },
  };
}
