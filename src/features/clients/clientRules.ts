/**
 * Règles de la fiche client (fonctions pures). Le serveur reste la référence.
 */
import type { Client } from '../../types';

export type ClientFields = Pick<Client, 'name' | 'phone' | 'segment' | 'favoriteService' | 'notes'> & {
  email?: string;
};

/** Charge utile : l'e-mail facultatif devient une chaîne vide, comme avant. */
export function toClientPayload(client: ClientFields) {
  return {
    name: client.name,
    phone: client.phone,
    email: client.email || '',
    segment: client.segment,
    favoriteService: client.favoriteService,
    notes: client.notes,
  };
}
