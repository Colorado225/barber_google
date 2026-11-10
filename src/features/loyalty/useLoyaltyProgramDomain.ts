import { useMemo, useState } from 'react';
import { salonApi, ApiError } from '../../lib/api';
import type {
  Client,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltySettings,
  LoyaltyTransaction,
  Salon,
} from '../../types';
import {
  adjustLoyaltyPoints,
  fetchLoyaltySnapshot,
  redeemLoyaltyReward,
  saveLoyaltyProgram,
} from './loyaltyCommands';
import { toLoyaltyTransactions } from './loyaltyRules';

export interface LoyaltyProgramDomainDeps {
  hasPermission: (permission: string, salonId?: string) => boolean;
  requireActiveSalon: () => Salon;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeSalonId: string;
  /** Lus pour résoudre le nom des clients dans le journal ; l'état reste dans le contexte. */
  clients: Client[];
  /** Recharge l'espace après un échange de points (la liste des clients change). */
  reloadWorkspace: (salonId: string) => Promise<void>;
}

/**
 * Domaine fidélité : programme, soldes, journal, échanges et ajustements de points. Soldes et journal sont
 * tenus par la base et lus seulement ; le client n'en calcule aucun.
 */
export function useLoyaltyProgramDomain({
  hasPermission,
  requireActiveSalon,
  addToast,
  activeSalonId,
  clients,
  reloadWorkspace,
}: LoyaltyProgramDomainDeps) {
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccount[]>([]);
  const [loyaltyLedger, setLoyaltyLedger] = useState<LoyaltyLedgerEntry[]>([]);

  // Journal réel relu depuis Supabase ; le nom du client est résolu localement.
  const loyaltyTransactions = useMemo<LoyaltyTransaction[]>(
    () => toLoyaltyTransactions(loyaltyLedger, clients),
    [loyaltyLedger, clients],
  );

  const loadLoyalty = async (salonId: string) => {
    const snapshot = await fetchLoyaltySnapshot(
      () => salonApi(salonId).loyalty,
      hasPermission('loyalty.read', salonId),
    );
    if (!snapshot.readable) {
      setLoyaltyAccounts([]);
      setLoyaltyLedger([]);
      return;
    }
    setLoyaltySettings(snapshot.program);
    setLoyaltyAccounts(snapshot.accounts);
    setLoyaltyLedger(snapshot.ledger);
  };

  const updateLoyaltySettings = async (updates: Partial<LoyaltySettings>) => {
    const salonId = requireActiveSalon().id;
    try {
      const saved = await saveLoyaltyProgram(salonApi(salonId).loyalty, updates);
      setLoyaltySettings(saved);
      await loadLoyalty(salonId);
      addToast('Programme de fidélité enregistré.', 'success');
    } catch (error) {
      addToast(
        error instanceof ApiError ? error.message : 'Enregistrement du programme impossible.',
        'error',
      );
    }
  };

  const redeemRewardForClient = async (
    clientId: string,
    rewardId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const salonId = requireActiveSalon().id;
    try {
      const result = await redeemLoyaltyReward(salonApi(salonId).loyalty, clientId, rewardId);
      await Promise.all([loadLoyalty(salonId), reloadWorkspace(salonId)]);
      addToast(`Récompense utilisée. Nouveau solde : ${result.points_balance} points.`, 'success');
      return { success: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Utilisation de la récompense impossible.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const creditPointsToClient = async (clientId: string, points: number, reason: string) => {
    const salonId = requireActiveSalon().id;
    try {
      const result = await adjustLoyaltyPoints(salonApi(salonId).loyalty, clientId, points, reason);
      await loadLoyalty(salonId);
      addToast(`Solde ajusté : ${result.points_balance} points.`, 'success');
    } catch (error) {
      addToast(error instanceof ApiError ? error.message : 'Ajustement des points impossible.', 'error');
    }
  };

  const refreshLoyalty = async () => {
    if (!activeSalonId) return;
    await loadLoyalty(activeSalonId);
  };

  return {
    loyaltySettings,
    loyaltyAccounts,
    loyaltyLedger,
    loyaltyTransactions,
    loadLoyalty,
    updateLoyaltySettings,
    redeemRewardForClient,
    creditPointsToClient,
    refreshLoyalty,
  };
}
