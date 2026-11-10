import { useState } from 'react';
import { salonApi } from '../../lib/api';
import type { Salon, StockItem } from '../../types';
import { planStockAdjustment, toStockPayload } from './stockRules';

export interface StockDomainDeps {
  requireActiveSalon: () => Salon;
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Domaine stock : état local des produits et commandes d'écriture. Les noms exposés sont ceux du contexte,
 * pour que `AppContext` puisse les déstructurer sans modifier les composants.
 * L'état initial est vide, comme `INITIAL_STOCKS`.
 */
export function useStockDomain({ requireActiveSalon, remote, addToast }: StockDomainDeps) {
  const [stocks, setStocks] = useState<StockItem[]>([]);

  const addStockItem = (data: Omit<StockItem, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).stock.create({
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        minThreshold: data.minThreshold,
        unitCost: data.unitCost,
        supplier: data.supplier,
      });
      setStocks((prev) => [...prev, created]);
      addToast(`Produit ${created.name} ajouté au stock`, 'success');
    }, 'Ajout du produit impossible');
  };

  const adjustStockQuantity = (id: string, delta: number) => {
    const item = stocks.find((entry) => entry.id === id);
    if (!item) {
      addToast('Produit introuvable.', 'error');
      return;
    }
    const plan = planStockAdjustment(item, delta);
    if (!plan.ok) {
      addToast(plan.error, 'error');
      return;
    }
    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).stock.update(
        id,
        toStockPayload({ ...item, quantity: plan.value }),
      );
      setStocks((prev) => prev.map((entry) => (entry.id === id ? saved : entry)));
      addToast('Stock ajusté.', 'info');
    }, 'Ajustement du stock impossible');
  };

  return { stocks, setStocks, addStockItem, adjustStockQuantity };
}
