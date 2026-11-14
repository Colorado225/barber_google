import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Client, ClientSegment } from '../../types';
import { FormModal, Field, inputClass, ConfirmDelete } from './FormModal';
import { Users, Plus, Search, Pencil } from 'lucide-react';

const SEGMENTS: { id: ClientSegment; label: string }[] = [
  { id: 'new', label: 'Nouveau' },
  { id: 'active', label: 'Actif' },
  { id: 'loyal', label: 'Fidèle' },
  { id: 'vip', label: 'VIP' },
  { id: 'inactive', label: 'Inactif' },
  { id: 'to_reactivate', label: 'À réactiver' },
];

const SEGMENT_LABELS: Record<ClientSegment, string> = {
  new: 'Nouveau',
  active: 'Actif',
  loyal: 'Fidèle',
  vip: 'VIP',
  inactive: 'Inactif',
  to_reactivate: 'À réactiver',
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  segment: ClientSegment;
  favoriteService: string;
  notes: string;
};

const emptyForm: FormState = {
  name: '',
  phone: '',
  email: '',
  segment: 'new',
  favoriteService: '',
  notes: '',
};

const formatClientTotal = (client: Client) =>
  client.totalSpent === undefined ? '—' : `${client.totalSpent.toLocaleString('fr-FR')} FCFA`;

export const ClientsView: React.FC = () => {
  const { activeSalon, clients, addClient, updateClient, deleteClient, addToast } = useApp();

  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const salonClients = useMemo(
    () => clients.filter((c) => c.salonId === activeSalon.id),
    [clients, activeSalon.id],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return salonClients;
    return salonClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q),
    );
  }, [salonClients, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      segment: client.segment,
      favoriteService: client.favoriteService || '',
      notes: client.notes || '',
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      addToast('Le nom du client est obligatoire.', 'error');
      return;
    }
    if (!form.phone.trim()) {
      addToast('Le téléphone est obligatoire.', 'error');
      return;
    }

    if (editing) {
      updateClient(editing.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        segment: form.segment,
        favoriteService: form.favoriteService.trim(),
        notes: form.notes.trim(),
      });
    } else {
      addClient({
        salonId: activeSalon.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        segment: form.segment,
        favoriteService: form.favoriteService.trim(),
        notes: form.notes.trim(),
      });
    }
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#f7f6f2]">
            <Users className="h-6 w-6 text-[#C9A45C]" />
            Clients
          </h1>
          <p className="mt-1 text-[#a9a9a9]">Gestion de la clientèle</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C9A45C] px-4 text-sm font-bold text-[#101010] transition-colors hover:bg-[#d4b26a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white min-[480px]:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouveau client
        </button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a9a9a9]"
          aria-hidden="true"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client..."
          aria-label="Rechercher un client"
          className="min-h-11 w-full rounded-xl border border-[#2a2a2b] bg-[#151516] py-2 pl-10 pr-4 text-sm text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
        />
      </div>

      <div className="rounded-xl border border-[#2a2a2b] bg-[#151516]">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[#a9a9a9] sm:p-6 sm:py-12">
            <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>{salonClients.length === 0 ? 'Aucun client' : 'Aucun résultat'}</p>
            <p className="mt-1 text-sm">
              {salonClients.length === 0
                ? 'Ajoutez votre premier client'
                : 'Aucun client ne correspond à cette recherche'}
            </p>
          </div>
        ) : (
          <>
            <section
              data-testid="clients-mobile-list"
              aria-label="Liste des clients"
              className="space-y-3 p-3 md:hidden"
            >
              {rows.map((client) => (
                <article
                  key={client.id}
                  className="rounded-xl border border-[#2a2a2b] bg-[#19191b] p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-[#f7f6f2]">{client.name}</h2>
                      <p className="mt-0.5 text-xs text-[#a9a9a9]">{client.phone}</p>
                      {client.email && (
                        <p className="mt-0.5 truncate text-xs text-stone-500">{client.email}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-[#232328] px-2 py-1 text-[11px] font-semibold text-stone-300">
                      {SEGMENT_LABELS[client.segment]}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-[#2a2a2b] py-3 text-xs">
                    <div>
                      <dt className="text-stone-500">Visites</dt>
                      <dd className="mt-0.5 font-semibold text-[#f7f6f2]">{client.visitsCount ?? '—'}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-stone-500">Dépensé</dt>
                      <dd className="mt-0.5 font-semibold text-[#E5C378]">{formatClientTotal(client)}</dd>
                    </div>
                    <div className="col-span-2 flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-stone-500">Dernière visite</dt>
                      <dd className="truncate text-right text-[#a9a9a9]">{client.lastVisit || '—'}</dd>
                    </div>
                    {client.favoriteService && (
                      <div className="col-span-2 flex items-baseline justify-between gap-3">
                        <dt className="shrink-0 text-stone-500">Préférence</dt>
                        <dd className="truncate text-right text-[#a9a9a9]">{client.favoriteService}</dd>
                      </div>
                    )}
                  </dl>

                  {client.notes && <p className="mt-3 text-xs text-stone-400">{client.notes}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(client)}
                      aria-label={`Modifier le client ${client.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#303036] bg-[#1c1c20] text-stone-300 transition-colors hover:bg-[#28282e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <ConfirmDelete
                      onConfirm={() => deleteClient(client.id)}
                      className="min-h-11 border-[#5e2020] px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                    />
                  </div>
                </article>
              ))}
            </section>

            <div className="hidden md:block">
              <div
                className="overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label="Liste des clients, défilement horizontal"
              >
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-[#2a2a2b] text-left">
                      {['Client', 'Segment', 'Visites', 'Dépensé', 'Dernière visite', ''].map((h) => (
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
                    {rows.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b border-[#232326] last:border-0 hover:bg-[#18181b]"
                      >
                        <td className="px-4 py-3">
                          <span className="font-semibold text-[#f7f6f2]">{client.name}</span>
                          <div className="text-[11px] text-[#a9a9a9]">{client.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#232328] px-2 py-0.5 text-[11px] font-semibold text-stone-300">
                            {SEGMENT_LABELS[client.segment]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#a9a9a9]">{client.visitsCount ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold text-[#E5C378]">
                          {formatClientTotal(client)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#a9a9a9]">{client.lastVisit || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(client)}
                              title="Modifier le client"
                              aria-label={`Modifier le client ${client.name}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-[#242429] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <ConfirmDelete onConfirm={() => deleteClient(client.id)} />
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
          title={editing ? 'Modifier le client' : 'Nouveau client'}
          subtitle={activeSalon.name}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
          submitLabel={editing ? 'Enregistrer' : 'Créer'}
        >
          <Field label="Nom complet" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Awa Koné"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <Field label="Téléphone" required>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+225 ..."
              />
            </Field>

            <Field label="Segment">
              <select
                className={inputClass}
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value as ClientSegment })}
              >
                {SEGMENTS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#17171a]">
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="E-mail">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="client@email.com"
            />
          </Field>

          <Field label="Prestation préférée">
            <input
              className={inputClass}
              value={form.favoriteService}
              onChange={(e) => setForm({ ...form, favoriteService: e.target.value })}
              placeholder="Ex: Dégradé américain"
            />
          </Field>

          <Field label="Notes internes">
            <textarea
              rows={2}
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </FormModal>
      )}
    </div>
  );
};
