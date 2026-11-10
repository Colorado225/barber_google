import type {
  Appointment,
  AppointmentBalance,
  AppointmentNotification,
  ErpBranch,
  ErpDashboardMetrics,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltySettings,
  NotificationDispatchResult,
  NotificationHealthSummary,
  NotificationProbeResult,
  CashSession,
  Client,
  Expense,
  ExpenseEvent,
  FinancialSummary,
  LoyaltyReward,
  PaymentEntryKind,
  PaymentMethod,
  PaymentSettlementMode,
  PaymentTransaction,
  Review,
  Service,
  StaffMember,
  StockItem,
  StockMovement,
  StockMovementType,
  Supplier,
} from '../types';
import {
  DEFAULT_BUSINESS_TIMEZONE,
  normalizeTimeZone,
  resolveSalonTimezone,
  shiftCalendarDays,
  zonedDateTime,
  zonedDateTimeToIso,
} from './businessTime';
import { mapCapabilities, mapNotificationProbe, mapSalonNotificationHealth } from './notifications';
import { getSupabaseClient } from './supabase';
import { ApiError } from './apiError';

export { ApiError };

type DbRow = Record<string, unknown>;

function throwSupabaseError(error: { message: string; code?: string }): never {
  const status =
    error.code === '42501'
      ? 403
      : error.code === '28000' || error.code === 'PGRST301'
        ? 401
        : error.code === '23505'
          ? 409
          : error.code?.startsWith('22') || error.code === '23514'
            ? 400
            : 500;
  throw new ApiError(error.message, status, error.code);
}

function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throwSupabaseError(result.error);
  if (result.data === null) throw new ApiError('Supabase n’a retourné aucune donnée.');
  return result.data;
}

function stringValue(row: DbRow, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

function optionalString(row: DbRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.length ? value : undefined;
}

function numberValue(row: DbRow, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function optionalNumber(row: DbRow, key: string): number | undefined {
  const value = row[key];
  return value === null || value === undefined ? undefined : Number(value);
}

function booleanValue(row: DbRow, key: string): boolean {
  return row[key] === true;
}

function mapDateTimeInZone(
  iso: string,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): { date: string; time: string } {
  return zonedDateTime(iso, timeZone);
}

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

function mapClient(row: DbRow): Client {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    phone: stringValue(row, 'phone'),
    email: optionalString(row, 'email'),
    segment: stringValue(row, 'segment', 'new') as Client['segment'],
    favoriteService: stringValue(row, 'favorite_service'),
    notes: stringValue(row, 'notes'),
    totalSpent: optionalNumber(row, 'total_spent'),
    visitsCount: optionalNumber(row, 'visits_count'),
    lastVisit: optionalString(row, 'last_visit'),
  };
}

function mapService(row: DbRow): Service {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    category: stringValue(row, 'category') as Service['category'],
    description: stringValue(row, 'description'),
    price: numberValue(row, 'price'),
    durationMinutes: numberValue(row, 'duration_minutes'),
    prepMinutes: numberValue(row, 'prep_minutes'),
    popular: booleanValue(row, 'popular'),
    isActive: booleanValue(row, 'is_active'),
  };
}

function mapStaff(row: DbRow): StaffMember {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    role: stringValue(row, 'role') as StaffMember['role'],
    avatar: optionalString(row, 'avatar'),
    specialties: Array.isArray(row.specialties)
      ? row.specialties.filter((value): value is string => typeof value === 'string')
      : [],
    rating: optionalNumber(row, 'rating'),
    commissionRate: numberValue(row, 'commission_rate'),
    phone: stringValue(row, 'phone'),
    email: optionalString(row, 'email'),
    branchId: optionalString(row, 'branch_id') ?? null,
    isAvailable: booleanValue(row, 'is_available'),
    isActive: booleanValue(row, 'is_active'),
    serviceIds: Array.isArray(row.service_ids)
      ? row.service_ids.filter((value): value is string => typeof value === 'string')
      : [],
    userId: optionalString(row, 'user_id') ?? null,
  };
}

export function mapAppointmentRow(row: DbRow, timeZone: string = DEFAULT_BUSINESS_TIMEZONE): Appointment {
  return mapAppointment(row, timeZone);
}

function mapAppointment(row: DbRow, timeZone: string = DEFAULT_BUSINESS_TIMEZONE): Appointment {
  const startsAt = stringValue(row, 'starts_at');
  const { date, time } = mapDateTimeInZone(startsAt, timeZone);
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    branchId: stringValue(row, 'branch_id'),
    clientId: optionalString(row, 'client_id') ?? null,
    clientName: stringValue(row, 'client_name'),
    clientPhone: stringValue(row, 'client_phone'),
    clientEmail: optionalString(row, 'client_email'),
    serviceId: stringValue(row, 'service_id'),
    serviceName: stringValue(row, 'service_name'),
    price: numberValue(row, 'amount'),
    staffId: optionalString(row, 'staff_id') ?? null,
    staffName: stringValue(row, 'staff_name'),
    date,
    time,
    durationMinutes: Math.max(0, (Date.parse(stringValue(row, 'ends_at')) - Date.parse(startsAt)) / 60000),
    status: stringValue(row, 'status') as Appointment['status'],
    paymentStatus: stringValue(row, 'payment_status') as Appointment['paymentStatus'],
    source: stringValue(row, 'source') as Appointment['source'],
    notes: stringValue(row, 'notes'),
    createdAt: stringValue(row, 'created_at'),
    updatedAt: optionalString(row, 'updated_at'),
    startsAt,
    endsAt: stringValue(row, 'ends_at'),
    arrivalAt: optionalString(row, 'arrival_at'),
    serviceStartedAt: optionalString(row, 'service_started_at'),
    serviceCompletedAt: optionalString(row, 'service_completed_at'),
  };
}

function mapPayment(row: DbRow, timeZone: string = DEFAULT_BUSINESS_TIMEZONE): PaymentTransaction {
  const createdAt = stringValue(row, 'created_at');
  const { date, time } = mapDateTimeInZone(createdAt, timeZone);
  const kind = stringValue(row, 'kind', 'payment') as PaymentEntryKind;
  const status = stringValue(row, 'status');
  const amount = numberValue(row, 'amount');
  const appointmentAmount = optionalNumber(row, 'appointment_amount');
  const providerReference = optionalString(row, 'provider_reference');
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    branchId: optionalString(row, 'branch_id'),
    appointmentId: optionalString(row, 'appointment_id'),
    appointmentAmount,
    serviceName: optionalString(row, 'service_name'),
    clientName: stringValue(row, 'client_name'),
    amount,
    method: stringValue(row, 'method') as PaymentMethod,
    kind,
    type:
      kind !== 'payment'
        ? 'balance'
        : appointmentAmount !== undefined && amount >= appointmentAmount
          ? 'full'
          : 'deposit',
    reference: providerReference ?? stringValue(row, 'id').slice(0, 8).toUpperCase(),
    providerReference,
    status: status === 'confirmed' ? 'completed' : status === 'pending' ? 'pending' : 'cancelled',
    date,
    time,
    createdAt,
    cashSessionId: optionalString(row, 'cash_session_id'),
    originalEntryId: optionalString(row, 'original_entry_id'),
    reason: optionalString(row, 'reason'),
    settlementMode: optionalString(row, 'settlement_mode') as PaymentSettlementMode | undefined,
    settlementNote: optionalString(row, 'settlement_note'),
  };
}

