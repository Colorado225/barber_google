import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Service, ServiceCategory } from '../../types';
import { FormModal, Field, inputClass, ConfirmDelete } from './FormModal';
import { Scissors, Plus, Pencil, Power } from 'lucide-react';

const CATEGORIES: { id: ServiceCategory; label: string }[] = [
  { id: 'coupe', label: 'Coupe' },
  { id: 'barbe', label: 'Barbe' },
  { id: 'tresses', label: 'Tresses' },
  { id: 'soins', label: 'Soins capillaires' },
  { id: 'coloration', label: 'Coloration' },
  { id: 'visage', label: 'Soin visage' },
  { id: 'combo', label: 'Formule combinée' },
];

type FormState = {
  name: string;
  category: ServiceCategory;
  description: string;
  price: string;
  durationMinutes: string;
  prepMinutes: string;
  popular: boolean;
};

const emptyForm: FormState = {
  name: '',
  category: 'coupe',
  description: '',
  price: '',
  durationMinutes: '30',
  prepMinutes: '0',
  popular: false,
};

export const ServicesView: React.FC = () => {
  const {
    activeSalon,
    services,
    formatPrice,
    addService,
    updateService,
    deleteService,
    setServiceActive,
    addToast,
  } = useApp();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const rows = useMemo(
    () => services.filter((s) => s.salonId === activeSalon.id),
    [services, activeSalon.id],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setForm({
      name: service.name,
      category: service.category,
      description: service.description,
      price: String(service.price),
      durationMinutes: String(service.durationMinutes),
      prepMinutes: String(service.prepMinutes ?? 0),
      popular: Boolean(service.popular),
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    const duration = Number(form.durationMinutes);
    const prepMinutes = Number(form.prepMinutes);

    if (!form.name.trim()) {
      addToast('Le nom de la prestation est obligatoire.', 'error');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      addToast('Le prix doit être supérieur à 0.', 'error');
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      addToast('La durée doit être supérieure à 0 minute.', 'error');
      return;
    }
    if (!Number.isFinite(prepMinutes) || prepMinutes < 0 || prepMinutes > 120) {
      addToast('Le temps de préparation doit être compris entre 0 et 120 minutes.', 'error');
      return;
    }

    const payload = {
      salonId: activeSalon.id,
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      price,
      durationMinutes: duration,
      prepMinutes,
      popular: form.popular,
    };

    if (editing) {
      updateService(editing.id, payload);
    } else {
      addService(payload);
    }
    setIsFormOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            <Scissors className="w-6 h-6 text-[#C9A45C]" />
            Prestations
          </h1>
          <p className="text-[#a9a9a9] mt-1">Catalogue des services</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nouvelle prestation
        </button>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-center py-12 text-[#a9a9a9]">
            <Scissors className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune prestation</p>
            <p className="text-sm mt-1">Ajoutez vos services</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2b] text-left">
                {['Prestation', 'Catégorie', 'Durée', 'Prix', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#a9a9a9] font-bold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((srv) => (
                <tr key={srv.id} className="border-b border-[#232326] last:border-0 hover:bg-[#18181b]">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#f7f6f2]">{srv.name}</span>
                    {srv.popular && (
                      <span className="ml-2 text-[10px] bg-[#1d1b15] text-[#E5C378] border border-[#C9A45C]/30 px-1.5 py-0.5 rounded">
                        Populaire
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#a9a9a9] uppercase text-[11px]">{srv.category}</td>
                  <td className="px-4 py-3 text-[#a9a9a9]">{srv.durationMinutes} min</td>
                  <td className="px-4 py-3 text-[#E5C378] font-semibold">{formatPrice(srv.price)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setServiceActive(srv.id, !(srv.isActive ?? true))}
                        title={(srv.isActive ?? true) ? 'Désactiver (retirée du catalogue)' : 'Réactiver'}
                        aria-pressed={srv.isActive ?? true}
                        className={`p-1 rounded cursor-pointer ${(srv.isActive ?? true) ? 'text-emerald-400 hover:text-emerald-300' : 'text-stone-500 hover:text-stone-300'}`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(srv)}
                        title="Modifier"
                        className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <ConfirmDelete onConfirm={() => deleteService(srv.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isFormOpen && (
        <FormModal
          title={editing ? 'Modifier la prestation' : 'Nouvelle prestation'}
          subtitle={activeSalon.name}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          submitLabel={editing ? 'Enregistrer' : 'Créer'}
        >
          <Field label="Nom" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Dégradé américain"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ServiceCategory })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#17171a]">
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Durée (minutes)" required>
              <input
                type="number"
                min={5}
                className={inputClass}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </Field>

            <Field label="Préparation (minutes)">
              <input
                type="number"
                min={0}
                max={120}
                className={inputClass}
                value={form.prepMinutes}
                onChange={(e) => setForm({ ...form, prepMinutes: e.target.value })}
              />
              <span className="text-[10px] text-stone-500">Temps ajouté à la fin du créneau réservé.</span>
            </Field>
          </div>

          <Field label="Prix (FCFA)" required>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="4000"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={2}
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.popular}
              onChange={(e) => setForm({ ...form, popular: e.target.checked })}
              className="accent-[#C9A45C]"
            />
            Mettre en avant comme prestation populaire
          </label>
        </FormModal>
      )}
    </div>
  );
};
