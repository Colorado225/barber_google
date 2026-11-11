// Types du domaine clients : fiche client et segments de fidélisation.

export type ClientSegment = 'new' | 'active' | 'loyal' | 'vip' | 'inactive' | 'to_reactivate';

export interface Client {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  email?: string;
  segment: ClientSegment;
  totalSpent?: number;
  visitsCount?: number;
  lastVisit?: string;
  favoriteService: string;
  preferredBarber?: string;
  notes: string;
  loyaltyPoints?: number;
  totalPointsEarned?: number;
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'vip';
}
