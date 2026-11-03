import React from 'react';
import { Calendar, Users, DollarSign, Clock } from 'lucide-react';

export const TodayView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f7f6f2]">Aujourd'hui</h1>
        <p className="text-[#a9a9a9] mt-1">Vue d'ensemble de votre journée</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#151516] p-6 rounded-xl border border-[#2a2a2b]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a9a9a9]">Rendez-vous</p>
              <p className="text-2xl font-bold text-[#f7f6f2] mt-1">0</p>
            </div>
            <Calendar className="w-8 h-8 text-[#C9A45C]" />
          </div>
        </div>
        <div className="bg-[#151516] p-6 rounded-xl border border-[#2a2a2b]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a9a9a9]">Clients</p>
              <p className="text-2xl font-bold text-[#f7f6f2] mt-1">0</p>
            </div>
            <Users className="w-8 h-8 text-[#C9A45C]" />
          </div>
        </div>
        <div className="bg-[#151516] p-6 rounded-xl border border-[#2a2a2b]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a9a9a9]">Encaissé</p>
              <p className="text-2xl font-bold text-[#f7f6f2] mt-1">0 FCFA</p>
            </div>
            <DollarSign className="w-8 h-8 text-[#C9A45C]" />
          </div>
        </div>
        <div className="bg-[#151516] p-6 rounded-xl border border-[#2a2a2b]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a9a9a9]">En attente</p>
              <p className="text-2xl font-bold text-[#f7f6f2] mt-1">0</p>
            </div>
            <Clock className="w-8 h-8 text-[#C9A45C]" />
          </div>
        </div>
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
        <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">Planning du jour</h2>
        <div className="text-center py-12 text-[#a9a9a9]">
          Aucun rendez-vous pour aujourd'hui
        </div>
      </div>
    </div>
  );
};
