import React from 'react';
import { Users, Plus, Search } from 'lucide-react';

export const ClientsView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Clients</h1>
          <p className="text-[#a9a9a9] mt-1">Gestion de la clientèle</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a]">
          <Plus className="w-4 h-4" />
          Nouveau client
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#a9a9a9]" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            className="w-full pl-10 pr-4 py-2 bg-[#151516] border border-[#2a2a2b] rounded-lg text-[#f7f6f2] focus:outline-none focus:border-[#C9A45C]"
          />
        </div>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b]">
        <div className="p-6 text-center py-12 text-[#a9a9a9]">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun client</p>
          <p className="text-sm mt-1">Ajoutez votre premier client</p>
        </div>
      </div>
    </div>
  );
};
