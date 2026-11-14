import React from 'react';
import { RefreshCw } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  salonName: string;
  onSync?: () => void;
  isSyncing?: boolean;
}

/** Compact mobile context header; module navigation lives at the bottom for one-handed reach. */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  salonName,
  onSync,
  isSyncing = false,
}) => (
  <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#222226] bg-[#121214]/95 px-3 backdrop-blur-md md:hidden">
    <div className="min-w-0">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
        {salonName}
      </p>
      <h1 className="truncate text-base font-bold text-white">{title}</h1>
    </div>
    {onSync && (
      <button
        type="button"
        onClick={onSync}
        title="Synchroniser immédiatement les données du salon"
        aria-label="Synchroniser les données"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2a2a32] bg-[#18181c] text-stone-300 transition-colors hover:bg-[#24242a] hover:text-white"
      >
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    )}
  </header>
);
