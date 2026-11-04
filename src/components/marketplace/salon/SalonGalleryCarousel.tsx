import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Camera } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SalonCardStyle } from '../../../types';

interface SalonGalleryCarouselProps {
  coverImage?: string;
  gallery?: string[];
  salonName: string;
  cardStyle?: SalonCardStyle;
  className?: string;
}

const DEFAULT_BARBER_IMAGES = [
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=80',
];

export const SalonGalleryCarousel: React.FC<SalonGalleryCarouselProps> = ({
  coverImage,
  gallery = [],
  salonName,
  cardStyle = 'rounded-3xl',
  className = ''
}) => {
  const images = [
    ...(coverImage ? [coverImage] : []),
    ...gallery.filter((src) => src !== coverImage),
  ];

  const displayImages = images.length > 0 ? images : DEFAULT_BARBER_IMAGES;
  const [index, setIndex] = useState(0);

  const goPrev = () => setIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  const goNext = () => setIndex((prev) => (prev + 1) % displayImages.length);

  return (
    <div
      className={cn(
        'relative row-span-2 h-[340px] sm:h-[420px] lg:h-[480px] overflow-hidden bg-[#141417] border border-stone-800 shadow-xl group',
        cardStyle,
        className
      )}
    >
      {/* Images Slider */}
      {displayImages.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt={`${salonName} — photo ${i + 1}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-700',
            i === index ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
          )}
        />
      ))}

      {/* Subtle Bottom & Top Vignette Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

      {/* Pill Indicators on Top Right */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
        <Camera className="w-3 h-3 text-stone-300 mr-1" />
        <span className="text-[11px] font-semibold text-white mr-1.5 tabular-nums">
          {index + 1}/{displayImages.length}
        </span>
        {displayImages.map((src, i) => (
          <span
            key={src}
            className={cn(
              'block h-1 rounded-full transition-all duration-300',
              i === index ? 'w-4 bg-white' : 'w-1 bg-white/40'
            )}
          />
        ))}
      </div>

      {/* Navigation Buttons (Left/Right) with Shadcn-Studio style gradients */}
      {displayImages.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Image précédente"
            className="group/prev absolute inset-y-0 left-0 flex w-1/4 items-center justify-start pl-3 outline-none cursor-pointer z-10"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover/prev:opacity-100" />
            <div className="relative size-9 rounded-full bg-black/50 border border-white/20 flex items-center justify-center -translate-x-2 text-white opacity-70 transition-all duration-300 group-hover/prev:translate-x-0 group-hover/prev:opacity-100 group-hover/prev:scale-105">
              <ChevronLeft className="size-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={goNext}
            aria-label="Image suivante"
            className="group/next absolute inset-y-0 right-0 flex w-1/4 items-center justify-end pr-3 outline-none cursor-pointer z-10"
          >
            <span className="absolute inset-0 bg-gradient-to-l from-black/50 to-transparent opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover/next:opacity-100" />
            <div className="relative size-9 rounded-full bg-black/50 border border-white/20 flex items-center justify-center translate-x-2 text-white opacity-70 transition-all duration-300 group-hover/next:translate-x-0 group-hover/next:opacity-100 group-hover/next:scale-105">
              <ChevronRight className="size-5" />
            </div>
          </button>
        </>
      )}

      {/* Bottom overlay info */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between text-xs text-white/90">
        <span className="px-3 py-1 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 font-medium">
          {images.length > 0 ? 'Galerie officielle du salon' : 'Ambiance du salon'}
        </span>
      </div>
    </div>
  );
};
