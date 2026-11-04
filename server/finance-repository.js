// LOT 4 — Accès aux données financières (caisse, encaissements, dépenses, rapports).
//
// Le journal `bc_payment_entries` est immuable : aucune fonction ici ne modifie
// ou supprime une écriture. Les corrections passent par des opérations
// compensatoires (remboursement, annulation de paiement).
//
// Accepte un pg.Pool ou PGlite ; `withRunner(tx)` exécute les lectures dans la
// transaction RLS de la requête HTTP.

import { PermissionError, ValidationError } from './salon-repository.js';

/** Conflit d'idempotence : la clé a déjà été utilisée (rejeu de requête). */
export class DuplicateEntryError extends Error {
  constructor(message = 'Cette opération a déjà été enregistrée.') {
    super(message);
    this.code = '23505';
    this.status = 409;
  }
}

const num = (value) => (value === null || value === undefined ? 0 : Number(value));
const isoDate = (value) =>
  !value ? '' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const isoDateTime = (value) => (value instanceof Date ? value.toISOString() : value ? String(value) : '');

const mapRegister = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  branchId: r.branch_id,
  name: r.name,
  isActive: r.is_active === undefined ? true : Boolean(r.is_active),
});

const mapSession = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  branchId: r.branch_id,
  cashRegisterId: r.cash_register_id,
  registerName: r.register_name || '',
  openedBy: r.opened_by,
  openedAt: isoDateTime(r.opened_at),
  openingBalance: num(r.opening_balance),
  closedBy: r.closed_by || null,
  closedAt: isoDateTime(r.closed_at),
  closingBalance: r.closing_balance === null ? null : num(r.closing_balance),
  expectedBalance: r.expected_balance === null ? null : num(r.expected_balance),
  difference: r.difference === null ? null : num(r.difference),
  status: r.status,
  notes: r.notes || '',
});

const mapEntry = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  branchId: r.branch_id,
  appointmentId: r.appointment_id,
  kind: r.kind,
  amount: num(r.amount),
  currency: r.currency,
  method: r.method,
  paymentStatus: r.payment_status,
  providerReference: r.provider_reference || '',
  originalEntryId: r.original_entry_id || null,
  reason: r.reason || '',
  actorId: r.actor_id,
  cashSessionId: r.cash_session_id || null,
  createdAt: isoDateTime(r.created_at),
  clientName: r.client_name || '',
  serviceName: r.service_name || '',
});

/** Traduit les erreurs PostgreSQL du lot 4 en erreurs HTTP explicites. */
export function toFinanceError(error) {
  if (!error) return error;
  if (error.code === '23505') return new DuplicateEntryError();
  if (error.code === '42501' && /immutable/i.test(error.message || '')) {
    return new PermissionError('Une écriture financière ne peut pas être modifiée.');
  }
  if (error.code === '22023') return new ValidationError();
  return error;
}

