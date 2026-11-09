import React from 'react';
import { SalonMarketplaceSection, SalonMarketplaceSectionId, SalonMarketplaceViewConfig } from '../../types';
import { Switch } from '../../components/ui/switch';
import { cn } from '../../lib/utils';
import { SlidersHorizontal, ChevronUp, ChevronDown, Eye, EyeOff, GripVertical } from 'lucide-react';

interface SalonMarketplaceSectionsEditorProps {
  config: SalonMarketplaceViewConfig;
  onChange: (updated: Partial<SalonMarketplaceViewConfig>) => void;
}

const SECTION_METADATA: Record<SalonMarketplaceSectionId, { label: string; desc: string }> = {
  hero: {
    label: 'En-tête & Présentation',
    desc: 'Logo, nom du salon, badges de certification et boutons d’appel à l’action.',
  },
  gallery: {
    label: 'Carrousel & Galerie Photos',
    desc: 'Grand carrousel interactif des réalisations et ambiance du salon.',
  },
  featured_services: {
    label: 'Prestations en Vedette',
    desc: 'Carte interactive mettant en valeur les prestations phares du catalogue.',
  },
  team: {
    label: 'Équipe d’Artisans',
    desc: 'Présentation des barbiers et coiffeurs avec leurs spécialités.',
  },
  trust: {
    label: 'Gage de Confiance',
    desc: 'Note moyenne certifiée, engagements hygiène et garanties sans attente.',
  },
  location_hours: {
    label: 'Horaires & Localisation',
    desc: 'Horaires de la semaine, adresse, itinéraire et contact WhatsApp direct.',
  },
  reviews: {
    label: 'Avis Clients Vérifiés',
    desc: 'Témoignages authentiques et répartition des étoiles par prestation.',
  },
};

export const SalonMarketplaceSectionsEditor: React.FC<SalonMarketplaceSectionsEditorProps> = ({
  config,
  onChange,
}) => {
  const sections = [...config.sections].sort((a, b) => a.position - b.position);

  const toggleSection = (id: SalonMarketplaceSectionId) => {
    const updated = sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    onChange({ sections: updated });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Reassign normalized positions
    const normalized = reordered.map((sec, pos) => ({ ...sec, position: pos }));
    onChange({ sections: normalized });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#C9A45C]" />
          <h3 className="text-sm font-bold text-white">Gestion des sections</h3>
        </div>
        <span className="text-[11px] text-stone-400">
          {sections.filter((s) => s.enabled).length} / {sections.length} actives
        </span>
      </div>

      <p className="text-xs text-stone-400 leading-relaxed">
        Activez, désactivez ou réorganisez l'ordre d'affichage des sections sur votre vitrine.
      </p>

      <div className="space-y-2.5">
        {sections.map((section, idx) => {
          const meta = SECTION_METADATA[section.id] || {
            label: section.id,
            desc: '',
          };

          return (
            <div
              key={section.id}
              className={cn(
                'p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3',
                section.enabled
                  ? 'bg-[#18181c] border-stone-800'
                  : 'bg-[#141416] border-stone-900 opacity-60',
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="flex flex-col gap-0.5 mt-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveSection(idx, 'up')}
                    disabled={idx === 0}
                    aria-label={`Monter la section ${meta.label}`}
                    className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(idx, 'down')}
                    disabled={idx === sections.length - 1}
                    aria-label={`Descendre la section ${meta.label}`}
                    className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">{meta.label}</span>
                    {!section.enabled && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-stone-800 text-stone-400">
                        Masquée
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">{meta.desc}</p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <Switch
                  checked={section.enabled}
                  onCheckedChange={() => toggleSection(section.id)}
                  aria-label={`Activer ou désactiver ${meta.label}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
