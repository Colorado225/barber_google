import { mapStaff, mapStaffAbsence, mapStaffSchedule, throwSupabaseError, unwrap } from './shared';
import type { DbRow, SalonApiClient, StaffAbsence, StaffInput, StaffSchedule } from './shared';

export async function listStaff(supabase: SalonApiClient, salonId: string) {
  const result = await supabase.from('staff').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapStaff(row as DbRow));
}
export function createStaffApi(supabase: SalonApiClient, salonId: string) {
  return {
    staff: {
      list: () => listStaff(supabase, salonId),
      async create(data: StaffInput) {
        const result = await supabase
          .from('staff')
          .insert({
            salon_id: salonId,
            name: data.name,
            role: data.role,
            phone: data.phone ?? '',
            email: data.email?.trim().toLowerCase() || null,
            specialties: data.specialties ?? [],
            commission_rate: data.commissionRate,
            branch_id: data.branchId ?? null,
            is_available: data.isAvailable ?? true,
            is_active: data.isActive ?? true,
            service_ids: data.serviceIds ?? [],
          })
          .select('*')
          .single();
        return mapStaff(unwrap(result) as DbRow);
      },
      async update(id: string, data: StaffInput) {
        const result = await supabase
          .from('staff')
          .update({
            name: data.name,
            role: data.role,
            phone: data.phone ?? '',
            email: data.email?.trim().toLowerCase() || null,
            specialties: data.specialties ?? [],
            commission_rate: data.commissionRate,
            branch_id: data.branchId ?? null,
            is_available: data.isAvailable ?? true,
            is_active: data.isActive ?? true,
            service_ids: data.serviceIds ?? [],
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapStaff(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('staff').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
      async schedule(staffId: string): Promise<StaffSchedule[]> {
        const result = await supabase
          .from('staff_schedules')
          .select('*')
          .eq('salon_id', salonId)
          .eq('staff_id', staffId)
          .order('weekday')
          .order('starts_at');
        return (unwrap(result) ?? []).map((row) => mapStaffSchedule(row as DbRow));
      },
      async addSchedule(
        staffId: string,
        data: { weekday: number; startsAt: string; endsAt: string },
      ): Promise<StaffSchedule> {
        const result = await supabase
          .from('staff_schedules')
          .insert({
            salon_id: salonId,
            staff_id: staffId,
            weekday: data.weekday,
            starts_at: data.startsAt,
            ends_at: data.endsAt,
          })
          .select('*')
          .single();
        return mapStaffSchedule(unwrap(result) as DbRow);
      },
      async removeSchedule(id: string): Promise<void> {
        const { error } = await supabase
          .from('staff_schedules')
          .delete()
          .eq('salon_id', salonId)
          .eq('id', id);
        if (error) throwSupabaseError(error);
      },
      async absences(staffId: string): Promise<StaffAbsence[]> {
        const result = await supabase
          .from('staff_absences')
          .select('*')
          .eq('salon_id', salonId)
          .eq('staff_id', staffId)
          .order('starts_on');
        return (unwrap(result) ?? []).map((row) => mapStaffAbsence(row as DbRow));
      },
      async addAbsence(
        staffId: string,
        data: { startsOn: string; endsOn: string; reason?: string },
      ): Promise<StaffAbsence> {
        const result = await supabase
          .from('staff_absences')
          .insert({
            salon_id: salonId,
            staff_id: staffId,
            starts_on: data.startsOn,
            ends_on: data.endsOn,
            reason: data.reason ?? '',
          })
          .select('*')
          .single();
        return mapStaffAbsence(unwrap(result) as DbRow);
      },
      async removeAbsence(id: string): Promise<void> {
        const { error } = await supabase.from('staff_absences').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
  };
}
