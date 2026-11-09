import React from 'react';
import { ArrowRight, Megaphone } from 'lucide-react';
import type { MarketplaceAnnouncementConfig } from '../../lib/marketplace-content';

interface SiteAnnouncementBarProps {
  announcement: MarketplaceAnnouncementConfig;
}

/**
 * Bandeau d'annonce global, piloté par le SuperAdmin (Config Marketplace > Bannières).
 * Ne s'affiche que si l'annonce est activée et qu'un texte est renseigné.
 */
export const SiteAnnouncementBar: React.FC<SiteAnnouncementBarProps> = ({ announcement }) => {
  const text = announcement.text.trim();
  if (!announcement.enabled || !text) return null;

  const hasLink = Boolean(announcement.linkLabel.trim() && announcement.linkUrl.trim());

  return (
    <aside
      aria-label="Annonce"
      className="bg-gradient-to-r from-[#211a0e] via-[#332711] to-[#211a0e] border-b border-[#C9A45C]/40 px-4 py-2.5 text-center text-xs text-[#f7e8c3]"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <Megaphone className="w-3.5 h-3.5 text-[#C9A45C] shrink-0" aria-hidden="true" />
        <span className="font-semibold">{text}</span>
        {hasLink && (
          <a
            href={announcement.linkUrl.trim()}
            className="underline underline-offset-4 text-[#C9A45C] hover:text-white font-bold inline-flex items-center gap-1"
          >
            <span>{announcement.linkLabel.trim()}</span>
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </aside>
  );
};