function mapCashSession(row: DbRow): CashSession {
  const counted = optionalNumber(row, 'counted_balance');
  const difference = optionalNumber(row, 'difference');
  const totalCashOut = numberValue(row, 'total_cash_out');
  const totalMobileMoneyOut = numberValue(row, 'total_mobile_money_out');
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    branchId: stringValue(row, 'branch_id'),
    registerId: stringValue(row, 'register_id'),
    registerName: optionalString(row, 'register_name'),
    openedAt: stringValue(row, 'opened_at'),
    closedAt: optionalString(row, 'closed_at'),
    reconciledAt: optionalString(row, 'reconciled_at'),
    openingBalance: numberValue(row, 'opening_balance'),
    totalCashIn: numberValue(row, 'total_cash_in'),
    totalCashOut,
    totalMobileMoneyIn: numberValue(row, 'total_mobile_money_in'),
    totalMobileMoneyOut,
    totalOut: totalCashOut + totalMobileMoneyOut,
    theoreticalBalance: numberValue(row, 'theoretical_balance'),
    expectedBalance: optionalNumber(row, 'expected_balance'),
    actualBalance: counted,
    countedBalance: counted,
    discrepancy: difference,
    difference,
    status: stringValue(row, 'status') as CashSession['status'],
    openingNote: optionalString(row, 'opening_note'),
    closingNote: optionalString(row, 'closing_note'),
    reconciliationNote: optionalString(row, 'reconciliation_note'),
    notes: optionalString(row, 'closing_note'),
  };
}

function mapFinancialSummary(row: DbRow): FinancialSummary {
  const byMethodRaw = row.by_method;
  const byMethod: Record<string, number> = {};
  if (byMethodRaw && typeof byMethodRaw === 'object') {
    for (const [key, value] of Object.entries(byMethodRaw as Record<string, unknown>)) {
      byMethod[key] = Number(value ?? 0);
    }
  }
  return {
    revenueBilled: numberValue(row, 'revenue_billed'),
    revenueCollected: numberValue(row, 'revenue_collected'),
    outstanding: numberValue(row, 'outstanding'),
    refunds: numberValue(row, 'refunds'),
    expenses: numberValue(row, 'expenses'),
    netBalance: numberValue(row, 'net_balance'),
    pendingAmount: numberValue(row, 'pending_amount'),
    paymentCount: numberValue(row, 'payment_count'),
    byMethod,
  };
}

function nullableNumber(row: DbRow, key: string): number | null {
  const value = row[key];
  return value === null || value === undefined ? null : Number(value);
}

export function mapErpDashboardMetrics(row: DbRow): ErpDashboardMetrics {
  const perms = (row.permissions ?? {}) as DbRow;
  const kpis = (row.kpis ?? {}) as DbRow;
  const byMethodRaw = (row.by_method ?? {}) as Record<string, unknown>;
  const byMethod: Record<string, number> = {};
  for (const [k, v] of Object.entries(byMethodRaw)) {
    byMethod[k] = Number(v ?? 0);
  }
  const monthlyRaw = Array.isArray(row.monthly_series) ? (row.monthly_series as DbRow[]) : [];
  const weeklyRaw = Array.isArray(row.weekly_series) ? (row.weekly_series as DbRow[]) : [];
  const serviceRaw = Array.isArray(row.service_performance) ? (row.service_performance as DbRow[]) : [];
  const staffRaw = Array.isArray(row.staff_activity) ? (row.staff_activity as DbRow[]) : [];
  const hourlyRaw = Array.isArray(row.hourly_occupancy) ? (row.hourly_occupancy as DbRow[]) : [];

  return {
    periodFrom: stringValue(row, 'period_from'),
    periodTo: stringValue(row, 'period_to'),
    timezone: stringValue(row, 'timezone', DEFAULT_BUSINESS_TIMEZONE),
    today: stringValue(row, 'today'),
    dayFilter: stringValue(row, 'day_filter', 'all') as ErpDashboardMetrics['dayFilter'],
    configuredStaffCount: numberValue(row, 'configured_staff_count'),
    permissions: {
      canViewFinance: perms.can_view_finance === true,
      canViewExpenses: perms.can_view_expenses === true,
      canViewAppointments: perms.can_view_appointments === true,
    },
    kpis: {
      revenueCollectedNet: nullableNumber(kpis, 'revenue_collected_net'),
      revenueCollectedGross: nullableNumber(kpis, 'revenue_collected_gross'),
      refunds: nullableNumber(kpis, 'refunds'),
      paymentReversals: nullableNumber(kpis, 'payment_reversals'),
      refundReversals: nullableNumber(kpis, 'refund_reversals'),
      pendingPaymentsAmount: nullableNumber(kpis, 'pending_payments_amount'),
      confirmedPaymentCount: nullableNumber(kpis, 'confirmed_payment_count'),
      averageBasket: nullableNumber(kpis, 'average_basket'),
      revenueBilled: nullableNumber(kpis, 'revenue_billed'),
      revenueRealized: nullableNumber(kpis, 'revenue_realized'),
      outstanding: nullableNumber(kpis, 'outstanding'),
      expensesNet: nullableNumber(kpis, 'expenses_net'),
      netMargin: nullableNumber(kpis, 'net_margin'),
      appointmentsTotal: numberValue(kpis, 'appointments_total'),
      appointmentsActive: numberValue(kpis, 'appointments_active'),
      appointmentsCompleted: numberValue(kpis, 'appointments_completed'),
      appointmentsCancelled: numberValue(kpis, 'appointments_cancelled'),
      appointmentsNoShow: numberValue(kpis, 'appointments_no_show'),
      todayAppointmentsActive: numberValue(kpis, 'today_appointments_active'),
      todayAppointmentsCompleted: numberValue(kpis, 'today_appointments_completed'),
      todayAppointmentsInProgress: numberValue(kpis, 'today_appointments_in_progress'),
      todayAppointmentsCancelled: numberValue(kpis, 'today_appointments_cancelled'),
      todayAppointmentsNoShow: numberValue(kpis, 'today_appointments_no_show'),
    },
    byMethod,
    monthlySeries: monthlyRaw.map((m) => ({
      month: stringValue(m, 'month'),
      fromDate: stringValue(m, 'from_date'),
      toDate: stringValue(m, 'to_date'),
      revenueCollected: nullableNumber(m, 'revenue_collected'),
      revenueBilled: nullableNumber(m, 'revenue_billed'),
      revenueRealized: nullableNumber(m, 'revenue_realized'),
      expenses: nullableNumber(m, 'expenses'),
      margin: nullableNumber(m, 'margin'),
      completedAppointments: numberValue(m, 'completed_appointments'),
      activeAppointments: numberValue(m, 'active_appointments'),
      cancelledAppointments: numberValue(m, 'cancelled_appointments'),
    })),
    weeklySeries: weeklyRaw.map((w) => ({
      label: stringValue(w, 'label'),
      shortLabel: stringValue(w, 'short_label'),
      fromDate: stringValue(w, 'from_date'),
      toDate: stringValue(w, 'to_date'),
      revenueCollected: nullableNumber(w, 'revenue_collected'),
      revenueBilled: nullableNumber(w, 'revenue_billed'),
      revenueRealized: nullableNumber(w, 'revenue_realized'),
      expenses: nullableNumber(w, 'expenses'),
      margin: nullableNumber(w, 'margin'),
      completedAppointments: numberValue(w, 'completed_appointments'),
      activeAppointments: numberValue(w, 'active_appointments'),
    })),
    servicePerformance: serviceRaw.map((s) => ({
      serviceId: stringValue(s, 'service_id'),
      name: stringValue(s, 'name'),
      category: stringValue(s, 'category') as Service['category'],
      price: numberValue(s, 'price'),
      durationMinutes: numberValue(s, 'duration_minutes'),
      completedVolume: numberValue(s, 'completed_volume'),
      completedRevenue: numberValue(s, 'completed_revenue'),
      billedVolume: numberValue(s, 'billed_volume'),
      billedRevenue: numberValue(s, 'billed_revenue'),
      cancelledVolume: numberValue(s, 'cancelled_volume'),
      noShowVolume: numberValue(s, 'no_show_volume'),
    })),
    staffActivity: staffRaw.map((st) => ({
      staffId: stringValue(st, 'staff_id'),
      name: stringValue(st, 'name'),
      commissionRate: numberValue(st, 'commission_rate'),
      completedAppointments: numberValue(st, 'completed_appointments'),
      completedRevenue: numberValue(st, 'completed_revenue'),
      billedAppointments: numberValue(st, 'billed_appointments'),
      billedRevenue: numberValue(st, 'billed_revenue'),
      cancelledAppointments: numberValue(st, 'cancelled_appointments'),
      noShowAppointments: numberValue(st, 'no_show_appointments'),
    })),
    hourlyOccupancy: hourlyRaw.map((h) => ({
      hour: stringValue(h, 'hour'),
      occupiedMinutes: numberValue(h, 'occupied_minutes'),
      availableMinutes: numberValue(h, 'available_minutes'),
      occupancyRate: numberValue(h, 'occupancy_rate'),
      activeAppointments: numberValue(h, 'active_appointments'),
      completedAppointments: numberValue(h, 'completed_appointments'),
    })),
  };
}

