import { createContext, useCallback, useContext, useState } from 'react';
import type {
  Appointment,
  AppointmentBalance,
  CashSession,
  Expense,
  ExpenseEvent,
  FinancialSummary,
  PaymentEntryKind,
  PaymentMethod,
  PaymentTransaction,
  StockItem,
  StockMovement,
  StockMovementType,
  Supplier,
} from '../../types';
import { getApiErrorMessage } from '../../lib/apiError';
import type { DomainSharedDeps } from './shared';

export interface FinanceDomainValue {
  transactions: PaymentTransaction[];
  cashSession: CashSession | null;
  cashSessions: CashSession[];
  financialSummary: FinancialSummary | null;
  expenses: Expense[];
  expenseEvents: ExpenseEvent[];
  stocks: StockItem[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
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
  closeCurrentCashSession: (
    actualCashAmount: number,
    notes?: string,
    sessionId?: string,
  ) => Promise<CashSession>;
  openNewCashSession: (openingBalance: number, branchId?: string, note?: string) => Promise<CashSession>;
  reconcileCashSession: (sessionId: string, note: string) => Promise<CashSession>;
  refreshFinance: () => Promise<void>;
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
  upsertSupplier: (input: {
    id?: string | null;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string | null;
    address?: string;
    notes?: string;
    isActive?: boolean;
  }) => Promise<Supplier>;
  addStockItem: (
    item: Omit<StockItem, 'id'> & { reason?: string; branchId?: string | null },
  ) => Promise<StockItem | void>;
  updateStockItemMetadata: (id: string, item: Omit<StockItem, 'id' | 'quantity'>) => Promise<StockItem>;
  recordStockMovement: (input: {
    stockItemId: string;
    movementType: Exclude<StockMovementType, 'initial'>;
    quantityDelta: number;
    reason: string;
    branchId?: string | null;
    supplierId?: string | null;
    unitCost?: number | null;
    reference?: string | null;
    appointmentId?: string | null;
  }) => Promise<StockMovement>;
  adjustStockQuantity: (
    id: string,
    delta: number,
    reason?: string,
    movementType?: Exclude<StockMovementType, 'initial'>,
  ) => void;
}

export const FinanceDomainContext = createContext<FinanceDomainValue | undefined>(undefined);

export function useFinanceDomain(): FinanceDomainValue {
  const ctx = useContext(FinanceDomainContext);
  if (!ctx) throw new Error('useFinanceDomain must be used within an AppProvider');
  return ctx;
}

export function financeRange() {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
  return { from, to, monthStart: `${to.slice(0, 8)}01` };
}

function paymentStatusFromBalance(balance: AppointmentBalance, billed: number): Appointment['paymentStatus'] {
  if (billed > 0 && balance.collected >= billed) return 'paid';
  if (balance.collected > 0) return 'deposit_paid';
  if (balance.refunded > 0) return 'refunded';
  return 'unpaid';
}

export function useFinanceDomainState(
  deps: Pick<
    DomainSharedDeps,
    | 'resolveApi'
    | 'domainCache'
    | 'activeSalonId'
    | 'requireActiveSalon'
    | 'memberships'
    | 'hasPermissionRef'
    | 'addToast'
    | 'remote'
    | 'formatPrice'
    | 'newIdempotencyKey'
  > & {
    branches: { id: string; name: string }[];
    loadLoyalty: (
      salonId: string,
      isGuardActive?: () => boolean,
      opts?: { force?: boolean },
    ) => Promise<void>;
    setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  },
) {
  const {
    resolveApi,
    domainCache,
    activeSalonId,
    requireActiveSalon,
    memberships,
    hasPermissionRef,
    addToast,
    remote,
    formatPrice,
    newIdempotencyKey,
    branches,
    loadLoyalty,
    setAppointments,
  } = deps;

  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseEvents, setExpenseEvents] = useState<ExpenseEvent[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const loadFinance = useCallback(
    async (salonId: string, isGuardActive?: () => boolean, options?: { force?: boolean }) => {
      const perm = hasPermissionRef.current;
      const data = await domainCache.getOrLoad(
        salonId,
        'finance',
        async () => {
          const api = await resolveApi(salonId);
          const { from, to, monthStart } = financeRange();
          const [payments, sessions, summary, movements, suppliersList, expEvents] = await Promise.all([
            perm('payments.read', salonId)
              ? api.payments.list({ from, to, limit: 500 })
              : Promise.resolve([] as PaymentTransaction[]),
            perm('cash.read', salonId) ? api.cash.sessions(50) : Promise.resolve([] as CashSession[]),
            perm('reports.read', salonId)
              ? api.reports.summary(monthStart, to)
              : Promise.resolve(null as FinancialSummary | null),
            perm('stock.read', salonId) && typeof api.stock?.movements === 'function'
              ? api.stock.movements(null, 200)
              : Promise.resolve([] as StockMovement[]),
            (perm('stock.write', salonId) || perm('expenses.read', salonId)) &&
            typeof api.suppliers?.list === 'function'
              ? api.suppliers.list(true)
              : Promise.resolve([] as Supplier[]),
            perm('expenses.read', salonId) && typeof api.expenses?.events === 'function'
              ? api.expenses.events(null, 200)
              : Promise.resolve([] as ExpenseEvent[]),
          ]);
          return { payments, sessions, summary, movements, suppliersList, expEvents };
        },
        { force: options?.force ?? true },
      );

      if (isGuardActive && !isGuardActive()) return;
      setTransactions(data.payments);
      setCashSessions(data.sessions);
      setCashSession(data.sessions.find((s) => s.status === 'open') ?? null);
      setFinancialSummary(data.summary);
      setStockMovements(data.movements);
      setSuppliers(data.suppliersList);
      setExpenseEvents(data.expEvents);
    },
    [resolveApi, domainCache, hasPermissionRef],
  );

  const syncAfterFinance = useCallback(
    async (appointmentId?: string) => {
      const salonId = requireActiveSalon().id;
      domainCache.invalidate(salonId, 'finance');
      domainCache.invalidate(salonId, 'loyalty');
      await loadFinance(salonId, undefined, { force: true });
      await loadLoyalty(salonId, undefined, { force: true });
      if (appointmentId) {
        const api = await resolveApi(salonId);
        const balance = await api.payments.balance(appointmentId);
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === appointmentId ? { ...a, paymentStatus: paymentStatusFromBalance(balance, a.price) } : a,
          ),
        );
      }
    },
    [requireActiveSalon, domainCache, loadFinance, loadLoyalty, resolveApi, setAppointments],
  );

  const refreshFinance = useCallback(async () => {
    const salonId = requireActiveSalon().id;
    const api = await resolveApi(salonId);
    const perm = hasPermissionRef.current;
    const [freshExpenses, freshStock] = await Promise.all([
      perm('expenses.read', salonId) && typeof api.expenses?.list === 'function'
        ? api.expenses.list()
        : Promise.resolve(expenses),
      perm('stock.read', salonId) && typeof api.stock?.list === 'function'
        ? api.stock.list()
        : Promise.resolve(stocks),
    ]);
    setExpenses(freshExpenses);
    setStocks(freshStock);
    await loadFinance(salonId, undefined, { force: true });
  }, [loadFinance, requireActiveSalon, resolveApi, hasPermissionRef, expenses, stocks]);

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

  const closeCurrentCashSession = useCallback(
    async (actualCashAmount: number, notes?: string, sessionId?: string): Promise<CashSession> => {
      const target = sessionId ?? cashSession?.id;
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
    [cashSession?.id, requireActiveSalon, resolveApi, domainCache, loadFinance, addToast],
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
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast(`Dépense de ${formatPrice(created.amount)} enregistrée`, 'success');
        return created;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Enregistrement de la dépense impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, memberships, domainCache, loadFinance, addToast, formatPrice],
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
    [requireActiveSalon, resolveApi, domainCache, loadFinance, addToast],
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
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast('Dépense annulée par contrepassation (historique conservé).', 'info');
        return reversal;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Contrepassation de la dépense impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadFinance, addToast],
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
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast('Dépense corrigée par écriture liée (historique conservé).', 'success');
        return replacement;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Correction de la dépense impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadFinance, addToast],
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

  const upsertSupplier = useCallback(
    async (input: {
      id?: string | null;
      name: string;
      contactName?: string;
      phone?: string;
      email?: string | null;
      address?: string;
      notes?: string;
      isActive?: boolean;
    }): Promise<Supplier> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.suppliers.upsert(input);
        setSuppliers((prev) => {
          const exists = prev.some((s) => s.id === saved.id);
          const next = exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved];
          return next.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        });
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'workspace');
        addToast(`Fournisseur ${saved.name} enregistré.`, 'success');
        return saved;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Enregistrement du fournisseur impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const addStockItem = useCallback(
    async (
      data: Omit<StockItem, 'id'> & { reason?: string; branchId?: string | null },
    ): Promise<StockItem> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const created = await api.stock.create({
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          minThreshold: data.minThreshold,
          unitCost: data.unitCost,
          sellingPrice: data.sellingPrice,
          supplierId: data.supplierId ?? null,
          supplier: data.supplier,
          reason: data.reason ?? 'Stock initial',
          branchId: data.branchId ?? memberships.find((m) => m.salonId === salonId)?.branchId ?? null,
        });
        setStocks((prev) => [...prev, created]);
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast(`Produit ${created.name} ajouté au stock`, 'success');
        return created;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Ajout du produit impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, memberships, domainCache, loadFinance, addToast],
  );

  const updateStockItemMetadata = useCallback(
    async (id: string, data: Omit<StockItem, 'id' | 'quantity'>): Promise<StockItem> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.stock.updateMetadata(id, {
          name: data.name,
          category: data.category,
          minThreshold: data.minThreshold,
          unitCost: data.unitCost,
          sellingPrice: data.sellingPrice,
          supplierId: data.supplierId ?? null,
          supplier: data.supplier,
          isActive: data.isActive ?? true,
        });
        setStocks((prev) => prev.map((entry) => (entry.id === id ? saved : entry)));
        domainCache.invalidate(salonId, 'workspace');
        addToast(`Fiche produit ${saved.name} mise à jour.`, 'success');
        return saved;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Mise à jour du produit impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const recordStockMovement = useCallback(
    async (input: {
      stockItemId: string;
      movementType: Exclude<StockMovementType, 'initial'>;
      quantityDelta: number;
      reason: string;
      branchId?: string | null;
      supplierId?: string | null;
      unitCost?: number | null;
      reference?: string | null;
      appointmentId?: string | null;
    }): Promise<StockMovement> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const movement = await api.stock.recordMovement({
          ...input,
          branchId: input.branchId ?? memberships.find((m) => m.salonId === salonId)?.branchId ?? null,
        });
        const refreshedStock = await api.stock.list();
        setStocks(refreshedStock);
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast('Mouvement de stock historisé.', 'success');
        return movement;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Mouvement de stock impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, memberships, domainCache, loadFinance, addToast],
  );

  const adjustStockQuantity = useCallback(
    (
      id: string,
      delta: number,
      reason = 'Ajustement manuel de stock',
      movementType?: Exclude<StockMovementType, 'initial'>,
    ) => {
      if (delta === 0) return;
      const item = stocks.find((entry) => entry.id === id);
      if (!item) {
        addToast('Produit introuvable.', 'error');
        return;
      }
      if (item.quantity + delta < 0) {
        addToast('La quantité ne peut pas être négative.', 'error');
        return;
      }
      const resolvedType: Exclude<StockMovementType, 'initial'> =
        movementType ?? (delta > 0 ? 'restock' : 'adjustment');
      void remote(
        () =>
          recordStockMovement({
            stockItemId: id,
            movementType: resolvedType,
            quantityDelta: delta,
            reason,
          }).then(() => undefined),
        'Ajustement du stock impossible',
      );
    },
    [stocks, addToast, remote, recordStockMovement],
  );

  const resetFinanceDomain = useCallback(() => {
    setTransactions([]);
    setCashSession(null);
    setCashSessions([]);
    setFinancialSummary(null);
    setExpenses([]);
    setExpenseEvents([]);
    setStocks([]);
    setStockMovements([]);
    setSuppliers([]);
  }, []);

  return {
    transactions,
    setTransactions,
    cashSession,
    setCashSession,
    cashSessions,
    setCashSessions,
    financialSummary,
    setFinancialSummary,
    expenses,
    setExpenses,
    expenseEvents,
    setExpenseEvents,
    stocks,
    setStocks,
    stockMovements,
    setStockMovements,
    suppliers,
    setSuppliers,
    loadFinance,
    refreshFinance,
    recordPayment,
    confirmPendingPayment,
    rejectPendingPayment,
    recordPaymentCorrection,
    getAppointmentBalance,
    closeCurrentCashSession,
    openNewCashSession,
    reconcileCashSession,
    addExpense,
    attachExpenseReceipt,
    reverseExpense,
    correctExpense,
    deleteExpense,
    upsertSupplier,
    addStockItem,
    updateStockItemMetadata,
    recordStockMovement,
    adjustStockQuantity,
    resetFinanceDomain,
  };
}
