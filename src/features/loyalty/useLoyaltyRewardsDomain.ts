import { useState } from 'react';
import { salonApi } from '../../lib/api';
import type { LoyaltyReward, Salon } from '../../types';
import { mergeRewardUpdate, toRewardPayload } from './rewardRules';

export interface LoyaltyRewardsDomainDeps {
  requireActiveSalon: () => Salon;
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Domaine catalogue de récompenses : ajout, modification et suppression. Les échanges de points et les
 * comptes fidélité restent dans le contexte (ils dépendent du chargement et des permissions).
 */
export function useLoyaltyRewardsDomain({ requireActiveSalon, remote, addToast }: LoyaltyRewardsDomainDeps) {
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);

  const addLoyaltyReward = (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).rewards.create(toRewardPayload(reward));
      setLoyaltyRewards((prev) => [created, ...prev]);
      addToast(`Récompense "${created.name}" ajoutée au catalogue !`, 'success');
    }, 'Ajout de la récompense impossible');
  };

  const updateLoyaltyReward = (id: string, updates: Partial<LoyaltyReward>) => {
    void remote(async () => {
      const current = loyaltyRewards.find((r) => r.id === id);
      if (!current) return;
      const saved = await salonApi(requireActiveSalon().id).rewards.update(
        id,
        toRewardPayload(mergeRewardUpdate(current, updates)),
      );
      setLoyaltyRewards((prev) => prev.map((r) => (r.id === id ? saved : r)));
      addToast('Récompense mise à jour.', 'success');
    }, 'Modification de la récompense impossible');
  };

  const deleteLoyaltyReward = (id: string) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).rewards.remove(id);
      setLoyaltyRewards((prev) => prev.filter((r) => r.id !== id));
      addToast('Récompense supprimée.', 'info');
    }, 'Suppression de la récompense impossible');
  };

  return { loyaltyRewards, setLoyaltyRewards, addLoyaltyReward, updateLoyaltyReward, deleteLoyaltyReward };
}
