import { mapService, throwSupabaseError, unwrap } from './shared';
import type { DbRow, SalonApiClient, ServiceInput } from './shared';

export async function listServices(supabase: SalonApiClient, salonId: string, all = false) {
  let query = supabase.from('services').select('*').eq('salon_id', salonId);
  if (!all) query = query.eq('is_active', true);
  const result = await query.order('name');
  return (unwrap(result) ?? []).map((row) => mapService(row as DbRow));
}
export function createServicesApi(supabase: SalonApiClient, salonId: string) {
  return {
    services: {
      list: () => listServices(supabase, salonId),
      listAll: () => listServices(supabase, salonId, true),
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
  };
}
