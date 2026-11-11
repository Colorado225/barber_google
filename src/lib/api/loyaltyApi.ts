// Domaine fidélité : récompenses, programme et journal de points
// (extrait de l'ancien src/lib/api.ts monolithique).
import type { LoyaltyAccount, LoyaltyLedgerEntry, LoyaltySettings } from '../../types';
import type { RewardInput } from './inputs';
import type { DbRow, SalonApiDeps } from './internal';
import { throwSupabaseError, unwrap } from './internal';
import { mapLoyaltyAccount, mapLoyaltyLedgerEntry, mapLoyaltyProgram, mapReward } from './mappers';

export async function listRewards(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  const result = await supabase.from('rewards').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapReward(row as DbRow));
}

export function createLoyaltyApi(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  return {
    rewards: {
      list: () => listRewards(deps),
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
    loyalty: {
      async program(): Promise<LoyaltySettings> {
        const result = await supabase
          .from('loyalty_programs')
          .select('*')
          .eq('salon_id', salonId)
          .maybeSingle();
        if (result.error) throwSupabaseError(result.error);
        return mapLoyaltyProgram(salonId, (result.data as DbRow | null) ?? null);
      },
      async setProgram(settings: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
        const payload: Record<string, unknown> = {};
        if (settings.programEnabled !== undefined) payload.is_enabled = settings.programEnabled;
        if (settings.pointsPer100Fcfa !== undefined) payload.points_per_100_xof = settings.pointsPer100Fcfa;
        if (settings.welcomeBonus !== undefined) payload.welcome_bonus = settings.welcomeBonus;
        if (settings.silverThreshold !== undefined) payload.silver_threshold = settings.silverThreshold;
        if (settings.goldThreshold !== undefined) payload.gold_threshold = settings.goldThreshold;
        if (settings.vipThreshold !== undefined) payload.vip_threshold = settings.vipThreshold;
        const result = await supabase.rpc('set_loyalty_program', {
          p_salon_id: salonId,
          p_settings: payload,
        });
        return mapLoyaltyProgram(salonId, unwrap(result) as DbRow);
      },
      async accounts(): Promise<LoyaltyAccount[]> {
        const result = await supabase
          .from('loyalty_accounts')
          .select('*')
          .eq('salon_id', salonId)
          .order('points_balance', { ascending: false });
        return (unwrap(result) ?? []).map((row) => mapLoyaltyAccount(row as DbRow));
      },
      async ledger(limit = 100): Promise<LoyaltyLedgerEntry[]> {
        const result = await supabase
          .from('loyalty_transactions')
          .select('*')
          .eq('salon_id', salonId)
          .order('created_at', { ascending: false })
          .limit(limit);
        return (unwrap(result) ?? []).map((row) => mapLoyaltyLedgerEntry(row as DbRow));
      },
      async redeem(clientId: string, rewardId: string) {
        const result = await supabase.rpc('redeem_loyalty_reward', {
          p_salon_id: salonId,
          p_client_id: clientId,
          p_reward_id: rewardId,
        });
        return unwrap(result) as {
          transaction_id: string;
          points_balance: number;
          tier: string;
          reward_name: string;
        };
      },
      async adjust(clientId: string, points: number, reason: string) {
        const result = await supabase.rpc('adjust_loyalty_points', {
          p_salon_id: salonId,
          p_client_id: clientId,
          p_points: points,
          p_reason: reason,
        });
        return unwrap(result) as { transaction_id: string; points_balance: number; tier: string };
      },
    },
  };
}
