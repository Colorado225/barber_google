import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import type { StockCategory, StockItem, StockMovementType, Supplier } from '../../types';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Edit3,
  History,
  Package,
  Plus,
  Truck,
  X,
} from 'lucide-react';

const CATEGORY_LABELS: Record<StockCategory, string> = {
  shampoing: 'Shampoing',
  gel_cire: 'Gel & Cire',
  huile_barbe: 'Huile à barbe',
  lames: 'Lames & Rasage',
  soin: 'Soin visage',
  accessoires: 'Accessoires',
};

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  initial: 'Stock initial',
  restock: 'Réapprovisionnement (+)',
  sale: 'Vente produit (-)',
  service_use: 'Usage prestation (-)',
  loss: 'Perte / Casse (-)',
  return: 'Retour (+)',
  adjustment: 'Ajustement inventaire (+/-)',
};

export const InventoryView: React.FC = () => {
  const {
    activeSalon,
    stocks,
    stockMovements,
    suppliers,
    formatPrice,
    addStockItem,
    updateStockItemMetadata,
    recordStockMovement,
    upsertSupplier,
  } = useApp();
  const { hasPermission } = useOptionalAuth();
  const canWrite = hasPermission('stock.write', activeSalon?.id);

  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'movements' | 'suppliers'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [movementFilterItemId, setMovementFilterItemId] = useState<string>('all');

  // Modal création produit
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<StockCategory>('gel_cire');
  const [newQuantity, setNewQuantity] = useState(10);
  const [newMinThreshold, setNewMinThreshold] = useState(3);
  const [newUnitCost, setNewUnitCost] = useState(2500);
  const [newSellingPrice, setNewSellingPrice] = useState<string>('');
  const [newSupplierId, setNewSupplierId] = useState<string>('');
  const [newSupplierText, setNewSupplierText] = useState('');
  const [newReason, setNewReason] = useState('Stock initial');
  const [submitting, setSubmitting] = useState(false);

  // Modal mouvement de stock historisé
  const [movementTarget, setMovementTarget] = useState<StockItem | null>(null);
  const [movementType, setMovementType] = useState<Exclude<StockMovementType, 'initial'>>('restock');
  const [movementQty, setMovementQty] = useState<number>(5);
  const [adjustmentDirection, setAdjustmentDirection] = useState<1 | -1>(1);
  const [movementReason, setMovementReason] = useState('');
  const [movementSupplierId, setMovementSupplierId] = useState<string>('');
  const [movementUnitCost, setMovementUnitCost] = useState<string>('');
  const [movementReference, setMovementReference] = useState('');

  // Modal édition fiche (métadonnées uniquement, sans écraser la quantité)
  const [editTarget, setEditTarget] = useState<StockItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<StockCategory>('gel_cire');
  const [editMinThreshold, setEditMinThreshold] = useState(0);
  const [editUnitCost, setEditUnitCost] = useState(0);
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editSupplierText, setEditSupplierText] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Modal fournisseur
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supNotes, setSupNotes] = useState('');
  const [supActive, setSupActive] = useState(true);

  const salonStocks = useMemo(() => {
    if (!activeSalon) return [];
    const q = searchQuery.trim().toLowerCase();
    return stocks.filter(
      (s) =>
        s.salonId === activeSalon.id &&
        (showArchived || s.isActive !== false) &&
        (!q || s.name.toLowerCase().includes(q) || s.supplier.toLowerCase().includes(q)),
    );
  }, [stocks, activeSalon, searchQuery, showArchived]);

  const activeSuppliers = useMemo(
    () => (activeSalon ? suppliers.filter((s) => s.salonId === activeSalon.id && s.isActive) : []),
    [suppliers, activeSalon],
  );

  const salonSuppliers = useMemo(
    () => (activeSalon ? suppliers.filter((s) => s.salonId === activeSalon.id) : []),
    [suppliers, activeSalon],
  );

  const salonMovements = useMemo(() => {
    if (!activeSalon) return [];
    return stockMovements.filter(
      (m) =>
        m.salonId === activeSalon.id &&
        (movementFilterItemId === 'all' || m.stockItemId === movementFilterItemId),
    );
  }, [stockMovements, activeSalon, movementFilterItemId]);

  const lowStockCount = useMemo(
    () =>
      activeSalon
        ? stocks.filter(
            (s) => s.salonId === activeSalon.id && s.isActive !== false && s.quantity <= s.minThreshold,
          ).length
        : 0,
    [stocks, activeSalon],
  );

  if (!activeSalon) return null;

  const openMovementModal = (item: StockItem, preset: Exclude<StockMovementType, 'initial'> = 'restock') => {
    setMovementTarget(item);
    setMovementType(preset);
    setMovementQty(1);
    setAdjustmentDirection(1);
    setMovementReason('');
    setMovementSupplierId(item.supplierId ?? '');
    setMovementUnitCost(String(item.unitCost || ''));
    setMovementReference('');
  };

  const openEditModal = (item: StockItem) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditMinThreshold(item.minThreshold);
    setEditUnitCost(item.unitCost);
    setEditSellingPrice(item.sellingPrice !== undefined ? String(item.sellingPrice) : '');
    setEditSupplierId(item.supplierId ?? '');
    setEditSupplierText(item.supplier);
    setEditIsActive(item.isActive !== false);
  };

  const openSupplierModal = (sup?: Supplier) => {
    setEditingSupplier(sup ?? null);
    setSupName(sup?.name ?? '');
    setSupContact(sup?.contactName ?? '');
    setSupPhone(sup?.phone ?? '');
    setSupEmail(sup?.email ?? '');
    setSupAddress(sup?.address ?? '');
    setSupNotes(sup?.notes ?? '');
    setSupActive(sup?.isActive ?? true);
    setSupplierModalOpen(true);
  };

  const computedDelta = (() => {
    const absQty = Math.abs(Math.trunc(Number(movementQty) || 0));
    if (absQty <= 0) return 0;
    if (movementType === 'restock' || movementType === 'return') return absQty;
    if (movementType === 'sale' || movementType === 'service_use' || movementType === 'loss') return -absQty;
    return adjustmentDirection * absQty;
  })();

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const selectedSup = activeSuppliers.find((s) => s.id === newSupplierId);
      await addStockItem({
        salonId: activeSalon.id,
        name: newName.trim(),
        category: newCategory,
        quantity: Math.max(0, Math.trunc(newQuantity)),
        minThreshold: Math.max(0, Math.trunc(newMinThreshold)),
        unitCost: Math.max(0, Math.trunc(newUnitCost)),
        sellingPrice: newSellingPrice.trim() ? Math.max(0, Math.trunc(Number(newSellingPrice))) : undefined,
        supplierId: newSupplierId || null,
        supplier: selectedSup?.name ?? newSupplierText.trim(),
        reason: newReason.trim() || 'Stock initial',
        isActive: true,
      });
      setIsCreateOpen(false);
      setNewName('');
      setNewQuantity(10);
      setNewReason('Stock initial');
    } catch {
      // Toast déjà remonté par FinanceDomainContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementTarget || computedDelta === 0 || movementReason.trim().length < 2 || submitting) return;
    setSubmitting(true);
    try {
      await recordStockMovement({
        stockItemId: movementTarget.id,
        movementType,
        quantityDelta: computedDelta,
        reason: movementReason.trim(),
        supplierId: movementSupplierId || null,
        unitCost:
          movementType === 'restock' && movementUnitCost.trim()
            ? Math.max(0, Math.trunc(Number(movementUnitCost)))
            : null,
        reference: movementReference.trim() || null,
      });
      setMovementTarget(null);
    } catch {
      // Toast déjà remonté par FinanceDomainContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const selectedSup = salonSuppliers.find((s) => s.id === editSupplierId);
      await updateStockItemMetadata(editTarget.id, {
        salonId: activeSalon.id,
        name: editName.trim(),
        category: editCategory,
        minThreshold: Math.max(0, Math.trunc(editMinThreshold)),
        unitCost: Math.max(0, Math.trunc(editUnitCost)),
        sellingPrice: editSellingPrice.trim() ? Math.max(0, Math.trunc(Number(editSellingPrice))) : undefined,
        supplierId: editSupplierId || null,
        supplier: selectedSup?.name ?? editSupplierText.trim(),
        isActive: editIsActive,
      });
      setEditTarget(null);
    } catch {
      // Toast déjà remonté
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await upsertSupplier({
        id: editingSupplier?.id ?? null,
        name: supName.trim(),
        contactName: supContact.trim(),
        phone: supPhone.trim(),
        email: supEmail.trim() || null,
        address: supAddress.trim(),
        notes: supNotes.trim(),
        isActive: supActive,
      });
      setSupplierModalOpen(false);
    } catch {
      // Toast déjà remonté
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête synthétique */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Références actives</span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {stocks.filter((s) => s.salonId === activeSalon.id && s.isActive !== false).length}
          </div>
          <span className="text-[11px] text-stone-500">Produits suivis par mouvements historisés</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Alertes de seuil bas</span>
          <div
            className={`text-2xl font-extrabold mt-1 flex items-center gap-1.5 ${
              lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {lowStockCount > 0 && <AlertTriangle className="w-5 h-5" />}
            <span>{lowStockCount}</span>
          </div>
          <span className="text-[11px] text-stone-500">Produits à réapprovisionner</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#161619] border border-[#27272c]">
          <span className="text-xs font-semibold text-stone-400">Fournisseurs & Journal</span>
          <div className="text-2xl font-extrabold text-[#E5C378] mt-1">
            {activeSuppliers.length}{' '}
            <span className="text-sm text-stone-400 font-semibold">fournisseurs</span>
          </div>
          <span className="text-[11px] text-stone-500">{salonMovements.length} mouvements enregistrés</span>
        </div>
      </div>

      {/* Navigation sous-vues + actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#161619] border border-[#27272c] rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('inventory')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSubTab === 'inventory'
                ? 'bg-[#C9A45C] text-[#101010]'
                : 'bg-[#111113] text-stone-300 border border-[#28282d] hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Inventaire</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('movements')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSubTab === 'movements'
                ? 'bg-[#C9A45C] text-[#101010]'
                : 'bg-[#111113] text-stone-300 border border-[#28282d] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>
              Journal des mouvements ({stockMovements.filter((m) => m.salonId === activeSalon.id).length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('suppliers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSubTab === 'suppliers'
                ? 'bg-[#C9A45C] text-[#101010]'
                : 'bg-[#111113] text-stone-300 border border-[#28282d] hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Fournisseurs ({salonSuppliers.length})</span>
          </button>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            {activeSubTab === 'suppliers' ? (
              <button
                type="button"
                onClick={() => openSupplierModal()}
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau fournisseur</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter un produit</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1 : INVENTAIRE */}
      {activeSubTab === 'inventory' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#26262a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit ou fournisseur..."
              className="w-full sm:max-w-xs bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
            />
            <label className="text-xs text-stone-400 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-[#C9A45C]"
              />
              <span>Afficher les fiches archivées</span>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                <tr>
                  <th className="p-3.5">Produit</th>
                  <th className="p-3.5">Catégorie</th>
                  <th className="p-3.5">Quantité</th>
                  <th className="p-3.5">Seuil</th>
                  <th className="p-3.5">Coût unitaire</th>
                  <th className="p-3.5">Fournisseur</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226]">
                {salonStocks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-stone-500">
                      Aucun produit en stock. Ajoutez votre premier article pour tracer les mouvements.
                    </td>
                  </tr>
                ) : (
                  salonStocks.map((item) => {
                    const low = item.isActive !== false && item.quantity <= item.minThreshold;
                    return (
                      <tr key={item.id} className="hover:bg-[#1a1a1e] transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{item.name}</span>
                            {item.isActive === false && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">
                                Archivé
                              </span>
                            )}
                          </div>
                          {item.lastRestock && (
                            <div className="text-[11px] text-stone-500">
                              Dernier réappro : {item.lastRestock.slice(0, 10)}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-stone-400">
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </td>
                        <td className="p-3.5 font-extrabold text-white">{item.quantity}</td>
                        <td className="p-3.5">
                          <span className={low ? 'text-amber-400 font-semibold' : 'text-stone-400'}>
                            {item.minThreshold}
                            {low ? ' · à réapprovisionner' : ''}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-[#E5C378]">
                          {item.unitCost ? formatPrice(item.unitCost) : '—'}
                        </td>
                        <td className="p-3.5 text-stone-300">{item.supplier || '—'}</td>
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {canWrite && item.isActive !== false && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openMovementModal(item, 'restock')}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#C9A45C]/15 text-[#E5C378] hover:bg-[#C9A45C]/25 border border-[#C9A45C]/30 font-semibold text-[11px] cursor-pointer"
                                >
                                  Mouvement
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(item)}
                                  title="Modifier la fiche produit"
                                  className="p-1.5 rounded-lg bg-[#222226] text-stone-300 hover:text-white border border-[#2d2d33] cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setMovementFilterItemId(item.id);
                                setActiveSubTab('movements');
                              }}
                              title="Voir l'historique du produit"
                              className="p-1.5 rounded-lg bg-[#111113] text-stone-400 hover:text-white border border-[#28282d] cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2 : JOURNAL APPEND-ONLY DES MOUVEMENTS */}
      {activeSubTab === 'movements' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#26262a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Journal historisé des mouvements</h3>
              <p className="text-[11px] text-stone-400">
                Journal append-only : chaque variation conserve stock avant/après, type, motif et fournisseur.
              </p>
            </div>
            <select
              value={movementFilterItemId}
              onChange={(e) => setMovementFilterItemId(e.target.value)}
              className="bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
            >
              <option value="all">Tous les produits</option>
              {stocks
                .filter((s) => s.salonId === activeSalon.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Produit</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Variation</th>
                  <th className="p-3.5">Avant → Après</th>
                  <th className="p-3.5">Fournisseur / Réf</th>
                  <th className="p-3.5">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226]">
                {salonMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-stone-500">
                      Aucun mouvement de stock enregistré pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  salonMovements.map((mov) => {
                    const isPositive = mov.quantityDelta > 0;
                    return (
                      <tr key={mov.id} className="hover:bg-[#1a1a1e]">
                        <td className="p-3.5 font-mono text-stone-400 whitespace-nowrap">
                          {mov.createdAt.slice(0, 16).replace('T', ' ')}
                        </td>
                        <td className="p-3.5 font-semibold text-white">{mov.stockItemName ?? 'Produit'}</td>
                        <td className="p-3.5">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#222226] border border-[#2d2d33] text-stone-200">
                            {MOVEMENT_LABELS[mov.movementType] ?? mov.movementType}
                          </span>
                        </td>
                        <td className="p-3.5 font-extrabold">
                          <span
                            className={`inline-flex items-center gap-0.5 ${
                              isPositive ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            )}
                            {isPositive ? `+${mov.quantityDelta}` : mov.quantityDelta}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-stone-300">
                          {mov.quantityBefore} → {mov.quantityAfter}
                        </td>
                        <td className="p-3.5 text-stone-400">
                          {[mov.supplierName, mov.reference].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="p-3.5 text-stone-300">{mov.reason}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3 : FOURNISSEURS */}
      {activeSubTab === 'suppliers' && (
        <div className="bg-[#161619] border border-[#27272c] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-[#111113] border-b border-[#26262a] text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                <tr>
                  <th className="p-3.5">Fournisseur</th>
                  <th className="p-3.5">Contact</th>
                  <th className="p-3.5">Téléphone / E-mail</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226]">
                {salonSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-stone-500">
                      Aucun fournisseur enregistré. Créez un fournisseur pour le lier aux achats et stocks.
                    </td>
                  </tr>
                ) : (
                  salonSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-[#1a1a1e]">
                      <td className="p-3.5">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#C9A45C]" />
                          <span>{sup.name}</span>
                        </div>
                        {sup.address && <div className="text-[11px] text-stone-500">{sup.address}</div>}
                      </td>
                      <td className="p-3.5 text-stone-300">{sup.contactName || '—'}</td>
                      <td className="p-3.5 text-stone-400">
                        {[sup.phone, sup.email].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            sup.isActive
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {sup.isActive ? 'Actif' : 'Archivé'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => openSupplierModal(sup)}
                            className="px-2.5 py-1 rounded-lg bg-[#222226] text-stone-200 hover:text-white border border-[#2d2d33] text-[11px] cursor-pointer"
                          >
                            Modifier
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL NOUVEAU PRODUIT */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Nouveau produit en stock</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Nom du produit *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Cire coiffante mate 150ml"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Catégorie</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as StockCategory)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Quantité initiale</label>
                  <input
                    type="number"
                    min="0"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Seuil alerte</label>
                  <input
                    type="number"
                    min="0"
                    value={newMinThreshold}
                    onChange={(e) => setNewMinThreshold(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Coût achat</label>
                  <input
                    type="number"
                    min="0"
                    value={newUnitCost}
                    onChange={(e) => setNewUnitCost(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Prix vente</label>
                  <input
                    type="number"
                    min="0"
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Fournisseur</label>
                {activeSuppliers.length > 0 ? (
                  <select
                    value={newSupplierId}
                    onChange={(e) => setNewSupplierId(e.target.value)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">— Saisie libre ou aucun —</option>
                    {activeSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newSupplierText}
                    onChange={(e) => setNewSupplierText(e.target.value)}
                    placeholder="Ex: AfroBeauté Pro"
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Motif d’ouverture (journal) *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] disabled:opacity-50 text-[#101010] font-bold text-xs py-3 rounded-xl cursor-pointer"
              >
                {submitting ? 'Enregistrement...' : 'Créer le produit et journaliser'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOUVEMENT HISTORISÉ */}
      {movementTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Mouvement de stock</h3>
                <p className="text-xs text-stone-400">
                  {movementTarget.name} · Stock actuel :{' '}
                  <strong className="text-white">{movementTarget.quantity}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMovementTarget(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordMovement} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">
                    Type de mouvement *
                  </label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as Exclude<StockMovementType, 'initial'>)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="restock">Réapprovisionnement (+)</option>
                    <option value="sale">Vente produit (-)</option>
                    <option value="service_use">Usage prestation (-)</option>
                    <option value="loss">Perte / Casse (-)</option>
                    <option value="return">Retour (+)</option>
                    <option value="adjustment">Ajustement (+/-)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Quantité *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={movementQty}
                    onChange={(e) => setMovementQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {movementType === 'adjustment' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentDirection(1)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      adjustmentDirection === 1
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-[#111113] text-stone-400 border-[#28282d]'
                    }`}
                  >
                    + Surcroît d'inventaire
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentDirection(-1)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      adjustmentDirection === -1
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : 'bg-[#111113] text-stone-400 border-[#28282d]'
                    }`}
                  >
                    - Écart manquant
                  </button>
                </div>
              )}

              {movementType === 'restock' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1">Fournisseur</label>
                    <select
                      value={movementSupplierId}
                      onChange={(e) => setMovementSupplierId(e.target.value)}
                      className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">— Inchangé —</option>
                      {activeSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-300 block mb-1">
                      Coût unitaire (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={movementUnitCost}
                      onChange={(e) => setMovementUnitCost(e.target.value)}
                      className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Référence BL / Facture
                </label>
                <input
                  type="text"
                  value={movementReference}
                  onChange={(e) => setMovementReference(e.target.value)}
                  placeholder="Ex: BL-2026-041"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Motif obligatoire *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="Ex: Réception commande fournisseur / Flacon cassé"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-[#111113] border border-[#28282d] text-xs flex items-center justify-between">
                <span className="text-stone-400">Stock résultant :</span>
                <span
                  className={`font-bold ${
                    movementTarget.quantity + computedDelta < 0 ? 'text-red-400' : 'text-[#E5C378]'
                  }`}
                >
                  {movementTarget.quantity} → {movementTarget.quantity + computedDelta}
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  submitting ||
                  computedDelta === 0 ||
                  movementTarget.quantity + computedDelta < 0 ||
                  movementReason.trim().length < 2
                }
                className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] disabled:opacity-50 text-[#101010] font-bold text-xs py-3 rounded-xl cursor-pointer"
              >
                {submitting ? 'Enregistrement...' : 'Valider et historiser le mouvement'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MODIFIER FICHE PRODUIT (SANS ÉCRASER QUANTITÉ) */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Modifier la fiche produit</h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-stone-400 bg-[#111113] border border-[#28282d] rounded-xl p-2.5">
              La quantité actuelle ({editTarget.quantity}) n’est jamais modifiée ici ; utilisez un mouvement
              de stock pour préserver l’historique.
            </p>
            <form onSubmit={handleSaveMetadata} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Catégorie</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as StockCategory)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Seuil minimal</label>
                  <input
                    type="number"
                    min="0"
                    value={editMinThreshold}
                    onChange={(e) => setEditMinThreshold(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Coût unitaire</label>
                  <input
                    type="number"
                    min="0"
                    value={editUnitCost}
                    onChange={(e) => setEditUnitCost(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Prix de vente</label>
                  <input
                    type="number"
                    min="0"
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Fournisseur</label>
                <select
                  value={editSupplierId}
                  onChange={(e) => setEditSupplierId(e.target.value)}
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">— Saisie libre / aucun —</option>
                  {salonSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="text-xs text-stone-300 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="accent-[#C9A45C]"
                />
                <span>Fiche produit active (décocher pour archiver sans perdre l’historique)</span>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl cursor-pointer"
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer la fiche'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FOURNISSEUR */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h3>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">
                  Nom / Raison sociale *
                </label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="Ex: Abidjan Barber Supply"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Contact</label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="Nom du commercial"
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="+225 07..."
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">E-mail</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="commandes@fournisseur.ci"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Adresse</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Quartier, commune"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Notes</label>
                <input
                  type="text"
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="Conditions de livraison / paiement"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              {editingSupplier && (
                <label className="text-xs text-stone-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={supActive}
                    onChange={(e) => setSupActive(e.target.checked)}
                    className="accent-[#C9A45C]"
                  />
                  <span>Fournisseur actif (décocher pour archiver)</span>
                </label>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl cursor-pointer"
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer le fournisseur'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
