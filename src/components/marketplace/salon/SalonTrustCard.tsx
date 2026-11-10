import React from 'react';
import { SalonCardStyle } from '../../../types';
import { Card } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { ShieldCheck, Star, Award, Sparkles, CheckCircle2 } from 'lucide-react';

interface SalonTrustCardProps {
  rating?: number | null;
  reviewCount?: number;
  salonName: string;
  cardStyle?: SalonCardStyle;
  accentColor?: string;
}

export const SalonTrustCard: React.FC<SalonTrustCardProps> = ({
  rating,
  reviewCount = 0,
  salonName: _salonName,
  cardStyle = 'rounded-3xl',
  accentColor = '#C9A45C',
}) => {
  const hasReviews = rating !== undefined && rating !== null && reviewCount > 0;

  return (
    <Card
      className={cn(
        'relative bg-gradient-to-br from-[#1c1a16] via-[#141416] to-[#121214] border border-amber-900/30 p-5 shadow-lg overflow-hidden flex flex-col justify-between group',
        cardStyle,
      )}
    >
      {/* Decorative top ribbon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#101010]"
            style={{ backgroundColor: accentColor }}
          >
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-wider">Gage de confiance</span>
        </div>

        <span className="text-[10px] font-semibold text-amber-300/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
          <Award className="w-3 h-3" />
          Vérifié Barber Cuts
        </span>
      </div>

      {/* Main Trust Metric or Highlight */}
      <div className="my-3 py-1 text-center space-y-1">
        {hasReviews ? (
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'w-5 h-5',
                    i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-stone-700',
                  )}
                />
              ))}
            </div>
            <p className="text-2xl font-black text-white tracking-tight">
              {rating.toFixed(1)} <span className="text-sm font-normal text-stone-400">/ 5</span>
            </p>
            <p className="text-xs text-stone-400 font-medium">
              Basé sur {reviewCount} avis client{reviewCount > 1 ? 's' : ''} certifié
              {reviewCount > 1 ? 's' : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="inline-flex p-2 rounded-xl bg-amber-500/10 text-amber-300 mb-1">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-white">Établissement Professionnel</p>
            <p className="text-xs text-stone-400">Réservations vérifiées & créneaux garantis</p>
          </div>
        )}
      </div>

      {/* Key Guarantees */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800/80 text-[11px] text-stone-300">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Matériel stérilisé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Sans attente garantie</span>
        </div>
      </div>
    </Card>
  );
};
