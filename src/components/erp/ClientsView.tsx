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
  { id: 'to_reactivate', label: 'À réactiver' }
];

const SEGMENT_LABELS: Record<ClientSegment, string> = {
  new: 'Nouveau',
  active: 'Actif',
  loyal: 'Fidèle',
  vip: 'VIP',
  inactive: 'Inactif',
  to_reactivate: 'À réactiver'
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
  notes: ''
};

export const ClientsView: React.FC = () => {
  const {
    activeSalon,
    clients,
    addClient,
    updateClient,
    deleteClient,
    addToast
  } = useApp();

  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const salonClients = useMemo(
    () => clients.filter((c) => c.salonId === activeSalon.id),
    [clients, activeSalon.id]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return salonClients;
    return salonClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
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
      notes: client.notes || ''
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
        notes: form.notes.trim()
      });
    } else {
      addClient({
        salonId: activeSalon.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        segment: form.segment,
        favoriteService: form.favoriteService.trim(),
        notes: form.notes.trim()
      });
    }
    setIsFormOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#C9A45C]" />
            Clients
          </h1>
          <p className="text-[#a9a9a9] mt-1">Gestion de la clientèle</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nouveau client
        </button>
      </div>

      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client..."
          aria-label="Rechercher un client"
          className="w-full pl-10 pr-4 py-2 bg-[#151516] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
        />
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-center py-12 text-[#a9a9a9]">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{salonClients.length === 0 ? 'Aucun client' : 'Aucun résultat'}</p>
            <p className="text-sm mt-1">
              {salonClients.length === 0
                ? 'Ajoutez votre premier client'
                : 'Aucun client ne correspond à cette recherche'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2b] text-left">
                {['Client', 'Segment', 'Visites', 'Dépensé', 'Dernière visite', ''].map((h) => (
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
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#232328] text-stone-300">
                      {SEGMENT_LABELS[client.segment]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#a9a9a9]">{client.visitsCount ?? '—'}</td>
                  <td className="px-4 py-3 text-[#E5C378] font-semibold">
                    {client.totalSpent === undefined
                      ? '—'
                      : `${client.totalSpent.toLocaleString('fr-FR')} FCFA`}
                  </td>
                  <td className="px-4 py-3 text-[#a9a9a9] text-xs">{client.lastVisit || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(client)}
                        title="Modifier"
                        className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <ConfirmDelete onConfirm={() => deleteClient(client.id)} />
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

          <div className="grid grid-cols-2 gap-3">
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
