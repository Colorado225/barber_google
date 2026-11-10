import { Appointment, AppointmentStatus, Expense, PaymentTransaction, Service } from '../types';
import {
  DEFAULT_BUSINESS_TIMEZONE,
  calendarWeekday,
  enumerateCalendarDays,
  normalizeTimeZone,
  shiftCalendarDays,
  shiftCalendarMonths,
  zonedDateString,
  zonedDateTimeToIso,
  zonedToday,
} from './businessTime';

/**
 * Analytique dérivée exclusivement des données persistées, avec définitions
 * métier explicites (encaissé net, facturé actif, réalisé `completed`, période,
 * fuseau du salon et taux d'occupation réel durée / capacité).
 */

const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const SHORT_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

export type PeriodKey = '6m' | '12m' | 'month_weeks';
export type HourlyDayFilter = 'all' | 'saturday' | 'friday' | 'weekday';
export type ServicePerformanceScope = 'completed' | 'billed';

export interface RevenuePoint {
  label: string;
  shortLabel: string;
  revenue: number;
  billedRevenue: number;
  realizedRevenue: number;
  appointments: number;
  activeAppointments: number;
  cancelledAppointments: number;
  expenses: number;
  margin: number;
  growth: number | null;
}

export interface HourlyPoint {
  hour: string;
  count: number;
  activeAppointments: number;
  completedAppointments: number;
  occupiedMinutes: number;
  availableMinutes: number;
  occupancyRate: number;
  intensity: 'calm' | 'moderate' | 'peak';
}

export interface ServicePerformance {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMinutes: number;
  volume: number;
  totalGeneratedRevenue: number;
  completedVolume: number;
  completedRevenue: number;
  billedVolume: number;
  billedRevenue: number;
  cancelledVolume: number;
  noShowVolume: number;
  revenueShare: number;
  volumeShare: number;
}

export interface FinancialTotals {
  collectedNet: number;
  collectedGross: number;
  refunds: number;
  paymentReversals: number;
  refundReversals: number;
  pendingAmount: number;
  confirmedPaymentCount: number;
  averageBasket: number | null;
  billedRevenue: number;
  realizedRevenue: number;
  expensesNet: number;
  netMargin: number;
  appointmentsTotal: number;
  appointmentsActive: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;
  appointmentsNoShow: number;
  byMethod: Record<string, number>;
}

export interface HourlyBranchHour {
  weekday: number;
  isOpen: boolean;
  open?: string | null;
  close?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
}

export interface HourlyStaffSchedule {
  staffId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
}

export interface HourlyStaffAbsence {
  staffId: string;
  startsOn: string;
  endsOn: string;
}

export interface HourlyOccupancyOptions {
  dayFilter?: HourlyDayFilter;
  from?: string;
  to?: string;
  timeZone?: string;
  staffCount?: number;
  staff?: ReadonlyArray<{ id: string; isActive?: boolean; isAvailable?: boolean }>;
  branchHours?: ReadonlyArray<HourlyBranchHour>;
  staffSchedules?: ReadonlyArray<HourlyStaffSchedule>;
  staffAbsences?: ReadonlyArray<HourlyStaffAbsence>;
  statuses?: ReadonlyArray<AppointmentStatus>;
}

/** Signe comptable d'une écriture : remboursements et contrepassations en négatif. */
export function paymentSignedAmount(t: PaymentTransaction): number {
  return t.kind === 'refund' || t.kind === 'payment_reversal' ? -t.amount : t.amount;
}

/** Signe comptable d'une écriture de dépense : contrepassation en négatif. */
export function expenseSignedAmount(e: Pick<Expense, 'amount' | 'entryKind'>): number {
  return e.entryKind === 'expense_reversal' ? -e.amount : e.amount;
}

/** Seules les écritures confirmées entrent dans les encaissements réalisés. */
export function isConfirmedPayment(t: PaymentTransaction): boolean {
  return t.status === 'completed';
}

export function isCancelledOrNoShowStatus(status: AppointmentStatus): boolean {
  return status === 'cancelled' || status === 'no_show';
}

/** Rendez-vous effectivement réalisé : uniquement le statut `completed`. */
export function isRealizedAppointment(a: Pick<Appointment, 'status'>): boolean {
  return a.status === 'completed';
}

/** Rendez-vous facturé actif : tout statut non annulé et non absent. */
export function isBilledAppointment(a: Pick<Appointment, 'status'>): boolean {
  return !isCancelledOrNoShowStatus(a.status);
}

