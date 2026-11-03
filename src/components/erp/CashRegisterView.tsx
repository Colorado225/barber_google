import React from 'react';
import { Receipt, Plus } from 'lucide-react';

export const CashRegisterView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Caisse</h1>
          <p className="text-[#a9a9a9] mt-1">Sessions et encaissements</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a]">
          <Plus className="w-4 h-4" />
          Ouvrir une session
        </button>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b]">
        <div className="p-6 text-center py-12 text-[#a9a9a9]">
          <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune session de caisse ouverte</p>
          <p className="text-sm mt-1">Ouvrez une session pour commencer</p>
        </div>
      </div>
    </div>
  );
};
