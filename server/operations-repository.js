// LOT 3 — Accès aux données opérationnelles (prestations, personnel, rendez-vous).
//
// Toutes les écritures passent par les fonctions SECURITY DEFINER de la migration
// 20261103040000_lot3_operations.sql : aucune requête SQL n'est construite à
// partir de données utilisateur, et les contrôles de permission ainsi que les
// vérifications de disponibilité sont faits côté base, dans la transaction.
//
// Comme `salon-repository.js`, `queryable` accepte un pg.Pool ou PGlite.
// `withRunner(tx)` permet d'exécuter les lectures dans la transaction RLS ouverte
// pour la requête HTTP.

/** Signale un créneau déjà réservé (erreur 23P01 ou message explicite). */
export class SlotConflictError extends Error {
  constructor(message = 'Ce créneau est déjà réservé pour cet employé.') {
    super(message);
    this.code = '23P01';
    this.status = 409;
  }
}

const num = (value) => (value === null || value === undefined ? 0 : Number(value));
const isoDate = (value) =>
  !value ? '' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const isoDateTime = (value) =>
  value instanceof Date ? value.toISOString() : value ? String(value) : '';
const hhmm = (value) => (value ? String(value).slice(0, 5) : '');

// ----- Mappers -----
const mapService = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  name: r.name,
  category: r.category,
  description: r.description || '',
  price: num(r.price),
  durationMinutes: num(r.duration_minutes),
  prepMinutes: num(r.prep_minutes),
  popular: Boolean(r.popular),
  isActive: r.is_active === undefined ? true : Boolean(r.is_active)
});

const mapStaff = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  name: r.name,
  role: r.role,
  avatar: '',
  specialties: r.specialties || [],
  rating: 0,
  commissionRate: num(r.commission_rate),
  phone: r.phone || '',
  email: r.email || '',
  branchId: r.branch_id || null,
  isAvailable: Boolean(r.is_available),
  isActive: r.is_active === undefined ? true : Boolean(r.is_active),
  serviceIds: r.service_ids || [],
  userId: r.user_id || null
});

const mapAppointment = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  branchId: r.branch_id,
  clientId: r.client_id || null,
  clientName: r.client_name,
  clientPhone: r.client_phone || '',
  staffId: r.staff_id || '',
  staffName: r.staff_name || 'Sans préférence',
  serviceId: r.service_id || '',
  serviceName: r.service_name,
  price: num(r.amount),
  date: isoDate(r.starts_at),
  time: hhmm(r.starts_at_time ?? r.starts_local),
  startsAt: isoDateTime(r.starts_at),
  endsAt: isoDateTime(r.ends_at),
  durationMinutes: r.duration_minutes === undefined ? 0 : num(r.duration_minutes),
  status: r.status,
  notes: r.notes || '',
  source: r.source,
  paymentStatus: r.payment_status || 'unpaid',
  createdAt: isoDateTime(r.created_at)
});

const mapSchedule = (r) => ({
  id: r.id,
  staffId: r.staff_id,
  weekday: num(r.weekday),
  startsAt: hhmm(r.starts_at),
  endsAt: hhmm(r.ends_at)
});

const mapAbsence = (r) => ({
  id: r.id,
  staffId: r.staff_id,
  startsOn: isoDate(r.starts_on),
  endsOn: isoDate(r.ends_on),
  reason: r.reason || ''
});

/** Traduit une erreur PostgreSQL de conflit en erreur HTTP 409. */
export function toOperationError(error) {
  if (!error) return error;
  // Violation de la contrainte d'exclusion anti-chevauchement, ou conflit levé
  // explicitement par bc_book_appointment / bc_reschedule_appointment (23P01).
  if (error.code === '23P01' || error.constraint === 'bc_appointments_no_overlap') {
    return new SlotConflictError();
  }
  return error;
}

