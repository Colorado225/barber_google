import React from 'react';
import {
  PublicSalonDetail,
  SalonMarketplaceViewConfig
} from '../../types';
import { ClassicSalonLayout } from '../../components/marketplace/salon/layouts/ClassicSalonLayout';
import { ElegantSalonLayout } from '../../components/marketplace/salon/layouts/ElegantSalonLayout';
import { EditorialSalonLayout } from '../../components/marketplace/salon/layouts/EditorialSalonLayout';
import { ViewportMode } from './SalonMarketplaceToolbar';
import { cn } from '../../lib/utils';
import { Sparkles, Eye } from 'lucide-react';

interface SalonMarketplacePreviewProps {
  detail: PublicSalonDetail;
  config: SalonMarketplaceViewConfig;
  viewport: ViewportMode;
  formatPrice?: (amount: number) => string;
}

export const SalonMarketplacePreview: React.FC<SalonMarketplacePreviewProps> = ({
  detail,
  config,
  viewport,
  formatPrice
}) => {
  const isConstrained = viewport !== 'desktop';

  return (
    <div className="flex-1 flex flex-col items-center justify-start overflow-x-auto min-h-[600px] bg-[#09090b] rounded-2xl border border-stone-800/80 p-3 sm:p-6 shadow-inner">
      {/* Live Preview Label Banner */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-stone-800/60 mb-6 text-xs text-stone-400">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#C9A45C]" />
          <span className="font-semibold text-white">Aperçu en temps réel</span>
          <span className="text-[11px] text-stone-500">
            — {viewport === 'desktop' ? 'Grand écran (100%)' : viewport === 'tablet' ? 'Tablette (768px)' : 'Mobile (390px)'}
          </span>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-stone-400">
          Modèle : <strong className="text-white capitalize">{config.layout}</strong>
        </span>
      </div>

      {/* Device Frame Wrapper */}
      <div
        className={cn(
          'transition-all duration-300 w-full',
          viewport === 'tablet' && 'max-w-[768px] border-4 border-stone-800 rounded-[32px] p-4 shadow-2xl bg-[#0d0d0e]',
          viewport === 'mobile' && 'max-w-[390px] border-4 border-stone-800 rounded-[36px] p-3 shadow-2xl bg-[#0d0d0e]'
        )}
      >
        <div className="bg-[#0d0d0e] text-[#f7f6f2] rounded-2xl overflow-hidden p-2 sm:p-4">
          {config.layout === 'elegant' && (
            <ElegantSalonLayout
              detail={detail}
              config={config}
              formatPrice={formatPrice}
              onBookNow={() => {}}
              onSelectService={() => {}}
              onSelectStaff={() => {}}
            />
          )}

          {config.layout === 'editorial' && (
            <EditorialSalonLayout
              detail={detail}
              config={config}
              formatPrice={formatPrice}
              onBookNow={() => {}}
              onSelectService={() => {}}
              onSelectStaff={() => {}}
            />
          )}

          {(config.layout === 'classic' || (!['elegant', 'editorial'].includes(config.layout))) && (
            <ClassicSalonLayout
              detail={detail}
              config={config}
              formatPrice={formatPrice}
              onBookNow={() => {}}
              onSelectService={() => {}}
              onSelectStaff={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
};
