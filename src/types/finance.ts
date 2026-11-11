// Types du domaine finance : paiements, sessions de caisse, synthèses et dépenses.

export type PaymentMethod = 'wave' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'cash' | 'card';

export type PaymentEntryKind = 'payment' | 'refund' | 'payment_reversal' | 'refund_reversal';

export type PaymentSettlementMode = 'cash_drawer' | 'manual_confirmed' | 'manual_rejected';

export interface PaymentTransaction {
  id: string;
  salonId: string;
  branchId?: string;
  appointmentId?: string;
  appointmentAmount?: number;
  serviceName?: string;
  clientName: string;
  amount: number;
  method: PaymentMethod;
  kind: PaymentEntryKind;
  type: 'full' | 'deposit' | 'balance';
  reference: string;
  providerReference?: string;
  status: 'completed' | 'pending' | 'cancelled';
  date: string;
  time: string;
  createdAt?: string;
  cashSessionId?: string;
  originalEntryId?: string;
  reason?: string;
  settlementMode?: PaymentSettlementMode;
  settlementNote?: string;
}

export interface CashSession {
  id: string;
  salonId: string;
  branchId: string;
  registerId: string;
  registerName?: string;
  openedAt: string;
  closedAt?: string;
  reconciledAt?: string;
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  totalMobileMoneyIn: number;
  totalMobileMoneyOut: number;
  totalOut: number;
  theoreticalBalance: number;
  expectedBalance?: number;
  actualBalance?: number;
  countedBalance?: number;
  discrepancy?: number;
  difference?: number;
  status: 'open' | 'closed' | 'reconciled';
  openingNote?: string;
  closingNote?: string;
  reconciliationNote?: string;
  notes?: string;
}

export interface FinancialSummary {
  revenueBilled: number;
  revenueCollected: number;
  outstanding: number;
  refunds: number;
  expenses: number;
  netBalance: number;
  pendingAmount: number;
  paymentCount: number;
  byMethod: Record<string, number>;
}

export interface AppointmentBalance {
  appointmentId: string;
  billed: number;
  collected: number;
  outstanding: number;
  pending: number;
  refunded: number;
}

export type ExpenseCategory =
  'rent' | 'electricity' | 'water' | 'salaries' | 'products' | 'maintenance' | 'marketing' | 'other';

export type ExpenseEntryKind = 'expense' | 'expense_reversal';

export type ExpenseStatus = 'active' | 'reversed' | 'superseded';

export interface Expense {
  id: string;
  salonId: string;
  branchId?: string | null;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  /** Champ historique d'affichage ; non persisté par le journal Supabase. */
  paymentMethod?: PaymentMethod;
  notes?: string;
  receiptRef?: string;
  entryKind?: ExpenseEntryKind;
  originalExpenseId?: string | null;
  status?: ExpenseStatus;
  supplierId?: string | null;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
  reason?: string;
  reversedAt?: string | null;
  reversedBy?: string | null;
  createdBy?: string;
  createdAt?: string;
}

export interface ExpenseEvent {
  id: string;
  salonId: string;
  expenseId: string;
  eventType: 'recorded' | 'attachment_updated' | 'reversed' | 'corrected';
  amount: number;
  reason: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
