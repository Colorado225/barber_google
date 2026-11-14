import React from 'react';
import { X } from 'lucide-react';
import type { ErpNavigationGroup } from './types';

interface MobileMoreMenuProps {
  open: boolean;
  salonSelector: React.ReactNode;
  groups: ErpNavigationGroup[];
  activeTabId: string;
  onClose: () => void;
  onSelectTab: (tabId: ErpNavigationGroup['items'][number]['id']) => void;
  badgeFor: (tabId: ErpNavigationGroup['items'][number]['id']) => number;
  hasCriticalNotificationAlert: boolean;
}

/** Bottom sheet for secondary modules. Its groups are supplied after the existing RBAC filtering. */
export const MobileMoreMenu: React.FC<MobileMoreMenuProps> = ({
  open,
  salonSelector,
  groups,
  activeTabId,
  onClose,
  onSelectTab,
  badgeFor,
  hasCriticalNotificationAlert,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Modules supplémentaires"
    >
      <button
        type="button"
        aria-label="Fermer le menu Plus"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <section
        id="erp-mobile-more-menu"
        className="absolute inset-x-0 bottom-0 flex max-h-[min(78dvh,42rem)] flex-col rounded-t-3xl border-t border-[#2a2a32] bg-[#121214] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#222226] px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
              Espace professionnel
            </p>
            <h2 className="text-sm font-bold text-white">Plus de modules</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu Plus"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-300 transition-colors hover:bg-[#1d1d22] hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mb-5">{salonSelector}</div>
          <nav aria-label="Modules secondaires" className="space-y-5">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTabId === item.id;
                    const badge = badgeFor(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => onSelectTab(item.id)}
                        className={`relative flex min-h-16 min-w-0 items-center gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-bold transition-colors ${
                          isActive
                            ? 'border-[#C9A45C]/60 bg-[#C9A45C]/15 text-[#E5C378]'
                            : 'border-[#29292f] bg-[#18181b] text-stone-300 hover:border-[#3a3a44] hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 leading-tight">{item.label}</span>
                        {badge > 0 && (
                          <span
                            title={
                              item.id === 'notifications' && hasCriticalNotificationAlert
                                ? 'Alerte : échecs répétés sur les notifications'
                                : undefined
                            }
                            className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                              item.id === 'notifications' && hasCriticalNotificationAlert
                                ? 'bg-red-500 text-white'
                                : 'bg-[#C9A45C] text-[#101010]'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </div>
      </section>
    </div>
  );
};
