import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Salon } from '../../../types';
import type { SalonSelectionOption } from './types';

interface ErpSalonSelectorProps {
  activeSalon: Salon;
  subtitle: string;
  options: SalonSelectionOption[];
  onSelect: (salonId: string) => void;
  testId?: string;
}

/** Shared salon switcher for the desktop workspace and the mobile “Plus” sheet. */
export const ErpSalonSelector: React.FC<ErpSalonSelectorProps> = ({
  activeSalon,
  subtitle,
  options,
  onSelect,
  testId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectable = options.length > 1;

  if (!selectable) {
    return (
      <div
        data-testid={testId}
        className="w-full rounded-xl border border-[#2a2a2e] bg-[#18181b] p-2.5 flex items-center gap-2.5"
        title="Un seul établissement est rattaché à ce compte"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#C9A45C]/40 bg-[#201d16] text-xs font-bold text-[#C9A45C]">
          {activeSalon.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-white">{activeSalon.name}</div>
          <div className="truncate text-[10px] text-stone-400">{subtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="w-full rounded-xl border border-[#2a2a2e] bg-[#18181b] p-2.5 flex items-center justify-between text-left transition-colors hover:bg-[#1f1f23] cursor-pointer"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#C9A45C]/40 bg-[#201d16] text-xs font-bold text-[#C9A45C]">
            {activeSalon.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-white">{activeSalon.name}</span>
            <span className="block truncate text-[10px] text-stone-400">{subtitle}</span>
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Changer d’établissement"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 rounded-xl border border-[#2d2d33] bg-[#18181b] p-1.5 shadow-2xl"
        >
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase text-stone-500">
            Vos établissements ({options.length})
          </div>
          {options.map((option) => {
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
                onClick={() => {
                  setIsOpen(false);
                  onSelect(option.salonId);
                }}
                className={`w-full rounded-lg p-2 text-left text-xs flex items-center justify-between gap-2 transition-colors hover:bg-[#232328] cursor-pointer ${
                  isSelected ? 'bg-[#232328]/50 font-bold text-[#C9A45C]' : 'text-stone-300'
                }`}
              >
                <span className="truncate">{option.salonName}</span>
                {meta && <span className="shrink-0 text-[10px] text-stone-400">{meta}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
