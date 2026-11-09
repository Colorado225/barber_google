import React from 'react';
import { Salon, SalonMarketplaceViewConfig } from '../../../types';
import { Star, MapPin, Sparkles, Phone, MessageCircle, Calendar } from 'lucide-react';
import { MotionPreset } from '../../ui/motion-preset';

interface SalonHeroProps {
  salon: Salon;
  config: SalonMarketplaceViewConfig;
  onBookNow?: () => void;
  accentColor?: string;
}

export const SalonHero: React.FC<SalonHeroProps> = ({
  salon,
  config,
  onBookNow,
  accentColor = '#C9A45C',
}) => {
  const tagline = config.customTagline || salon.tagline || 'Salon de coiffure & soins pour homme';
  const description = config.customDescription || salon.description || '';
  const locationLabel = [salon.address, salon.quarter, salon.commune, salon.city].filter(Boolean).join(', ');

  const typeLabels: Record<string, string> = {
    barbershop: 'Barbershop Premium',
    salon_femme: 'Salon de Coiffure Femme',
    salon_mixte: 'Salon Mixte & Soins',
    institut: 'Institut de Beauté',
  };

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MotionPreset fade blur slide={{ direction: 'down', offset: 25 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5"
              style={{ color: accentColor }}
            >
              {'//'} {salon.type ? (typeLabels[salon.type] ?? 'Barbershop') : 'Barbershop'}
            </span>
            {salon.isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Sparkles className="w-2.5 h-2.5" />
                Établissement certifié
              </span>
            )}
          </div>
        </MotionPreset>

        {salon.rating !== undefined && (
          <MotionPreset fade blur delay={0.1} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1c20] border border-stone-800">
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span className="font-bold text-xs text-white">{salon.rating.toFixed(1)}</span>
              </div>
              <span className="text-[11px] text-stone-400">({salon.reviewCount ?? 0} avis vérifiés)</span>
            </div>
          </MotionPreset>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-1">
        <MotionPreset
          fade
          blur
          delay={0.15}
          slide={{ direction: 'down', offset: 25 }}
          transition={{ duration: 0.4 }}
          className="space-y-2 max-w-2xl"
        >
          <div className="flex items-center gap-3">
            {salon.logo && (
              <img
                src={salon.logo}
                alt={`Logo ${salon.name}`}
                className="w-12 h-12 rounded-2xl object-cover border border-stone-700 shadow-md shrink-0"
              />
            )}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              {salon.name}
            </h1>
          </div>
          <p className="text-base sm:text-lg text-stone-300 font-medium leading-snug">{tagline}</p>
          {description && (
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-xl">{description}</p>
          )}

          {config.showAddress && locationLabel && (
            <div className="flex items-center gap-1.5 text-xs text-stone-400 pt-1">
              <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span>{locationLabel}</span>
            </div>
          )}
        </MotionPreset>

        <MotionPreset
          fade
          blur
          delay={0.2}
          slide={{ direction: 'left', offset: 25 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-center gap-2.5 shrink-0"
        >
          {config.showPhone && salon.phone && (
            <a
              href={`tel:${salon.phone}`}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#1a1a1e] hover:bg-[#25252b] text-stone-200 text-xs font-semibold border border-stone-800 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-stone-400" />
              <span>Appeler</span>
            </a>
          )}

          {config.showWhatsapp && salon.whatsapp && (
            <a
              href={`https://wa.me/${salon.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold border border-emerald-800/40 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}

          <button
            type="button"
            onClick={onBookNow}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#101010] shadow-lg hover:brightness-110 active:scale-95 transition-all"
            style={{ backgroundColor: accentColor }}
          >
            <Calendar className="w-4 h-4" />
            <span>Prendre rendez-vous</span>
          </button>
        </MotionPreset>
      </div>
    </header>
  );
};
