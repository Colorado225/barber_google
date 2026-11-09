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
 * Modèle 1 — Classique : présentation structurée inspirée du bloc
 * about-us-page-30 (bento : galerie latérale + cartes métier), réservation
 * immédiatement accessible. L'ordre des sections suit la configuration du
 * propriétaire ; le bento s'applique lorsque la galerie précède les cartes.
 */
export const ClassicSalonLayout: React.FC<LayoutProps> = (props) => (
  <div className="space-y-10 sm:space-y-12">
    <SalonOrderedSections
      {...props}
      cardSectionIds={['featured_services', 'team', 'trust']}
      cardGridClassName="grid gap-4 sm:grid-cols-2"
      trustInGroupClassName="sm:col-span-2"
      bentoGallery
    />
  </div>
);
