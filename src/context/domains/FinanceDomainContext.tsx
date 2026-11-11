// Contexte du domaine finance : état, cache et rechargement (source de
// vérité unique). Les écritures sont réparties par opérations dans
// ./finance/ (paiement, caisse, dépenses, stock) et reçoivent leurs
// dépendances — elles ne détiennent aucun état propre.
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type {
  Appointment,
  AppointmentBalance,
  CashSession,
  ErpBranch,
  ErpDashboardMetrics,
  Expense,
  ExpenseEvent,
  FinancialSummary,
  PaymentTransaction,
  StockItem,
  StockMovement,
  Supplier,
} from '../../types';
import {
  DEFAULT_BUSINESS_TIMEZONE,
  normalizeTimeZone,
  shiftCalendarMonths,
  zonedToday,
} from '../../lib/businessTime';
import type { DomainSharedDeps } from './shared';
import type { SyncAfterFinanceFn } from './finance/financeShared';
import { usePaymentOperations } from './finance/paymentOperations';
import type { PaymentOperationsValue } from './finance/paymentOperations';
import { useCashOperations } from './finance/cashOperations';
import type { CashOperationsValue } from './finance/cashOperations';
import { useExpenseOperations } from './finance/expenseOperations';
import type { ExpenseOperationsValue } from './finance/expenseOperations';
import { useStockOperations } from './finance/stockOperations';
import type { StockOperationsValue } from './finance/stockOperations';

export interface DashboardMetricsParams {
  from: string;
  to: string;
  dayFilter?: 'all' | 'saturday' | 'friday' | 'weekday';
  force?: boolean;
}

