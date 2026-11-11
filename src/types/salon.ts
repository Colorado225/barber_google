// Types du domaine salon : établissement, catalogue de services, équipe et avis vérifiés.

import type { PaymentMethod } from './finance';

export type SalonType = 'barbershop' | 'salon_femme' | 'salon_mixte' | 'institut';

export interface OpeningHour {
  day: string;
  open: string;
  close: string;
  isOpen: boolean;
}

export interface SalonGalleryItem {
  id: string;
  url: string;
  title: string;
  description: string;
  isCover?: boolean;
}

export interface Salon {
  id: string;
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  type?: SalonType;
  timezone?: string;
  logo?: string;
  coverImage?: string;
  gallery?: string[];
  galleryItems?: SalonGalleryItem[];
  rating?: number;
  reviewCount?: number;
  country?: string;
  city?: string;
  commune?: string;
  quarter?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  openingHours?: OpeningHour[];
  paymentMethods?: PaymentMethod[];
  minPrice?: number;
  currency?: string;
  nextAvailableSlot?: string;
  isRecommended?: boolean;
  isPopular?: boolean;
  isVerified?: boolean;
  verifiedAt?: string;
  status?: 'active' | 'suspended';
  suspendedAt?: string;
  suspensionReason?: string;
  isPublishedOnMarketplace?: boolean;
  featuredPrestations?: string[];
  publicationDate?: string;
  subscriptionPlanId?: string;
  ownerName?: string;
  /** Fiche fictive du mode démonstration (VITE_MARKETPLACE_DEMO=true). Jamais un salon réel. */
  isDemo?: boolean;
}

export type ServiceCategory = 'coupe' | 'barbe' | 'tresses' | 'soins' | 'coloration' | 'visage' | 'combo';

export interface Service {
  id: string;
  salonId: string;
  name: string;
  category: ServiceCategory;
  description: string;
  price: number;
  durationMinutes: number;
  /** Temps de préparation éventuel (0 par défaut), ignoré dans le calcul métier pour l'instant. */
  prepMinutes?: number;
  popular?: boolean;
  /** Une prestation inactive reste dans l'historique mais n'est plus réservable. */
  isActive?: boolean;
}

export type StaffRole = 'master_barber' | 'barber' | 'colorist' | 'stylist' | 'manager';

export interface StaffMember {
  id: string;
  salonId: string;
  name: string;
  role: StaffRole;
  avatar?: string;
  specialties: string[];
  rating?: number;
  commissionRate: number; // e.g. 30%
  phone: string;
  /** Email facultatif : un employé n'a pas nécessairement de compte de connexion. */
  email?: string;
  /** Succursale d'affectation (null = toutes). */
  branchId?: string | null;
  isAvailable: boolean;
  /** Statut actif/inactif du profil métier. */
  isActive?: boolean;
  /** Prestations maîtrisées. */
  serviceIds?: string[];
  /** Identité de connexion éventuelle, distincte du profil métier. */
  userId?: string | null;
}

export interface Review {
  id: string;
  salonId: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
  isHidden?: boolean;
  moderatedAt?: string;
  moderationReason?: string;
}
