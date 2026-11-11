// Types du domaine marketplace : personnalisation des vitrines et fiche publique.

import type { Review, Salon, Service, StaffMember } from './salon';

export type SalonMarketplaceSectionId =
  'hero' | 'gallery' | 'featured_services' | 'team' | 'trust' | 'location_hours' | 'reviews';

export type SalonMarketplaceLayout = 'classic' | 'elegant' | 'editorial';

export type SalonCardStyle = 'rounded-3xl' | 'rounded-2xl' | 'rounded-xl';

export interface SalonMarketplaceSection {
  id: SalonMarketplaceSectionId;
  enabled: boolean;
  position: number;
}

export interface SalonMarketplaceViewConfig {
  layout: SalonMarketplaceLayout;
  accentColor: string;
  cardStyle?: SalonCardStyle;
  sections: SalonMarketplaceSection[];
  featuredServiceIds: string[];
  visibleStaffIds: string[];
  featuredGalleryImageIds: string[];
  showAddress: boolean;
  showPhone: boolean;
  showWhatsapp: boolean;
  customTagline?: string;
  customDescription?: string;
  themeMode?: 'dark' | 'light' | 'auto';
  featuredBranchId?: string;
}

/** Fiche publique complète d'un salon sur la marketplace (données ERP réelles). */
export interface PublicSalonDetail {
  salon: Salon;
  services: Service[];
  staff: Pick<StaffMember, 'id' | 'name' | 'role' | 'specialties' | 'serviceIds'>[];
  reviews: Review[];
  branches: {
    id: string;
    name: string;
    timezone: string;
    hours: { weekday: number; isOpen: boolean; opensAt: string | null; closesAt: string | null }[];
  }[];
  rating: number | null;
  reviewCount: number;
  minPrice: number | null;
  customizer?: SalonMarketplaceViewConfig;
}

export interface SalonMarketplaceSettingsRecord {
  salonId: string;
  layout: SalonMarketplaceLayout;
  accentColor: string;
  cardStyle: SalonCardStyle;
  draftConfig: SalonMarketplaceViewConfig;
  publishedConfig: SalonMarketplaceViewConfig | null;
  isPublished: boolean;
  publishedAt?: string | null;
  updatedAt: string;
}
