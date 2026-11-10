import { mapClient, throwSupabaseError, unwrap } from './shared';
import type { ClientInput, DbRow, SalonApiClient } from './shared';

export async function listClients(supabase: SalonApiClient, salonId: string) {
  const result = await supabase.from('clients').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapClient(row as DbRow));
}
export function createClientsApi(supabase: SalonApiClient, salonId: string) {
  return {
    clients: {
      list: () => listClients(supabase, salonId),
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
  };
}
