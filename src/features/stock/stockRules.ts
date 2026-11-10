/**
 * Règles du stock (fonctions pures). Le serveur reste la référence : ces règles évitent un aller-retour inutile.
 */
import type { StockItem } from '../../types';

export type StockPayload = Pick<
  StockItem,
  'name' | 'category' | 'quantity' | 'minThreshold' | 'unitCost' | 'supplier'
>;

export type StockPlan = { ok: true; value: number } | { ok: false; error: string };

/**
 * Nouvelle quantité après un ajustement. Refuse un delta non fini et une quantité négative.
 * Les quantités peuvent être fractionnaires (kg, litres) : aucune contrainte d'entier n'est imposée ici.
 */
export function planStockAdjustment(item: Pick<StockItem, 'quantity'>, delta: number): StockPlan {
  if (!Number.isFinite(delta)) {
    return { ok: false, error: 'Ajustement invalide.' };
  }
  const quantity = item.quantity + delta;
  if (quantity < 0) {
    return { ok: false, error: 'La quantité ne peut pas être négative.' };
  }
  return { ok: true, value: quantity };
}

/** Charge utile envoyée à l'API pour une mise à jour : seuls les six champs éditables. */
export function toStockPayload(item: StockPayload): StockPayload {
  return {
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    minThreshold: item.minThreshold,
    unitCost: item.unitCost,
    supplier: item.supplier,
  };
}
