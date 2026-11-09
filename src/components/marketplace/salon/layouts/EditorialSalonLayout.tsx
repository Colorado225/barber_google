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
 * Modèle 3 — Éditorial : galerie dominante (2 colonnes sur 3), prestations
 * et équipe mises en avant dans une grille asymétrique. L'ordre des
 * sections suit la configuration du propriétaire.
 */
export const EditorialSalonLayout: React.FC<LayoutProps> = (props) => (
  <div className="space-y-10 sm:space-y-12">
    <SalonOrderedSections
      {...props}
      cardSectionIds={['gallery', 'featured_services', 'team', 'trust', 'location_hours']}
      cardGridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start"
      galleryClassName="h-[360px] sm:h-[440px] lg:h-[480px]"
      galleryInGroupClassName="md:col-span-2 lg:col-span-2"
      heroWrapperClassName="border-b border-stone-800 pb-6"
    />
  </div>
);
