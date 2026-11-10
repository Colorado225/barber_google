// Opérations stock du domaine finance : fiches produits, fournisseurs et
// mouvements historisés. L'état (stocks/stockMovements/suppliers) et le
// rechargement restent la propriété de useFinanceDomainState — aucune
// seconde source de vérité n'est créée ici.
import { useCallback } from 'react';
import type React from 'react';
import type { StockItem, StockMovement, StockMovementType, Supplier } from '../../../types';
import { getApiErrorMessage } from '../../../lib/apiError';
import type { DomainSharedDeps } from '../shared';
import type { LoadFinanceFn } from './financeShared';

export interface StockOperationsDeps extends Pick<
  DomainSharedDeps,
  'resolveApi' | 'requireActiveSalon' | 'domainCache' | 'memberships' | 'remote' | 'addToast'
> {
  stocks: StockItem[];
  setStocks: React.Dispatch<React.SetStateAction<StockItem[]>>;
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  loadFinance: LoadFinanceFn;
}

export interface StockOperationsValue {
  upsertSupplier: (input: {
    id?: string | null;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string | null;
    address?: string;
    notes?: string;
    isActive?: boolean;
  }) => Promise<Supplier>;
  addStockItem: (
    item: Omit<StockItem, 'id'> & { reason?: string; branchId?: string | null },
  ) => Promise<StockItem | void>;
  updateStockItemMetadata: (id: string, item: Omit<StockItem, 'id' | 'quantity'>) => Promise<StockItem>;
  recordStockMovement: (input: {
    stockItemId: string;
    movementType: Exclude<StockMovementType, 'initial'>;
    quantityDelta: number;
    reason: string;
    branchId?: string | null;
    supplierId?: string | null;
    unitCost?: number | null;
    reference?: string | null;
    appointmentId?: string | null;
  }) => Promise<StockMovement>;
  adjustStockQuantity: (
    id: string,
    delta: number,
    reason?: string,
    movementType?: Exclude<StockMovementType, 'initial'>,
  ) => void;
}

export function useStockOperations(deps: StockOperationsDeps): StockOperationsValue {
  const {
    resolveApi,
    requireActiveSalon,
    domainCache,
    memberships,
    remote,
    addToast,
    stocks,
    setStocks,
    setSuppliers,
    loadFinance,
  } = deps;

  const upsertSupplier = useCallback(
    async (input: {
      id?: string | null;
      name: string;
      contactName?: string;
      phone?: string;
      email?: string | null;
      address?: string;
      notes?: string;
      isActive?: boolean;
    }): Promise<Supplier> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.suppliers.upsert(input);
        setSuppliers((prev) => {
          const exists = prev.some((s) => s.id === saved.id);
          const next = exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved];
          return next.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        });
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'workspace');
        addToast(`Fournisseur ${saved.name} enregistré.`, 'success');
        return saved;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Enregistrement du fournisseur impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, addToast, setSuppliers],
  );

  const addStockItem = useCallback(
    async (
      data: Omit<StockItem, 'id'> & { reason?: string; branchId?: string | null },
    ): Promise<StockItem> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const created = await api.stock.create({
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          minThreshold: data.minThreshold,
          unitCost: data.unitCost,
          sellingPrice: data.sellingPrice,
          supplierId: data.supplierId ?? null,
          supplier: data.supplier,
          reason: data.reason ?? 'Stock initial',
          branchId: data.branchId ?? memberships.find((m) => m.salonId === salonId)?.branchId ?? null,
        });
        setStocks((prev) => [...prev, created]);
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast(`Produit ${created.name} ajouté au stock`, 'success');
        return created;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Ajout du produit impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, memberships, domainCache, loadFinance, addToast, setStocks],
  );

  const updateStockItemMetadata = useCallback(
    async (id: string, data: Omit<StockItem, 'id' | 'quantity'>): Promise<StockItem> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.stock.updateMetadata(id, {
          name: data.name,
          category: data.category,
          minThreshold: data.minThreshold,
          unitCost: data.unitCost,
          sellingPrice: data.sellingPrice,
          supplierId: data.supplierId ?? null,
          supplier: data.supplier,
          isActive: data.isActive ?? true,
        });
        setStocks((prev) => prev.map((entry) => (entry.id === id ? saved : entry)));
        domainCache.invalidate(salonId, 'workspace');
        addToast(`Fiche produit ${saved.name} mise à jour.`, 'success');
        return saved;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Mise à jour du produit impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, domainCache, addToast, setStocks],
  );

  const recordStockMovement = useCallback(
    async (input: {
      stockItemId: string;
      movementType: Exclude<StockMovementType, 'initial'>;
      quantityDelta: number;
      reason: string;
      branchId?: string | null;
      supplierId?: string | null;
      unitCost?: number | null;
      reference?: string | null;
      appointmentId?: string | null;
    }): Promise<StockMovement> => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const movement = await api.stock.recordMovement({
          ...input,
          branchId: input.branchId ?? memberships.find((m) => m.salonId === salonId)?.branchId ?? null,
        });
        const refreshedStock = await api.stock.list();
        setStocks(refreshedStock);
        domainCache.invalidate(salonId, 'finance');
        domainCache.invalidate(salonId, 'workspace');
        await loadFinance(salonId, undefined, { force: true });
        addToast('Mouvement de stock historisé.', 'success');
        return movement;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Mouvement de stock impossible'), 'error');
        throw error;
      }
    },
    [requireActiveSalon, resolveApi, memberships, domainCache, loadFinance, addToast, setStocks],
  );

  const adjustStockQuantity = useCallback(
    (
      id: string,
      delta: number,
      reason = 'Ajustement manuel de stock',
      movementType?: Exclude<StockMovementType, 'initial'>,
    ) => {
      if (delta === 0) return;
      const item = stocks.find((entry) => entry.id === id);
      if (!item) {
        addToast('Produit introuvable.', 'error');
        return;
      }
      if (item.quantity + delta < 0) {
        addToast('La quantité ne peut pas être négative.', 'error');
        return;
      }
      const resolvedType: Exclude<StockMovementType, 'initial'> =
        movementType ?? (delta > 0 ? 'restock' : 'adjustment');
      void remote(
        () =>
          recordStockMovement({
            stockItemId: id,
            movementType: resolvedType,
            quantityDelta: delta,
            reason,
          }).then(() => undefined),
        'Ajustement du stock impossible',
      );
    },
    [stocks, addToast, remote, recordStockMovement],
  );

  return {
    upsertSupplier,
    addStockItem,
    updateStockItemMetadata,
    recordStockMovement,
    adjustStockQuantity,
  };
}
