import {
  ApiError,
  firstRow,
  mapAppointmentBalance,
  mapCashSession,
  mapFinancialSummary,
  mapPayment,
  unwrap,
} from './shared';
import type {
  DbRow,
  PaymentCorrectionInput,
  PaymentListParams,
  RecordPaymentInput,
  SalonApiClient,
} from './shared';

export function createFinanceApi(supabase: SalonApiClient, salonId: string) {
  return {
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
  };
}
