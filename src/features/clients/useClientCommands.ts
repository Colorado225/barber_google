import { salonApi } from '../../lib/api';
import type { Client, Salon } from '../../types';
import { toClientPayload } from './clientRules';

export interface ClientCommandsDeps {
  requireActiveSalon: () => Salon;
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  /** L'état reste dans le contexte : il alimente la fidélité (`loyaltyTransactions`). */
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

/** Commandes de la fiche client, sur un état fourni par le contexte. */
export function useClientCommands({
  requireActiveSalon,
  remote,
  addToast,
  clients,
  setClients,
}: ClientCommandsDeps) {
  const addClient = (data: Omit<Client, 'id' | 'totalSpent' | 'visitsCount' | 'lastVisit'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).clients.create(toClientPayload(data));
      setClients((prev) => [created, ...prev]);
      addToast(`Client ${created.name} ajouté au CRM !`, 'success');
    }, 'Ajout du client impossible');
  };

  const updateClientNotes = (clientId: string, notes: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).clients.update(
        clientId,
        toClientPayload({ ...client, notes }),
      );
      setClients((prev) => prev.map((c) => (c.id === clientId ? saved : c)));
      addToast('Fiche client mise à jour.', 'success');
    }, 'Mise à jour de la note impossible');
  };

  const updateClient = (clientId: string, updates: Partial<Client>) => {
    void remote(async () => {
      const current = clients.find((c) => c.id === clientId);
      if (!current) return;
      const saved = await salonApi(requireActiveSalon().id).clients.update(
        clientId,
        toClientPayload({ ...current, ...updates }),
      );
      setClients((prev) => prev.map((c) => (c.id === clientId ? saved : c)));
      addToast('Client mis à jour.', 'success');
    }, 'Modification du client impossible');
  };

  const deleteClient = (clientId: string) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).clients.remove(clientId);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      addToast('Client supprimé.', 'info');
    }, 'Suppression du client impossible');
  };

  return { addClient, updateClientNotes, updateClient, deleteClient };
}
