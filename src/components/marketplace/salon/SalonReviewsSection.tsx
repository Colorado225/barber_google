import React, { useEffect, useState } from 'react';
import { Review, SalonCardStyle } from '../../../types';
import { Card } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { Star, MessageSquare, CheckCircle, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

interface SalonReviewsSectionProps {
  reviews: Review[];
  rating?: number | null;
  reviewCount?: number;
  cardStyle?: SalonCardStyle;
  accentColor?: string;
}

function formatReviewDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    dateStyle: 'medium',
  }).format(parsed);
}

export const SalonReviewsSection: React.FC<SalonReviewsSectionProps> = ({
  reviews = [],
  rating,
  reviewCount = 0,
  cardStyle = 'rounded-3xl',
  accentColor = '#C9A45C',
}) => {
  const verifiedReviews = reviews.filter((r) => r.verified !== false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((prev) => {
      if (verifiedReviews.length === 0) return 0;
      return Math.min(prev, verifiedReviews.length - 1);
    });
  }, [verifiedReviews.length]);

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
          <p>Aucun avis n&apos;a encore été déposé pour cet établissement.</p>
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

  const safeIndex = Math.min(activeIndex, verifiedReviews.length - 1);
  const currentReview = verifiedReviews[safeIndex];
  const hasMultiple = verifiedReviews.length > 1;

  const goPrev = () => {
    if (!hasMultiple) return;
    setActiveIndex((prev) => (prev - 1 + verifiedReviews.length) % verifiedReviews.length);
  };

  const goNext = () => {
    if (!hasMultiple) return;
    setActiveIndex((prev) => (prev + 1) % verifiedReviews.length);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasMultiple) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5" style={{ color: accentColor }} />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Avis certifiés par les clients
            </h2>
            <p className="text-xs text-stone-400">Chaque avis provient d&apos;un rendez-vous réel honoré</p>
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

        {/* Customer Reviews Carousel */}
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Témoignages des clients"
          data-testid="salon-reviews-carousel"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="md:col-span-2 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]/60 rounded-2xl"
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-xs font-semibold text-stone-300 tabular-nums"
              data-testid="reviews-carousel-counter"
            >
              Avis {safeIndex + 1} / {verifiedReviews.length}
            </span>

            {hasMultiple && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Avis précédent"
                  data-testid="reviews-carousel-prev"
                  className="w-8 h-8 rounded-full bg-[#1a1a20] hover:bg-[#23232b] border border-stone-700 hover:border-[#C9A45C]/60 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Avis suivant"
                  data-testid="reviews-carousel-next"
                  className="w-8 h-8 rounded-full bg-[#1a1a20] hover:bg-[#23232b] border border-stone-700 hover:border-[#C9A45C]/60 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <Card
            key={currentReview.id}
            data-testid="reviews-carousel-slide"
            aria-live="polite"
            className={cn(
              'relative overflow-hidden p-5 sm:p-6 bg-[#161619] border border-stone-800 space-y-4 min-h-[210px] flex flex-col justify-between',
              cardStyle,
            )}
          >
            <Quote
              aria-hidden="true"
              className="pointer-events-none absolute -top-2 -right-2 w-20 h-20 opacity-10"
              style={{ color: accentColor }}
            />

            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex items-center gap-1 text-amber-400"
                  aria-label={`Note ${currentReview.rating} sur 5`}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-4 h-4',
                        i < currentReview.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-700',
                      )}
                      aria-hidden="true"
                    />
                  ))}
                  <span className="ml-1.5 text-xs font-semibold text-amber-300 tabular-nums">
                    {currentReview.rating}/5
                  </span>
                </div>
              </div>

              <blockquote className="text-sm sm:text-base text-stone-100 leading-relaxed italic">
                {currentReview.comment
                  ? `« ${currentReview.comment} »`
                  : 'Note attribuée suite à un rendez-vous confirmé.'}
              </blockquote>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-stone-800 relative z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center font-bold text-xs text-white shrink-0"
                  aria-hidden="true"
                >
                  {currentReview.author.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-semibold text-white truncate">
                      {currentReview.author}
                    </span>
                    {currentReview.verified && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-medium">
                        <CheckCircle className="w-3 h-3" aria-hidden="true" />
                        Vérifié
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-stone-400 block">
                    {formatReviewDate(currentReview.date)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {hasMultiple && (
            <div
              className="flex items-center justify-center gap-1.5 pt-1"
              role="tablist"
              aria-label="Sélectionner un avis"
            >
              {verifiedReviews.map((rev, index) => {
                const isActive = index === safeIndex;
                return (
                  <button
                    key={rev.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Afficher l'avis ${index + 1} de ${rev.author}`}
                    data-testid={`reviews-carousel-dot-${index}`}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'h-2 rounded-full transition-all cursor-pointer',
                      isActive ? 'w-6' : 'w-2 bg-stone-700 hover:bg-stone-500',
                    )}
                    style={isActive ? { backgroundColor: accentColor } : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
