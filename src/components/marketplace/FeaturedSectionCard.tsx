import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { MarketplaceFeaturedSection } from '../../lib/marketplace-content';

interface FeaturedSectionCardProps {
  feature: MarketplaceFeaturedSection;
}

/** Carte « à la une » : utilisée sur la marketplace publique et dans l'aperçu du SuperAdmin. */
export const FeaturedSectionCard: React.FC<FeaturedSectionCardProps> = ({ feature }) => (
  <article
    className={`rounded-3xl p-6 border flex flex-col justify-between gap-6 transition-colors ${
      feature.theme === 'gold'
        ? 'bg-gradient-to-br from-[#211a0e] to-[#141210] border-[#C9A45C]/40'
        : feature.theme === 'emerald'
          ? 'bg-gradient-to-br from-[#0d2217] to-[#101010] border-emerald-500/30'
          : 'bg-[#161619] border-[#282830] hover:border-[#C9A45C]/40'
    }`}
  >
    <div className="space-y-3">
      {feature.eyebrow && (
        <span className="text-[11px] uppercase tracking-wider text-[#C9A45C] font-semibold">
          {feature.eyebrow}
        </span>
      )}
      <h2 className="text-xl font-extrabold text-white">{feature.title}</h2>
      {feature.description && <p className="text-xs text-stone-400 leading-relaxed">{feature.description}</p>}
    </div>
    {feature.ctaLabel && feature.ctaLink && (
      <a
        href={feature.ctaLink}
        className="text-xs font-bold text-[#C9A45C] hover:underline inline-flex items-center gap-1"
      >
        <span>{feature.ctaLabel}</span>
        <ArrowRight className="w-3 h-3" aria-hidden="true" />
      </a>
    )}
  </article>
);
