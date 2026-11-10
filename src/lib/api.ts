import type {
  Appointment,
  AppointmentNotification,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltySettings,
  NotificationDispatchResult,
  Review,
} from '../types';
import { getSupabaseClient } from './supabase';
import {
  ApiError,
  booleanValue,
  firstRow,
  mapAppointment,
  mapAppointmentBalance,
  mapCashSession,
  mapClient,
  mapExpense,
  mapFinancialSummary,
  mapLoyaltyAccount,
  mapLoyaltyLedgerEntry,
  mapLoyaltyProgram,
  mapNotification,
  mapPayment,
  mapReview,
  mapReward,
  mapService,
  mapStaff,
  mapStaffAbsence,
  mapStaffSchedule,
  mapStock,
  stringValue,
  throwSupabaseError,
  unwrap,
} from '../services/api/shared';
import type {
  AppointmentInput,
  Availability,
  ClientInput,
  DbRow,
  ExpenseInput,
  PaymentCorrectionInput,
  PaymentListParams,
  RecordPaymentInput,
  RescheduleInput,
  ReviewInput,
  RewardInput,
  ServiceInput,
  StaffAbsence,
  StaffInput,
  StaffSchedule,
  StockInput,
  WalkInInput,
} from '../services/api/shared';

export { ApiError };
export type {
  AppointmentInput,
  WalkInInput,
  RescheduleInput,
  PaymentListParams,
  RecordPaymentInput,
  PaymentCorrectionInput,
  ReviewInput,
} from '../services/api/shared';

export function salonApi(salonId: string) {
  const supabase = getSupabaseClient();
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
      .order('spent_on', { ascending: false });
    return (unwrap(result) ?? []).map((row) => mapExpense(row as DbRow));
  };
  const listStock = async () => {
    const result = await supabase.from('stock_items').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapStock(row as DbRow));
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
    async workspace() {
      const [salonResult, branchesResult, clients, services, staff, expenses, stock, rewards, reviews] =
        await Promise.all([
          supabase.from('salons').select('*').eq('id', salonId).single(),
          supabase.from('branches').select('id, name').eq('salon_id', salonId).order('created_at'),
          listClients(),
          listServices(true),
          listStaff(),
          listExpenses(),
          listStock(),
          listRewards(),
          listReviews(),
        ]);
      const salon = unwrap(salonResult);
      const branches = (unwrap(branchesResult) ?? []) as { id: string; name: string }[];
      return { salon, branches, clients, services, staff, expenses, stock, rewards, reviews };
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
          .select('id, name')
          .eq('salon_id', salonId)
          .order('created_at');
        return unwrap(result) ?? [];
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
      async list(params: { from?: string; to?: string; staffId?: string } = {}) {
        let query = supabase.from('appointments').select('*').eq('salon_id', salonId);
        if (params.from) query = query.gte('starts_at', `${params.from}T00:00:00.000Z`);
        if (params.to) query = query.lte('starts_at', `${params.to}T23:59:59.999Z`);
        if (params.staffId) query = query.eq('staff_id', params.staffId);
        const result = await query.order('starts_at');
        return (unwrap(result) ?? []).map((row) => mapAppointment(row as DbRow));
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
        return mapAppointment(unwrap(result) as DbRow);
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
        return mapAppointment(unwrap(result) as DbRow);
      },
      async startWalkIn(id: string, staffId?: string | null): Promise<Appointment> {
        const result = await supabase.rpc('start_walk_in', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_staff_id: staffId ?? null,
        });
        return mapAppointment(unwrap(result) as DbRow);
      },
      async completeWalkIn(id: string): Promise<Appointment> {
        const result = await supabase.rpc('complete_walk_in', {
          p_salon_id: salonId,
          p_appointment_id: id,
        });
        return mapAppointment(unwrap(result) as DbRow);
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
        return mapAppointment(unwrap(result) as DbRow);
      },
      async transition(id: string, status: string, reason?: string): Promise<Appointment> {
        const result = await supabase.rpc('transition_appointment', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_status: status,
          p_reason: reason ?? null,
        });
        return mapAppointment(unwrap(result) as DbRow);
      },
      async cancel(id: string, reason: string): Promise<Appointment> {
        const result = await supabase.rpc('cancel_appointment', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_reason: reason,
        });
        return mapAppointment(unwrap(result) as DbRow);
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
        });
        return mapExpense(unwrap(result) as DbRow);
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
        return (Array.isArray(data) ? data : []).map((row) => mapPayment(row as DbRow));
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
        return mapPayment(unwrap(result) as DbRow);
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
        return mapPayment(unwrap(result) as DbRow);
      },
      async confirm(paymentId: string, providerReference: string, settlementNote: string) {
        const result = await supabase.rpc('confirm_pending_payment', {
          p_salon_id: salonId,
          p_payment_id: paymentId,
          p_provider_reference: providerReference,
          p_settlement_note: settlementNote,
        });
        return mapPayment(unwrap(result) as DbRow);
      },
      async reject(paymentId: string, reason: string) {
        const result = await supabase.rpc('reject_pending_payment', {
          p_salon_id: salonId,
          p_payment_id: paymentId,
          p_reason: reason,
        });
        return mapPayment(unwrap(result) as DbRow);
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
    },
    stock: {
      list: listStock,
      async create(data: StockInput) {
        const result = await supabase
          .from('stock_items')
          .insert({
            salon_id: salonId,
            name: data.name,
            category: data.category,
            quantity: data.quantity,
            min_threshold: data.minThreshold,
            unit_cost: data.unitCost,
            supplier: data.supplier ?? '',
          })
          .select('*')
          .single();
        return mapStock(unwrap(result) as DbRow);
      },
      async update(id: string, data: StockInput) {
        const result = await supabase
          .from('stock_items')
          .update({
            name: data.name,
            category: data.category,
            quantity: data.quantity,
            min_threshold: data.minThreshold,
            unit_cost: data.unitCost,
            supplier: data.supplier ?? '',
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapStock(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('stock_items').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
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
          error?: string;
        };
        if (payload.error) throw new ApiError(payload.error, 400);
        return {
          processed: Number(payload.processed ?? 0),
          sent: Number(payload.sent ?? 0),
          failed: Number(payload.failed ?? 0),
          skipped: Number(payload.skipped ?? 0),
          providerConfigured: payload.provider_configured !== false,
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
