// Mapping des lignes Supabase vers les types métier
// (extrait de l'ancien src/lib/api.ts monolithique).
import type {
  Appointment,
  AppointmentBalance,
  AppointmentNotification,
  CashSession,
  Client,
  ErpDashboardMetrics,
  Expense,
  ExpenseEvent,
  FinancialSummary,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltyReward,
  LoyaltySettings,
  PaymentEntryKind,
  PaymentMethod,
  PaymentSettlementMode,
  PaymentTransaction,
  Review,
  Service,
  StaffMember,
  StockItem,
  StockMovementType,
  StockMovement,
  Supplier,
} from '../../types';
import { DEFAULT_BUSINESS_TIMEZONE } from '../businessTime';
import type { StaffAbsence, StaffSchedule } from './inputs';
import type { DbRow } from './internal';
import {
  booleanValue,
  mapDateTimeInZone,
  numberValue,
  optionalNumber,
  optionalString,
  stringValue,
} from './internal';

export function mapClient(row: DbRow): Client {
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

export function mapService(row: DbRow): Service {
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

export function mapStaff(row: DbRow): StaffMember {
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

export function mapAppointment(row: DbRow, timeZone: string = DEFAULT_BUSINESS_TIMEZONE): Appointment {
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

export function mapPayment(row: DbRow, timeZone: string = DEFAULT_BUSINESS_TIMEZONE): PaymentTransaction {
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

export function mapCashSession(row: DbRow): CashSession {
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

export function mapFinancialSummary(row: DbRow): FinancialSummary {
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

export function nullableNumber(row: DbRow, key: string): number | null {
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

export function mapAppointmentBalance(row: DbRow): AppointmentBalance {
  return {
    appointmentId: stringValue(row, 'appointment_id'),
    billed: numberValue(row, 'billed'),
    collected: numberValue(row, 'collected'),
    outstanding: numberValue(row, 'outstanding'),
    pending: numberValue(row, 'pending'),
    refunded: numberValue(row, 'refunded'),
  };
}

export function mapExpense(row: DbRow): Expense {
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

export function mapExpenseEvent(row: DbRow): ExpenseEvent {
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

export function mapSupplier(row: DbRow): Supplier {
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

export function mapStock(row: DbRow): StockItem {
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

export function mapStockMovement(row: DbRow): StockMovement {
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

export function mapReward(row: DbRow): LoyaltyReward {
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

export function mapLoyaltyProgram(salonId: string, row: DbRow | null): LoyaltySettings {
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

export function mapLoyaltyAccount(row: DbRow): LoyaltyAccount {
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

export function mapLoyaltyLedgerEntry(row: DbRow): LoyaltyLedgerEntry {
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

export function mapNotification(row: DbRow): AppointmentNotification {
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

export function mapReview(row: DbRow): Review {
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

export function mapStaffSchedule(row: DbRow): StaffSchedule {
  return {
    id: stringValue(row, 'id'),
    weekday: numberValue(row, 'weekday'),
    startsAt: stringValue(row, 'starts_at').slice(0, 5),
    endsAt: stringValue(row, 'ends_at').slice(0, 5),
  };
}

export function mapStaffAbsence(row: DbRow): StaffAbsence {
  return {
    id: stringValue(row, 'id'),
    startsOn: stringValue(row, 'starts_on'),
    endsOn: stringValue(row, 'ends_on'),
    reason: stringValue(row, 'reason'),
  };
}
