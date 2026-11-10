import { DEFAULT_BUSINESS_TIMEZONE, shiftCalendarDays, zonedToday } from './businessTime';

export type MetricsPeriodKey = 'month' | '30d' | 'year' | 'all' | 'custom';

export function abidjanToday(now: Date = new Date()): string {
  return zonedToday(DEFAULT_BUSINESS_TIMEZONE, now);
}

export function rangeForMetricsPeriod(
  period: Exclude<MetricsPeriodKey, 'custom'>,
  today: string = abidjanToday(),
): { from: string | null; to: string | null } {
  if (period === 'all') return { from: null, to: null };
  if (period === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  if (period === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: shiftCalendarDays(today, -29), to: today };
}
