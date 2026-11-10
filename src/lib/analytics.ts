import { Appointment, Expense, PaymentTransaction, Service } from '../types';

/**
 * Analytics derived only from stored data. No invented fallbacks: when a series
 * has no records it is returned empty so the UI can show a real empty state.
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

export interface RevenuePoint {
  label: string;
  shortLabel: string;
  revenue: number;
  appointments: number;
  expenses: number;
  margin: number;
  growth: number | null;
}

export interface HourlyPoint {
  hour: string;
  count: number;
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
  revenueShare: number;
  volumeShare: number;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Signe comptable d'une écriture : remboursements/annulations en négatif. */
export function paymentSignedAmount(t: PaymentTransaction): number {
  return t.kind === 'refund' || t.kind === 'payment_reversal' ? -t.amount : t.amount;
}

/** Signe comptable d'une écriture de dépense : contrepassation en négatif. */
export function expenseSignedAmount(e: Pick<Expense, 'amount' | 'entryKind'>): number {
  return e.entryKind === 'expense_reversal' ? -e.amount : e.amount;
}

/** Seules les écritures confirmées entrent dans les revenus réalisés. */
export function isConfirmedPayment(t: PaymentTransaction): boolean {
  return t.status === 'completed';
}

export function netRevenue(transactions: PaymentTransaction[]): number {
  return transactions.filter(isConfirmedPayment).reduce((acc, t) => acc + paymentSignedAmount(t), 0);
}

function growthOf(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Buckets completed payments / appointments / expenses over the selected period. */
export function buildRevenueSeries(
  period: PeriodKey,
  transactions: PaymentTransaction[],
  appointments: Appointment[],
  expenses: Expense[],
  now: Date = new Date(),
): RevenuePoint[] {
  if (period === 'month_weeks') {
    // Current month split into 4 weekly buckets.
    const year = now.getFullYear();
    const month = now.getMonth();
    const buckets = [0, 1, 2, 3].map((i) => {
      const start = i * 7 + 1;
      const end = i === 3 ? 31 : start + 6;
      return {
        start: `${year}-${String(month + 1).padStart(2, '0')}-${String(start).padStart(2, '0')}`,
        end: `${year}-${String(month + 1).padStart(2, '0')}-${String(end).padStart(2, '0')}`,
        label: `Semaine ${i + 1}`,
        shortLabel: `Sem ${i + 1}`,
      };
    });

    const points = buckets.map((b) => {
      const revenue = transactions
        .filter((t) => isConfirmedPayment(t) && t.date >= b.start && t.date <= b.end)
        .reduce((acc, t) => acc + paymentSignedAmount(t), 0);
      const count = appointments.filter((a) => a.date >= b.start && a.date <= b.end).length;
      const spent = expenses
        .filter((e) => e.date >= b.start && e.date <= b.end)
        .reduce((acc, e) => acc + expenseSignedAmount(e), 0);
      return {
        label: b.label,
        shortLabel: b.shortLabel,
        revenue,
        appointments: count,
        expenses: spent,
        margin: revenue - spent,
        growth: null as number | null,
      };
    });

    points.forEach((p, i) => {
      if (i > 0) p.growth = growthOf(p.revenue, points[i - 1].revenue);
    });

    return points;
  }

  const months = period === '12m' ? 12 : 6;
  const points: RevenuePoint[] = [];

  for (let offset = months - 1; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = monthKey(d);
    const revenue = transactions
      .filter((t) => isConfirmedPayment(t) && t.date.startsWith(key))
      .reduce((acc, t) => acc + paymentSignedAmount(t), 0);
    const count = appointments.filter((a) => a.date.startsWith(key)).length;
    const spent = expenses
      .filter((e) => e.date.startsWith(key))
      .reduce((acc, e) => acc + expenseSignedAmount(e), 0);

    const isCurrent = offset === 0;
    points.push({
      label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}${isCurrent ? ' (En cours)' : ''}`,
      shortLabel: SHORT_MONTHS[d.getMonth()],
      revenue,
      appointments: count,
      expenses: spent,
      margin: revenue - spent,
      growth: null,
    });
  }

  points.forEach((p, i) => {
    if (i > 0) p.growth = growthOf(p.revenue, points[i - 1].revenue);
  });

  return points;
}

/**
 * Busy hours from real appointments. Returns one bucket per half hour between
 * the earliest and latest appointment of the selected day scope.
 */
export function buildHourlySeries(
  appointments: Appointment[],
  dayFilter: 'all' | 'saturday' | 'friday' | 'weekday',
): HourlyPoint[] {
  const filtered = appointments.filter((a) => {
    const day = new Date(`${a.date}T00:00:00`).getDay(); // 0 = Sunday … 6 = Saturday
    if (dayFilter === 'saturday') return day === 6;
    if (dayFilter === 'friday') return day === 5;
    if (dayFilter === 'weekday') return day >= 1 && day <= 5;
    return true;
  });

  if (!filtered.length) return [];

  const counts = new Map<string, number>();
  filtered.forEach((a) => counts.set(a.time, (counts.get(a.time) || 0) + 1));

  const times = [...counts.keys()].sort();
  const max = Math.max(...counts.values(), 1);

  const uniqueDays = new Set(filtered.map((a) => a.date)).size || 1;

  return times.map((hour) => {
    const count = counts.get(hour) || 0;
    const perDay = count / uniqueDays;
    const occupancyRate = Math.min(100, Math.round((perDay / max) * 100));
    const intensity: HourlyPoint['intensity'] =
      occupancyRate >= 75 ? 'peak' : occupancyRate >= 45 ? 'moderate' : 'calm';
    return { hour, count, occupancyRate, intensity };
  });
}

/**
 * Ranking of services from real appointments. Falls back to the salon catalogue
 * with zero volume so the panel can show which services have sold nothing yet.
 */
export function buildServicePerformance(
  appointments: Appointment[],
  services: Service[],
  sort: 'revenue' | 'volume',
): ServicePerformance[] {
  const stats = new Map<string, { volume: number; revenue: number }>();

  appointments.forEach((a) => {
    const entry = stats.get(a.serviceId) || { volume: 0, revenue: 0 };
    entry.volume += 1;
    entry.revenue += a.price;
    stats.set(a.serviceId, entry);
  });

  const rows = services.map((srv) => {
    const stat = stats.get(srv.id) || { volume: 0, revenue: 0 };
    return {
      id: srv.id,
      name: srv.name,
      category: srv.category,
      price: srv.price,
      durationMinutes: srv.durationMinutes,
      volume: stat.volume,
      totalGeneratedRevenue: stat.revenue,
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
    sort === 'revenue' ? b.totalGeneratedRevenue - a.totalGeneratedRevenue : b.volume - a.volume,
  );
}

/** Average basket, or null when no payment exists yet (no invented default). */
export function computeAverageBasket(transactions: PaymentTransaction[]): number | null {
  const confirmed = transactions.filter(isConfirmedPayment);
  const paymentCount = confirmed.filter((t) => t.kind === 'payment').length;
  if (!paymentCount) return null;
  const total = confirmed.reduce((acc, t) => acc + paymentSignedAmount(t), 0);
  return Math.round(total / paymentCount);
}
