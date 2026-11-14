import React from 'react';
import type { ErpNavigationGroup } from './types';

interface DesktopSidebarProps {
  salonSelector: React.ReactNode;
  groups: ErpNavigationGroup[];
  activeTabId: string;
  onSelectTab: (tabId: ErpNavigationGroup['items'][number]['id']) => void;
  badgeFor: (tabId: ErpNavigationGroup['items'][number]['id']) => number;
  hasCriticalNotificationAlert: boolean;
  footer: React.ReactNode;
}

/** Desktop-only workspace navigation. Items supplied here are already RBAC-filtered by ErpLayout. */
export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  salonSelector,
  groups,
  activeTabId,
  onSelectTab,
  badgeFor,
  hasCriticalNotificationAlert,
  footer,
}) => (
  <aside
    aria-label="Navigation ERP"
    className="hidden md:sticky md:top-0 md:self-start md:flex md:h-dvh md:w-72 md:shrink-0 md:flex-col md:overflow-hidden md:border-r md:border-[#222226] md:bg-[#121214]"
  >
    <div className="shrink-0 border-b border-[#222226] p-4">{salonSelector}</div>

    <nav
      aria-label="Navigation de l’espace professionnel"
      className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3"
    >
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label} className="space-y-1">
          <p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
            {group.label}
          </p>
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
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#C9A45C] font-bold text-[#101010] shadow-sm'
                    : 'text-stone-400 hover:bg-[#1a1a1d] hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#101010]' : 'text-stone-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
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
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </section>
      ))}
    </nav>

    <div className="shrink-0 border-t border-[#222226] p-3">{footer}</div>
  </aside>
);
