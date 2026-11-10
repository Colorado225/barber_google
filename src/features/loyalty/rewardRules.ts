/**
 * Règles du catalogue de récompenses de fidélité (fonctions pures).
 */
import type { LoyaltyReward } from '../../types';

export type RewardFields = Pick<
  LoyaltyReward,
  'name' | 'description' | 'pointsCost' | 'category' | 'discountPercentage' | 'freeServiceName' | 'isActive'
>;

/** Charge utile d'une récompense : les sept champs éditables, sans identifiant ni dates serveur. */
export function toRewardPayload(reward: RewardFields): RewardFields {
  return {
    name: reward.name,
    description: reward.description,
    pointsCost: reward.pointsCost,
    category: reward.category,
    discountPercentage: reward.discountPercentage,
    freeServiceName: reward.freeServiceName,
    isActive: reward.isActive,
  };
}

/** Fusion d'une mise à jour partielle sur la récompense existante. */
export function mergeRewardUpdate(current: LoyaltyReward, updates: Partial<LoyaltyReward>): LoyaltyReward {
  return { ...current, ...updates };
}
