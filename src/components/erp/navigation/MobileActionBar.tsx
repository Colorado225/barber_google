import React from 'react';
import type { MobileQuickAction } from './types';

interface MobileActionBarProps {
  actions: MobileQuickAction[];
}

/** Permission-aware quick actions supplied by ErpLayout; this component adds no business authorization. */
export const MobileActionBar: React.FC<MobileActionBarProps> = ({ actions }) => {
  if (actions.length === 0) return null;

  return (
    <div className="border-b border-[#222226] bg-[#101012] px-3 py-2 md:hidden">
      <div className="grid grid-flow-col auto-cols-fr gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const tone =
            action.tone === 'primary'
              ? 'border-[#C9A45C] bg-[#C9A45C] text-[#101010]'
              : action.tone === 'accent'
                ? 'border-[#C9A45C]/40 bg-[#C9A45C]/15 text-[#E5C378]'
                : 'border-[#3b3b44] bg-[#242429] text-white';
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-bold transition-colors ${tone}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
