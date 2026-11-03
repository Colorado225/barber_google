import {
  Salon,
  Service,
  StaffMember,
  Appointment,
  Client,
  PaymentTransaction,
  CashSession,
  Expense,
  StockItem,
  Review,
  SubscriptionPlan,
  LoyaltyReward,
  LoyaltyTransaction,
  LoyaltySettings
} from '../types';

export const INITIAL_SALONS: Salon[] = [
  {
    id: 'salon-1',
    name: "Le Roi du Dégradé",
    slug: 'le-roi-du-degrade',
    tagline: 'Barbier prestige & dégradé signature à Cocody',
    description:
      "Barbershop haut de gamme spécialisé dans le dégradé américain, la barbe sculptée et les soins du visage. Réservation en ligne disponible 24/7.",
    type: 'barbershop',
    coverImage: '/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png',
    gallery: ['/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png'],
    rating: 4.9,
    reviewCount: 0,
    country: "Côte d'Ivoire",
    city: 'Abidjan',
    commune: 'Cocody',
    quarter: 'Riviera 3',
    address: 'Riviera 3, Cocody, Abidjan',
    phone: '+225 07 00 00 00 00',
    whatsapp: '+225 07 00 00 00 00',
    email: 'contact@leroidudegrade.ci',
    openingHours: [
      { day: 'Lundi', open: '09:00', close: '20:00', isOpen: true },
      { day: 'Mardi', open: '09:00', close: '20:00', isOpen: true },
      { day: 'Mercredi', open: '09:00', close: '20:00', isOpen: true },
      { day: 'Jeudi', open: '09:00', close: '20:00', isOpen: true },
      { day: 'Vendredi', open: '09:00', close: '21:00', isOpen: true },
      { day: 'Samedi', open: '08:30', close: '21:00', isOpen: true },
      { day: 'Dimanche', open: '00:00', close: '00:00', isOpen: false }
    ],
    paymentMethods: ['wave', 'orange_money', 'mtn_momo', 'cash'],
    minPrice: 5000,
    currency: 'FCFA',
    nextAvailableSlot: 'Aujourd’hui 09:30',
    isRecommended: true,
    isPopular: true,
    isVerified: true,
    isPublishedOnMarketplace: true,
    subscriptionPlanId: 'plan-pro'
  }
];

export const INITIAL_SERVICES: Service[] = [
  {
    id: 'srv-1',
    salonId: 'salon-1',
    name: 'Coupe classique aux ciseaux',
    category: 'coupe',
    description: 'Coupe soignée ciseaux et tondeuse, finitions au rasoir.',
    price: 3000,
    durationMinutes: 30,
    popular: true
  },
  {
    id: 'srv-2',
    salonId: 'salon-1',
    name: 'Dégradé américain',
    category: 'coupe',
    description: 'Dégradé net à la tondeuse et finitions précises.',
    price: 4000,
    durationMinutes: 40,
    popular: true
  },
  {
    id: 'srv-3',
    salonId: 'salon-1',
    name: 'Taille de barbe serviette chaude',
    category: 'barbe',
    description: 'Taille, dessin et serviette chaude.',
    price: 2500,
    durationMinutes: 25
  },
  {
    id: 'srv-4',
    salonId: 'salon-1',
    name: 'Formule Coupe + Barbe + Soin',
    category: 'combo',
    description: 'La formule complète : coupe, barbe et soin du visage.',
    price: 7000,
    durationMinutes: 60
  }
];

export const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'staff-1',
    salonId: 'salon-1',
    name: 'Ibrahim Ouattara',
    role: 'master_barber',
    avatar: '',
    specialties: ['Dégradé américain', 'Barbe'],
    rating: 0,
    commissionRate: 30,
    phone: '+225 07 00 00 00 01',
    isAvailable: true
  },
  {
    id: 'staff-2',
    salonId: 'salon-1',
    name: 'Kevin Yao',
    role: 'barber',
    avatar: '',
    specialties: ['Coupe classique'],
    rating: 0,
    commissionRate: 25,
    phone: '+225 07 00 00 00 02',
    isAvailable: true
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [];

export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_TRANSACTIONS: PaymentTransaction[] = [];

export const INITIAL_CASH_SESSION: CashSession = {
  id: '',
  salonId: '',
  openedAt: '',
  openingBalance: 0,
  totalCashIn: 0,
  totalMobileMoneyIn: 0,
  totalOut: 0,
  theoreticalBalance: 0,
  status: 'closed'
};

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_STOCKS: StockItem[] = [];

export const INITIAL_REVIEWS: Review[] = [];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter',
    tagline: 'Idéal pour démarrer',
    priceMonth: 15000,
    priceYear: 150000,
    maxStaff: 3,
    maxAppointmentsPerMonth: 500,
    features: ['Agenda en ligne', 'Gestion clients', 'Caisse basique', 'Rapports essentiels']
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    tagline: 'Pour les salons en croissance',
    priceMonth: 35000,
    priceYear: 350000,
    maxStaff: 10,
    maxAppointmentsPerMonth: 2000,
    features: ['Tout Starter', 'Fidelité & points', 'Stocks avancés', 'Commissions', 'Multi-caisses']
  },
  {
    id: 'plan-business',
    name: 'Business',
    tagline: 'Multi-salons & équipes',
    priceMonth: 75000,
    priceYear: 750000,
    maxStaff: 50,
    maxAppointmentsPerMonth: -1,
    features: ['Tout Pro', 'Multi-salons', 'API & intégrations', 'Support prioritaire', 'Rapports avancés']
  }
];

export const INITIAL_LOYALTY_REWARDS: LoyaltyReward[] = [];

export const INITIAL_LOYALTY_TRANSACTIONS: LoyaltyTransaction[] = [];

export const INITIAL_LOYALTY_SETTINGS: LoyaltySettings = {
  pointsPerCurrency: 1,
  currencyPerPoint: 100,
  pointsExpiryDays: 365,
  tiers: [
    { id: 'bronze', name: 'Bronze', minPoints: 0, discountPercent: 0, benefits: [] },
    { id: 'silver', name: 'Argent', minPoints: 1000, discountPercent: 5, benefits: ['Réduction 5%'] },
    { id: 'gold', name: 'Or', minPoints: 5000, discountPercent: 10, benefits: ['Réduction 10%'] },
    { id: 'vip', name: 'VIP', minPoints: 10000, discountPercent: 15, benefits: ['Réduction 15%', 'Accès prioritaire'] }
  ]
};