export interface FinanceDomainValue
  extends PaymentOperationsValue, CashOperationsValue, ExpenseOperationsValue, StockOperationsValue {
  transactions: PaymentTransaction[];
  cashSession: CashSession | null;
  cashSessions: CashSession[];
  financialSummary: FinancialSummary | null;
  dashboardMetrics: ErpDashboardMetrics | null;
  dashboardMetricsLoading: boolean;
  loadDashboardMetrics: (params: DashboardMetricsParams) => Promise<ErpDashboardMetrics | null>;
  loadFinancialSummary: (from: string, to: string) => Promise<FinancialSummary | null>;
  expenses: Expense[];
  expenseEvents: ExpenseEvent[];
  stocks: StockItem[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  refreshFinance: () => Promise<void>;
}

export const FinanceDomainContext = createContext<FinanceDomainValue | undefined>(undefined);

export function useFinanceDomain(): FinanceDomainValue {
  const ctx = useContext(FinanceDomainContext);
  if (!ctx) throw new Error('useFinanceDomain must be used within an AppProvider');
  return ctx;
}

export function financeRange(timeZone: string = DEFAULT_BUSINESS_TIMEZONE) {
  const tz = normalizeTimeZone(timeZone);
  const to = zonedToday(tz);
  const startMonth = shiftCalendarMonths(to.slice(0, 7), -11);
  return {
    from: `${startMonth}-01`,
    to,
    monthStart: `${to.slice(0, 7)}-01`,
    timeZone: tz,
  };
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
    branches: ErpBranch[];
    salonTimezone?: string;
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
    salonTimezone = DEFAULT_BUSINESS_TIMEZONE,
    loadLoyalty,
    setAppointments,
  } = deps;

  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<ErpDashboardMetrics | null>(null);
  const [dashboardMetricsLoading, setDashboardMetricsLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseEvents, setExpenseEvents] = useState<ExpenseEvent[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const lastDashboardQueryRef = useRef<{
    salonId: string;
    from: string;
    to: string;
    dayFilter: 'all' | 'saturday' | 'friday' | 'weekday';
  } | null>(null);

  const loadDashboardMetrics = useCallback(
    async (params: DashboardMetricsParams): Promise<ErpDashboardMetrics | null> => {
      if (!activeSalonId) return null;
      const perm = hasPermissionRef.current;
      if (!perm('dashboard.read', activeSalonId)) return null;
      const dayFilter = params.dayFilter ?? 'all';
      const qualifier = `${params.from}:${params.to}:${dayFilter}`;
      lastDashboardQueryRef.current = {
        salonId: activeSalonId,
        from: params.from,
        to: params.to,
        dayFilter,
      };
      setDashboardMetricsLoading(true);
      try {
        const metrics = await domainCache.getOrLoad(
          activeSalonId,
          'dashboard',
          async () => {
            const api = await resolveApi(activeSalonId);
            if (typeof api.reports?.dashboard !== 'function') return null;
            return api.reports.dashboard({ from: params.from, to: params.to, dayFilter });
          },
          { qualifier, force: params.force ?? false },
        );
        if (metrics !== undefined) {
          setDashboardMetrics(metrics);
        }
        return metrics;
      } catch {
        return null;
      } finally {
        setDashboardMetricsLoading(false);
      }
    },
    [activeSalonId, domainCache, resolveApi, hasPermissionRef],
  );

  const loadFinancialSummary = useCallback(
    async (from: string, to: string): Promise<FinancialSummary | null> => {
      if (!activeSalonId) return null;
      const perm = hasPermissionRef.current;
      if (!perm('reports.read', activeSalonId)) return null;
      try {
        const api = await resolveApi(activeSalonId);
        if (typeof api.reports?.summary !== 'function') return null;
        const summary = await api.reports.summary(from, to);
        setFinancialSummary(summary);
        return summary;
      } catch {
        return null;
      }
    },
    [activeSalonId, resolveApi, hasPermissionRef],
  );

  const loadFinance = useCallback(
    async (
      salonId: string,
      isGuardActive?: () => boolean,
      options?: { force?: boolean; timeZone?: string },
    ) => {
      const perm = hasPermissionRef.current;
      const tz = options?.timeZone ?? salonTimezone;
      const data = await domainCache.getOrLoad(
        salonId,
        'finance',
        async () => {
          const api = await resolveApi(salonId);
          const { from, to, monthStart } = financeRange(tz);
          const activeQuery =
            lastDashboardQueryRef.current && lastDashboardQueryRef.current.salonId === salonId
              ? lastDashboardQueryRef.current
              : { salonId, from: monthStart, to, dayFilter: 'all' as const };
          const [payments, sessions, summary, dashboard, movements, suppliersList, expEvents] =
            await Promise.all([
              perm('payments.read', salonId)
                ? api.payments.list({ from, to, limit: 500 })
                : Promise.resolve([] as PaymentTransaction[]),
              perm('cash.read', salonId) ? api.cash.sessions(50) : Promise.resolve([] as CashSession[]),
              perm('reports.read', salonId)
                ? api.reports.summary(monthStart, to)
                : Promise.resolve(null as FinancialSummary | null),
              perm('dashboard.read', salonId) && typeof api.reports?.dashboard === 'function'
                ? api.reports
                    .dashboard({
                      from: activeQuery.from,
                      to: activeQuery.to,
                      dayFilter: activeQuery.dayFilter,
                    })
                    .catch(() => null)
                : Promise.resolve(null as ErpDashboardMetrics | null),
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
          if (dashboard) {
            domainCache.set(
              salonId,
              'dashboard',
              dashboard,
              undefined,
              `${activeQuery.from}:${activeQuery.to}:${activeQuery.dayFilter}`,
            );
          }
          return { payments, sessions, summary, dashboard, movements, suppliersList, expEvents };
        },
        { force: options?.force ?? true },
      );

      if (isGuardActive && !isGuardActive()) return;
      setTransactions(data.payments);
      setCashSessions(data.sessions);
      setCashSession(data.sessions.find((s) => s.status === 'open') ?? null);
      setFinancialSummary(data.summary);
      if (data.dashboard !== undefined) setDashboardMetrics(data.dashboard);
      setStockMovements(data.movements);
      setSuppliers(data.suppliersList);
      setExpenseEvents(data.expEvents);
    },
    [resolveApi, domainCache, hasPermissionRef, salonTimezone],
  );

  const syncAfterFinance = useCallback<SyncAfterFinanceFn>(
    async (appointmentId?: string) => {
      const salonId = requireActiveSalon().id;
      domainCache.invalidate(salonId, 'finance');
      domainCache.invalidate(salonId, 'dashboard');
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

  const paymentOperations = usePaymentOperations({
    activeSalonId,
    resolveApi,
    requireActiveSalon,
    addToast,
    newIdempotencyKey,
    syncAfterFinance,
  });

  const cashOperations = useCashOperations({
    resolveApi,
    requireActiveSalon,
    domainCache,
    memberships,
    addToast,
    cashSessionId: cashSession?.id,
    branches,
    loadFinance,
  });

  const expenseOperations = useExpenseOperations({
    resolveApi,
    requireActiveSalon,
    domainCache,
    memberships,
    formatPrice,
    addToast,
    setExpenses,
    loadFinance,
  });

  const stockOperations = useStockOperations({
    resolveApi,
    requireActiveSalon,
    domainCache,
    memberships,
    remote,
    addToast,
    stocks,
    setStocks,
    setSuppliers,
    loadFinance,
  });

  const resetFinanceDomain = useCallback(() => {
    setTransactions([]);
    setCashSession(null);
    setCashSessions([]);
    setFinancialSummary(null);
    setDashboardMetrics(null);
    setDashboardMetricsLoading(false);
    lastDashboardQueryRef.current = null;
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
    dashboardMetrics,
    setDashboardMetrics,
    dashboardMetricsLoading,
    loadDashboardMetrics,
    loadFinancialSummary,
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
    ...paymentOperations,
    ...cashOperations,
    ...expenseOperations,
    ...stockOperations,
    resetFinanceDomain,
  };
}
