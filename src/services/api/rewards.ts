import { mapReward, throwSupabaseError, unwrap } from './shared';
import type { DbRow, RewardInput, SalonApiClient } from './shared';

export async function listRewards(supabase: SalonApiClient, salonId: string) {
  const result = await supabase.from('rewards').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapReward(row as DbRow));
}
export function createRewardsApi(supabase: SalonApiClient, salonId: string) {
  return {
    rewards: {
      list: () => listRewards(supabase, salonId),
      async create(data: RewardInput) {
        const result = await supabase
          .from('rewards')
          .insert({
            salon_id: salonId,
            name: data.name,
            description: data.description ?? '',
            points_cost: data.pointsCost,
            category: data.category,
            discount_percentage: data.discountPercentage ?? null,
            free_service_name: data.freeServiceName ?? null,
            is_active: data.isActive ?? true,
          })
          .select('*')
          .single();
        return mapReward(unwrap(result) as DbRow);
      },
      async update(id: string, data: RewardInput) {
        const result = await supabase
          .from('rewards')
          .update({
            name: data.name,
            description: data.description ?? '',
            points_cost: data.pointsCost,
            category: data.category,
            discount_percentage: data.discountPercentage ?? null,
            free_service_name: data.freeServiceName ?? null,
            is_active: data.isActive ?? true,
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapReward(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('rewards').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
  };
}
