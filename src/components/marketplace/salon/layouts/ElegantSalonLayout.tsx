import React from 'react';
import { PublicSalonDetail, SalonMarketplaceViewConfig, Service } from '../../../../types';
import { SalonOrderedSections } from '../SalonOrderedSections';

interface LayoutProps {
  detail: PublicSalonDetail;
  config: SalonMarketplaceViewConfig;
  onBookNow?: () => void;
  onSelectService?: (service: Service) => void;
  onSelectStaff?: (staffId: string) => void;
  formatPrice?: (amount: number) => string;
}

/**
 * Modèle 2 — Élégant : grande couverture photographique pleine largeur,
 * cartes aérées en deux colonnes. L'ordre des sections suit la
 * configuration du propriétaire.
 */
export const ElegantSalonLayout: React.FC<LayoutProps> = (props) => (
  <div className="space-y-12">
    <SalonOrderedSections
      {...props}
      cardSectionIds={['featured_services', 'team', 'trust', 'location_hours']}
      cardGridClassName="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch"
      galleryClassName="h-[380px] sm:h-[480px] lg:h-[540px]"
      heroWrapperClassName="border-b border-stone-800/60 pb-8"
    />
  </div>
);
