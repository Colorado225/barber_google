/**
 * Règles du catalogue de prestations (fonctions pures). Le serveur reste la référence.
 * Montants en FCFA entiers ; durées en minutes entières.
 */
import type { Service } from '../../types';

export type ServiceFields = Pick<
  Service,
  'name' | 'category' | 'description' | 'price' | 'durationMinutes' | 'prepMinutes' | 'popular'
>;

/** Charge utile : préparation absente = 0, mise en avant = booléen. */
export function toServicePayload(service: ServiceFields) {
  return {
    name: service.name,
    category: service.category,
    description: service.description,
    price: service.price,
    durationMinutes: service.durationMinutes,
    prepMinutes: service.prepMinutes ?? 0,
    popular: Boolean(service.popular),
  };
}

export type ServiceCheck = { ok: true } | { ok: false; error: string };

/** Contrôles avant envoi : nom requis, prix et durées entiers, durée strictement positive. */
export function validateServiceFields(service: ServiceFields): ServiceCheck {
  if (!service.name.trim()) {
    return { ok: false, error: 'Le nom de la prestation est requis.' };
  }
  if (!Number.isInteger(service.price) || service.price < 0) {
    return { ok: false, error: 'Le prix doit être un montant entier en FCFA, positif ou nul.' };
  }
  if (!Number.isInteger(service.durationMinutes) || service.durationMinutes <= 0) {
    return { ok: false, error: 'La durée doit être un nombre entier de minutes, supérieur à zéro.' };
  }
  const prep = service.prepMinutes ?? 0;
  if (!Number.isInteger(prep) || prep < 0) {
    return {
      ok: false,
      error: 'Le temps de préparation doit être un nombre entier de minutes, positif ou nul.',
    };
  }
  return { ok: true };
}
