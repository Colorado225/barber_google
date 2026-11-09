import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Client, ClientSegment } from '../../types';
import {
  Users,
  Search,
  Plus,
  MessageCircle,
  Phone,
  Calendar,
  Wallet,
  Star,
  Sparkles,
  Edit,
  X,
  CheckCircle2,
} from 'lucide-react';

export const CrmClientsView: React.FC = () => {
  const { activeSalon, clients, formatPrice, addClient, updateClientNotes } = useApp();

  const salonClients = useMemo(
    () => clients.filter((c) => c.salonId === activeSalon.id),
    [clients, activeSalon.id],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [selectedClientForNotes, setSelectedClientForNotes] = useState<Client | null>(null);
  const [editingNotes, setEditingNotes] = useState('');

  // Form State for new client
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFavoriteService, setNewFavoriteService] = useState('');
  const [newSegment, setNewSegment] = useState<ClientSegment>('new');
  const [newNotes, setNewNotes] = useState('');

  const filteredClients = useMemo(() => {
    return salonClients.filter((client) => {
      if (selectedSegment !== 'all' && client.segment !== selectedSegment) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          client.name.toLowerCase().includes(q) ||
          client.phone.includes(q) ||
          (client.email && client.email.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [salonClients, selectedSegment, searchQuery]);

  const segmentBadges: Record<ClientSegment, { label: string; badge: string }> = {
    vip: { label: 'Client VIP', badge: 'bg-[#C9A45C]/20 text-[#E5C378] border-[#C9A45C]/40 font-bold' },
    loyal: { label: 'Fidèle', badge: 'bg-emerald-950 text-emerald-400 border-emerald-800/40' },
    active: { label: 'Actif', badge: 'bg-cyan-950 text-cyan-400 border-cyan-800/40' },
    new: { label: 'Nouveau', badge: 'bg-blue-950 text-blue-400 border-blue-800/40' },
    to_reactivate: {
      label: 'À relancer',
      badge: 'bg-orange-950 text-orange-400 border-orange-800/40 font-bold',
    },
    inactive: { label: 'Inactif', badge: 'bg-stone-800 text-stone-400 border-stone-700' },
  };

  const handleAddClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      alert('Veuillez renseigner le nom et le numéro de téléphone.');
      return;
    }

    addClient({
      salonId: activeSalon.id,
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
      segment: newSegment,
      favoriteService: newFavoriteService,
      notes: newNotes.trim(),
    });

    setIsAddClientModalOpen(false);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewNotes('');
  };

  const handleSaveNotes = () => {
    if (selectedClientForNotes) {
      updateClientNotes(selectedClientForNotes.id, editingNotes);
      setSelectedClientForNotes(null);
    }
  };

  const getWhatsAppRelanceUrl = (client: Client) => {
    const text = `Bonjour ${client.name} ! L'équipe de ${activeSalon.name} espère que vous allez bien. Cela fait quelques semaines depuis votre dernière visite. Avez-vous besoin d'un rafraîchissement de votre coupe (${client.favoriteService}) ? Réservez votre créneau dès maintenant !`;
    return `https://wa.me/${client.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Search */}
      <div className="bg-[#161619] border border-[#27272c] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher client, téléphone..."
            className="w-full bg-[#111113] border border-[#29292e] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
          />
        </div>

        {/* Right: Segments Filter & Add Client */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'vip', label: 'VIP' },
            { id: 'loyal', label: 'Fidèles' },
            { id: 'active', label: 'Actifs' },
            { id: 'new', label: 'Nouveaux' },
            { id: 'to_reactivate', label: 'À relancer' },
          ].map((seg) => (
            <button
              key={seg.id}
              onClick={() => setSelectedSegment(seg.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                selectedSegment === seg.id
                  ? 'bg-[#C9A45C] text-[#101010] font-bold border-[#C9A45C]'
                  : 'bg-[#111113] border-[#29292e] text-stone-300 hover:text-white'
              }`}
            >
              {seg.label}
            </button>
          ))}

          <button
            onClick={() => setIsAddClientModalOpen(true)}
            className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ml-1"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouveau Client</span>
          </button>
        </div>
      </div>

      {/* CRM Clients Table / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const badge = segmentBadges[client.segment] || {
            label: client.segment,
            badge: 'bg-stone-800',
          };
          return (
            <div
              key={client.id}
              className="bg-[#161619] border border-[#27272c] hover:border-stone-500 rounded-2xl p-5 flex flex-col justify-between transition-colors shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-white text-base">{client.name}</h3>
                    <div className="text-xs text-stone-400 flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3 h-3 text-[#C9A45C]" />
                      <span>{client.phone}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.badge}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#111113] border border-[#242428] text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Total Dépensé :</span>
                    <span className="font-extrabold text-[#E5C378]">
                      {client.totalSpent === undefined ? '—' : formatPrice(client.totalSpent)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Nombre de visites :</span>
                    <span className="font-bold text-white">
                      {client.visitsCount === undefined ? '—' : `${client.visitsCount} passages`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Dernière visite :</span>
                    <span className="text-stone-300 font-mono">{client.lastVisit || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Service favori :</span>
                    <span className="text-white truncate max-w-[140px] font-medium">
                      {client.favoriteService}
                    </span>
                  </div>
                </div>

                {/* Notes box */}
                <div className="text-xs text-stone-300 bg-[#141416] p-2.5 rounded-lg border border-[#222226] flex items-start justify-between gap-2">
                  <p className="italic text-[11px] text-stone-400 line-clamp-2">
                    {client.notes || 'Aucune note particulière.'}
                  </p>
                  <button
                    onClick={() => {
                      setSelectedClientForNotes(client);
                      setEditingNotes(client.notes || '');
                    }}
                    className="text-stone-500 hover:text-white shrink-0 p-0.5"
                    title="Modifier note"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action: WhatsApp button */}
              <div className="pt-4 border-t border-[#232328] mt-3 flex items-center justify-between">
                <a
                  href={`tel:${client.phone}`}
                  className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5 text-stone-500" />
                  <span>Appeler</span>
                </a>

                <a
                  href={getWhatsAppRelanceUrl(client)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Relancer WhatsApp</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT NOTES MODAL */}
      {selectedClientForNotes && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center justify-between">
              <span>Préférences de {selectedClientForNotes.name}</span>
              <button
                onClick={() => setSelectedClientForNotes(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </h3>

            <textarea
              rows={4}
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder="Ex: Préfère la serviette très chaude, pas de parfum après rasage, contours hauts..."
              className="w-full bg-[#111113] border border-[#29292e] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedClientForNotes(null)}
                className="flex-1 py-2 rounded-xl bg-[#232328] text-stone-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                className="flex-1 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CLIENT MODAL */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161619] border border-[#2b2b30] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Nouveau Client CRM</h3>
              <button
                onClick={() => setIsAddClientModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddClientSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-stone-300 block mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Koffi Serge"
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-300 block mb-1">Numéro WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Ex: +225 07 11 22 33 44"
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-300 block mb-1">Email (Optionnel)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="client@gmail.com"
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-300 block mb-1">Segment</label>
                  <select
                    value={newSegment}
                    onChange={(e) => setNewSegment(e.target.value as ClientSegment)}
                    className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="new">Nouveau</option>
                    <option value="active">Actif</option>
                    <option value="loyal">Fidèle</option>
                    <option value="vip">VIP</option>
                    <option value="to_reactivate">À relancer</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-stone-300 block mb-1">Prestation préférée</label>
                  <input
                    type="text"
                    value={newFavoriteService}
                    onChange={(e) => setNewFavoriteService(e.target.value)}
                    className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-300 block mb-1">Notes internes</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Préférences de coupe..."
                  className="w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Ajouter au CRM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