function mapAppointmentBalance(row: DbRow): AppointmentBalance {
  return {
    appointmentId: stringValue(row, 'appointment_id'),
    billed: numberValue(row, 'billed'),
    collected: numberValue(row, 'collected'),
    outstanding: numberValue(row, 'outstanding'),
    pending: numberValue(row, 'pending'),
    refunded: numberValue(row, 'refunded'),
  };
}

function mapExpense(row: DbRow): Expense {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    branchId: optionalString(row, 'branch_id') ?? null,
    title: stringValue(row, 'title'),
    category: stringValue(row, 'category') as Expense['category'],
    amount: numberValue(row, 'amount'),
    date: stringValue(row, 'spent_on'),
    paymentMethod: undefined,
    notes: stringValue(row, 'notes'),
    receiptRef: optionalString(row, 'receipt_ref'),
    entryKind: (optionalString(row, 'entry_kind') as Expense['entryKind']) ?? 'expense',
    originalExpenseId: optionalString(row, 'original_expense_id') ?? null,
    status: (optionalString(row, 'status') as Expense['status']) ?? 'active',
    supplierId: optionalString(row, 'supplier_id') ?? null,
    attachmentPath: optionalString(row, 'attachment_path') ?? null,
    attachmentName: optionalString(row, 'attachment_name') ?? null,
    attachmentMime: optionalString(row, 'attachment_mime') ?? null,
    attachmentSize: optionalNumber(row, 'attachment_size') ?? null,
    reason: optionalString(row, 'reason') ?? '',
    reversedAt: optionalString(row, 'reversed_at') ?? null,
    reversedBy: optionalString(row, 'reversed_by') ?? null,
    createdBy: optionalString(row, 'created_by'),
    createdAt: optionalString(row, 'created_at'),
  };
}

function mapExpenseEvent(row: DbRow): ExpenseEvent {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    expenseId: stringValue(row, 'expense_id'),
    eventType: stringValue(row, 'event_type') as ExpenseEvent['eventType'],
    amount: numberValue(row, 'amount'),
    reason: stringValue(row, 'reason'),
    actorId: optionalString(row, 'actor_id') ?? null,
    metadata:
      row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {},
    createdAt: stringValue(row, 'created_at'),
  };
}

function mapSupplier(row: DbRow): Supplier {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    contactName: stringValue(row, 'contact_name'),
    phone: stringValue(row, 'phone'),
    email: optionalString(row, 'email'),
    address: stringValue(row, 'address'),
    notes: stringValue(row, 'notes'),
    isActive: row.is_active !== false,
    createdAt: optionalString(row, 'created_at'),
    updatedAt: optionalString(row, 'updated_at'),
  };
}

function mapStock(row: DbRow): StockItem {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    category: stringValue(row, 'category') as StockItem['category'],
    quantity: numberValue(row, 'quantity'),
    minThreshold: numberValue(row, 'min_threshold'),
    unitCost: numberValue(row, 'unit_cost'),
    sellingPrice: optionalNumber(row, 'selling_price'),
    supplierId: optionalString(row, 'supplier_id') ?? null,
    supplier: stringValue(row, 'supplier'),
    lastRestock: optionalString(row, 'last_restock'),
    isActive: row.is_active !== false,
    updatedAt: optionalString(row, 'updated_at'),
  };
}

function mapStockMovement(row: DbRow): StockMovement {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    branchId: optionalString(row, 'branch_id') ?? null,
    stockItemId: stringValue(row, 'stock_item_id'),
    stockItemName: optionalString(row, 'stock_item_name'),
    supplierId: optionalString(row, 'supplier_id') ?? null,
    supplierName: optionalString(row, 'supplier_name'),
    movementType: stringValue(row, 'movement_type') as StockMovementType,
    quantityDelta: numberValue(row, 'quantity_delta'),
    quantityBefore: numberValue(row, 'quantity_before'),
    quantityAfter: numberValue(row, 'quantity_after'),
    unitCost: optionalNumber(row, 'unit_cost') ?? null,
    reason: stringValue(row, 'reason'),
    reference: optionalString(row, 'reference'),
    appointmentId: optionalString(row, 'appointment_id') ?? null,
    actorId: optionalString(row, 'actor_id') ?? null,
    createdAt: stringValue(row, 'created_at'),
  };
}

function mapReward(row: DbRow): LoyaltyReward {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    description: stringValue(row, 'description'),
    pointsCost: numberValue(row, 'points_cost'),
    category: stringValue(row, 'category') as LoyaltyReward['category'],
    isActive: booleanValue(row, 'is_active'),
    timesRedeemed: optionalNumber(row, 'times_redeemed'),
    discountPercentage: optionalNumber(row, 'discount_percentage'),
    freeServiceName: optionalString(row, 'free_service_name'),
    createdAt: stringValue(row, 'created_at'),
  };
}

function mapLoyaltyProgram(salonId: string, row: DbRow | null): LoyaltySettings {
  return {
    salonId,
    pointsPer100Fcfa: row ? numberValue(row, 'points_per_100_xof') : 1,
    welcomeBonus: row ? numberValue(row, 'welcome_bonus') : 0,
    silverThreshold: row ? numberValue(row, 'silver_threshold') : 100,
    goldThreshold: row ? numberValue(row, 'gold_threshold') : 250,
    vipThreshold: row ? numberValue(row, 'vip_threshold') : 500,
    programEnabled: row ? booleanValue(row, 'is_enabled') : true,
  };
}

