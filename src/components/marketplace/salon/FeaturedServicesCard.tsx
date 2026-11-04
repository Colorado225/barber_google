import React, { useState } from 'react';
import { Service, SalonCardStyle } from '../../../types';
import { Card } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { Scissors, Sparkles, Clock, ChevronRight, Check } from 'lucide-react';

interface FeaturedServicesCardProps {
  services: Service[];
  featuredIds?: string[];
  cardStyle?: SalonCardStyle;
  accentColor?: string;
  onSelectService?: (service: Service) => void;
  formatPrice?: (amount: number) => string;
}

export const FeaturedServicesCard: React.FC<FeaturedServicesCardProps> = ({
  services,
  featuredIds = [],
  cardStyle = 'rounded-3xl',
  accentColor = '#C9A45C',
  onSelectService,
  formatPrice = (amt) => `${amt.toLocaleString('fr-FR')} FCFA`,
}) => {
  // Prestations mises en avant réelles (issues du catalogue ERP)
  const availableServices = services.filter((s) => s.isActive !== false);
  const featured = featuredIds.length > 0
    ? availableServices.filter((s) => featuredIds.includes(s.id))
    : availableServices.slice(0, 4);

  const displayList = featured.length > 0 ? featured : availableServices.slice(0, 4);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);

  const activeService = displayList[selectedIndex] || displayList[0];

  if (!activeService) {
    return (
      <Card
        className={cn(
          'p-5 border border-stone-800 bg-[#161619] flex items-center justify-center text-center text-stone-400 text-xs min-h-[180px]',
          cardStyle
        )}
      >
        <p>Aucune prestation disponible dans le catalogue.</p>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'relative bg-[#161619] border border-stone-800 p-0 overflow-hidden shadow-lg flex flex-col justify-between transition-all duration-300 group',
        cardStyle
      )}
    >
      {/* Visual Header (inspired by music player card curve) */}
      <div
        className={cn(
          'relative overflow-hidden bg-gradient-to-br from-[#201d18] via-[#17171a] to-[#121214] p-4 transition-all duration-500 border-b border-stone-800/80',
          isExpanded ? 'h-28 rounded-b-2xl' : 'h-20'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#101010] shadow-md"
              style={{ backgroundColor: accentColor }}
            >
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Prestations en vedette
              </span>
              <p className="text-sm font-bold text-white line-clamp-1">
                {activeService.name}
              </p>
            </div>
          </div>

          {activeService.popular && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-2.5 h-2.5" />
              Populaire
            </span>
          )}
        </div>

        {/* Pricing badge */}
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className="text-2xl font-black tracking-tight"
            style={{ color: accentColor }}
          >
            {formatPrice(activeService.price)}
          </span>
          <span className="text-xs text-stone-400 flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3 text-stone-500" />
            {activeService.durationMinutes} min
          </span>
        </div>
      </div>

      {/* Description & Switcher */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
          {activeService.description || 'Prestation professionnelle réalisée par nos barbiers experts.'}
        </p>

        {/* Selector pills for featured services */}
        {displayList.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {displayList.map((service, idx) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer',
                  idx === selectedIndex
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-[#1b1b1f] text-stone-400 hover:text-white border border-stone-800'
                )}
              >
                {service.name}
              </button>
            ))}
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={() => onSelectService?.(activeService)}
          className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-[#101010] flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          style={{ backgroundColor: accentColor }}
        >
          <span>Réserver cette prestation</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
};
