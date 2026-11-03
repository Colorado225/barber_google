import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StockItem, StockCategory } from '../../types';
import { Package, Plus, AlertTriangle, CheckCircle, Trash2, X } from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { activeSalon, stocks, formatPrice, addStockItem, adjustStockQuantity } = useApp();

  const salonStocks = stocks.filter((s) => s.salonId === activeSalon.id);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StockCategory>('gel_cire');
  const [quantity, setQuantity] = useState<number>(10);
  const [minThreshold, setMinThreshold] = useState<number>(3);
  const [unitCost, setUnitCost] = useState<number>(2500);
  const [sellingPrice, setSellingPrice] = useState<number>(5000);
  const [supplier, setSupplier] = useState('Fournisseur Abidjan');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Veuillez renseigner le nom du produit.');
      return;
    }

    addStockItem({
      salonId: activeSalon.id,
      name: name.trim(),
      category,
      quantity: Number(quantity),
      minThreshold: Number(minThreshold),
      unitCost: Number(unitCost),
      sellingPrice: sellingPrice ? Number(sellingPrice) : undefined,
      supplier: supplier.trim(),
      lastRestock: new Date().toISOString().slice(0, 10)
    });

    setIsModalOpen(false);
    setName('');
  };

  const categoryLabels: Record<StockCategory, string> = {
    gel_cire: 'Cires, Poudres & Gels',
    huile_barbe: 'Huiles & Soins Barbe',
    shampoing: 'Shampoings & Lotions',
    lames: 'Lames & Consommables Rasoir',
    soin: 'Masques & Gommages',
    accessoires: 'Peignes, Brosses & Serviettes'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161619] border border-[#27272c] rounded-2xl p-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-[#C9A45C]" />
            <span>Gestion des Stocks & Produits</span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Contrôlez vos consommables barbiers et produits revendus aux clients.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Ajouter un produit</span>
        </button>
      </div>

      {/* Stock Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {salonStocks.map((item) => {
          const isLow = item.quantity <= item.minThreshold;
          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                isLow
                  ? 'bg-[#1e1515] border-amber-600/40 shadow-[0_0_20px_rgba(217,119,6,0.1)]'
                  : 'bg-[#161619] border-[#27272c] hover:border-stone-500'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-bold text-white text-sm">{item.name}</h3>
                  {isLow ? (
                    <span className="text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      Rupture imminente
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full shrink-0">
                      Stock OK
                    </span>
                  )}
                </div>

                <span className="text-xs text-[#C9A45C] block mb-2 font-medium">
                  {categoryLabels[item.category] || item.category}
                </span>

                <div className="p-3 rounded-xl bg-[#111113] border border-[#242428] text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Quantité en stock :</span>
                    <span className={`font-extrabold text-base ${isLow ? 'text-amber-400' : 'text-white'}`}>
                      {item.quantity} unités
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Seuil d'alerte :</span>
                    <span className="text-stone-300">{item.minThreshold} unités</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Coût d'achat unitaire :</span>
                    <span className="text-stone-300">{formatPrice(item.unitCost)}</span>
                  </div>
                  {item.sellingPrice && (
                    <div className="flex justify-between pt-1 border-t border-[#232328]">
                      <span className="text-[#E5C378]">Prix vente comptoir :</span>
                      <span className="font-bold text-[#E5C378]">{formatPrice(item.sellingPrice)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Adjust Stock Buttons */}
              <div className="pt-2 border-t border-[#232328] flex items-center justify-between">
                <span className="text-[11px] text-stone-500 truncate max-w-[120px]">
                  {item.supplier}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustStockQuantity(item.id, -1)}
                    disabled={item.quantity <= 0}
                    className="w-7 h-7 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-stone-300 hover:text-white flex items-center justify-center font-bold text-xs disabled:opacity-30"
                    title="Retirer 1 (Consommé)"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => adjustStockQuantity(item.id, 1)}
                    className="w-7 h-7 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-stone-300 hover:text-white flex items-center justify-center font-bold text-xs"
                    title="Ajouter 1"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => adjustStockQuantity(item.id, 5)}
                    className="px-2 h-7 rounded-lg bg-[#C9A45C]/20 hover:bg-[#C9A45C]/30 text-[#E5C378] flex items-center justify-center font-bold text-xs"
                    title="Réapprovisionner (+5)"
                  >
                    +5
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD ITEM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Nouveau Produit / Consommable</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Nom du produit *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Cire coiffante Elegance"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Catégorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as StockCategory)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="gel_cire">Cires & Gels</option>
                    <option value="huile_barbe">Huiles Barbe</option>
                    <option value="shampoing">Shampoings</option>
                    <option value="lames">Lames rasoir</option>
                    <option value="soin">Soins & Masques</option>
                    <option value="accessoires">Accessoires</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Quantité initiale</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Seuil d'alerte (Min)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Coût d'achat (FCFA)</label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="100"
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Prix de vente client</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-[#E5C378] font-bold focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Fournisseur</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Ex: Grossiste Cocody"
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Ajouter au stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
