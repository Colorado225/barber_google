import type { OpeningHour } from '../types';
import { getSupabaseClient } from './supabase';

export interface SalonBranch {
  id: string;
  name: string;
}

interface BranchHourRecord {
  weekday: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

const DAYS_OF_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const weekdayByDay = new Map(DAYS_OF_WEEK.map((day, index) => [day, (index + 1) % 7]));
const dayByWeekday = new Map([...weekdayByDay].map(([day, weekday]) => [weekday, day]));

export async function listSalonBranches(salonId: string): Promise<SalonBranch[]> {
  const { data, error } = await getSupabaseClient()
    .from('branches')
    .select('id, name')
    .eq('salon_id', salonId)
    .order('created_at');

  if (error) throw error;
  return data ?? [];
}

export async function getBranchHours(salonId: string, branchId: string): Promise<OpeningHour[]> {
  const { data, error } = await getSupabaseClient()
    .from('branch_hours')
    .select('weekday, is_open, opens_at, closes_at')
    .eq('salon_id', salonId)
    .eq('branch_id', branchId)
    .order('weekday');

  if (error) throw error;
  return mapBranchHours(data ?? []);
}

export function mapBranchHours(rows: readonly BranchHourRecord[]): OpeningHour[] {
  const hoursByDay = new Map(
    rows.map((row) => [
      dayByWeekday.get(row.weekday),
      {
        isOpen: row.is_open,
        open: row.opens_at ? row.opens_at.slice(0, 5) : '09:00',
        close: row.closes_at ? row.closes_at.slice(0, 5) : '19:00',
      },
    ]),
  );

  return DAYS_OF_WEEK.map((day) => {
    const existing = hoursByDay.get(day);
    if (existing) {
      return {
        day,
        isOpen: existing.isOpen,
        open: existing.open || '09:00',
        close: existing.close || '19:00',
      };
    }
    return {
      day,
      isOpen: day !== 'Dimanche',
      open: '09:00',
      close: '19:00',
    };
  });
}

export function toBranchHoursRows(salonId: string, branchId: string, hours: readonly OpeningHour[]) {
  return hours.map((hour) => {
    const weekday = weekdayByDay.get(hour.day);
    if (weekday === undefined) throw new Error(`Jour d’ouverture inconnu : ${hour.day}`);
    if (hour.isOpen && (!hour.open || !hour.close || hour.close <= hour.open)) {
      throw new Error(`Les horaires du ${hour.day} sont invalides.`);
    }

    return {
      salon_id: salonId,
      branch_id: branchId,
      weekday,
      is_open: hour.isOpen,
      opens_at: hour.isOpen ? hour.open : null,
      closes_at: hour.isOpen ? hour.close : null,
    };
  });
}

export async function saveBranchHours(
  salonId: string,
  branchId: string,
  hours: readonly OpeningHour[],
): Promise<void> {
  const rows = toBranchHoursRows(salonId, branchId, hours);

  const { error } = await getSupabaseClient()
    .from('branch_hours')
    .upsert(rows, { onConflict: 'salon_id,branch_id,weekday' });

  if (error) throw error;
}
