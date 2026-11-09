import React from 'react';
import {
  Save,
  Globe,
  UploadCloud,
  EyeOff,
  RotateCcw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

interface SalonMarketplaceToolbarProps {
  viewport: ViewportMode;
  onViewportChange: (viewport: ViewportMode) => void;
  isDirty: boolean;
  isPublished: boolean;
  publishedAt?: string | null;
  saving: boolean;
  publishing: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onRevert: () => void;
  publicUrl?: string;
}

export const SalonMarketplaceToolbar: React.FC<SalonMarketplaceToolbarProps> = ({
  viewport,
  onViewportChange,
  isDirty,
  isPublished,
  publishedAt,
  saving,
  publishing,
  onSaveDraft,
  onPublish,
  onUnpublish,
  onRevert,
  publicUrl,
}) => {
  return (
    <div className="bg-[#161619] border border-stone-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
      {/* Left side: Publication Status & Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isPublished ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Vitrine publiée
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-800 text-stone-300 border border-stone-700">
              <EyeOff className="w-3.5 h-3.5 text-stone-400" />
              Non publiée
            </span>
          )}

          {isDirty ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3" />
              Modifications non enregistrées
            </span>
          ) : (
            <span className="text-[11px] text-stone-400">Brouillon à jour</span>
          )}
        </div>

        {publicUrl && isPublished && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#C9A45C] hover:underline font-medium"
          >
            <span>Voir en direct</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Center: Device Viewport Controls */}
      <div className="flex items-center bg-[#111113] border border-stone-800 rounded-xl p-1 gap-1">
        <button
          type="button"
          onClick={() => onViewportChange('desktop')}
          title="Aperçu Ordinateur"
          className={cn(
            'p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5',
            viewport === 'desktop' ? 'bg-[#25252b] text-white shadow-sm' : 'text-stone-400 hover:text-white',
          )}
        >
          <Monitor className="w-4 h-4" />
          <span className="hidden sm:inline">Desktop</span>
        </button>

        <button
          type="button"
          onClick={() => onViewportChange('tablet')}
          title="Aperçu Tablette (768px)"
          className={cn(
            'p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5',
            viewport === 'tablet' ? 'bg-[#25252b] text-white shadow-sm' : 'text-stone-400 hover:text-white',
          )}
        >
          <Tablet className="w-4 h-4" />
          <span className="hidden sm:inline">Tablette</span>
        </button>

        <button
          type="button"
          onClick={() => onViewportChange('mobile')}
          title="Aperçu Mobile (390px)"
          className={cn(
            'p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5',
            viewport === 'mobile' ? 'bg-[#25252b] text-white shadow-sm' : 'text-stone-400 hover:text-white',
          )}
        >
          <Smartphone className="w-4 h-4" />
          <span className="hidden sm:inline">Mobile</span>
        </button>
      </div>

      {/* Right side: Actions (Save Draft, Publish, Unpublish, Revert) */}
      <div className="flex items-center gap-2">
        {isDirty && (
          <button
            type="button"
            onClick={onRevert}
            disabled={saving || publishing}
            className="px-3 py-2 rounded-xl text-xs font-medium text-stone-300 hover:text-white hover:bg-[#202025] border border-stone-700/80 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Annuler</span>
          </button>
        )}

        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving || publishing}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#222228] hover:bg-[#2a2a32] text-stone-200 border border-stone-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 text-stone-400" />
          )}
          <span>Enregistrer brouillon</span>
        </button>

        {isPublished ? (
          <button
            type="button"
            onClick={onUnpublish}
            disabled={saving || publishing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Dépublier</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={saving || publishing}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C9A45C] hover:brightness-110 text-[#101010] shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {publishing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5" />
            )}
            <span>Publier sur la marketplace</span>
          </button>
        )}
      </div>
    </div>
  );
};
