import {
  mapLoyaltyAccount,
  mapLoyaltyLedgerEntry,
  mapLoyaltyProgram,
  throwSupabaseError,
  unwrap,
} from './shared';
import type { DbRow, SalonApiClient } from './shared';
import type { LoyaltyAccount, LoyaltyLedgerEntry, LoyaltySettings } from '../../types';

export function createLoyaltyApi(supabase: SalonApiClient, salonId: string) {
  return {
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
