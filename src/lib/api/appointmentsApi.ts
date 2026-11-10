// Domaine rendez-vous : listing, cycle de vie, clients de passage et disponibilités
// (extrait de l'ancien src/lib/api.ts monolithique).
import type { Appointment } from '../../types';
import { normalizeTimeZone, shiftCalendarDays, zonedDateTimeToIso } from '../businessTime';
import type { AppointmentInput, Availability, RescheduleInput, WalkInInput } from './inputs';
import type { DbRow, SalonApiDeps } from './internal';
import { booleanValue, stringValue, unwrap } from './internal';
import { mapAppointment } from './mappers';

export function createAppointmentsApi(deps: SalonApiDeps) {
  const { supabase, salonId, getTimeZone } = deps;
  return {
    appointments: {
      async list(params: { from?: string; to?: string; staffId?: string; timeZone?: string } = {}) {
        const tz = normalizeTimeZone(params.timeZone ?? getTimeZone());
        let query = supabase.from('appointments').select('*').eq('salon_id', salonId);
        if (params.from) query = query.gte('starts_at', zonedDateTimeToIso(params.from, '00:00', tz));
        if (params.to) {
          query = query.lt('starts_at', zonedDateTimeToIso(shiftCalendarDays(params.to, 1), '00:00', tz));
        }
        if (params.staffId) query = query.eq('staff_id', params.staffId);
        const result = await query.order('starts_at');
        return (unwrap(result) ?? []).map((row) => mapAppointment(row as DbRow, tz));
      },
      async create(data: AppointmentInput): Promise<Appointment> {
        const result = await supabase.rpc('create_appointment', {
          p_salon_id: salonId,
          p_service_id: data.serviceId,
          p_starts_at: data.startsAt,
          p_client_name: data.clientName,
          p_client_phone: data.clientPhone,
          p_staff_id: data.staffId ?? null,
          p_client_id: data.clientId ?? null,
          p_branch_id: data.branchId ?? null,
          p_source: data.source ?? 'direct',
          p_notes: data.notes ?? '',
        });
        return mapAppointment(unwrap(result) as DbRow, getTimeZone());
      },
      async registerWalkIn(data: WalkInInput): Promise<Appointment> {
        const result = await supabase.rpc('register_walk_in', {
          p_salon_id: salonId,
          p_service_id: data.serviceId,
          p_idempotency_key: data.idempotencyKey,
          p_client_name: data.clientName ?? null,
          p_client_phone: data.clientPhone ?? null,
          p_client_id: data.clientId ?? null,
          p_staff_id: data.staffId ?? null,
          p_branch_id: data.branchId ?? null,
          p_start_immediately: data.startImmediately ?? false,
          p_notes: data.notes ?? '',
        });
        return mapAppointment(unwrap(result) as DbRow, getTimeZone());
      },
      async startWalkIn(id: string, staffId?: string | null): Promise<Appointment> {
        const result = await supabase.rpc('start_walk_in', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_staff_id: staffId ?? null,
        });
        return mapAppointment(unwrap(result) as DbRow, getTimeZone());
      },
      async completeWalkIn(id: string): Promise<Appointment> {
        const result = await supabase.rpc('complete_walk_in', {
          p_salon_id: salonId,
          p_appointment_id: id,
        });
        return mapAppointment(unwrap(result) as DbRow, getTimeZone());
      },
      async reschedule(id: string, data: RescheduleInput): Promise<Appointment> {
        const result = await supabase.rpc('reschedule_appointment', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_staff_id: data.staffId ?? null,
          p_service_id: data.serviceId ?? null,
          p_starts_at: data.startsAt ?? null,
          p_notes: data.notes ?? null,
        });
        return mapAppointment(unwrap(result) as DbRow, getTimeZone());
      },
      async transition(id: string, status: string, reason?: string): Promise<Appointment> {
        const result = await supabase.rpc('transition_appointment', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_status: status,
          p_reason: reason ?? null,
        });
        return mapAppointment(unwrap(result) as DbRow, getTimeZone());
      },
      async cancel(id: string, reason: string): Promise<Appointment> {
        const result = await supabase.rpc('cancel_appointment', {
          p_salon_id: salonId,
          p_appointment_id: id,
          p_reason: reason,
        });
        return mapAppointment(unwrap(result) as DbRow, getTimeZone());
      },
      async events(id: string): Promise<unknown[]> {
        const result = await supabase
          .from('appointment_events')
          .select('*')
          .eq('salon_id', salonId)
          .eq('appointment_id', id)
          .order('created_at');
        return unwrap(result) ?? [];
      },
      async availability(date: string, serviceId?: string): Promise<Availability> {
        const result = await supabase.rpc('day_availability', {
          p_salon_id: salonId,
          p_date: date,
          p_service_id: serviceId ?? null,
        });
        const byStaff: Availability = {};
        for (const row of (unwrap(result) ?? []) as DbRow[]) {
          const staffId = stringValue(row, 'staff_id');
          (byStaff[staffId] ??= []).push({
            startsAt: stringValue(row, 'starts_at'),
            available: booleanValue(row, 'available'),
          });
        }
        return byStaff;
      },
    },
  };
}
