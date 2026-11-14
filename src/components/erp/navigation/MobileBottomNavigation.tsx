import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ErpNavigationItem } from './types';

const MOBILE_PRIMARY_LABELS: Partial<Record<ErpNavigationItem['id'], string>> = {
  dashboard: 'Accueil',
  calendar: 'Planning',
  cash: 'Caisse',
  crm: 'Clients',
};

interface MobileBottomNavigationProps {
  items: ErpNavigationItem[];
  activeTabId: string;
  isMoreOpen: boolean;
  onSelectTab: (tabId: ErpNavigationItem['id']) => void;
  onOpenMore: () => void;
}

/** Bottom navigation only receives modules that are already visible to the active membership. */
export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  items,
  activeTabId,
  isMoreOpen,
  onSelectTab,
  onOpenMore,
}) => (
  <nav
    aria-label="Navigation principale"
    className="fixed inset-x-0 bottom-0 z-30 flex items-start border-t border-[#29292f] bg-[#121214]/95 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
  >
    {items.map((item) => {
      const Icon = item.icon;
      const isActive = activeTabId === item.id;
      return (
        <button
          key={item.id}
          type="button"
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onSelectTab(item.id)}
          className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-bold transition-colors ${
            isActive ? 'text-[#E5C378]' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <span
            className={`flex h-7 w-9 items-center justify-center rounded-lg ${
              isActive ? 'bg-[#C9A45C]/20 text-[#E5C378]' : ''
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="truncate">{MOBILE_PRIMARY_LABELS[item.id] ?? item.label}</span>
        </button>
      );
    })}
    <button
      type="button"
      aria-expanded={isMoreOpen}
      aria-controls="erp-mobile-more-menu"
      onClick={onOpenMore}
      className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-bold transition-colors ${
        isMoreOpen ? 'text-[#E5C378]' : 'text-stone-400 hover:text-stone-200'
      }`}
    >
      <span
        className={`flex h-7 w-9 items-center justify-center rounded-lg ${
          isMoreOpen ? 'bg-[#C9A45C]/20 text-[#E5C378]' : ''
        }`}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>Plus</span>
    </button>
  </nav>
);
