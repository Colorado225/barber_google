// Helpers génériques partagés par les modules domaine de l'API salon
// (extraits de l'ancien src/lib/api.ts monolithique).
import type { SupabaseClient } from '@supabase/supabase-js';

import { ApiError } from '../apiError';
import { DEFAULT_BUSINESS_TIMEZONE, zonedDateTime } from '../businessTime';

export type DbRow = Record<string, unknown>;

export function throwSupabaseError(error: { message: string; code?: string }): never {
  const status =
    error.code === '42501'
      ? 403
      : error.code === '28000' || error.code === 'PGRST301'
        ? 401
        : error.code === '23505'
          ? 409
          : error.code?.startsWith('22') || error.code === '23514'
            ? 400
            : 500;
  throw new ApiError(error.message, status, error.code);
}

export function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throwSupabaseError(result.error);
  if (result.data === null) throw new ApiError('Supabase n’a retourné aucune donnée.');
  return result.data;
}

export function stringValue(row: DbRow, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

export function optionalString(row: DbRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.length ? value : undefined;
}

export function numberValue(row: DbRow, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export function optionalNumber(row: DbRow, key: string): number | undefined {
  const value = row[key];
  return value === null || value === undefined ? undefined : Number(value);
}

export function booleanValue(row: DbRow, key: string): boolean {
  return row[key] === true;
}

export function mapDateTimeInZone(
  iso: string,
  timeZone: string = DEFAULT_BUSINESS_TIMEZONE,
): { date: string; time: string } {
  return zonedDateTime(iso, timeZone);
}

export function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

/** Dépendances partagées des modules domaine de l'API salon. */
export interface SalonApiDeps {
  supabase: SupabaseClient;
  salonId: string;
  /** Fuseau horaire actif du salon (mutable via setTimeZone). */
  getTimeZone: () => string;
}
