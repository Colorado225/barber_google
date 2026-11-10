/**
 * Règles de lecture de la fidélité (fonctions pures, sans React ni réseau).
 */
import type { Client, LoyaltyLedgerEntry, LoyaltyTransaction } from '../../types';

/** Nom affiché quand le client de l'écriture n'est pas (ou plus) dans la liste chargée. */
export const UNKNOWN_CLIENT_NAME = 'Client';

/**
 * Transforme le journal serveur en lignes d'affichage. Le nom et le téléphone du client sont résolus
 * localement à partir de la liste chargée ; le journal lui-même n'est jamais modifié ici.
 */
export function toLoyaltyTransactions(ledger: LoyaltyLedgerEntry[], clients: Client[]): LoyaltyTransaction[] {
  const byId = new Map(clients.map((client) => [client.id, client]));
  return ledger.map((entry) => {
    const client = byId.get(entry.clientId);
    return {
      id: entry.id,
      salonId: entry.salonId,
      clientId: entry.clientId,
      clientName: client?.name ?? UNKNOWN_CLIENT_NAME,
      clientPhone: client?.phone,
      points: entry.points,
      type: entry.kind,
      description: entry.reason,
      rewardId: entry.rewardId ?? undefined,
      appointmentId: entry.appointmentId ?? undefined,
      createdAt: entry.createdAt,
    };
  });
}
