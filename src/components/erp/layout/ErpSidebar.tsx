// Barre latérale ERP : sélecteur d'établissement, navigation filtrée par
// permissions et indicateur de tiroir caisse.
import React from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import type { ErpTab } from '../ErpLayout';
import type { Salon } from '../../../types';
import type { CashSession } from '../../../types';

export interface SwitchableSalonOption {
  salonId: string;
  salonName: string;
  roleLabel: string;
  branchName: string | null;
  organizationName: string;
}

export const ErpSidebar: React.FC<{
  activeSalon: Salon;
  activeSubtitle: string;
  switchableOptions: SwitchableSalonOption[];
  dropdownOpen: boolean;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
  onSelectSalon: (salonId: string) => void;
  navItems: {
    id: ErpTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    permission?: string;
  }[];
  visibleActiveTab: ErpTab;
  onSelectTab: (tab: ErpTab) => void;
  navBadge: (id: ErpTab) => number;
  hasCriticalNotificationAlert: boolean;
  cashSession: CashSession | null;
  formatPrice: (amount: number) => string;
  onBackToMarketplace: () => void;
  /** Contenu principal (barre supérieure + vue active). */
  children?: React.ReactNode;
}> = ({
  activeSalon,
  activeSubtitle,
  switchableOptions,
  dropdownOpen,
  onToggleDropdown,
  onCloseDropdown,
  onSelectSalon,
  navItems,
  visibleActiveTab,
  onSelectTab,
  navBadge,
  hasCriticalNotificationAlert,
  cashSession,
  formatPrice,
  onBackToMarketplace,
  children,
}) => (
  <div className="min-h-screen bg-[#0d0d0e] flex flex-col md:flex-row text-stone-200">
    <aside className="w-full md:w-64 bg-[#121214] border-r border-[#222226] flex flex-col shrink-0">
      {/* Salon Selector Header */}
      <div className="p-4 border-b border-[#222226] relative">
        {switchableOptions.length > 1 ? (
          <>
            <button
              type="button"
              data-testid="erp-salon-switcher"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              onClick={onToggleDropdown}
              className="w-full p-2.5 rounded-xl bg-[#18181b] hover:bg-[#1f1f23] border border-[#2a2a2e] flex items-center justify-between transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#201d16] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] shrink-0 font-bold text-xs">
                  {activeSalon.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">{activeSalon.name}</div>
                  <div className="text-[10px] text-stone-400 truncate">{activeSubtitle}</div>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            </button>

            {dropdownOpen && (
              <div
                role="listbox"
                aria-label="Changer d’établissement"
                className="absolute left-4 right-4 top-18 bg-[#18181b] border border-[#2d2d33] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={onCloseDropdown}
              >
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-stone-500">
                  Vos Établissements ({switchableOptions.length})
                </div>
                {switchableOptions.map((option) => {
                  const isSelected = activeSalon.id === option.salonId;
                  const meta = [option.roleLabel, option.branchName || option.organizationName]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <button
                      key={option.salonId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelectSalon(option.salonId)}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between gap-2 hover:bg-[#232328] transition-colors cursor-pointer ${
                        isSelected ? 'text-[#C9A45C] font-bold bg-[#232328]/50' : 'text-stone-300'
                      }`}
                    >
                      <span className="truncate">{option.salonName}</span>
                      {meta && <span className="text-[10px] text-stone-400 shrink-0">{meta}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div
            data-testid="erp-salon-single"
            className="w-full p-2.5 rounded-xl bg-[#18181b] border border-[#2a2a2e] flex items-center gap-2.5"
            title="Un seul établissement est rattaché à ce compte"
          >
            <div className="w-8 h-8 rounded-lg bg-[#201d16] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] shrink-0 font-bold text-xs">
              {activeSalon.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{activeSalon.name}</div>
              <div className="text-[10px] text-stone-400 truncate">{activeSubtitle}</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = visibleActiveTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#C9A45C] text-[#101010] shadow-sm font-bold'
                  : 'text-stone-400 hover:text-white hover:bg-[#1a1a1d]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#101010]' : 'text-stone-400'}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {navBadge(item.id) > 0 && (
                <span
                  data-testid={
                    item.id === 'notifications' && hasCriticalNotificationAlert
                      ? 'notifications-critical-badge'
                      : undefined
                  }
                  title={
                    item.id === 'notifications' && hasCriticalNotificationAlert
                      ? 'Alerte : échecs répétés sur les notifications'
                      : undefined
                  }
                  className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    item.id === 'notifications' && hasCriticalNotificationAlert
                      ? 'bg-red-500 text-white'
                      : isActive
                        ? 'bg-[#101010] text-[#C9A45C]'
                        : 'bg-[#C9A45C] text-[#101010]'
                  }`}
                >
                  {navBadge(item.id)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer: Cash Register status indicator */}
      <div className="p-3 border-t border-[#222226] space-y-2">
        <div className="p-3 rounded-xl bg-[#161619] border border-[#242428] text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-stone-400">Tiroir Caisse :</span>
            <span
              className={`text-[10px] font-bold ${cashSession?.status === 'open' ? 'text-emerald-400' : 'text-stone-500'}`}
            >
              {cashSession ? (cashSession.status === 'open' ? 'Ouverte' : 'Fermée') : 'Non configurée'}
            </span>
          </div>
          <div className="font-extrabold text-[#E5C378] text-sm">
            {cashSession ? formatPrice(cashSession.theoreticalBalance) : '—'}
          </div>
        </div>

        <button
          onClick={onBackToMarketplace}
          className="w-full py-2 px-3 rounded-xl bg-[#18181b] hover:bg-[#202025] text-stone-400 hover:text-white text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour Marketplace</span>
        </button>
      </div>
    </aside>

    {/* MAIN ERP WORKSPACE */}
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">{children}</div>
  </div>
);
