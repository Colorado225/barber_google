// Barre supérieure ERP : titre de la vue active, badge de synchronisation
// temps réel et actions rapides (RDV, client de passage, encaissement).
import React from 'react';
import { Calendar, CreditCard, RefreshCw, UserPlus, Wifi } from 'lucide-react';
import type { ErpTab } from '../ErpLayout';

export interface ErpRealtimeBadge {
  label: string;
  tone: string;
  icon: typeof Wifi;
}

export const ErpTopbar: React.FC<{
  activeTab: ErpTab;
  /** Libellé de l'onglet actif (déjà résolu côté layout). */
  tabLabel: string;
  salonName: string;
  realtimeBadge: ErpRealtimeBadge | null;
  hasMemberships: boolean;
  canWriteAppointments: boolean;
  canRecordPayments: boolean;
  isSyncing: boolean;
  onSyncNow: () => void;
  onOpenWalkIn: () => void;
  onOpenNewAppointment: () => void;
  onOpenNewPayment: () => void;
}> = ({
  activeTab: _activeTab,
  tabLabel,
  salonName,
  realtimeBadge,
  hasMemberships,
  canWriteAppointments,
  canRecordPayments,
  isSyncing,
  onSyncNow,
  onOpenWalkIn,
  onOpenNewAppointment,
  onOpenNewPayment,
}) => (
  <header className="h-16 bg-[#121214] border-b border-[#222226] px-6 flex items-center justify-between shrink-0">
    <div className="flex items-center gap-3">
      <h1 className="text-base font-bold text-white capitalize">{tabLabel}</h1>
      <span className="text-xs text-stone-500 hidden sm:inline">• {salonName}</span>
      {realtimeBadge && (
        <div
          data-testid="erp-realtime-status"
          className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${realtimeBadge.tone}`}
          title="Synchronisation multi-postes active pour cet établissement"
        >
          <realtimeBadge.icon className="w-3 h-3" />
          <span>{realtimeBadge.label}</span>
        </div>
      )}
    </div>

    <div className="flex items-center gap-3">
      {hasMemberships && (
        <button
          type="button"
          onClick={() => onSyncNow()}
          title="Synchroniser immédiatement les données du salon"
          aria-label="Synchroniser les données"
          className="p-2 rounded-xl bg-[#18181c] hover:bg-[#24242a] text-stone-300 hover:text-white border border-[#2a2a32] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      )}
      {canWriteAppointments && (
        <button
          onClick={() => onOpenWalkIn()}
          className="bg-[#C9A45C]/15 hover:bg-[#C9A45C]/25 text-[#E5C378] border border-[#C9A45C]/40 font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">+ Client de passage</span>
        </button>
      )}
      <button
        onClick={() => {
          onOpenNewAppointment();
        }}
        className="bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b44] font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5 text-[#C9A45C]" />
        <span className="hidden sm:inline">+ Nouveau RDV</span>
      </button>

      {canRecordPayments && (
        <button
          onClick={() => {
            onOpenNewPayment();
          }}
          className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Encaisser</span>
        </button>
      )}
    </div>
  </header>
);
