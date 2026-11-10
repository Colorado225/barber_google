import type { ErpDashboardPeriod } from '../types';

export const DEFAULT_BUSINESS_TIMEZONE = 'Africa/Abidjan';

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone || typeof timeZone !== 'string' || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timeZone.trim() }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone?: string | null): string {
  if (isValidTimeZone(timeZone)) return timeZone.trim();
  return DEFAULT_BUSINESS_TIMEZONE;
}

export function resolveSalonTimezone(
  salon?: { timezone?: string | null } | null,
  branches?: ReadonlyArray<{ id: string; timezone?: string | null }> | null,
  branchId?: string | null,
): string {
  if (branches?.length) {
    if (branchId) {
      const matched = branches.find((b) => b.id === branchId);
      if (isValidTimeZone(matched?.timezone)) return matched.timezone.trim();
    }
    const primary = branches.find((b) => isValidTimeZone(b.timezone));
    if (primary && isValidTimeZone(primary.timezone)) return primary.timezone.trim();
  }
  if (isValidTimeZone(salon?.timezone)) return salon.timezone.trim();
  return DEFAULT_BUSINESS_TIMEZONE;
}

function getDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const tz = normalizeTimeZone(timeZone);
  let fmt = dateFormatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatterCache.set(tz, fmt);
  }
  return fmt;
}

function getTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const tz = normalizeTimeZone(timeZone);
  let fmt = timeFormatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    timeFormatterCache.set(tz, fmt);
  }
  return fmt;
}

function toDateObj(input: Date | string | number): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function zonedDateString(
  input: Date | string | number,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): string {
  const d = toDateObj(input);
  if (!d) {
    return typeof input === 'string' ? input.slice(0, 10) : '';
  }
  return getDateFormatter(timeZone).format(d);
}

export function zonedTimeString(
  input: Date | string | number,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): string {
  const d = toDateObj(input);
  if (!d) {
    return typeof input === 'string' ? input.slice(11, 16) : '';
  }
  const formatted = getTimeFormatter(timeZone).format(d);
  // Sécurité additionnelle si un runtime ancien renvoie "24:00".
  return formatted.startsWith('24:') ? `00:${formatted.slice(3)}` : formatted;
}

export function zonedDateTime(
  input: Date | string | number,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): { date: string; time: string } {
  const d = toDateObj(input);
  if (!d) {
    const raw = typeof input === 'string' ? input : '';
    return { date: raw.slice(0, 10), time: raw.slice(11, 16) };
  }
  return {
    date: zonedDateString(d, timeZone),
    time: zonedTimeString(d, timeZone),
  };
}

export function zonedToday(timeZone: string = DEFAULT_BUSINESS_TIMEZONE, now: Date = new Date()): string {
  return zonedDateString(now, timeZone);
}

export function zonedMonthKey(timeZone: string = DEFAULT_BUSINESS_TIMEZONE, now: Date = new Date()): string {
  return zonedToday(timeZone, now).slice(0, 7);
}

export function shiftCalendarDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return utc.toISOString().slice(0, 10);
}

export function shiftCalendarMonths(yearMonth: string, deltaMonths: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function calendarWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function calendarWeekStart(dateStr: string): string {
  const wd = calendarWeekday(dateStr);
  const diff = wd === 0 ? -6 : 1 - wd;
  return shiftCalendarDays(dateStr, diff);
}

export function enumerateCalendarDays(fromDate: string, toDate: string): string[] {
  if (!fromDate || !toDate || fromDate > toDate) return [];
  const days: string[] = [];
  let cursor = fromDate;
  let guard = 0;
  while (cursor <= toDate && guard < 400) {
    days.push(cursor);
    cursor = shiftCalendarDays(cursor, 1);
    guard += 1;
  }
  return days;
}

function parseWallClockMs(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.slice(0, 5).split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

export function zonedDateTimeToIso(
  dateStr: string,
  timeStr: string,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): string {
  const tz = normalizeTimeZone(timeZone);
  const targetMs = parseWallClockMs(dateStr, timeStr);
  let guessMs = targetMs;
  for (let i = 0; i < 3; i += 1) {
    const measured = zonedDateTime(new Date(guessMs), tz);
    const measuredMs = parseWallClockMs(measured.date, measured.time);
    const diff = targetMs - measuredMs;
    if (diff === 0) break;
    guessMs += diff;
  }
  return new Date(guessMs).toISOString();
}

export function zonedDayRangeToUtcBounds(
  fromDate: string,
  toDate: string,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): { startIso: string; endExclusiveIso: string } {
  return {
    startIso: zonedDateTimeToIso(fromDate, '00:00', timeZone),
    endExclusiveIso: zonedDateTimeToIso(shiftCalendarDays(toDate, 1), '00:00', timeZone),
  };
}

export function resolveErpPeriodRange(
  period: ErpDashboardPeriod,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
  now: Date = new Date(),
): { from: string; to: string; label: string; timeZone: string } {
  const tz = normalizeTimeZone(timeZone);
  const today = zonedToday(tz, now);
  if (period === 'month' || period === 'month_weeks') {
    return {
      from: `${today.slice(0, 8)}01`,
      to: today,
      label: period === 'month_weeks' ? 'Mois en cours (par semaine)' : 'Mois en cours',
      timeZone: tz,
    };
  }
  if (period === '30d') {
    return {
      from: shiftCalendarDays(today, -29),
      to: today,
      label: '30 derniers jours',
      timeZone: tz,
    };
  }
  if (period === '6m') {
    return {
      from: `${shiftCalendarMonths(today.slice(0, 7), -5)}-01`,
      to: today,
      label: '6 derniers mois',
      timeZone: tz,
    };
  }
  if (period === 'year') {
    return {
      from: `${today.slice(0, 4)}-01-01`,
      to: today,
      label: 'Année en cours',
      timeZone: tz,
    };
  }
  return {
    from: `${shiftCalendarMonths(today.slice(0, 7), -11)}-01`,
    to: today,
    label: '12 derniers mois',
    timeZone: tz,
  };
}
