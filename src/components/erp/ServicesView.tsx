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

const categoryLabel = (category: ServiceCategory) =>
  CATEGORIES.find((item) => item.id === category)?.label ?? category;

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
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#f7f6f2]">
            <Scissors className="h-6 w-6 text-[#C9A45C]" aria-hidden="true" />
            Prestations
          </h1>
          <p className="mt-1 text-[#a9a9a9]">Catalogue des services</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C9A45C] px-4 text-sm font-bold text-[#101010] transition-colors hover:bg-[#d4b26a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white min-[480px]:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouvelle prestation
        </button>
      </div>

      <div className="rounded-xl border border-[#2a2a2b] bg-[#151516]">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[#a9a9a9] sm:p-6 sm:py-12">
            <Scissors className="mx-auto mb-4 h-12 w-12 opacity-50" aria-hidden="true" />
            <p>Aucune prestation</p>
            <p className="mt-1 text-sm">Ajoutez vos services</p>
          </div>
        ) : (
          <>
            <section
              data-testid="services-mobile-list"
              aria-label="Liste des prestations"
              className="space-y-3 p-3 md:hidden"
            >
              {rows.map((srv) => {
                const isActive = srv.isActive ?? true;
                return (
                  <article
                    key={srv.id}
                    className="rounded-xl border border-[#2a2a2b] bg-[#19191b] p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-[#f7f6f2]">{srv.name}</h2>
                        <p className="mt-0.5 text-xs text-[#a9a9a9]">{categoryLabel(srv.category)}</p>
                      </div>
                      {srv.popular && (
                        <span className="shrink-0 rounded-full border border-[#C9A45C]/30 bg-[#1d1b15] px-2 py-1 text-[11px] font-semibold text-[#E5C378]">
                          Populaire
                        </span>
                      )}
                    </div>

                    {srv.description && <p className="mt-3 text-xs text-stone-400">{srv.description}</p>}

                    <dl className="mt-3 grid grid-cols-2 gap-3 border-y border-[#2a2a2b] py-3 text-xs">
                      <div>
                        <dt className="text-stone-500">Durée</dt>
                        <dd className="mt-0.5 font-semibold text-[#f7f6f2]">{srv.durationMinutes} min</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-stone-500">Tarif</dt>
                        <dd className="mt-0.5 font-semibold text-[#E5C378]">{formatPrice(srv.price)}</dd>
                      </div>
                      {(srv.prepMinutes ?? 0) > 0 && (
                        <div className="col-span-2 flex items-baseline justify-between gap-3">
                          <dt className="shrink-0 text-stone-500">Préparation</dt>
                          <dd className="text-right text-[#a9a9a9]">{srv.prepMinutes} min</dd>
                        </div>
                      )}
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          isActive ? 'bg-emerald-950/80 text-emerald-400' : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {isActive ? 'Disponible' : 'Désactivée'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setServiceActive(srv.id, !isActive)}
                          aria-label={`${isActive ? 'Désactiver' : 'Réactiver'} la prestation ${srv.name}`}
                          aria-pressed={isActive}
                          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] ${
                            isActive
                              ? 'border-emerald-900/70 bg-emerald-950/40 text-emerald-400 hover:text-emerald-300'
                              : 'border-stone-700 bg-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          <Power className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(srv)}
                          aria-label={`Modifier la prestation ${srv.name}`}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#303036] bg-[#1c1c20] text-stone-300 transition-colors hover:bg-[#28282e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <ConfirmDelete
                          onConfirm={() => deleteService(srv.id)}
                          className="min-h-11 border-[#5e2020] px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <div className="hidden md:block">
              <div
                className="overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label="Liste des prestations, défilement horizontal"
              >
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-[#2a2a2b] text-left">
                      {['Prestation', 'Catégorie', 'Durée', 'Prix', ''].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#a9a9a9]"
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
                            <span className="ml-2 rounded border border-[#C9A45C]/30 bg-[#1d1b15] px-1.5 py-0.5 text-[10px] text-[#E5C378]">
                              Populaire
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] uppercase text-[#a9a9a9]">{srv.category}</td>
                        <td className="px-4 py-3 text-[#a9a9a9]">{srv.durationMinutes} min</td>
                        <td className="px-4 py-3 font-semibold text-[#E5C378]">{formatPrice(srv.price)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setServiceActive(srv.id, !(srv.isActive ?? true))}
                              title={
                                (srv.isActive ?? true) ? 'Désactiver (retirée du catalogue)' : 'Réactiver'
                              }
                              aria-label={`${(srv.isActive ?? true) ? 'Désactiver' : 'Réactiver'} la prestation ${srv.name}`}
                              aria-pressed={srv.isActive ?? true}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] ${(srv.isActive ?? true) ? 'text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300' : 'text-stone-500 hover:bg-stone-800 hover:text-stone-300'}`}
                            >
                              <Power className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(srv)}
                              title="Modifier la prestation"
                              aria-label={`Modifier la prestation ${srv.name}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-[#242429] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <ConfirmDelete onConfirm={() => deleteService(srv.id)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
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

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
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

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#2a2a2b] px-3 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={form.popular}
              onChange={(e) => setForm({ ...form, popular: e.target.checked })}
              className="h-4 w-4 accent-[#C9A45C]"
            />
            Mettre en avant comme prestation populaire
          </label>
        </FormModal>
      )}
    </div>
  );
};
