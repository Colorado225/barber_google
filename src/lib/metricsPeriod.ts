export type MetricsPeriodKey = 'month' | '30d' | 'year' | 'all' | 'custom';

export function abidjanToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function rangeForMetricsPeriod(
  period: Exclude<MetricsPeriodKey, 'custom'>,
  today: string = abidjanToday(),
): { from: string | null; to: string | null } {
  if (period === 'all') return { from: null, to: null };
  if (period === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  if (period === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today };
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 29);
  return { from: d.toISOString().slice(0, 10), to: today };
}