export function appointmentBusinessDate(
  a: Pick<Appointment, 'date' | 'startsAt'>,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): string {
  if (a.startsAt) {
    const parsed = Date.parse(a.startsAt);
    if (Number.isFinite(parsed)) {
      return zonedDateString(parsed, timeZone);
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
    return a.date;
  }
  const parsedDate = Date.parse(a.date);
  if (Number.isFinite(parsedDate)) {
    return zonedDateString(parsedDate, timeZone);
  }
  return a.date.slice(0, 10);
}

export function paymentBusinessDate(
  t: Pick<PaymentTransaction, 'date' | 'createdAt'>,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): string {
  if (t.createdAt) {
    const parsed = Date.parse(t.createdAt);
    if (Number.isFinite(parsed)) {
      return zonedDateString(parsed, timeZone);
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
    return t.date;
  }
  const parsedDate = Date.parse(t.date);
  if (Number.isFinite(parsedDate)) {
    return zonedDateString(parsedDate, timeZone);
  }
  return t.date.slice(0, 10);
}

function inDateRange(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function netRevenue(
  transactions: PaymentTransaction[],
  options?: { from?: string; to?: string; timeZone?: string },
): number {
  const tz = normalizeTimeZone(options?.timeZone);
  return transactions
    .filter(
      (t) => isConfirmedPayment(t) && inDateRange(paymentBusinessDate(t, tz), options?.from, options?.to),
    )
    .reduce((acc, t) => acc + paymentSignedAmount(t), 0);
}

function growthOf(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function computeFinancialTotals(
  transactions: ReadonlyArray<PaymentTransaction>,
  appointments: ReadonlyArray<Appointment>,
  expenses: ReadonlyArray<Expense>,
  options?: { from?: string; to?: string; timeZone?: string },
): FinancialTotals {
  const tz = normalizeTimeZone(options?.timeZone);
  const from = options?.from;
  const to = options?.to;

  const periodPayments = transactions.filter((t) => inDateRange(paymentBusinessDate(t, tz), from, to));
  const confirmed = periodPayments.filter(isConfirmedPayment);

  let collectedNet = 0;
  let collectedGross = 0;
  let refunds = 0;
  let paymentReversals = 0;
  let refundReversals = 0;
  let confirmedPaymentCount = 0;
  const byMethod: Record<string, number> = {};

  for (const t of confirmed) {
    const signed = paymentSignedAmount(t);
    collectedNet += signed;
    byMethod[t.method] = (byMethod[t.method] ?? 0) + signed;
    if (t.kind === 'payment') {
      collectedGross += t.amount;
      confirmedPaymentCount += 1;
    } else if (t.kind === 'refund') {
      refunds += t.amount;
    } else if (t.kind === 'payment_reversal') {
      paymentReversals += t.amount;
    } else if (t.kind === 'refund_reversal') {
      refundReversals += t.amount;
    }
  }

  const pendingAmount = periodPayments
    .filter((t) => t.status === 'pending')
    .reduce((acc, t) => acc + t.amount, 0);

  const periodAppointments = appointments.filter((a) =>
    inDateRange(appointmentBusinessDate(a, tz), from, to),
  );
  let billedRevenue = 0;
  let realizedRevenue = 0;
  let appointmentsActive = 0;
  let appointmentsCompleted = 0;
  let appointmentsCancelled = 0;
  let appointmentsNoShow = 0;

  for (const a of periodAppointments) {
    if (a.status === 'cancelled') {
      appointmentsCancelled += 1;
    } else if (a.status === 'no_show') {
      appointmentsNoShow += 1;
    } else {
      appointmentsActive += 1;
      billedRevenue += a.price;
      if (a.status === 'completed') {
        appointmentsCompleted += 1;
        realizedRevenue += a.price;
      }
    }
  }

  const expensesNet = expenses
    .filter((e) => inDateRange(e.date, from, to))
    .reduce((acc, e) => acc + expenseSignedAmount(e), 0);

  return {
    collectedNet,
    collectedGross,
    refunds,
    paymentReversals,
    refundReversals,
    pendingAmount,
    confirmedPaymentCount,
    averageBasket: confirmedPaymentCount > 0 ? Math.round(collectedNet / confirmedPaymentCount) : null,
    billedRevenue,
    realizedRevenue,
    expensesNet,
    netMargin: collectedNet - expensesNet,
    appointmentsTotal: periodAppointments.length,
    appointmentsActive,
    appointmentsCompleted,
    appointmentsCancelled,
    appointmentsNoShow,
    byMethod,
  };
}

/** Agrège encaissements nets, facturé, réalisé, RDV réalisés et dépenses sur la période choisie. */
export function buildRevenueSeries(
  period: PeriodKey,
  transactions: PaymentTransaction[],
  appointments: Appointment[],
  expenses: Expense[],
  nowOrOptions: Date | { now?: Date; timeZone?: string } = new Date(),
): RevenuePoint[] {
  const now = nowOrOptions instanceof Date ? nowOrOptions : (nowOrOptions.now ?? new Date());
  const tz = normalizeTimeZone(nowOrOptions instanceof Date ? undefined : nowOrOptions.timeZone);
  const today = zonedToday(tz, now);

  if (period === 'month_weeks') {
    const yearMonth = today.slice(0, 7);
    const buckets = [0, 1, 2, 3].map((i) => {
      const start = i * 7 + 1;
      const end = i === 3 ? 31 : start + 6;
      return {
        start: `${yearMonth}-${String(start).padStart(2, '0')}`,
        end: `${yearMonth}-${String(end).padStart(2, '0')}`,
        label: `Semaine ${i + 1}`,
        shortLabel: `Sem ${i + 1}`,
      };
    });

    const points = buckets.map((b) => {
      const totals = computeFinancialTotals(transactions, appointments, expenses, {
        from: b.start,
        to: b.end,
        timeZone: tz,
      });
      return {
        label: b.label,
        shortLabel: b.shortLabel,
        revenue: totals.collectedNet,
        billedRevenue: totals.billedRevenue,
        realizedRevenue: totals.realizedRevenue,
        appointments: totals.appointmentsCompleted,
        activeAppointments: totals.appointmentsActive,
        cancelledAppointments: totals.appointmentsCancelled,
        expenses: totals.expensesNet,
        margin: totals.netMargin,
        growth: null as number | null,
      };
    });

    points.forEach((p, i) => {
      if (i > 0) p.growth = growthOf(p.revenue, points[i - 1].revenue);
    });

    return points;
  }

  const months = period === '12m' ? 12 : 6;
  const currentYm = today.slice(0, 7);
  const points: RevenuePoint[] = [];

  for (let offset = months - 1; offset >= 0; offset--) {
    const ym = shiftCalendarMonths(currentYm, -offset);
    const [yearNum, monthNum] = ym.split('-').map(Number);
    const monthStart = `${ym}-01`;
    const monthEnd = `${ym}-31`;
    const totals = computeFinancialTotals(transactions, appointments, expenses, {
      from: monthStart,
      to: monthEnd,
      timeZone: tz,
    });

    const isCurrent = offset === 0;
    const monthIdx = monthNum - 1;
    points.push({
      label: `${MONTH_LABELS[monthIdx]} ${yearNum}${isCurrent ? ' (En cours)' : ''}`,
      shortLabel: SHORT_MONTHS[monthIdx],
      revenue: totals.collectedNet,
      billedRevenue: totals.billedRevenue,
      realizedRevenue: totals.realizedRevenue,
      appointments: totals.appointmentsCompleted,
      activeAppointments: totals.appointmentsActive,
      cancelledAppointments: totals.appointmentsCancelled,
      expenses: totals.expensesNet,
      margin: totals.netMargin,
      growth: null,
    });
  }

  points.forEach((p, i) => {
    if (i > 0) p.growth = growthOf(p.revenue, points[i - 1].revenue);
  });

  return points;
}

function parseMinutesOfDay(hhmm: string): number {
  const [hh, mm] = hhmm.slice(0, 5).split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

function matchesDayFilter(weekday: number, dayFilter: HourlyDayFilter): boolean {
  if (dayFilter === 'saturday') return weekday === 6;
  if (dayFilter === 'friday') return weekday === 5;
  if (dayFilter === 'weekday') return weekday >= 1 && weekday <= 4;
  return true;
}

function appointmentIntervalMs(a: Appointment, timeZone: string): { startMs: number; endMs: number } | null {
  const startMs = a.startsAt
    ? Date.parse(a.startsAt)
    : Date.parse(zonedDateTimeToIso(a.date, a.time || '00:00', timeZone));
  if (!Number.isFinite(startMs)) return null;

  let endMs = a.endsAt ? Date.parse(a.endsAt) : Number.NaN;
  if (!Number.isFinite(endMs) || endMs <= startMs) {
    const durMin = Math.max(0, Number(a.durationMinutes) || 0);
    endMs = startMs + durMin * 60_000;
  }
  if (endMs <= startMs) return null;
  return { startMs, endMs };
}

/**
 * Taux d'occupation réel par tranche de 30 minutes :
 * - Exclut systématiquement `cancelled` et `no_show` (sauf override explicite) ;
 * - Calcule les minutes réellement occupées sur chaque tranche selon la durée
 *   des rendez-vous dans le fuseau horaire du salon ;
 * - Divise par la capacité disponible réelle (horaires succursale, effectif actif,
 *   plannings individuels et absences) sur les jours du filtre.
 */
export function buildHourlySeries(
  appointments: Appointment[],
  dayFilterOrOptions: HourlyDayFilter | HourlyOccupancyOptions = 'all',
  extraOptions?: Omit<HourlyOccupancyOptions, 'dayFilter'>,
): HourlyPoint[] {
  const options: HourlyOccupancyOptions =
    typeof dayFilterOrOptions === 'string'
      ? { dayFilter: dayFilterOrOptions, ...extraOptions }
      : dayFilterOrOptions;

  const dayFilter: HourlyDayFilter = options.dayFilter ?? 'all';
  const tz = normalizeTimeZone(options.timeZone);
  const allowedStatuses = options.statuses ? new Set(options.statuses) : null;

  const activeIntervals = appointments
    .filter((a) => (allowedStatuses ? allowedStatuses.has(a.status) : isBilledAppointment(a)))
    .map((a) => {
      const iv = appointmentIntervalMs(a, tz);
      if (!iv) return null;
      const startDate = zonedDateString(iv.startMs, tz);
      const endDate = zonedDateString(iv.endMs - 1, tz);
      return { a, startMs: iv.startMs, endMs: iv.endMs, startDate, endDate };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  let days: string[];
  if (options.from && options.to) {
    days = enumerateCalendarDays(options.from, options.to).filter((d) =>
      matchesDayFilter(calendarWeekday(d), dayFilter),
    );
  } else {
    const observedDates = new Set<string>();
    for (const item of activeIntervals) {
      for (const d of enumerateCalendarDays(item.startDate, item.endDate)) {
        if (matchesDayFilter(calendarWeekday(d), dayFilter)) observedDates.add(d);
      }
    }
    days = [...observedDates].sort();
  }

  if (days.length === 0) return [];

  const activeStaff = options.staff
    ? options.staff.filter((st) => st.isActive !== false && st.isAvailable !== false)
    : null;
  const virtualStaffCount = activeStaff ? activeStaff.length : Math.max(0, options.staffCount ?? 1);

  const hasBranchHours = Boolean(options.branchHours && options.branchHours.length > 0);
  const branchWindowByWeekday = new Map<number, { openMin: number; closeMin: number }>();
  if (hasBranchHours) {
    for (const bh of options.branchHours!) {
      const openTime = bh.open ?? bh.opensAt;
      const closeTime = bh.close ?? bh.closesAt;
      if (bh.isOpen && openTime && closeTime) {
        const openMin = parseMinutesOfDay(openTime);
        const closeMin = parseMinutesOfDay(closeTime);
        if (closeMin > openMin) branchWindowByWeekday.set(bh.weekday, { openMin, closeMin });
      }
    }
  }

  const schedulesByStaff = new Map<string, HourlyStaffSchedule[]>();
  if (options.staffSchedules) {
    for (const sc of options.staffSchedules) {
      const list = schedulesByStaff.get(sc.staffId) ?? [];
      list.push(sc);
      schedulesByStaff.set(sc.staffId, list);
    }
  }

  const absencesByStaff = new Map<string, HourlyStaffAbsence[]>();
  if (options.staffAbsences) {
    for (const ab of options.staffAbsences) {
      const list = absencesByStaff.get(ab.staffId) ?? [];
      list.push(ab);
      absencesByStaff.set(ab.staffId, list);
    }
  }

  const daySet = new Set(days);
  const slotStats = Array.from({ length: 48 }, (_, sIdx) => ({
    sIdx,
    hour: `${String(Math.floor(sIdx / 2)).padStart(2, '0')}:${sIdx % 2 === 0 ? '00' : '30'}`,
    occupiedMinutesRaw: 0,
    availableMinutes: 0,
    activeAppointmentKeys: new Set<string>(),
    completedAppointmentKeys: new Set<string>(),
  }));

  // 1. Capacité disponible réelle par tranche
  for (const day of days) {
    const wd = calendarWeekday(day);
    const branchWin = hasBranchHours
      ? (branchWindowByWeekday.get(wd) ?? null)
      : { openMin: 8 * 60, closeMin: 20 * 60 };
    if (!branchWin) continue;

    for (let sIdx = 0; sIdx < 48; sIdx += 1) {
      const slotStart = sIdx * 30;
      const slotEnd = slotStart + 30;
      const branchSlotOverlap = Math.max(
        0,
        Math.min(branchWin.closeMin, slotEnd) - Math.max(branchWin.openMin, slotStart),
      );
      if (branchSlotOverlap <= 0) continue;

      if (!activeStaff) {
        slotStats[sIdx].availableMinutes += branchSlotOverlap * virtualStaffCount;
        continue;
      }

      for (const st of activeStaff) {
        const staffAbsences = absencesByStaff.get(st.id) ?? [];
        if (staffAbsences.some((ab) => day >= ab.startsOn && day <= ab.endsOn)) continue;

        const staffScheds = schedulesByStaff.get(st.id) ?? [];
        if (staffScheds.length === 0) {
          slotStats[sIdx].availableMinutes += branchSlotOverlap;
          continue;
        }
        let schedOverlap = 0;
        for (const sc of staffScheds) {
          if (sc.weekday !== wd) continue;
          const scStart = parseMinutesOfDay(sc.startsAt);
          const scEnd = parseMinutesOfDay(sc.endsAt);
          schedOverlap += Math.max(
            0,
            Math.min(branchWin.closeMin, scEnd, slotEnd) - Math.max(branchWin.openMin, scStart, slotStart),
          );
        }
        slotStats[sIdx].availableMinutes += Math.min(branchSlotOverlap, schedOverlap);
      }
    }
  }

  // 2. Minutes réellement occupées par chevauchement de durée des RDV actifs
  for (const item of activeIntervals) {
    const spannedDays = enumerateCalendarDays(item.startDate, item.endDate);
    for (const day of spannedDays) {
      if (!daySet.has(day)) continue;
      for (let sIdx = 0; sIdx < 48; sIdx += 1) {
        const startMin = sIdx * 30;
        const startHour = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${startMin % 60 === 0 ? '00' : '30'}`;
        const slotStartMs = Date.parse(zonedDateTimeToIso(day, startHour, tz));
        const nextDay = sIdx === 47 ? shiftCalendarDays(day, 1) : day;
        const endMin = ((sIdx + 1) * 30) % 1440;
        const endHour = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${endMin % 60 === 0 ? '00' : '30'}`;
        const slotEndMs = Date.parse(zonedDateTimeToIso(nextDay, endHour, tz));

        const overlapMs = Math.min(item.endMs, slotEndMs) - Math.max(item.startMs, slotStartMs);
        if (overlapMs > 0) {
          slotStats[sIdx].occupiedMinutesRaw += overlapMs / 60_000;
          const occKey = `${item.a.id}:${day}`;
          slotStats[sIdx].activeAppointmentKeys.add(occKey);
          if (item.a.status === 'completed') {
            slotStats[sIdx].completedAppointmentKeys.add(occKey);
          }
        }
      }
    }
  }

  return slotStats
    .filter((s) => s.occupiedMinutesRaw > 0 || s.availableMinutes > 0)
    .map((s) => {
      const occupiedMinutes = Math.round(s.occupiedMinutesRaw);
      const occupancyRate =
        s.availableMinutes > 0
          ? Math.min(100, Math.round((s.occupiedMinutesRaw / s.availableMinutes) * 100))
          : occupiedMinutes > 0
            ? 100
            : 0;
      const intensity: HourlyPoint['intensity'] =
        occupancyRate >= 75 ? 'peak' : occupancyRate >= 45 ? 'moderate' : 'calm';
      const activeAppointments = s.activeAppointmentKeys.size;
      const completedAppointments = s.completedAppointmentKeys.size;
      return {
        hour: s.hour,
        count: activeAppointments,
        activeAppointments,
        completedAppointments,
        occupiedMinutes,
        availableMinutes: s.availableMinutes,
        occupancyRate,
        intensity,
      };
    });
}

/**
 * Palmarès des prestations basé uniquement sur les rendez-vous valides :
 * - Exclut systématiquement `cancelled` et `no_show` du volume et du revenu ;
 * - Distingue les prestations réalisées (`status === 'completed'`, défaut) des
 *   prestations facturées actives (`scope: 'billed'`).
 */
export function buildServicePerformance(
  appointments: Appointment[],
  services: Service[],
  sort: 'revenue' | 'volume',
  options?: {
    from?: string;
    to?: string;
    scope?: ServicePerformanceScope;
    timeZone?: string;
  },
): ServicePerformance[] {
  const scope: ServicePerformanceScope = options?.scope ?? 'completed';
  const tz = normalizeTimeZone(options?.timeZone);

  const stats = new Map<
    string,
    {
      completedVolume: number;
      completedRevenue: number;
      billedVolume: number;
      billedRevenue: number;
      cancelledVolume: number;
      noShowVolume: number;
    }
  >();

  for (const a of appointments) {
    if (!inDateRange(appointmentBusinessDate(a, tz), options?.from, options?.to)) continue;
    const entry = stats.get(a.serviceId) ?? {
      completedVolume: 0,
      completedRevenue: 0,
      billedVolume: 0,
      billedRevenue: 0,
      cancelledVolume: 0,
      noShowVolume: 0,
    };

    if (a.status === 'cancelled') {
      entry.cancelledVolume += 1;
    } else if (a.status === 'no_show') {
      entry.noShowVolume += 1;
    } else {
      entry.billedVolume += 1;
      entry.billedRevenue += a.price;
      if (a.status === 'completed') {
        entry.completedVolume += 1;
        entry.completedRevenue += a.price;
      }
    }
    stats.set(a.serviceId, entry);
  }

  const rows: ServicePerformance[] = services.map((srv) => {
    const stat = stats.get(srv.id) ?? {
      completedVolume: 0,
      completedRevenue: 0,
      billedVolume: 0,
      billedRevenue: 0,
      cancelledVolume: 0,
      noShowVolume: 0,
    };
    const volume = scope === 'billed' ? stat.billedVolume : stat.completedVolume;
    const totalGeneratedRevenue = scope === 'billed' ? stat.billedRevenue : stat.completedRevenue;

    return {
      id: srv.id,
      name: srv.name,
      category: srv.category,
      price: srv.price,
      durationMinutes: srv.durationMinutes,
      volume,
      totalGeneratedRevenue,
      completedVolume: stat.completedVolume,
      completedRevenue: stat.completedRevenue,
      billedVolume: stat.billedVolume,
      billedRevenue: stat.billedRevenue,
      cancelledVolume: stat.cancelledVolume,
      noShowVolume: stat.noShowVolume,
      revenueShare: 0,
      volumeShare: 0,
    };
  });

  const totalRevenue = rows.reduce((acc, r) => acc + r.totalGeneratedRevenue, 0);
  const totalVolume = rows.reduce((acc, r) => acc + r.volume, 0);

  rows.forEach((r) => {
    r.revenueShare = totalRevenue > 0 ? Math.round((r.totalGeneratedRevenue / totalRevenue) * 100) : 0;
    r.volumeShare = totalVolume > 0 ? Math.round((r.volume / totalVolume) * 100) : 0;
  });

  return rows.sort((a, b) =>
    sort === 'revenue'
      ? b.totalGeneratedRevenue - a.totalGeneratedRevenue || b.volume - a.volume
      : b.volume - a.volume || b.totalGeneratedRevenue - a.totalGeneratedRevenue,
  );
}

/** Panier moyen encaissé net sur la période (ou null si aucun paiement confirmé). */
export function computeAverageBasket(
  transactions: PaymentTransaction[],
  options?: { from?: string; to?: string; timeZone?: string },
): number | null {
  const tz = normalizeTimeZone(options?.timeZone);
  const confirmed = transactions.filter(
    (t) => isConfirmedPayment(t) && inDateRange(paymentBusinessDate(t, tz), options?.from, options?.to),
  );
  const paymentCount = confirmed.filter((t) => t.kind === 'payment').length;
  if (!paymentCount) return null;
  const total = confirmed.reduce((acc, t) => acc + paymentSignedAmount(t), 0);
  return Math.round(total / paymentCount);
}
