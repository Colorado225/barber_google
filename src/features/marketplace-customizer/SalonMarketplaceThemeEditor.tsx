import React from 'react';
import { SalonMarketplaceLayout, SalonMarketplaceViewConfig, SalonCardStyle } from '../../types';
import { Card } from '../../components/ui/card';
import { cn } from '../../lib/utils';
import { Check, Sparkles, Layout, Palette, Box } from 'lucide-react';

interface SalonMarketplaceThemeEditorProps {
  config: SalonMarketplaceViewConfig;
  onChange: (updated: Partial<SalonMarketplaceViewConfig>) => void;
}

const LAYOUT_OPTIONS: {
  id: SalonMarketplaceLayout;
  title: string;
  badge: string;
  description: string;
}[] = [
  {
    id: 'classic',
    title: 'Modèle 1 — Classique',
    badge: 'Recommandé',
    description: 'Présentation équilibrée en 2 colonnes avec carrousel et accès immédiat à la réservation.',
  },
  {
    id: 'elegant',
    title: 'Modèle 2 — Élégant',
    badge: 'Prestige',
    description: 'Galerie photographique dominante, cartes aérées et mise en valeur raffinée du salon.',
  },
  {
    id: 'editorial',
    title: 'Modèle 3 — Éditorial',
    badge: 'Lookbook',
    description: 'Style magazine avec asymétrie visuelle, triptyque d’artisans et focus prestations.',
  },
];

const ACCENT_COLORS = [
  { hex: '#C9A45C', name: 'Or Barber (Signature)' },
  { hex: '#D97706', name: 'Ambre Cuivré' },
  { hex: '#059669', name: 'Vert Émeraude' },
  { hex: '#2563EB', name: 'Bleu Saphir' },
  { hex: '#DC2626', name: 'Rouge Rubis' },
  { hex: '#94A3B8', name: 'Platine Moderne' },
];

const CARD_STYLES: { id: SalonCardStyle; label: string; desc: string }[] = [
  { id: 'rounded-3xl', label: 'Extra arrondi (3xl)', desc: 'Style moderne Shadcn Studio' },
  { id: 'rounded-2xl', label: 'Arrondi doux (2xl)', desc: 'Élégant et sobre' },
  { id: 'rounded-xl', label: 'Classique (xl)', desc: 'Plus compact et droit' },
];

export const SalonMarketplaceThemeEditor: React.FC<SalonMarketplaceThemeEditorProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. LAYOUT MODEL SELECTOR */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-[#C9A45C]" />
          <h3 className="text-sm font-bold text-white">Modèle de présentation</h3>
        </div>

        <div className="grid gap-3">
          {LAYOUT_OPTIONS.map((opt) => {
            const isSelected = config.layout === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => onChange({ layout: opt.id })}
                className={cn(
                  'p-3.5 rounded-2xl border transition-all cursor-pointer relative',
                  isSelected
                    ? 'bg-[#1e1c18] border-[#C9A45C] shadow-md ring-1 ring-[#C9A45C]/40'
                    : 'bg-[#18181c] border-stone-800 hover:border-stone-700',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{opt.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#292621] text-[#C9A45C] border border-[#C9A45C]/30">
                      {opt.badge}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="size-4 rounded-full bg-[#C9A45C] flex items-center justify-center text-[#101010]">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">{opt.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. ACCENT COLOR PICKER */}
      <div className="space-y-3 pt-2 border-t border-stone-800">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#C9A45C]" />
          <h3 className="text-sm font-bold text-white">Couleur d'accentuation</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ACCENT_COLORS.map((c) => {
            const isSelected = (config.accentColor || '#C9A45C').toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => onChange({ accentColor: c.hex })}
                className={cn(
                  'p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer',
                  isSelected
                    ? 'bg-[#202025] border-white/40'
                    : 'bg-[#18181c] border-stone-800 hover:border-stone-700',
                )}
              >
                <span
                  className="size-5 rounded-lg shrink-0 shadow-sm flex items-center justify-center"
                  style={{ backgroundColor: c.hex }}
                >
                  {isSelected && <Check className="size-3 text-white stroke-[3]" />}
                </span>
                <span className="text-xs text-stone-300 font-medium truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. CARD CORNER RADIUS STYLE */}
      <div className="space-y-3 pt-2 border-t border-stone-800">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-[#C9A45C]" />
          <h3 className="text-sm font-bold text-white">Style des bordures & cartes</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {CARD_STYLES.map((style) => {
            const isSelected = (config.cardStyle || 'rounded-3xl') === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onChange({ cardStyle: style.id })}
                className={cn(
                  'p-2.5 rounded-xl border text-center transition-all cursor-pointer',
                  isSelected
                    ? 'bg-[#202025] border-[#C9A45C] text-white'
                    : 'bg-[#18181c] border-stone-800 text-stone-400 hover:border-stone-700',
                )}
              >
                <span className="text-xs font-semibold block">{style.label}</span>
                <span className="text-[10px] text-stone-500 block mt-0.5">{style.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