function mapLoyaltyAccount(row: DbRow): LoyaltyAccount {
  return {
    salonId: stringValue(row, 'salon_id'),
    clientId: stringValue(row, 'client_id'),
    pointsBalance: numberValue(row, 'points_balance'),
    totalEarned: numberValue(row, 'total_earned'),
    totalRedeemed: numberValue(row, 'total_redeemed'),
    tier: stringValue(row, 'tier', 'bronze') as LoyaltyAccount['tier'],
    updatedAt: stringValue(row, 'updated_at'),
  };
}

function mapLoyaltyLedgerEntry(row: DbRow): LoyaltyLedgerEntry {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    clientId: stringValue(row, 'client_id'),
    appointmentId: optionalString(row, 'appointment_id') ?? null,
    rewardId: optionalString(row, 'reward_id') ?? null,
    kind: stringValue(row, 'kind') as LoyaltyLedgerEntry['kind'],
    points: numberValue(row, 'points'),
    balanceAfter: numberValue(row, 'balance_after'),
    reason: stringValue(row, 'reason'),
    createdAt: stringValue(row, 'created_at'),
  };
}

export function mapNotificationRow(row: DbRow): AppointmentNotification {
  return mapNotification(row);
}

function mapNotification(row: DbRow): AppointmentNotification {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    appointmentId: stringValue(row, 'appointment_id'),
    channel: stringValue(row, 'channel') as AppointmentNotification['channel'],
    kind: stringValue(row, 'kind') as AppointmentNotification['kind'],
    recipient: stringValue(row, 'recipient'),
    status: stringValue(row, 'status') as AppointmentNotification['status'],
    scheduledAt: stringValue(row, 'scheduled_at'),
    createdAt: stringValue(row, 'created_at'),
    sentAt: optionalString(row, 'sent_at') ?? null,
    error: optionalString(row, 'error') ?? null,
    attempts: numberValue(row, 'attempts'),
    failureCount: numberValue(row, 'failure_count'),
    lastError: optionalString(row, 'last_error') ?? null,
    providerMessageId: optionalString(row, 'provider_message_id') ?? null,
  };
}

function mapReview(row: DbRow): Review {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    author: stringValue(row, 'author'),
    rating: numberValue(row, 'rating'),
    date: stringValue(row, 'created_at').slice(0, 10),
    comment: stringValue(row, 'comment'),
    verified: booleanValue(row, 'verified'),
    isHidden: booleanValue(row, 'is_hidden'),
    moderatedAt: optionalString(row, 'moderated_at'),
    moderationReason: optionalString(row, 'moderation_reason'),
  };
}

function mapStaffSchedule(row: DbRow): StaffSchedule {
  return {
    id: stringValue(row, 'id'),
    weekday: numberValue(row, 'weekday'),
    startsAt: stringValue(row, 'starts_at').slice(0, 5),
    endsAt: stringValue(row, 'ends_at').slice(0, 5),
  };
}

function mapStaffAbsence(row: DbRow): StaffAbsence {
  return {
    id: stringValue(row, 'id'),
    startsOn: stringValue(row, 'starts_on'),
    endsOn: stringValue(row, 'ends_on'),
    reason: stringValue(row, 'reason'),
  };
}

type ClientInput = Pick<Client, 'name' | 'phone'> &
  Partial<Pick<Client, 'email' | 'segment' | 'favoriteService' | 'notes'>>;
type ServiceInput = Pick<Service, 'name' | 'category' | 'price' | 'durationMinutes'> &
  Partial<Pick<Service, 'description' | 'prepMinutes' | 'popular' | 'isActive'>>;
type StaffInput = Pick<StaffMember, 'name' | 'role' | 'commissionRate'> &
  Partial<
    Pick<
      StaffMember,
      'phone' | 'email' | 'specialties' | 'branchId' | 'isAvailable' | 'isActive' | 'serviceIds'
    >
  >;
type ExpenseInput = Pick<Expense, 'title' | 'category' | 'amount' | 'date'> &
  Partial<
    Pick<
      Expense,
      | 'notes'
      | 'branchId'
      | 'receiptRef'
      | 'supplierId'
      | 'attachmentPath'
      | 'attachmentName'
      | 'attachmentMime'
      | 'attachmentSize'
    >
  >;

export interface ExpenseCorrectionInput {
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
}

export interface SupplierInput {
  id?: string | null;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string | null;
  address?: string;
  notes?: string;
  isActive?: boolean;
}

export interface RecordStockMovementInput {
  stockItemId: string;
  movementType: Exclude<StockMovementType, 'initial'>;
  quantityDelta: number;
  reason: string;
  branchId?: string | null;
  supplierId?: string | null;
  unitCost?: number | null;
  reference?: string | null;
  appointmentId?: string | null;
}

export interface RecordPaymentInput {
  appointmentId: string;
  amount: number;
  method: PaymentMethod;
  idempotencyKey: string;
  providerReference?: string | null;
  reason?: string;
}

export interface PaymentCorrectionInput {
  originalEntryId: string;
  kind: Exclude<PaymentEntryKind, 'payment'>;
  amount: number;
  reason: string;
  idempotencyKey: string;
  providerReference?: string | null;
  settlementNote?: string;
}

export interface PaymentListParams {
  from?: string;
  to?: string;
  appointmentId?: string;
  cashSessionId?: string;
  status?: 'pending' | 'confirmed' | 'failed';
  limit?: number;
}
type StockInput = Pick<StockItem, 'name' | 'category' | 'quantity' | 'minThreshold' | 'unitCost'> &
  Partial<Pick<StockItem, 'supplier' | 'supplierId' | 'sellingPrice' | 'isActive'>> & {
    reason?: string;
    branchId?: string | null;
  };
type RewardInput = Pick<LoyaltyReward, 'name' | 'pointsCost' | 'category'> &
  Partial<Pick<LoyaltyReward, 'description' | 'isActive' | 'discountPercentage' | 'freeServiceName'>>;

export interface AppointmentInput {
  serviceId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  staffId?: string | null;
  clientId?: string | null;
  branchId?: string | null;
  source?: 'direct' | 'whatsapp' | 'phone';
  notes?: string;
}

export interface RescheduleInput {
  staffId?: string | null;
  serviceId?: string | null;
  startsAt?: string | null;
  notes?: string | null;
}

export interface WalkInInput {
  serviceId: string;
  idempotencyKey: string;
  clientName?: string | null;
  clientPhone?: string | null;
  clientId?: string | null;
  staffId?: string | null;
  branchId?: string | null;
  startImmediately?: boolean;
  notes?: string;
}

export interface ReviewInput {
  author: string;
  rating: number;
  comment: string;
  appointmentId?: string | null;
}

interface StaffSchedule {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
}

interface StaffAbsence {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
}

type Availability = Record<string, { startsAt: string; available: boolean }[]>;

