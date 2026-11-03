export type SalonType = 'barbershop' | 'salon_femme' | 'salon_mixte' | 'institut';

export type PaymentMethod = 'wave' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'cash' | 'card';

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
  slug: string;
  tagline: string;
  description: string;
  type: SalonType;
  logo?: string;
  coverImage: string;
  gallery: string[];
  galleryItems?: SalonGalleryItem[];
  rating: number;
  reviewCount: number;
  country: string;
  city: string;
  commune: string;
  quarter: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  openingHours: OpeningHour[];
  paymentMethods: PaymentMethod[];
  minPrice: number;
  currency: string;
  nextAvailableSlot: string;
  isRecommended: boolean;
  isPopular: boolean;
  isVerified: boolean;
  isPublishedOnMarketplace?: boolean;
  demoOnboarding?: boolean;
  ownerName?: string;
  featuredPrestations?: string[];
  publicationDate?: string;
  subscriptionPlanId: string;
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
  popular?: boolean;
}

export type StaffRole = 'master_barber' | 'barber' | 'colorist' | 'stylist' | 'manager';

export interface StaffMember {
  id: string;
  salonId: string;
  name: string;
  role: StaffRole;
  avatar: string;
  specialties: string[];
  rating: number;
  commissionRate: number; // e.g. 30%
  phone: string;
  isAvailable: boolean;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'refunded';

export interface Appointment {
  id: string;
  salonId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  serviceName: string;
  price: number;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  source: 'marketplace' | 'direct' | 'whatsapp' | 'phone';
  notes?: string;
  createdAt: string;
}

export type ClientSegment = 'new' | 'active' | 'loyal' | 'vip' | 'inactive' | 'to_reactivate';

export interface Client {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  email?: string;
  segment: ClientSegment;
  totalSpent: number;
  visitsCount: number;
  lastVisit: string;
  favoriteService: string;
  preferredBarber?: string;
  notes: string;
  loyaltyPoints?: number;
  totalPointsEarned?: number;
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'vip';
}

export interface PaymentTransaction {
  id: string;
  salonId: string;
  appointmentId?: string;
  clientName: string;
  amount: number;
  method: PaymentMethod;
  type: 'full' | 'deposit' | 'balance';
  reference: string;
  status: 'completed' | 'pending' | 'cancelled';
  date: string;
  time: string;
  cashSessionId?: string;
}

export interface CashSession {
  id: string;
  salonId: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  totalCashIn: number;
  totalMobileMoneyIn: number;
  totalOut: number;
  theoreticalBalance: number;
  actualBalance?: number;
  discrepancy?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export type ExpenseCategory =
  | 'rent'
  | 'electricity'
  | 'water'
  | 'salaries'
  | 'products'
  | 'maintenance'
  | 'marketing'
  | 'other';

export interface Expense {
  id: string;
  salonId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export type StockCategory = 'shampoing' | 'gel_cire' | 'huile_barbe' | 'lames' | 'soin' | 'accessoires';

export interface StockItem {
  id: string;
  salonId: string;
  name: string;
  category: StockCategory;
  quantity: number;
  minThreshold: number;
  unitCost: number;
  sellingPrice?: number;
  supplier: string;
  lastRestock: string;
}

export interface Review {
  id: string;
  salonId: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonth: number;
  priceYear: number;
  isPopular?: boolean;
  features: string[];
  limits: {
    staff: number;
    branches: number;
    appointmentsPerMonth: number;
    inventory: boolean;
    whatsappAutomations: boolean;
  };
}

export type RewardCategory = 'free_service' | 'discount' | 'product' | 'vip_upgrade';

export interface LoyaltyReward {
  id: string;
  salonId: string;
  name: string;
  description: string;
  pointsCost: number;
  category: RewardCategory;
  isActive: boolean;
  timesRedeemed: number;
  discountPercentage?: number;
  freeServiceName?: string;
  createdAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  salonId: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  points: number; // positive for earn, negative for redeem
  type: 'earned_service' | 'redeemed_reward' | 'welcome_bonus' | 'manual_adjustment';
  description: string;
  rewardId?: string;
  rewardName?: string;
  appointmentId?: string;
  createdAt: string;
}

export interface LoyaltySettings {
  salonId: string;
  pointsPer100Fcfa: number; // e.g. 1 point for every 100 FCFA spent
  welcomeBonus: number; // e.g. 25 points
  silverThreshold: number; // e.g. 100 points
  goldThreshold: number; // e.g. 250 points
  vipThreshold: number; // e.g. 500 points
  programEnabled: boolean;
}
