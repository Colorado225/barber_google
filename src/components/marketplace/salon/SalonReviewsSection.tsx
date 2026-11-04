import React from 'react';
import { Review, SalonCardStyle } from '../../../types';
import { Card } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { Star, MessageSquare, CheckCircle, ShieldCheck } from 'lucide-react';

interface SalonReviewsSectionProps {
  reviews: Review[];
  rating?: number | null;
  reviewCount?: number;
  cardStyle?: SalonCardStyle;
  accentColor?: string;
}

export const SalonReviewsSection: React.FC<SalonReviewsSectionProps> = ({
  reviews = [],
  rating,
  reviewCount = 0,
  cardStyle = 'rounded-3xl',
  accentColor = '#C9A45C',
}) => {
  const verifiedReviews = reviews.filter((r) => r.verified !== false);

  if (verifiedReviews.length === 0) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" style={{ color: accentColor }} />
          <h2 className="text-xl font-bold text-white">Avis certifiés</h2>
        </div>
        <Card
          className={cn(
            'p-6 bg-[#161619] border border-stone-800 text-center text-stone-400 text-xs',
            cardStyle,
          )}
        >
          <p>Aucun avis n'a encore été déposé pour cet établissement.</p>
        </Card>
      </section>
    );
  }

  // Calculate rating distribution
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = verifiedReviews.filter((r) => Math.round(r.rating) === stars).length;
    const percentage = verifiedReviews.length > 0 ? (count / verifiedReviews.length) * 100 : 0;
    return { stars, count, percentage };
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5" style={{ color: accentColor }} />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Avis certifiés par les clients
            </h2>
            <p className="text-xs text-stone-400">Chaque avis provient d'un rendez-vous réel honoré</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#1c1c20] px-3.5 py-1.5 rounded-full border border-stone-800">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span className="font-bold text-sm text-white">
            {rating !== null && rating !== undefined ? rating.toFixed(1) : '5.0'}
          </span>
          <span className="text-xs text-stone-400">({reviewCount || verifiedReviews.length})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Rating Breakdown Summary */}
        <Card className={cn('p-5 bg-[#161619] border border-stone-800 space-y-3', cardStyle)}>
          <div className="text-center pb-2 border-b border-stone-800">
            <span className="text-4xl font-black text-white">
              {rating !== null && rating !== undefined ? rating.toFixed(1) : '5.0'}
            </span>
            <div className="flex justify-center gap-1 my-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'w-4 h-4',
                    i < Math.round(rating ?? 5) ? 'fill-amber-400 text-amber-400' : 'text-stone-700',
                  )}
                />
              ))}
            </div>
            <p className="text-[11px] text-stone-400">Note globale basée sur {verifiedReviews.length} avis</p>
          </div>

          <div className="space-y-1.5 pt-1">
            {distribution.map((d) => (
              <div key={d.stars} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-stone-400 text-right">{d.stars}</span>
                <Star className="w-3 h-3 fill-stone-500 text-stone-500" />
                <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${d.percentage}%`, backgroundColor: accentColor }}
                  />
                </div>
                <span className="w-6 text-[10px] text-stone-500 text-right tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Reviews List */}
        <div className="md:col-span-2 space-y-3">
          {verifiedReviews.slice(0, 6).map((rev) => (
            <Card
              key={rev.id}
              className={cn('p-4 bg-[#161619] border border-stone-800 space-y-2', cardStyle)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center font-bold text-xs text-white">
                    {rev.author.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">{rev.author}</span>
                      {rev.verified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Vérifié
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-stone-500 block">
                      {new Intl.DateTimeFormat('fr-FR', {
                        timeZone: 'Africa/Abidjan',
                        dateStyle: 'medium',
                      }).format(new Date(rev.date))}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-3 h-3',
                        i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-700',
                      )}
                    />
                  ))}
                </div>
              </div>

              {rev.comment && (
                <p className="text-xs text-stone-300 leading-relaxed pt-1">« {rev.comment} »</p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
