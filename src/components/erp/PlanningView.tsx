import React from 'react';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';

export const PlanningView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2]">Planning</h1>
          <p className="text-[#a9a9a9] mt-1">Gérer les rendez-vous</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#C9A45C] text-[#101010] rounded-lg font-semibold hover:bg-[#d4b26a]">
          <Plus className="w-4 h-4" />
          Nouveau rendez-vous
        </button>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
        <div className="flex items-center justify-center h-96 text-[#a9a9a9]">
          <div className="text-center">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Calendrier des rendez-vous</p>
            <p className="text-sm mt-1">Aucun rendez-vous à afficher</p>
          </div>
        </div>
      </div>
    </div>
  );
};
