import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Service, ServiceCategory } from '../../types';
import { Scissors, Plus, Edit, Trash2, Clock, CheckCircle, X } from 'lucide-react';

export const ServicesView: React.FC = () => {
  const { activeSalon, services, formatPrice, addService, updateService, deleteService } = useApp();

  const salonServices = services.filter((s) => s.salonId === activeSalon.id);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('coupe');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(3000);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [popular, setPopular] = useState(false);

  const handleOpenAdd = () => {
    setEditingServiceId(null);
    setName('');
    setCategory('coupe');
    setDescription('');
    setPrice(3000);
    setDurationMinutes(30);
    setPopular(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (srv: Service) => {
    setEditingServiceId(srv.id);
    setName(srv.name);
    setCategory(srv.category);
    setDescription(srv.description);
    setPrice(srv.price);
    setDurationMinutes(srv.durationMinutes);
    setPopular(!!srv.popular);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price <= 0) {
      alert('Veuillez renseigner un nom et un prix valide.');
      return;
    }

    if (editingServiceId) {
      updateService(editingServiceId, {
        name: name.trim(),
        category,
        description: description.trim(),
        price: Number(price),
        durationMinutes: Number(durationMinutes),
        popular
      });
    } else {
      addService({
        salonId: activeSalon.id,
        name: name.trim(),
        category,
        description: description.trim(),
        price: Number(price),
        durationMinutes: Number(durationMinutes),
        popular
      });
    }

    setIsModalOpen(false);
  };

  const categories: { id: ServiceCategory; label: string }[] = [
    { id: 'coupe', label: 'Coupes' },
    { id: 'barbe', label: 'Barbe & Rasage' },
    { id: 'combo', label: 'Formules & Combos' },
    { id: 'visage', label: 'Soins Visage' },
    { id: 'soins', label: 'Soins Capillaires' },
    { id: 'coloration', label: 'Coloration' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161619] border border-[#27272c] rounded-2xl p-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scissors className="w-5 h-5 text-[#C9A45C]" />
            <span>Catalogue des Prestations & Tarifs</span>
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Configurez vos prix et durées affichés sur la Marketplace et utilisables en Caisse.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Ajouter une prestation</span>
        </button>
      </div>

      {/* Services grouped by category */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const list = salonServices.filter((s) => s.category === cat.id);
          if (list.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-3">
              <h3 className="text-xs font-bold text-[#C9A45C] uppercase tracking-wider">
                {cat.label} ({list.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-2xl bg-[#161619] border border-[#27272c] hover:border-stone-500 transition-colors flex flex-col justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white text-sm">{srv.name}</h4>
                        {srv.popular && (
                          <span className="text-[10px] bg-[#C9A45C]/20 text-[#E5C378] font-bold px-2 py-0.5 rounded-full border border-[#C9A45C]/30 shrink-0">
                            Populaire
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                        {srv.description || 'Prestation standard de coiffure.'}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-stone-400 mt-3 pt-2 border-t border-[#232328]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          <span>{srv.durationMinutes} min</span>
                        </span>
                        <span className="font-extrabold text-[#E5C378] text-sm ml-auto">
                          {formatPrice(srv.price)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#232328]">
                      <button
                        onClick={() => handleOpenEdit(srv)}
                        className="text-xs text-stone-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-[#232328] transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Voulez-vous supprimer cette prestation ?')) {
                            deleteService(srv.id);
                          }
                        }}
                        className="text-xs text-stone-500 hover:text-red-400 p-1 rounded hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingServiceId ? 'Modifier la prestation' : 'Nouvelle prestation'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Dégradé américain"
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Catégorie</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ServiceCategory)}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="coupe">Coupe</option>
                    <option value="barbe">Barbe</option>
                    <option value="combo">Combo / Formule</option>
                    <option value="visage">Soin visage</option>
                    <option value="soins">Soins capillaires</option>
                    <option value="coloration">Coloration</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-300 block mb-1">Prix (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min="500"
                    step="500"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs font-bold text-[#E5C378] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Durée (minutes)</label>
                <input
                  type="number"
                  required
                  min="10"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Détails de la prestation, finitions au rasoir..."
                  className="w-full bg-[#111113] border border-[#28282d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="popularCheck"
                  checked={popular}
                  onChange={(e) => setPopular(e.target.checked)}
                  className="rounded border-[#28282d] bg-[#111113] text-[#C9A45C] focus:ring-0"
                />
                <label htmlFor="popularCheck" className="text-xs text-stone-300 cursor-pointer">
                  Mettre en avant comme prestation "Populaire"
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {editingServiceId ? 'Mettre à jour' : 'Ajouter au catalogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