export function createFinanceRepository(db) {
  const queries = (runner) => {
    const q = runner
      ? (text, params) => runner.query(text, params)
      : (text, params) => db.query(text, params);

    // ===================== Caisses =====================
    const listRegisters = async (salonId) => {
      const r = await q('select * from public.bc_cash_registers where salon_id = $1 order by created_at', [
        salonId,
      ]);
      return r.rows.map(mapRegister);
    };

    const ensureDefaultRegister = async (salonId, branchId) => {
      const r = await q('select public.bc_ensure_default_register($1,$2) as id', [salonId, branchId]);
      const rows = await listRegisters(salonId);
      return rows.find((x) => x.id === r.rows[0].id);
    };

    const sessionSelect = `
      select s.*, r.name as register_name
        from public.bc_cash_sessions s
        join public.bc_cash_registers r on r.id = s.cash_register_id
       where s.salon_id = $1`;

    const listSessions = async (salonId, { limit = 20 } = {}) => {
      const r = await q(`${sessionSelect} order by s.opened_at desc limit $2`, [salonId, limit]);
      return r.rows.map(mapSession);
    };

    const currentSession = async (salonId, branchId = null) => {
      const params = [salonId];
      let sql = `${sessionSelect} and s.status = 'open'`;
      if (branchId) {
        params.push(branchId);
        sql += ` and s.branch_id = $${params.length}`;
      }
      const r = await q(sql, params);
      return r.rows[0] ? mapSession(r.rows[0]) : null;
    };

    const getSession = async (salonId, id) => {
      const r = await q(`${sessionSelect} and s.id = $2`, [salonId, id]);
      return r.rows[0] ? mapSession(r.rows[0]) : null;
    };

    const openSession = async (salonId, { branchId, registerId, openingBalance }) => {
      let register = registerId;
      if (!register) {
        const created = await ensureDefaultRegister(salonId, branchId);
        register = created.id;
      }
      const r = await q('select public.bc_open_cash_session($1,$2,$3,$4) as id', [
        salonId,
        branchId,
        register,
        openingBalance,
      ]);
      return getSession(salonId, r.rows[0].id);
    };

    const closeSession = async (salonId, id, { countedCash, notes }) => {
      await q('select public.bc_close_cash_session($1,$2,$3)', [id, countedCash, notes ?? '']);
      return getSession(salonId, id);
    };

    const reconcileSession = async (salonId, id, notes) => {
      await q('select public.bc_reconcile_cash_session($1,$2)', [id, notes ?? '']);
      return getSession(salonId, id);
    };

    // ===================== Encaissements =====================
    const listEntries = async (
      salonId,
      { from = null, to = null, appointmentId = null, sessionId = null } = {},
    ) => {
      const params = [salonId];
      let sql = `
        select e.*, a.client_name, a.service_name
          from public.bc_payment_entries e
          left join public.bc_appointments a on a.id = e.appointment_id
         where e.salon_id = $1`;
      if (from) {
        params.push(from);
        sql += ` and (e.created_at at time zone 'Africa/Abidjan')::date >= $${params.length}::date`;
      }
      if (to) {
        params.push(to);
        sql += ` and (e.created_at at time zone 'Africa/Abidjan')::date <= $${params.length}::date`;
      }
      if (appointmentId) {
        params.push(appointmentId);
        sql += ` and e.appointment_id = $${params.length}`;
      }
      if (sessionId) {
        params.push(sessionId);
        sql += ` and e.cash_session_id = $${params.length}`;
      }
      sql += ' order by e.created_at desc';
      const r = await q(sql, params);
      return r.rows.map(mapEntry);
    };

    const createEntry = async (salonId, data) => {
      const r = await q('select public.bc_record_manual_entry($1,$2,$3,$4,$5,$6,$7,$8,$9) as id', [
        data.appointmentId,
        data.kind ?? 'payment',
        data.amount,
        data.method,
        data.reason ?? '',
        data.idempotencyKey,
        data.originalEntryId ?? null,
        data.paymentStatus ?? 'confirmed',
        data.providerReference ?? '',
      ]);
      const rows = await listEntries(salonId, { appointmentId: data.appointmentId });
      return rows.find((e) => e.id === r.rows[0].id);
    };

    const confirmEntry = async (salonId, id, providerReference) => {
      await q('select public.bc_confirm_provider_payment($1,$2)', [id, providerReference]);
      const rows = await listEntries(salonId);
      return rows.find((e) => e.id === id) || null;
    };

    /** Solde d'un rendez-vous : facturé, encaissé, restant (opérations réelles). */
    const appointmentBalance = async (salonId, appointmentId) => {
      const r = await q(
        `select a.amount as billed,
                coalesce(sum(case when e.kind in ('payment','refund_reversal') and e.payment_status='confirmed'
                                  then e.amount
                                  when e.kind in ('refund','payment_reversal') and e.payment_status='confirmed'
                                  then -e.amount else 0 end), 0) as collected
           from public.bc_appointments a
           left join public.bc_payment_entries e on e.appointment_id = a.id
          where a.salon_id = $1 and a.id = $2
          group by a.amount`,
        [salonId, appointmentId],
      );
      const row = r.rows[0];
      if (!row) return null;
      const billed = num(row.billed);
      const collected = num(row.collected);
      return { billed, collected, outstanding: Math.max(0, billed - collected) };
    };

    // ===================== Dépenses =====================
    const listExpenses = async (salonId, { from = null, to = null } = {}) => {
      const params = [salonId];
      let sql = 'select * from public.bc_expenses where salon_id = $1';
      if (from) {
        params.push(from);
        sql += ` and spent_on >= $${params.length}::date`;
      }
      if (to) {
        params.push(to);
        sql += ` and spent_on <= $${params.length}::date`;
      }
      sql += ' order by spent_on desc, created_at desc';
      const r = await q(sql, params);
      return r.rows.map((x) => ({
        id: x.id,
        salonId: x.salon_id,
        branchId: x.branch_id || null,
        title: x.title,
        category: x.category,
        amount: num(x.amount),
        date: isoDate(x.spent_on),
        notes: x.notes || '',
        receiptRef: x.receipt_ref || '',
        createdBy: x.created_by || null,
        createdAt: isoDateTime(x.created_at),
      }));
    };

    const addExpense = async (salonId, data) => {
      const r = await q('select public.bc_add_expense_v2($1,$2,$3,$4,$5,$6,$7,$8) as id', [
        salonId,
        data.branchId ?? null,
        data.title,
        data.category,
        data.amount,
        data.date,
        data.notes ?? '',
        data.receiptRef ?? '',
      ]);
      const rows = await listExpenses(salonId);
      return rows.find((x) => x.id === r.rows[0].id);
    };

    // ===================== Rapports =====================
    const summary = async (salonId, from, to) => {
      const r = await q('select * from public.bc_financial_summary($1,$2::date,$3::date)', [
        salonId,
        from,
        to,
      ]);
      const row = r.rows[0] || {};
      return {
        revenueBilled: num(row.revenue_billed),
        revenueCollected: num(row.revenue_collected),
        outstanding: num(row.outstanding),
        refunds: num(row.refunds),
        expenses: num(row.expenses),
        netBalance: num(row.net_balance),
      };
    };

    const byPaymentMethod = async (salonId, from, to) => {
      const r = await q(
        `select e.method, sum(e.amount)::bigint as total, count(*)::int as count
           from public.bc_payment_entries e
           left join public.bc_appointments a on a.id = e.appointment_id
          where e.salon_id = $1 and e.payment_status = 'confirmed' and e.kind = 'payment'
            and coalesce((a.starts_at at time zone 'Africa/Abidjan')::date, (e.created_at at time zone 'Africa/Abidjan')::date) between $2::date and $3::date
          group by e.method order by total desc`,
        [salonId, from, to],
      );
      return r.rows.map((x) => ({ method: x.method, total: num(x.total), count: num(x.count) }));
    };

    const topServices = async (salonId, from, to) => {
      const r = await q(
        `select a.service_name as name, count(*)::int as count, sum(a.amount)::bigint as total
           from public.bc_appointments a
          where a.salon_id = $1 and a.status not in ('cancelled', 'no_show')
            and (a.starts_at at time zone 'Africa/Abidjan')::date between $2::date and $3::date
          group by a.service_name order by count desc limit 10`,
        [salonId, from, to],
      );
      return r.rows.map((x) => ({ name: x.name, count: num(x.count), total: num(x.total) }));
    };

    const staffPerformance = async (salonId, from, to) => {
      const r = await q(
        `select st.id as staff_id, st.name,
                count(a.id)::int as appointments,
                coalesce(sum(a.amount) filter (where a.status = 'completed'), 0)::bigint as completed_revenue
           from public.bc_staff st
           left join public.bc_appointments a
             on a.staff_id = st.id
            and a.status not in ('cancelled', 'no_show')
            and (a.starts_at at time zone 'Africa/Abidjan')::date between $2::date and $3::date
          where st.salon_id = $1
          group by st.id, st.name
          order by completed_revenue desc`,
        [salonId, from, to],
      );
      return r.rows.map((x) => ({
        staffId: x.staff_id,
        name: x.name,
        appointments: num(x.appointments),
        revenue: num(x.completed_revenue),
      }));
    };

    const dailySeries = async (salonId, from, to) => {
      const r = await q(
        `select d::date as day,
                coalesce((select sum(e.amount) from public.bc_payment_entries e
                           left join public.bc_appointments a on a.id = e.appointment_id
                          where e.salon_id = $1 and e.payment_status = 'confirmed' and e.kind = 'payment'
                            and coalesce((a.starts_at at time zone 'Africa/Abidjan')::date, (e.created_at at time zone 'Africa/Abidjan')::date) = d::date), 0)::bigint as collected,
                coalesce((select sum(x.amount) from public.bc_expenses x
                           where x.salon_id = $1 and x.spent_on = d::date), 0)::bigint as expenses
           from generate_series($2::date, $3::date, interval '1 day') as d
          order by d`,
        [salonId, from, to],
      );
      return r.rows.map((x) => ({
        date: isoDate(x.day),
        collected: num(x.collected),
        expenses: num(x.expenses),
      }));
    };

    return {
      listRegisters,
      ensureDefaultRegister,
      listSessions,
      currentSession,
      getSession,
      openSession,
      closeSession,
      reconcileSession,
      listEntries,
      createEntry,
      confirmEntry,
      appointmentBalance,
      listExpenses,
      addExpense,
      summary,
      byPaymentMethod,
      topServices,
      staffPerformance,
      dailySeries,
    };
  };

  const repo = queries(null);
  repo.withRunner = queries;
  return repo;
}