export function salonApi(salonId: string, initialTimeZone: string = DEFAULT_BUSINESS_TIMEZONE) {
  const supabase = getSupabaseClient();
  let activeTimeZone = normalizeTimeZone(initialTimeZone);
  const listClients = async () => {
    const result = await supabase.from('clients').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapClient(row as DbRow));
  };
  const listServices = async (all = false) => {
    let query = supabase.from('services').select('*').eq('salon_id', salonId);
    if (!all) query = query.eq('is_active', true);
    const result = await query.order('name');
    return (unwrap(result) ?? []).map((row) => mapService(row as DbRow));
  };
  const listStaff = async () => {
    const result = await supabase.from('staff').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapStaff(row as DbRow));
  };
  const listExpenses = async () => {
    const result = await supabase
      .from('expenses')
      .select('*')
      .eq('salon_id', salonId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false });
    return (unwrap(result) ?? []).map((row) => mapExpense(row as DbRow));
  };
  const listStock = async () => {
    const result = await supabase.from('stock_items').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapStock(row as DbRow));
  };
  const listSuppliers = async () => {
    const result = await supabase.from('suppliers').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapSupplier(row as DbRow));
  };
  const listRewards = async () => {
    const result = await supabase.from('rewards').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapReward(row as DbRow));
  };
  const listReviews = async () => {
    const result = await supabase
      .from('reviews')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });
    return (unwrap(result) ?? []).map((row) => mapReview(row as DbRow));
  };

  return {
    setTimeZone(timeZone?: string | null) {
      activeTimeZone = normalizeTimeZone(timeZone);
    },
    getTimeZone() {
      return activeTimeZone;
    },
    async workspace() {
      const [
        salonResult,
        branchesResult,
        clients,
        services,
        staff,
        expenses,
        stock,
        suppliers,
        rewards,
        reviews,
      ] = await Promise.all([
        supabase.from('salons').select('*').eq('id', salonId).single(),
        supabase.from('branches').select('id, name, timezone').eq('salon_id', salonId).order('created_at'),
        listClients(),
        listServices(true),
        listStaff(),
        listExpenses(),
        listStock(),
        listSuppliers(),
        listRewards(),
        listReviews(),
      ]);
      const salon = unwrap(salonResult);
      const branches = (unwrap(branchesResult) ?? []) as ErpBranch[];
      activeTimeZone = resolveSalonTimezone(salon as { timezone?: string | null }, branches);
      return { salon, branches, clients, services, staff, expenses, stock, suppliers, rewards, reviews };
    },
    clients: {
      list: listClients,
      async create(data: ClientInput) {
        const result = await supabase
          .from('clients')
          .insert({
            salon_id: salonId,
            name: data.name,
            phone: data.phone,
            email: data.email?.trim().toLowerCase() || null,
            segment: data.segment ?? 'new',
            favorite_service: data.favoriteService ?? '',
            notes: data.notes ?? '',
          })
          .select('*')
          .single();
        return mapClient(unwrap(result) as DbRow);
      },
      async update(id: string, data: ClientInput) {
        const result = await supabase
          .from('clients')
          .update({
            name: data.name,
            phone: data.phone,
            email: data.email?.trim().toLowerCase() || null,
            segment: data.segment ?? 'new',
            favorite_service: data.favoriteService ?? '',
            notes: data.notes ?? '',
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapClient(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('clients').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
    services: {
      list: () => listServices(),
      listAll: () => listServices(true),
      async create(data: ServiceInput) {
        const result = await supabase
          .from('services')
          .insert({
            salon_id: salonId,
            name: data.name,
            category: data.category,
            description: data.description ?? '',
            price: data.price,
            duration_minutes: data.durationMinutes,
            prep_minutes: data.prepMinutes ?? 0,
            popular: data.popular ?? false,
            is_active: data.isActive ?? true,
          })
          .select('*')
          .single();
        return mapService(unwrap(result) as DbRow);
      },
      async update(id: string, data: ServiceInput) {
        const result = await supabase
          .from('services')
          .update({
            name: data.name,
            category: data.category,
            description: data.description ?? '',
            price: data.price,
            duration_minutes: data.durationMinutes,
            prep_minutes: data.prepMinutes ?? 0,
            popular: data.popular ?? false,
            is_active: data.isActive ?? true,
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapService(unwrap(result) as DbRow);
      },
      async setActive(id: string, isActive: boolean) {
        const { error } = await supabase
          .from('services')
          .update({ is_active: isActive })
          .eq('salon_id', salonId)
          .eq('id', id);
        if (error) throwSupabaseError(error);
      },
      async remove(id: string) {
        return this.setActive(id, false);
      },
    },
    branches: {
      async list() {
        const result = await supabase
          .from('branches')
          .select('id, name, timezone')
          .eq('salon_id', salonId)
          .order('created_at');
        return (unwrap(result) ?? []) as ErpBranch[];
      },
    },
    staff: {
      list: listStaff,
      async create(data: StaffInput) {
        const result = await supabase
          .from('staff')
          .insert({
            salon_id: salonId,
            name: data.name,
            role: data.role,
            phone: data.phone ?? '',
            email: data.email?.trim().toLowerCase() || null,
            specialties: data.specialties ?? [],
            commission_rate: data.commissionRate,
            branch_id: data.branchId ?? null,
            is_available: data.isAvailable ?? true,
            is_active: data.isActive ?? true,
            service_ids: data.serviceIds ?? [],
          })
          .select('*')
          .single();
        return mapStaff(unwrap(result) as DbRow);
      },
      async update(id: string, data: StaffInput) {
        const result = await supabase
          .from('staff')
          .update({
            name: data.name,
            role: data.role,
            phone: data.phone ?? '',
            email: data.email?.trim().toLowerCase() || null,
            specialties: data.specialties ?? [],
            commission_rate: data.commissionRate,
            branch_id: data.branchId ?? null,
            is_available: data.isAvailable ?? true,
            is_active: data.isActive ?? true,
            service_ids: data.serviceIds ?? [],
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapStaff(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('staff').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
      async schedule(staffId: string): Promise<StaffSchedule[]> {
        const result = await supabase
          .from('staff_schedules')
          .select('*')
          .eq('salon_id', salonId)
          .eq('staff_id', staffId)
          .order('weekday')
          .order('starts_at');
        return (unwrap(result) ?? []).map((row) => mapStaffSchedule(row as DbRow));
      },
      async addSchedule(
        staffId: string,
        data: { weekday: number; startsAt: string; endsAt: string },
      ): Promise<StaffSchedule> {
        const result = await supabase
          .from('staff_schedules')
          .insert({
            salon_id: salonId,
            staff_id: staffId,
            weekday: data.weekday,
            starts_at: data.startsAt,
            ends_at: data.endsAt,
          })
          .select('*')
          .single();
        return mapStaffSchedule(unwrap(result) as DbRow);
      },
      async removeSchedule(id: string): Promise<void> {
        const { error } = await supabase
          .from('staff_schedules')
          .delete()
          .eq('salon_id', salonId)
          .eq('id', id);
        if (error) throwSupabaseError(error);
      },
      async absences(staffId: string): Promise<StaffAbsence[]> {
        const result = await supabase
          .from('staff_absences')
          .select('*')
          .eq('salon_id', salonId)
          .eq('staff_id', staffId)
          .order('starts_on');
        return (unwrap(result) ?? []).map((row) => mapStaffAbsence(row as DbRow));
      },
      async addAbsence(
        staffId: string,
        data: { startsOn: string; endsOn: string; reason?: string },
      ): Promise<StaffAbsence> {
        const result = await supabase
          .from('staff_absences')
          .insert({
            salon_id: salonId,
            staff_id: staffId,
            starts_on: data.startsOn,
            ends_on: data.endsOn,
            reason: data.reason ?? '',
          })
          .select('*')
          .single();
        return mapStaffAbsence(unwrap(result) as DbRow);
      },
      async removeAbsence(id: string): Promise<void> {
        const { error } = await supabase.from('staff_absences').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
    appointments: {
      async list(params: { from?: string; to?: string; staffId?: string; timeZone?: string } = {}) {
        const tz = normalizeTimeZone(params.timeZone ?? activeTimeZone);
        let query = supabase.from('appointments').select('*').eq('salon_id', salonId);
        if (params.from) query = query.gte('starts_at', zonedDateTimeToIso(params.from, '00:00', tz));
        if (params.to) {
          query = query.lt('starts_at', zonedDateTimeToIso(shiftCalendarDays(params.to, 1), '00:00', tz));
        }
        if (params.staffId) query = query.eq('staff_id', params.staffId);
        const result = await query.order('starts_at');
        return (unwrap(result) ?? []).map((row) => mapAppointment(row as DbRow, tz));
      },
      async create(data: AppointmentInput): Promise<Appointment> {
        const result = await supabase.rpc('create_appointment', {
          p_salon_id: salonId,
          p_service_id: data.serviceId,
          p_starts_at: data.startsAt,
          p_client_name: data.clientName,
          p_client_phone: data.clientPhone,
          p_staff_id: data.staffId ?? null,
          p_client_id: data.clientId ?? null,
          p_branch_id: data.branchId ?? null,
          p_source: data.source ?? 'direct',
          p_notes: data.notes ?? '',
        });
        return mapAppointment(unwrap(result) as DbRow, activeTimeZone);
      },
      async registerWalkIn(data: WalkInInput): Promise<Appointment> {
        const result = await supabase.rpc('register_walk_in', {
          p_salon_id: salonId,
          p_service_id: data.serviceId,
          p_idempotency_key: data.idempotencyKey,
          p_client_name: data.clientName ?? null,
          p_client_phone: data.clientPhone ?? null,
          p_client_id: data.clientId ?? null,
          p_staff_id: data.staffId ?? null,
          p_branch_id: data.branchId ?? null,
          p_start_immediately: data.startImmediately ?? false,
          p_notes: data.notes ?? '',
        });
        return mapAppointment(unwrap(result) as DbRow, activeTimeZone);
      },
      async startWalkIn(id: string, staffId?: string | null): Promise<Appointment> {
        const result = await supabase.rpc('start_walk_in', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_staff_id: staffId ?? null,
        });
        return mapAppointment(unwrap(result) as DbRow, activeTimeZone);
      },
      async completeWalkIn(id: string): Promise<Appointment> {
        const result = await supabase.rpc('complete_walk_in', {
          p_salon_id: salonId,
          p_appointment_id: id,
        });
        return mapAppointment(unwrap(result) as DbRow, activeTimeZone);
      },
      async reschedule(id: string, data: RescheduleInput): Promise<Appointment> {
        const result = await supabase.rpc('reschedule_appointment', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_staff_id: data.staffId ?? null,
          p_service_id: data.serviceId ?? null,
          p_starts_at: data.startsAt ?? null,
          p_notes: data.notes ?? null,
        });
        return mapAppointment(unwrap(result) as DbRow, activeTimeZone);
      },
      async transition(id: string, status: string, reason?: string): Promise<Appointment> {
        const result = await supabase.rpc('transition_appointment', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_status: status,
          p_reason: reason ?? null,
        });
        return mapAppointment(unwrap(result) as DbRow, activeTimeZone);
      },
      async cancel(id: string, reason: string): Promise<Appointment> {
        const result = await supabase.rpc('cancel_appointment', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_reason: reason,
        });
        return mapAppointment(unwrap(result) as DbRow, activeTimeZone);
      },
      async events(id: string): Promise<unknown[]> {
        const result = await supabase
          .from('appointment_events')
          .select('*')
          .eq('salon_id', salonId)
          .eq('appointment_id', id)
          .order('created_at');
        return unwrap(result) ?? [];
      },
      async availability(date: string, serviceId?: string): Promise<Availability> {
        const result = await supabase.rpc('day_availability', {
          p_salon_id: salonId,
          p_date: date,
          p_service_id: serviceId ?? null,
        });
        const byStaff: Availability = {};
        for (const row of (unwrap(result) ?? []) as DbRow[]) {
          const staffId = stringValue(row, 'staff_id');
          (byStaff[staffId] ??= []).push({
            startsAt: stringValue(row, 'starts_at'),
            available: booleanValue(row, 'available'),
          });
        }
        return byStaff;
      },
    },
    expenses: {
      list: listExpenses,
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
          p_supplier_id: data.supplierId ?? null,
          p_attachment_path: data.attachmentPath ?? null,
          p_attachment_name: data.attachmentName ?? null,
          p_attachment_mime: data.attachmentMime ?? null,
          p_attachment_size: data.attachmentSize ?? null,
        });
        return mapExpense(unwrap(result) as DbRow);
      },
      async attachReceipt(
        expenseId: string,
        attachment: { path: string; name: string; mime: string; size: number },
      ) {
        const result = await supabase.rpc('attach_expense_receipt', {
          p_salon_id: salonId,
          p_expense_id: expenseId,
          p_attachment_path: attachment.path,
          p_attachment_name: attachment.name,
          p_attachment_mime: attachment.mime,
          p_attachment_size: attachment.size,
        });
        return mapExpense(unwrap(result) as DbRow);
      },
      async reverse(expenseId: string, reason: string) {
        const result = await supabase.rpc('reverse_expense', {
          p_salon_id: salonId,
          p_expense_id: expenseId,
          p_reason: reason,
        });
        return mapExpense(unwrap(result) as DbRow);
      },
      async correct(data: ExpenseCorrectionInput) {
        const result = await supabase.rpc('correct_expense', {
          p_salon_id: salonId,
          p_original_expense_id: data.originalExpenseId,
          p_title: data.title,
          p_category: data.category,
          p_amount: data.amount,
          p_spent_on: data.date,
          p_reason: data.reason,
          p_branch_id: data.branchId ?? null,
          p_notes: data.notes ?? '',
          p_receipt_ref: data.receiptRef ?? null,
          p_supplier_id: data.supplierId ?? null,
        });
        return mapExpense(unwrap(result) as DbRow);
      },
      async events(expenseId?: string | null, limit = 200) {
        const result = await supabase.rpc('list_expense_events', {
          p_salon_id: salonId,
          p_expense_id: expenseId ?? null,
          p_limit: limit,
        });
        const data = unwrap(result);
        return (Array.isArray(data) ? data : []).map((row) => mapExpenseEvent(row as DbRow));
      },
    },
    payments: {
      async list(params: PaymentListParams = {}) {
        const result = await supabase.rpc('list_payments', {
          p_salon_id: salonId,
          p_from: params.from ?? null,
          p_to: params.to ?? null,
          p_appointment_id: params.appointmentId ?? null,
          p_cash_session_id: params.cashSessionId ?? null,
          p_status: params.status ?? null,
          p_limit: params.limit ?? 200,
        });
        const data = unwrap(result);
        return (Array.isArray(data) ? data : []).map((row) => mapPayment(row as DbRow, activeTimeZone));
      },
      async record(data: RecordPaymentInput) {
        const result = await supabase.rpc('record_payment', {
          p_salon_id: salonId,
          p_appointment_id: data.appointmentId,
          p_amount: data.amount,
          p_method: data.method,
          p_idempotency_key: data.idempotencyKey,
          p_provider_reference: data.providerReference ?? null,
          p_reason: data.reason ?? '',
        });
        return mapPayment(unwrap(result) as DbRow, activeTimeZone);
      },
      async correct(data: PaymentCorrectionInput) {
        const result = await supabase.rpc('record_payment_correction', {
          p_salon_id: salonId,
          p_original_entry_id: data.originalEntryId,
          p_kind: data.kind,
          p_amount: data.amount,
          p_reason: data.reason,
          p_idempotency_key: data.idempotencyKey,
          p_provider_reference: data.providerReference ?? null,
          p_settlement_note: data.settlementNote ?? '',
        });
        return mapPayment(unwrap(result) as DbRow, activeTimeZone);
      },
      async confirm(paymentId: string, providerReference: string, settlementNote: string) {
        const result = await supabase.rpc('confirm_pending_payment', {
          p_salon_id: salonId,
          p_payment_id: paymentId,
          p_provider_reference: providerReference,
          p_settlement_note: settlementNote,
        });
        return mapPayment(unwrap(result) as DbRow, activeTimeZone);
      },
      async reject(paymentId: string, reason: string) {
        const result = await supabase.rpc('reject_pending_payment', {
          p_salon_id: salonId,
          p_payment_id: paymentId,
          p_reason: reason,
        });
        return mapPayment(unwrap(result) as DbRow, activeTimeZone);
      },
      async balance(appointmentId: string) {
        const result = await supabase.rpc('get_appointment_balance', {
          p_salon_id: salonId,
          p_appointment_id: appointmentId,
        });
        return mapAppointmentBalance(unwrap(result) as DbRow);
      },
      async events(paymentId: string) {
        const result = await supabase
          .from('payment_events')
          .select('*')
          .eq('salon_id', salonId)
          .eq('payment_id', paymentId)
          .order('created_at');
        return (unwrap(result) ?? []) as DbRow[];
      },
    },
    cash: {
      async registers() {
        const result = await supabase
          .from('cash_registers')
          .select('*')
          .eq('salon_id', salonId)
          .order('created_at');
        return (unwrap(result) ?? []) as DbRow[];
      },
      async ensureRegister(branchId: string) {
        const result = await supabase.rpc('ensure_default_register', {
          p_salon_id: salonId,
          p_branch_id: branchId,
        });
        return unwrap(result) as string;
      },
      async sessions(limit = 20) {
        const result = await supabase.rpc('list_cash_sessions', {
          p_salon_id: salonId,
          p_limit: limit,
        });
        const data = unwrap(result);
        return (Array.isArray(data) ? data : []).map((row) => mapCashSession(row as DbRow));
      },
      async get(sessionId: string) {
        const result = await supabase.rpc('get_cash_session', {
          p_salon_id: salonId,
          p_session_id: sessionId,
        });
        return mapCashSession(unwrap(result) as DbRow);
      },
      async open(branchId: string, openingBalance: number, note = '', registerId?: string | null) {
        const result = await supabase.rpc('open_cash_session', {
          p_salon_id: salonId,
          p_branch_id: branchId,
          p_opening_balance: openingBalance,
          p_register_id: registerId ?? null,
          p_note: note,
        });
        const sessionId = unwrap(result) as string;
        return this.get(sessionId);
      },
      async close(sessionId: string, countedBalance: number, note = '') {
        const result = await supabase.rpc('close_cash_session', {
          p_salon_id: salonId,
          p_session_id: sessionId,
          p_counted_balance: countedBalance,
          p_note: note,
        });
        const id = unwrap(result) as string;
        return this.get(id);
      },
      async reconcile(sessionId: string, note: string) {
        const result = await supabase.rpc('reconcile_cash_session', {
          p_salon_id: salonId,
          p_session_id: sessionId,
          p_note: note,
        });
        const id = unwrap(result) as string;
        return this.get(id);
      },
    },
    reports: {
      async summary(from: string, to: string) {
        const result = await supabase.rpc('financial_summary', {
          p_salon_id: salonId,
          p_from: from,
          p_to: to,
        });
        const row = firstRow(unwrap(result) as DbRow | DbRow[]);
        if (!row) throw new ApiError('Supabase n’a retourné aucun rapport.');
        return mapFinancialSummary(row);
      },
      async dashboard(params: {
        from: string;
        to: string;
        dayFilter?: 'all' | 'saturday' | 'friday' | 'weekday';
      }): Promise<ErpDashboardMetrics> {
        const result = await supabase.rpc('erp_dashboard_metrics', {
          p_salon_id: salonId,
          p_from: params.from,
          p_to: params.to,
          p_day_filter: params.dayFilter ?? 'all',
        });
        const row = firstRow(unwrap(result) as DbRow | DbRow[]);
        if (!row) throw new ApiError('Supabase n’a retourné aucun indicateur.');
        return mapErpDashboardMetrics(row);
      },
    },
    suppliers: {
      async list(includeInactive = false) {
        const result = await supabase.rpc('list_suppliers', {
          p_salon_id: salonId,
          p_include_inactive: includeInactive,
        });
        const data = unwrap(result);
        return (Array.isArray(data) ? data : []).map((row) => mapSupplier(row as DbRow));
      },
      async upsert(data: SupplierInput) {
        const result = await supabase.rpc('upsert_supplier', {
          p_salon_id: salonId,
          p_name: data.name,
          p_contact_name: data.contactName ?? '',
          p_phone: data.phone ?? '',
          p_email: data.email ?? null,
          p_address: data.address ?? '',
          p_notes: data.notes ?? '',
          p_is_active: data.isActive ?? true,
          p_supplier_id: data.id ?? null,
        });
        return mapSupplier(unwrap(result) as DbRow);
      },
    },
    stock: {
      list: listStock,
      async movements(stockItemId?: string | null, limit = 200) {
        const result = await supabase.rpc('list_stock_movements', {
          p_salon_id: salonId,
          p_stock_item_id: stockItemId ?? null,
          p_limit: limit,
        });
        const data = unwrap(result);
        return (Array.isArray(data) ? data : []).map((row) => mapStockMovement(row as DbRow));
      },
      async create(data: StockInput) {
        const result = await supabase.rpc('create_stock_item', {
          p_salon_id: salonId,
          p_name: data.name,
          p_category: data.category,
          p_initial_quantity: data.quantity,
          p_min_threshold: data.minThreshold,
          p_unit_cost: data.unitCost,
          p_supplier_id: data.supplierId ?? null,
          p_supplier_name: data.supplier ?? '',
          p_reason: data.reason ?? 'Stock initial',
          p_branch_id: data.branchId ?? null,
          p_selling_price: data.sellingPrice ?? null,
        });
        return mapStock(unwrap(result) as DbRow);
      },
      async updateMetadata(id: string, data: Omit<StockInput, 'quantity' | 'reason' | 'branchId'>) {
        const result = await supabase.rpc('update_stock_item_metadata', {
          p_salon_id: salonId,
          p_stock_item_id: id,
          p_name: data.name,
          p_category: data.category,
          p_min_threshold: data.minThreshold,
          p_unit_cost: data.unitCost,
          p_supplier_id: data.supplierId ?? null,
          p_supplier_name: data.supplier ?? '',
          p_selling_price: data.sellingPrice ?? null,
          p_is_active: data.isActive ?? true,
        });
        return mapStock(unwrap(result) as DbRow);
      },
      async recordMovement(data: RecordStockMovementInput) {
        const result = await supabase.rpc('record_stock_movement', {
          p_salon_id: salonId,
          p_stock_item_id: data.stockItemId,
          p_movement_type: data.movementType,
          p_quantity_delta: data.quantityDelta,
          p_reason: data.reason,
          p_branch_id: data.branchId ?? null,
          p_supplier_id: data.supplierId ?? null,
          p_unit_cost: data.unitCost ?? null,
          p_reference: data.reference ?? null,
          p_appointment_id: data.appointmentId ?? null,
        });
        return mapStockMovement(unwrap(result) as DbRow);
      },
    },
    rewards: {
      list: listRewards,
      async create(data: RewardInput) {
        const result = await supabase
          .from('rewards')
          .insert({
            salon_id: salonId,
            name: data.name,
            description: data.description ?? '',
            points_cost: data.pointsCost,
            category: data.category,
            discount_percentage: data.discountPercentage ?? null,
            free_service_name: data.freeServiceName ?? null,
            is_active: data.isActive ?? true,
          })
          .select('*')
          .single();
        return mapReward(unwrap(result) as DbRow);
      },
      async update(id: string, data: RewardInput) {
        const result = await supabase
          .from('rewards')
          .update({
            name: data.name,
            description: data.description ?? '',
            points_cost: data.pointsCost,
            category: data.category,
            discount_percentage: data.discountPercentage ?? null,
            free_service_name: data.freeServiceName ?? null,
            is_active: data.isActive ?? true,
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapReward(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('rewards').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
    notifications: {
      async list(limit = 200): Promise<AppointmentNotification[]> {
        const result = await supabase
          .from('appointment_notifications')
          .select('*')
          .eq('salon_id', salonId)
          .order('created_at', { ascending: false })
          .limit(limit);
        return (unwrap(result) ?? []).map((row) => mapNotification(row as DbRow));
      },
      async health(): Promise<NotificationHealthSummary> {
        const result = await supabase.rpc('get_salon_notification_health', { p_salon_id: salonId });
        return mapSalonNotificationHealth(unwrap(result));
      },
      async probe(checkWhatsappApi = false): Promise<NotificationProbeResult> {
        const { data, error } = await supabase.functions.invoke('notifications-dispatcher', {
          body: { salon_id: salonId, mode: 'health', check_whatsapp_api: checkWhatsappApi },
        });
        if (error) {
          throw new ApiError(
            `Expéditeur injoignable : ${error.message}. Vérifiez que la fonction « notifications-dispatcher » est déployée.`,
            502,
          );
        }
        const payload = (data ?? {}) as { error?: string };
        if (payload.error) throw new ApiError(payload.error, 400);
        return mapNotificationProbe(data);
      },
      async retry(id: string): Promise<AppointmentNotification> {
        const result = await supabase.rpc('retry_notification', { p_salon_id: salonId, p_id: id });
        return mapNotification(unwrap(result) as DbRow);
      },
      // L'envoi réel est effectué par l'edge function (secrets fournisseur côté
      // serveur). Le navigateur ne fait que déclencher le traitement du salon.
      async dispatch(limit = 50): Promise<NotificationDispatchResult> {
        const { data, error } = await supabase.functions.invoke('notifications-dispatcher', {
          body: { salon_id: salonId, limit },
        });
        if (error) {
          throw new ApiError(
            `Expéditeur injoignable : ${error.message}. Vérifiez que la fonction « notifications-dispatcher » est déployée.`,
            502,
          );
        }
        const payload = (data ?? {}) as {
          processed?: number;
          sent?: number;
          failed?: number;
          skipped?: number;
          provider_configured?: boolean;
          capabilities?: unknown;
          error?: string;
        };
        if (payload.error) throw new ApiError(payload.error, 400);
        return {
          processed: Number(payload.processed ?? 0),
          sent: Number(payload.sent ?? 0),
          failed: Number(payload.failed ?? 0),
          skipped: Number(payload.skipped ?? 0),
          providerConfigured: payload.provider_configured !== false,
          capabilities: mapCapabilities(payload.capabilities),
        };
      },
    },
    loyalty: {
      async program(): Promise<LoyaltySettings> {
        const result = await supabase
          .from('loyalty_programs')
          .select('*')
          .eq('salon_id', salonId)
          .maybeSingle();
        if (result.error) throwSupabaseError(result.error);
        return mapLoyaltyProgram(salonId, (result.data as DbRow | null) ?? null);
      },
      async setProgram(settings: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
        const payload: Record<string, unknown> = {};
        if (settings.programEnabled !== undefined) payload.is_enabled = settings.programEnabled;
        if (settings.pointsPer100Fcfa !== undefined) payload.points_per_100_xof = settings.pointsPer100Fcfa;
        if (settings.welcomeBonus !== undefined) payload.welcome_bonus = settings.welcomeBonus;
        if (settings.silverThreshold !== undefined) payload.silver_threshold = settings.silverThreshold;
        if (settings.goldThreshold !== undefined) payload.gold_threshold = settings.goldThreshold;
        if (settings.vipThreshold !== undefined) payload.vip_threshold = settings.vipThreshold;
        const result = await supabase.rpc('set_loyalty_program', {
          p_salon_id: salonId,
          p_settings: payload,
        });
        return mapLoyaltyProgram(salonId, unwrap(result) as DbRow);
      },
      async accounts(): Promise<LoyaltyAccount[]> {
        const result = await supabase
          .from('loyalty_accounts')
          .select('*')
          .eq('salon_id', salonId)
          .order('points_balance', { ascending: false });
        return (unwrap(result) ?? []).map((row) => mapLoyaltyAccount(row as DbRow));
      },
      async ledger(limit = 100): Promise<LoyaltyLedgerEntry[]> {
        const result = await supabase
          .from('loyalty_transactions')
          .select('*')
          .eq('salon_id', salonId)
          .order('created_at', { ascending: false })
          .limit(limit);
        return (unwrap(result) ?? []).map((row) => mapLoyaltyLedgerEntry(row as DbRow));
      },
      async redeem(clientId: string, rewardId: string) {
        const result = await supabase.rpc('redeem_loyalty_reward', {
          p_salon_id: salonId,
          p_client_id: clientId,
          p_reward_id: rewardId,
        });
        return unwrap(result) as {
          transaction_id: string;
          points_balance: number;
          tier: string;
          reward_name: string;
        };
      },
      async adjust(clientId: string, points: number, reason: string) {
        const result = await supabase.rpc('adjust_loyalty_points', {
          p_salon_id: salonId,
          p_client_id: clientId,
          p_points: points,
          p_reason: reason,
        });
        return unwrap(result) as { transaction_id: string; points_balance: number; tier: string };
      },
    },
    reviews: {
      list: listReviews,
      async create(data: ReviewInput): Promise<Review> {
        const result = await supabase.rpc('create_review', {
          p_salon_id: salonId,
          p_author: data.author,
          p_rating: data.rating,
          p_comment: data.comment,
          p_appointment_id: data.appointmentId ?? null,
        });
        return mapReview(unwrap(result) as DbRow);
      },
      async remove(id: string): Promise<void> {
        const { error } = await supabase.rpc('delete_review', {
          p_salon_id: salonId,
          p_review_id: id,
        });
        if (error) throwSupabaseError(error);
      },
    },
  };
}
