import type {
  Appointment,
  AppointmentBalance,
  AppointmentNotification,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltySettings,
  CashSession,
  Client,
  Expense,
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
} from '../../types';

export type DbRow = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function throwSupabaseError(error: { message: string; code?: string }): never {
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

export function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throwSupabaseError(result.error);
  if (result.data === null) throw new ApiError('Supabase n’a retourné aucune donnée.');
  return result.data;
}

export function stringValue(row: DbRow, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

export function optionalString(row: DbRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.length ? value : undefined;
}

export function numberValue(row: DbRow, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export function optionalNumber(row: DbRow, key: string): number | undefined {
  const value = row[key];
  return value === null || value === undefined ? undefined : Number(value);
}

export function booleanValue(row: DbRow, key: string): boolean {
  return row[key] === true;
}

export const ABIDJAN_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Abidjan',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const ABIDJAN_TIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Abidjan',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function abidjanDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  return { date: ABIDJAN_DATE.format(d), time: ABIDJAN_TIME.format(d) };
}

export function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

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

export function mapAppointment(row: DbRow): Appointment {
  const startsAt = stringValue(row, 'starts_at');
  const { date, time } = abidjanDateTime(startsAt);
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
    startsAt,
    endsAt: stringValue(row, 'ends_at'),
    arrivalAt: optionalString(row, 'arrival_at'),
    serviceStartedAt: optionalString(row, 'service_started_at'),
    serviceCompletedAt: optionalString(row, 'service_completed_at'),
  };
}

export function mapPayment(row: DbRow): PaymentTransaction {
  const createdAt = stringValue(row, 'created_at');
  const { date, time } = abidjanDateTime(createdAt);
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
    createdBy: optionalString(row, 'created_by'),
    createdAt: optionalString(row, 'created_at'),
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
    supplier: stringValue(row, 'supplier'),
    lastRestock: optionalString(row, 'last_restock'),
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

export type ClientInput = Pick<Client, 'name' | 'phone'> &
  Partial<Pick<Client, 'email' | 'segment' | 'favoriteService' | 'notes'>>;
export type ServiceInput = Pick<Service, 'name' | 'category' | 'price' | 'durationMinutes'> &
  Partial<Pick<Service, 'description' | 'prepMinutes' | 'popular' | 'isActive'>>;
export type StaffInput = Pick<StaffMember, 'name' | 'role' | 'commissionRate'> &
  Partial<
    Pick<
      StaffMember,
      'phone' | 'email' | 'specialties' | 'branchId' | 'isAvailable' | 'isActive' | 'serviceIds'
    >
  >;
export type ExpenseInput = Pick<Expense, 'title' | 'category' | 'amount' | 'date'> &
  Partial<Pick<Expense, 'notes' | 'branchId' | 'receiptRef'>>;

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
export type StockInput = Pick<StockItem, 'name' | 'category' | 'quantity' | 'minThreshold' | 'unitCost'> &
  Partial<Pick<StockItem, 'supplier'>>;
export type RewardInput = Pick<LoyaltyReward, 'name' | 'pointsCost' | 'category'> &
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

export interface StaffSchedule {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
}

export interface StaffAbsence {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
}

export type Availability = Record<string, { startsAt: string; available: boolean }[]>;
