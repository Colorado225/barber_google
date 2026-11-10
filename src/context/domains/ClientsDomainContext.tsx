import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type {
  Client,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltyReward,
  LoyaltySettings,
  LoyaltyTransaction,
} from '../../types';
import { getApiErrorMessage } from '../../lib/apiError';
import type { DomainSharedDeps } from './shared';

export interface ClientsDomainValue {
  clients: Client[];
  loyaltyRewards: LoyaltyReward[];
  loyaltyTransactions: LoyaltyTransaction[];
  loyaltyAccounts: LoyaltyAccount[];
  loyaltyLedger: LoyaltyLedgerEntry[];
  loyaltySettings: LoyaltySettings | null;
  refreshLoyalty: () => Promise<void>;
  addLoyaltyReward: (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => void;
  updateLoyaltyReward: (id: string, updates: Partial<LoyaltyReward>) => void;
  deleteLoyaltyReward: (id: string) => void;
  updateLoyaltySettings: (updates: Partial<LoyaltySettings>) => Promise<void>;
  redeemRewardForClient: (
    clientId: string,
    rewardId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  creditPointsToClient: (clientId: string, points: number, reason: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'totalSpent' | 'visitsCount' | 'lastVisit'>) => void;
  updateClientNotes: (clientId: string, notes: string) => void;
  updateClient: (clientId: string, updates: Partial<Client>) => void;
  deleteClient: (clientId: string) => void;
}

export const ClientsDomainContext = createContext<ClientsDomainValue | undefined>(undefined);

export function useClientsDomain(): ClientsDomainValue {
  const ctx = useContext(ClientsDomainContext);
  if (!ctx) throw new Error('useClientsDomain must be used within an AppProvider');
  return ctx;
}

export function useClientsDomainState(
  deps: Pick<
    DomainSharedDeps,
    | 'resolveApi'
    | 'domainCache'
    | 'activeSalonId'
    | 'requireActiveSalon'
    | 'hasPermissionRef'
    | 'addToast'
    | 'remote'
  > & {
    reloadWorkspace: (salonId: string) => Promise<void>;
  },
) {
  const {
    resolveApi,
    domainCache,
    activeSalonId,
    requireActiveSalon,
    hasPermissionRef,
    addToast,
    remote,
    reloadWorkspace,
  } = deps;

  const [clients, setClients] = useState<Client[]>([]);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccount[]>([]);
  const [loyaltyLedger, setLoyaltyLedger] = useState<LoyaltyLedgerEntry[]>([]);

  const loyaltyTransactions = useMemo<LoyaltyTransaction[]>(() => {
    const byId = new Map(clients.map((client) => [client.id, client]));
    return loyaltyLedger.map((entry) => {
      const client = byId.get(entry.clientId);
      return {
        id: entry.id,
        salonId: entry.salonId,
        clientId: entry.clientId,
        clientName: client?.name ?? 'Client',
        clientPhone: client?.phone,
        points: entry.points,
        type: entry.kind,
        description: entry.reason,
        rewardId: entry.rewardId ?? undefined,
        appointmentId: entry.appointmentId ?? undefined,
        createdAt: entry.createdAt,
      };
    });
  }, [loyaltyLedger, clients]);

  const loadLoyalty = useCallback(
    async (salonId: string, isGuardActive?: () => boolean, options?: { force?: boolean }) => {
      if (!hasPermissionRef.current('loyalty.read', salonId)) {
        if (!isGuardActive || isGuardActive()) {
          setLoyaltySettings(null);
          setLoyaltyAccounts([]);
          setLoyaltyLedger([]);
        }
        return;
      }

      const data = await domainCache.getOrLoad(
        salonId,
        'loyalty',
        async () => {
          const api = await resolveApi(salonId);
          const [program, accounts, ledger] = await Promise.all([
            api.loyalty.program(),
            api.loyalty.accounts(),
            api.loyalty.ledger(150),
          ]);
          return { program, accounts, ledger };
        },
        { force: options?.force ?? true },
      );

      if (isGuardActive && !isGuardActive()) return;
      setLoyaltySettings(data.program);
      setLoyaltyAccounts(data.accounts);
      setLoyaltyLedger(data.ledger);
    },
    [resolveApi, domainCache, hasPermissionRef],
  );

  const refreshLoyalty = useCallback(async () => {
    if (!activeSalonId) return;
    await loadLoyalty(activeSalonId, undefined, { force: true });
  }, [activeSalonId, loadLoyalty]);

  const addLoyaltyReward = useCallback(
    (reward: Omit<LoyaltyReward, 'id' | 'timesRedeemed' | 'createdAt'>) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const created = await api.rewards.create({
          name: reward.name,
          description: reward.description,
          pointsCost: reward.pointsCost,
          category: reward.category,
          discountPercentage: reward.discountPercentage,
          freeServiceName: reward.freeServiceName,
          isActive: reward.isActive,
        });
        setLoyaltyRewards((prev) => [created, ...prev]);
        domainCache.invalidate(salonId, 'workspace');
        addToast(`Récompense "${created.name}" ajoutée au catalogue !`, 'success');
      }, 'Ajout de la récompense impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const updateLoyaltyReward = useCallback(
    (id: string, updates: Partial<LoyaltyReward>) => {
      void remote(async () => {
        const current = loyaltyRewards.find((r) => r.id === id);
        if (!current) return;
        const salonId = requireActiveSalon().id;
        const merged = { ...current, ...updates };
        const api = await resolveApi(salonId);
        const saved = await api.rewards.update(id, {
          name: merged.name,
          description: merged.description,
          pointsCost: merged.pointsCost,
          category: merged.category,
          discountPercentage: merged.discountPercentage,
          freeServiceName: merged.freeServiceName,
          isActive: merged.isActive,
        });
        setLoyaltyRewards((prev) => prev.map((r) => (r.id === id ? saved : r)));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Récompense mise à jour.', 'success');
      }, 'Modification de la récompense impossible');
    },
    [remote, loyaltyRewards, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const deleteLoyaltyReward = useCallback(
    (id: string) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        await api.rewards.remove(id);
        setLoyaltyRewards((prev) => prev.filter((r) => r.id !== id));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Récompense supprimée.', 'info');
      }, 'Suppression de la récompense impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const updateLoyaltySettings = useCallback(
    async (updates: Partial<LoyaltySettings>) => {
      const salonId = requireActiveSalon().id;
      try {
        const api = await resolveApi(salonId);
        const saved = await api.loyalty.setProgram(updates);
        setLoyaltySettings(saved);
        domainCache.invalidate(salonId, 'loyalty');
        await loadLoyalty(salonId, undefined, { force: true });
        addToast('Programme de fidélité enregistré.', 'success');
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Enregistrement du programme impossible.'), 'error');
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadLoyalty, addToast],
  );

  const redeemRewardForClient = useCallback(
    async (clientId: string, rewardId: string): Promise<{ success: boolean; error?: string }> => {
      const salonId = requireActiveSalon().id;
      try {
        const api = await resolveApi(salonId);
        const result = await api.loyalty.redeem(clientId, rewardId);
        domainCache.invalidate(salonId, 'loyalty');
        domainCache.invalidate(salonId, 'workspace');
        await Promise.all([loadLoyalty(salonId, undefined, { force: true }), reloadWorkspace(salonId)]);
        addToast(`Récompense utilisée. Nouveau solde : ${result.points_balance} points.`, 'success');
        return { success: true };
      } catch (error) {
        const message = getApiErrorMessage(error, 'Utilisation de la récompense impossible.');
        addToast(message, 'error');
        return { success: false, error: message };
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadLoyalty, reloadWorkspace, addToast],
  );

  const creditPointsToClient = useCallback(
    async (clientId: string, points: number, reason: string) => {
      const salonId = requireActiveSalon().id;
      try {
        const api = await resolveApi(salonId);
        const result = await api.loyalty.adjust(clientId, points, reason);
        domainCache.invalidate(salonId, 'loyalty');
        await loadLoyalty(salonId, undefined, { force: true });
        addToast(`Solde ajusté : ${result.points_balance} points.`, 'success');
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Ajustement des points impossible.'), 'error');
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadLoyalty, addToast],
  );

  const addClient = useCallback(
    (data: Omit<Client, 'id' | 'totalSpent' | 'visitsCount' | 'lastVisit'>) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const created = await api.clients.create({
          name: data.name,
          phone: data.phone,
          email: data.email || '',
          segment: data.segment,
          favoriteService: data.favoriteService,
          notes: data.notes,
        });
        setClients((prev) => [created, ...prev]);
        domainCache.invalidate(salonId, 'workspace');
        addToast(`Client ${created.name} ajouté au CRM !`, 'success');
      }, 'Ajout du client impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const updateClientNotes = useCallback(
    (clientId: string, notes: string) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.clients.update(clientId, {
          name: client.name,
          phone: client.phone,
          email: client.email || '',
          segment: client.segment,
          favoriteService: client.favoriteService,
          notes,
        });
        setClients((prev) => prev.map((c) => (c.id === clientId ? saved : c)));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Fiche client mise à jour.', 'success');
      }, 'Mise à jour de la note impossible');
    },
    [clients, remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const updateClient = useCallback(
    (clientId: string, updates: Partial<Client>) => {
      void remote(async () => {
        const current = clients.find((c) => c.id === clientId);
        if (!current) return;
        const salonId = requireActiveSalon().id;
        const merged = { ...current, ...updates };
        const api = await resolveApi(salonId);
        const saved = await api.clients.update(clientId, {
          name: merged.name,
          phone: merged.phone,
          email: merged.email || '',
          segment: merged.segment,
          favoriteService: merged.favoriteService,
          notes: merged.notes,
        });
        setClients((prev) => prev.map((c) => (c.id === clientId ? saved : c)));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Client mis à jour.', 'success');
      }, 'Modification du client impossible');
    },
    [clients, remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const deleteClient = useCallback(
    (clientId: string) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        await api.clients.remove(clientId);
        setClients((prev) => prev.filter((c) => c.id !== clientId));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Client supprimé.', 'info');
      }, 'Suppression du client impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const resetClientsDomain = useCallback(() => {
    setClients([]);
    setLoyaltyRewards([]);
    setLoyaltySettings(null);
    setLoyaltyAccounts([]);
    setLoyaltyLedger([]);
  }, []);

  return {
    clients,
    setClients,
    loyaltyRewards,
    setLoyaltyRewards,
    loyaltySettings,
    loyaltyAccounts,
    loyaltyLedger,
    loyaltyTransactions,
    loadLoyalty,
    refreshLoyalty,
    addLoyaltyReward,
    updateLoyaltyReward,
    deleteLoyaltyReward,
    updateLoyaltySettings,
    redeemRewardForClient,
    creditPointsToClient,
    addClient,
    updateClientNotes,
    updateClient,
    deleteClient,
    resetClientsDomain,
  };
}