export function createOperationsRepository(db) {
  const queries = (runner) => {
    const q = runner ? (text, params) => runner.query(text, params) : (text, params) => db.query(text, params);

    // ===================== Prestations =====================
    const listServices = async (salonId, includeInactive = false) => {
      const r = await q(
        `select * from public.bc_services
          where salon_id = $1 ${includeInactive ? '' : 'and is_active'}
          order by name`,
        [salonId]
      );
      return r.rows.map(mapService);
    };

    const saveService = async (salonId, id, data) => {
      const r = await q('select public.bc_save_service($1,$2,$3,$4,$5,$6,$7,$8,$9) as id', [
        salonId,
        id ?? null,
        data.name,
        data.category,
        data.description ?? '',
        data.price,
        data.durationMinutes,
        data.popular ?? false,
        data.prepMinutes ?? 0
      ]);
      const rows = await listServices(salonId, true);
      return rows.find((s) => s.id === r.rows[0].id);
    };

    const setServiceActive = async (salonId, id, active) => {
      await q('select public.bc_set_service_active($1,$2,$3)', [salonId, id, active]);
      return { ok: true, isActive: active };
    };

    const deleteService = async (salonId, id) => {
      await q('select public.bc_delete_service($1,$2)', [salonId, id]);
      return { ok: true };
    };

    // ===================== Personnel =====================
    const staffSelect = `
      select s.*, b.name as branch_name
        from public.bc_staff s
        left join public.bc_branches b on b.id = s.branch_id
       where s.salon_id = $1
       order by s.is_active desc, s.name`;

    const listStaff = async (salonId) => (await q(staffSelect, [salonId])).rows.map(mapStaff);

    const saveStaff = async (salonId, id, data) => {
      const r = await q(
        'select public.bc_save_staff_profile($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as id',
        [
          salonId,
          id ?? null,
          data.name,
          data.role,
          data.phone ?? '',
          data.email ?? '',
          data.specialties ?? [],
          data.commissionRate,
          data.isAvailable ?? true,
          data.branchId ?? null,
          data.isActive ?? true,
          data.serviceIds ?? []
        ]
      );
      const rows = await listStaff(salonId);
      return rows.find((s) => s.id === r.rows[0].id);
    };

    const deleteStaff = async (salonId, id) => {
      await q('select public.bc_delete_staff($1,$2)', [salonId, id]);
      return { ok: true };
    };

    const listSchedules = async (salonId, staffId = null) => {
      const r = await q(
        `select * from public.bc_staff_schedules
          where salon_id = $1 ${staffId ? 'and staff_id = $2' : ''}
          order by staff_id, weekday, starts_at`,
        staffId ? [salonId, staffId] : [salonId]
      );
      return r.rows.map(mapSchedule);
    };

    const saveSchedule = async (salonId, staffId, data) => {
      const r = await q('select public.bc_save_staff_schedule($1,$2,$3,$4,$5) as id', [
        salonId,
        staffId,
        data.weekday,
        data.startsAt,
        data.endsAt
      ]);
      const rows = await listSchedules(salonId, staffId);
      return rows.find((s) => s.id === r.rows[0].id);
    };

    const deleteSchedule = async (salonId, id) => {
      await q('select public.bc_delete_staff_schedule($1,$2)', [salonId, id]);
      return { ok: true };
    };

    const listAbsences = async (salonId, staffId = null) => {
      const r = await q(
        `select * from public.bc_staff_absences
          where salon_id = $1 ${staffId ? 'and staff_id = $2' : ''}
          order by starts_on desc`,
        staffId ? [salonId, staffId] : [salonId]
      );
      return r.rows.map(mapAbsence);
    };

    const addAbsence = async (salonId, staffId, data) => {
      const r = await q('select public.bc_add_staff_absence($1,$2,$3,$4,$5) as id', [
        salonId,
        staffId,
        data.startsOn,
        data.endsOn,
        data.reason ?? ''
      ]);
      const rows = await listAbsences(salonId, staffId);
      return rows.find((a) => a.id === r.rows[0].id);
    };

    const deleteAbsence = async (salonId, id) => {
      await q('select public.bc_delete_staff_absence($1,$2)', [salonId, id]);
      return { ok: true };
    };

    // ===================== Rendez-vous =====================
    const appointmentSelect = `
      select ap.*,
             (ap.starts_at at time zone 'Africa/Abidjan')::time as starts_local,
             c.phone as client_phone,
             c.name as client_name_real,
             st.name as staff_name,
             sv.duration_minutes
        from public.bc_appointments ap
        left join public.bc_clients c on c.id = ap.client_id
        left join public.bc_staff st on st.id = ap.staff_id
        left join public.bc_services sv on sv.id = ap.service_id
       where ap.salon_id = $1`;

    const listAppointments = async (salonId, { from = null, to = null, staffId = null } = {}) => {
      const params = [salonId];
      let sql = appointmentSelect;
      if (from) {
        params.push(from);
        sql += ` and ap.starts_at >= $${params.length}::date`;
      }
      if (to) {
        params.push(to);
        sql += ` and ap.starts_at < ($${params.length}::date + interval '1 day')`;
      }
      if (staffId) {
        params.push(staffId);
        sql += ` and ap.staff_id = $${params.length}`;
      }
      sql += ' order by ap.starts_at';
      const r = await q(sql, params);
      return r.rows.map((row) => ({
        ...mapAppointment({ ...row, client_phone: row.client_phone || '' }),
        clientName: row.client_name_real || row.client_name,
        time: hhmm(row.starts_local)
      }));
    };

    const getAppointment = async (salonId, id) => {
      const r = await q(`${appointmentSelect} and ap.id = $2`, [salonId, id]);
      const row = r.rows[0];
      if (!row) return null;
      return { ...mapAppointment(row), clientName: row.client_name_real || row.client_name };
    };

    /** Création : la base vérifie employé, prestation, horaires et chevauchement. */
    const bookAppointment = async (salonId, data) => {
      const r = await q('select public.bc_book_appointment($1,$2,$3,$4,$5,$6,$7,$8,$9) as id', [
        salonId,
        data.branchId,
        data.clientId,
        data.staffId ?? null,
        data.serviceId,
        data.startsAt,
        data.endsAt,
        data.notes ?? '',
        data.source ?? 'direct'
      ]);
      return getAppointment(salonId, r.rows[0].id);
    };

    const rescheduleAppointment = async (salonId, id, data) => {
      await q('select public.bc_reschedule_appointment($1,$2,$3,$4,$5,$6)', [
        id,
        data.staffId ?? null,
        data.serviceId,
        data.startsAt,
        data.endsAt,
        data.notes ?? ''
      ]);
      return getAppointment(salonId, id);
    };

    const transitionAppointment = async (salonId, id, status, reason) => {
      await q('select public.bc_transition_appointment($1,$2,$3)', [id, status, reason ?? null]);
      return getAppointment(salonId, id);
    };

    const cancelAppointment = async (salonId, id, reason) => {
      await q('select public.bc_cancel_appointment($1,$2)', [id, reason]);
      return getAppointment(salonId, id);
    };

    const listEvents = async (salonId, id) => {
      const r = await q(
        `select previous_status, new_status, reason, created_at
           from public.bc_appointment_events
          where salon_id = $1 and appointment_id = $2
          order by created_at`,
        [salonId, id]
      );
      return r.rows.map((e) => ({
        previousStatus: e.previous_status,
        newStatus: e.new_status,
        reason: e.reason || '',
        at: isoDateTime(e.created_at)
      }));
    };

    /** Disponibilités d'une journée (créneaux de 30 min, 8 h → 19 h). */
    const dayAvailability = async (salonId, date) => {
      const r = await q('select * from public.bc_day_availability($1, $2::date)', [salonId, date]);
      const byStaff = new Map();
      for (const row of r.rows) {
        if (!byStaff.has(row.staff_id)) byStaff.set(row.staff_id, []);
        byStaff.get(row.staff_id).push({
          startsAt: isoDateTime(row.starts_at),
          endsAt: isoDateTime(row.ends_at),
          available: Boolean(row.available)
        });
      }
      return Object.fromEntries(byStaff);
    };

    const workspace = async (salonId) => {
      const [salon, services, staff, appointments] = await Promise.all([
        q('select id, name from public.bc_salons where id = $1', [salonId]),
        listServices(salonId, true),
        listStaff(salonId),
        listAppointments(salonId, { from: isoDate(new Date()) })
      ]);
      if (!salon.rows.length) return null;
      return { salon: { id: salon.rows[0].id, name: salon.rows[0].name }, services, staff, appointments };
    };

    /** Succursales du salon. */
    const listBranches = async (salonId) => {
      const r = await q('select id, name from public.bc_branches where salon_id = $1 order by name', [salonId]);
      return r.rows.map((row) => ({ id: row.id, name: row.name }));
    };

    /** Horaires d'ouverture d'une succursale (weekday : 0 = dimanche … 6 = samedi). */
    const getBranchHours = async (salonId, branchId) => {
      const r = await q(
        'select weekday, opens_at, closes_at, is_open from public.bc_branch_hours where salon_id = $1 and branch_id = $2 order by weekday',
        [salonId, branchId]
      );
      return r.rows.map((row) => ({
        weekday: num(row.weekday),
        opensAt: hhmm(row.opens_at),
        closesAt: hhmm(row.closes_at),
        isOpen: Boolean(row.is_open)
      }));
    };

    /** Sauvegarde (ou supprime si fermée) la plage horaire d'un jour de la semaine. */
    const saveBranchHours = async (salonId, branchId, weekday, opensAt, closesAt, isOpen) => {
      await q('select public.bc_save_branch_hours($1,$2,$3,$4,$5,$6)', [
        salonId, branchId, weekday, opensAt ?? null, closesAt ?? null, isOpen
      ]);
    };

    return {
      listServices,
      saveService,
      setServiceActive,
      deleteService,
      listStaff,
      saveStaff,
      deleteStaff,
      listSchedules,
      saveSchedule,
      deleteSchedule,
      listAbsences,
      addAbsence,
      deleteAbsence,
      listAppointments,
      getAppointment,
      bookAppointment,
      rescheduleAppointment,
      transitionAppointment,
      cancelAppointment,
      listEvents,
      dayAvailability,
      listBranches,
      getBranchHours,
      saveBranchHours,
      workspace
    };
  };

  const repo = queries(null);
  repo.withRunner = queries;
  return repo;
}

export const operationsMappers = { mapService, mapStaff, mapAppointment, mapSchedule, mapAbsence };
