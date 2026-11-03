import React from 'react';
import { UserCog, Plus } from 'lucide-react';

export const StaffView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Équipe</h1>
          <p className="text-[#a9a9a9] mt-1">Collaborateurs et rôles</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a]">
          <Plus className="w-4 h-4" />
          Inviter un collaborateur
        </button>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b]">
        <div className="p-6 text-center py-12 text-[#a9a9a9]">
          <UserCog className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun collaborateur</p>
          <p className="text-sm mt-1">Invitez votre équipe</p>
        </div>
      </div>
    </div>
  );
};
