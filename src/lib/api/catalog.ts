// Référentiel salon : clients, prestations, succursales, équipe et avis
// (extrait de l'ancien src/lib/api.ts monolithique).
import type { ErpBranch, Review } from '../../types';
import type {
  ClientInput,
  ReviewInput,
  ServiceInput,
  StaffAbsence,
  StaffInput,
  StaffSchedule,
} from './inputs';
import type { DbRow, SalonApiDeps } from './internal';
import { throwSupabaseError, unwrap } from './internal';
import { mapClient, mapReview, mapService, mapStaff, mapStaffAbsence, mapStaffSchedule } from './mappers';

export async function listClients(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  const result = await supabase.from('clients').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapClient(row as DbRow));
}

export async function listServices(deps: SalonApiDeps, all = false) {
  const { supabase, salonId } = deps;
  let query = supabase.from('services').select('*').eq('salon_id', salonId);
  if (!all) query = query.eq('is_active', true);
  const result = await query.order('name');
  return (unwrap(result) ?? []).map((row) => mapService(row as DbRow));
}

export async function listStaff(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  const result = await supabase.from('staff').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapStaff(row as DbRow));
}

export async function listReviews(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  const result = await supabase
    .from('reviews')
    .select('*')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false });
  return (unwrap(result) ?? []).map((row) => mapReview(row as DbRow));
}

export function createCatalogApi(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  return {
    clients: {
      list: () => listClients(deps),
      async create(data: ClientInput) {
        const result = await supabase
          .from('clients')
          .insert({
            salon_id: salonId,
            name: data.name,
            phone: data.phone,
            email: data.email?.trim().toLowerCase() || null,
            segment: data.segment ?? 'new',
            favorite_service: data.favoriteService ?? '',
            notes: data.notes ?? '',
          })
          .select('*')
          .single();
        return mapClient(unwrap(result) as DbRow);
      },
      async update(id: string, data: ClientInput) {
        const result = await supabase
          .from('clients')
          .update({
            name: data.name,
            phone: data.phone,
            email: data.email?.trim().toLowerCase() || null,
            segment: data.segment ?? 'new',
            favorite_service: data.favoriteService ?? '',
            notes: data.notes ?? '',
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapClient(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('clients').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
    services: {
      list: () => listServices(deps),
      listAll: () => listServices(deps, true),
      async create(data: ServiceInput) {
        const result = await supabase
          .from('services')
          .insert({
            salon_id: salonId,
            name: data.name,
            category: data.category,
            description: data.description ?? '',
            price: data.price,
            duration_minutes: data.durationMinutes,
            prep_minutes: data.prepMinutes ?? 0,
            popular: data.popular ?? false,
            is_active: data.isActive ?? true,
          })
          .select('*')
          .single();
        return mapService(unwrap(result) as DbRow);
      },
      async update(id: string, data: ServiceInput) {
        const result = await supabase
          .from('services')
          .update({
            name: data.name,
            category: data.category,
            description: data.description ?? '',
            price: data.price,
            duration_minutes: data.durationMinutes,
            prep_minutes: data.prepMinutes ?? 0,
            popular: data.popular ?? false,
            is_active: data.isActive ?? true,
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapService(unwrap(result) as DbRow);
      },
      async setActive(id: string, isActive: boolean) {
        const { error } = await supabase
          .from('services')
          .update({ is_active: isActive })
          .eq('salon_id', salonId)
          .eq('id', id);
        if (error) throwSupabaseError(error);
      },
      async remove(id: string) {
        return this.setActive(id, false);
      },
    },
    branches: {
      async list() {
        const result = await supabase
          .from('branches')
          .select('id, name, timezone')
          .eq('salon_id', salonId)
          .order('created_at');
        return (unwrap(result) ?? []) as ErpBranch[];
      },
    },
    staff: {
      list: () => listStaff(deps),
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
    reviews: {
      list: () => listReviews(deps),
      async create(data: ReviewInput): Promise<Review> {
        const result = await supabase.rpc('create_review', {
          p_salon_id: salonId,
          p_author: data.author,
          p_rating: data.rating,
          p_comment: data.comment,
          p_appointment_id: data.appointmentId ?? null,
        });
        return mapReview(unwrap(result) as DbRow);
      },
      async remove(id: string): Promise<void> {
        const { error } = await supabase.rpc('delete_review', {
          p_salon_id: salonId,
          p_review_id: id,
        });
        if (error) throwSupabaseError(error);
      },
    },
  };
}
