/**
 * Règles du stock (fonctions pures). Le serveur reste la référence : ces règles évitent un aller-retour inutile.
 *
 * Décision D11 : les quantités sont des entiers (colonne `stock_items.quantity integer`, bornes 0 à 1 000 000).
 * Les unités fractionnaires (kg, litres) ne sont pas gérées ; une quantité décimale est refusée avant l'envoi.
 */
import type { StockItem } from '../../types';

export type StockPayload = Pick<
  StockItem,
  'name' | 'category' | 'quantity' | 'minThreshold' | 'unitCost' | 'supplier'
>;

export type StockPlan = { ok: true; value: number } | { ok: false; error: string };

/** Miroir de la contrainte SQL `check (quantity between 0 and 1000000)`. */
export const MAX_STOCK_QUANTITY = 1_000_000;

const QUANTITY_ERROR = 'La quantité doit être un nombre entier entre 0 et 1 000 000.';

/** Valide une quantité absolue (création, seuil) : entier, sans décimale, dans les bornes de la base. */
export function planStockQuantity(value: number): StockPlan {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_STOCK_QUANTITY) {
    return { ok: false, error: QUANTITY_ERROR };
  }
  return { ok: true, value };
}

/**
 * Nouvelle quantité après un ajustement. Refuse un delta non entier, une quantité négative
 * et une quantité au-delà de la borne de la base.
 */
export function planStockAdjustment(item: Pick<StockItem, 'quantity'>, delta: number): StockPlan {
  if (!Number.isSafeInteger(delta)) {
    return { ok: false, error: 'Ajustement invalide : la quantité doit être un nombre entier.' };
  }
  const quantity = item.quantity + delta;
  if (quantity < 0) {
    return { ok: false, error: 'La quantité ne peut pas être négative.' };
  }
  if (quantity > MAX_STOCK_QUANTITY) {
    return { ok: false, error: 'La quantité dépasse la limite de 1 000 000.' };
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
