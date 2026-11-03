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
    name: 'Le Gentleman',
    slug: 'le-gentleman',
    tagline: 'Barbershop haut de gamme au cœur de la Riviera. Coupes précises, rasage traditionnel et ambiance feutrée.',
    description: 'Né au cœur de la Riviera 2 à Abidjan, Le Gentleman réinvente le rituel de la coiffure masculine africaine et internationale. Fauteuils rétro dorés, serviettes chaudes parfumées aux huiles essentielles, sélection de soins capillaires exclusifs et barbiers chevronnés.',
    type: 'barbershop',
    logo: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=128&q=80',
    coverImage: '/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png',
    gallery: [
      '/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png',
      '/assets/aistudio/screenshot-e664554a-e3b4-4d22-924e-332446e319ad_dfc35c43.png',
      '/assets/aistudio/screenshot-18481913-c95c-475e-8deb-93143b1d04f4_b4e11663.png',
      '/assets/aistudio/screenshot-ddf3f3da-a677-43c3-98cc-b2a17960cd0b_63fcfb93.png'
    ],
    galleryItems: [
      {
        id: 'gal-1',
        url: '/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png',
        title: 'Salon lounge & Sièges en cuir doré',
        description: 'Atmosphère feutrée, miroirs rétro éclairés et fauteuils de barbier ergonomiques vintage.'
      },
      {
        id: 'gal-2',
        url: '/assets/aistudio/screenshot-e664554a-e3b4-4d22-924e-332446e319ad_dfc35c43.png',
        title: 'Dégradé américain haute précision',
        description: 'Finitions nettes aux ciseaux et tondeuse de précision par nos maîtres barbiers.'
      },
      {
        id: 'gal-3',
        url: '/assets/aistudio/screenshot-18481913-c95c-475e-8deb-93143b1d04f4_b4e11663.png',
        title: 'Espace rasage & serviettes chaudes',
        description: 'Rituel complet à la vapeur chaude et huiles essentielles apaisantes.'
      },
      {
        id: 'gal-4',
        url: '/assets/aistudio/screenshot-ddf3f3da-a677-43c3-98cc-b2a17960cd0b_63fcfb93.png',
        title: 'Bar à soins capillaires',
        description: 'Produits de prestige, masques nourrissants et revitalisants.'
      }
    ],
    rating: 4.9,
    reviewCount: 214,
    country: "Côte d'Ivoire",
    city: 'Abidjan',
    commune: 'Cocody',
    quarter: 'Riviera 2',
    address: 'Rue des Jardins, Riviera 2, Cocody',
    phone: '+225 07 08 45 12 89',
    whatsapp: '+225 07 08 45 12 89',
    email: 'contact@legentleman-abidjan.ci',
    openingHours: [
      { day: 'Lundi', open: '09:00', close: '20:00', isOpen: true },
      { day: 'Mardi', open: '09:00', close: '20:00', isOpen: true },
      { day: 'Mercredi', open: '09:00', close: '20:00', isOpen: true },
      { day: 'Jeudi', open: '09:00', close: '21:00', isOpen: true },
      { day: 'Vendredi', open: '08:30', close: '22:00', isOpen: true },
      { day: 'Samedi', open: '08:30', close: '22:00', isOpen: true },
      { day: 'Dimanche', open: '10:00', close: '18:00', isOpen: true },
    ],
    paymentMethods: ['wave', 'orange_money', 'mtn_momo', 'cash', 'card'],
    minPrice: 3000,
    currency: 'FCFA',
    nextAvailableSlot: 'Aujourd\'hui 15:30',
    isRecommended: true,
    isPopular: true,
    isVerified: true,
    isPublishedOnMarketplace: true,
    featuredPrestations: ['srv-1', 'srv-2', 'srv-4'],
    publicationDate: '2026-11-02',
    subscriptionPlanId: 'plan-pro'
  },
  {
    id: 'salon-2',
    name: 'Fade District',
    slug: 'fade-district',
    tagline: 'L\'art du dégradé moderne et de la précision urbaine en Zone 4.',
    description: 'Le spot incontournable des amoureux des dégradés millimétrés (taper, burst, drop fade), des soins de barbe et du design capillaire. Équipe dynamique et ambiance beats & lounge.',
    type: 'barbershop',
    coverImage: '/assets/aistudio/screenshot-e664554a-e3b4-4d22-924e-332446e319ad_dfc35c43.png',
    gallery: [
      '/assets/aistudio/screenshot-e664554a-e3b4-4d22-924e-332446e319ad_dfc35c43.png',
      '/assets/aistudio/screenshot-2d154f69-45b8-4e16-948d-ad4fa1036c1b_72f2bb3a.png'
    ],
    rating: 4.7,
    reviewCount: 142,
    country: "Côte d'Ivoire",
    city: 'Abidjan',
    commune: 'Marcory',
    quarter: 'Zone 4',
    address: 'Boulevard de Marseille, Marcory Zone 4',
    phone: '+225 05 54 22 11 00',
    whatsapp: '+225 05 54 22 11 00',
    email: 'info@fadedistrict.ci',
    openingHours: [
      { day: 'Mardi - Samedi', open: '09:00', close: '21:00', isOpen: true },
      { day: 'Dimanche', open: '11:00', close: '19:00', isOpen: true },
      { day: 'Lundi', open: 'Fermé', close: 'Fermé', isOpen: false }
    ],
    paymentMethods: ['wave', 'orange_money', 'cash', 'mtn_momo'],
    minPrice: 2500,
    currency: 'FCFA',
    nextAvailableSlot: 'Aujourd\'hui 17:00',
    isRecommended: true,
    isPopular: true,
    isVerified: true,
    subscriptionPlanId: 'plan-pro'
  },
  {
    id: 'salon-3',
    name: "King's Cut",
    slug: 'kings-cut',
    tagline: 'Barbershop de quartier, ambiance conviviale, savoir-faire et prix accessibles.',
    description: 'Au cœur de Treichville, King\'s Cut perpétue l\'ambiance chaleureuse du salon de quartier avec la précision d\'artisans barbiers expérimentés depuis plus de 10 ans.',
    type: 'barbershop',
    coverImage: '/assets/aistudio/screenshot-18481913-c95c-475e-8deb-93143b1d04f4_b4e11663.png',
    gallery: [
      '/assets/aistudio/screenshot-18481913-c95c-475e-8deb-93143b1d04f4_b4e11663.png',
      '/assets/aistudio/screenshot-e664554a-e3b4-4d22-924e-332446e319ad_dfc35c43.png'
    ],
    rating: 4.5,
    reviewCount: 58,
    country: "Côte d'Ivoire",
    city: 'Abidjan',
    commune: 'Treichville',
    quarter: 'Avenue 16',
    address: 'Avenue 16, Treichville',
    phone: '+225 01 02 03 04 05',
    whatsapp: '+225 01 02 03 04 05',
    email: 'kingscut.treich@gmail.com',
    openingHours: [
      { day: 'Lundi - Samedi', open: '08:00', close: '21:00', isOpen: true },
      { day: 'Dimanche', open: '09:00', close: '16:00', isOpen: true }
    ],
    paymentMethods: ['cash', 'wave', 'orange_money'],
    minPrice: 2000,
    currency: 'FCFA',
    nextAvailableSlot: 'Aujourd\'hui 16:15',
    isRecommended: false,
    isPopular: true,
    isVerified: true,
    subscriptionPlanId: 'plan-starter'
  },
  {
    id: 'salon-4',
    name: 'Maison Ébène',
    slug: 'maison-ebene',
    tagline: 'Salon de coiffure & esthétique afro contemporaine au Plateau.',
    description: 'Spécialiste des tresses artistiques, coiffures protectrices, soins du cuir chevelu et taille de barbe pour les professionnels et cadres d\'affaires.',
    type: 'salon_mixte',
    coverImage: '/assets/aistudio/screenshot-ddf3f3da-a677-43c3-98cc-b2a17960cd0b_63fcfb93.png',
    gallery: [
      '/assets/aistudio/screenshot-ddf3f3da-a677-43c3-98cc-b2a17960cd0b_63fcfb93.png'
    ],
    rating: 4.8,
    reviewCount: 89,
    country: "Côte d'Ivoire",
    city: 'Abidjan',
    commune: 'Plateau',
    quarter: 'Centre des affaires',
    address: 'Avenue Chardy, Résidence le Général, Plateau',
    phone: '+225 07 48 99 21 00',
    whatsapp: '+225 07 48 99 21 00',
    email: 'contact@maisonebene.ci',
    openingHours: [
      { day: 'Lundi - Samedi', open: '08:30', close: '19:30', isOpen: true },
      { day: 'Dimanche', open: 'Fermé', close: 'Fermé', isOpen: false }
    ],
    paymentMethods: ['wave', 'orange_money', 'card', 'cash'],
    minPrice: 5000,
    currency: 'FCFA',
    nextAvailableSlot: 'Demain 10:00',
    isRecommended: true,
    isPopular: true,
    isVerified: true,
    subscriptionPlanId: 'plan-business'
  },
  {
    id: 'salon-5',
    name: "L'Atelier d'Or",
    slug: 'latelier-dor',
    tagline: 'Coupes hommes & soins barbiers d\'exception à Yopougon.',
    description: 'Une institution à Yopougon Selmer réputée pour ses dégradés impeccables et son ambiance détendue avec thé à la menthe offert.',
    type: 'barbershop',
    coverImage: '/assets/aistudio/screenshot-3a1a87f3-01d3-461a-8fab-68c1b1cf2c8b_93e7d402.png',
    gallery: [
      '/assets/aistudio/screenshot-3a1a87f3-01d3-461a-8fab-68c1b1cf2c8b_93e7d402.png'
    ],
    rating: 4.6,
    reviewCount: 95,
    country: "Côte d'Ivoire",
    city: 'Abidjan',
    commune: 'Yopougon',
    quarter: 'Selmer',
    address: 'Carrefour Selmer, face Pharmacie, Yopougon',
    phone: '+225 05 06 07 08 09',
    whatsapp: '+225 05 06 07 08 09',
    email: 'atelierdor.yop@gmail.com',
    openingHours: [
      { day: 'Lundi - Dimanche', open: '08:00', close: '22:00', isOpen: true }
    ],
    paymentMethods: ['wave', 'orange_money', 'mtn_momo', 'cash'],
    minPrice: 2000,
    currency: 'FCFA',
    nextAvailableSlot: 'Aujourd\'hui 14:00',
    isRecommended: false,
    isPopular: true,
    isVerified: true,
    subscriptionPlanId: 'plan-starter'
  }
];

export const INITIAL_SERVICES: Service[] = [
  // Services Le Gentleman (salon-1)
  {
    id: 'srv-1',
    salonId: 'salon-1',
    name: 'Coupe classique',
    category: 'coupe',
    description: 'Coupe aux ciseaux et tondeuse, shampoing offert, finitions précises au rasoir et après-rasage apaisant.',
    price: 3000,
    durationMinutes: 30,
    popular: true
  },
  {
    id: 'srv-2',
    salonId: 'salon-1',
    name: 'Dégradé américain (Fade)',
    category: 'coupe',
    description: 'Dégradé américain à blanc ou bas, contours au coupe-chou, texture styling au gel mat.',
    price: 4000,
    durationMinutes: 40,
    popular: true
  },
  {
    id: 'srv-3',
    salonId: 'salon-1',
    name: 'Taille & Traçage de Barbe',
    category: 'barbe',
    description: 'Sculpture de la barbe, serviette chaude infusée eucalyptus, rasage des contours et huile de soin hydratante.',
    price: 2500,
    durationMinutes: 25,
    popular: true
  },
  {
    id: 'srv-4',
    salonId: 'salon-1',
    name: 'Formule VIP Gentleman (Coupe + Barbe + Soin)',
    category: 'combo',
    description: 'Le combo complet : coupe sur-mesure, soin barbe à l\'ancienne, serviette chaude et gommage visage express.',
    price: 7000,
    durationMinutes: 60,
    popular: true
  },
  {
    id: 'srv-5',
    salonId: 'salon-1',
    name: 'Soin du visage au charbon actif',
    category: 'visage',
    description: 'Gommage désincrustant, bain de vapeur à l\'ozone, masque purifiant au charbon et crème hydratante.',
    price: 5000,
    durationMinutes: 35
  },
  {
    id: 'srv-6',
    salonId: 'salon-1',
    name: 'Coloration barbe / Bigen Black',
    category: 'coloration',
    description: 'Teinture naturelle pour estomper les poils blancs ou intensifier les contours de la barbe.',
    price: 3500,
    durationMinutes: 30
  },
  {
    id: 'srv-7',
    salonId: 'salon-1',
    name: 'Soins capillaires profonds',
    category: 'soins',
    description: 'Masque revitalisant anti-chute et stimulation du cuir chevelu aux huiles de ricin et romarin.',
    price: 4500,
    durationMinutes: 30
  },
  // Services Fade District (salon-2)
  {
    id: 'srv-8',
    salonId: 'salon-2',
    name: 'Signature Taper Fade',
    category: 'coupe',
    description: 'Dégradé aux tempes et à la nuque ultra précis avec contours nets.',
    price: 3500,
    durationMinutes: 35,
    popular: true
  },
  {
    id: 'srv-9',
    salonId: 'salon-2',
    name: 'Entretien barbe express',
    category: 'barbe',
    description: 'Désépaississage et contours nets au rasoir.',
    price: 2000,
    durationMinutes: 20
  },
  // Services King's Cut (salon-3)
  {
    id: 'srv-10',
    salonId: 'salon-3',
    name: 'Coupe classique',
    category: 'coupe',
    description: 'Coupe aux ciseaux et tondeuse, finitions au rasoir.',
    price: 3000,
    durationMinutes: 30,
    popular: true
  },
  {
    id: 'srv-11',
    salonId: 'salon-3',
    name: 'Dégradé',
    category: 'coupe',
    description: 'Dégradé américain ou à blanc, contours nets.',
    price: 4000,
    durationMinutes: 40,
    popular: true
  }
];

export const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'staff-1',
    salonId: 'salon-1',
    name: 'Ibrahim Touré',
    role: 'master_barber',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    specialties: ['Dégradés laser', 'Rasage à l\'ancienne', 'Sculpture barbe'],
    rating: 4.95,
    commissionRate: 35,
    phone: '+225 07 10 20 30 40',
    isAvailable: true
  },
  {
    id: 'staff-2',
    salonId: 'salon-1',
    name: 'Serge Konan',
    role: 'barber',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    specialties: ['Coupes ciseaux', 'Teinture & Contours', 'Soins visage'],
    rating: 4.85,
    commissionRate: 30,
    phone: '+225 05 11 22 33 44',
    isAvailable: true
  },
  {
    id: 'staff-3',
    salonId: 'salon-1',
    name: 'Aristide Kouamé',
    role: 'colorist',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    specialties: ['Coloration barbe', 'Soins capillaires', 'Dégradé bas'],
    rating: 4.8,
    commissionRate: 30,
    phone: '+225 01 99 88 77 66',
    isAvailable: true
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'client-1',
    salonId: 'salon-1',
    name: 'Kouadio Armand',
    phone: '+225 07 49 10 20 30',
    email: 'armand.kouadio@gmail.com',
    segment: 'vip',
    totalSpent: 84000,
    visitsCount: 12,
    lastVisit: '2026-10-28',
    favoriteService: 'Formule VIP Gentleman',
    preferredBarber: 'Ibrahim Touré',
    notes: 'Préfère la serviette très chaude. Toujours café sans sucre.',
    loyaltyPoints: 340,
    totalPointsEarned: 840,
    loyaltyTier: 'gold'
  },
  {
    id: 'client-2',
    salonId: 'salon-1',
    name: 'Aminata Traoré',
    phone: '+225 05 55 12 34 56',
    email: 'aminata.t@orange.ci',
    segment: 'loyal',
    totalSpent: 38000,
    visitsCount: 6,
    lastVisit: '2026-10-24',
    favoriteService: 'Soins capillaires profonds',
    preferredBarber: 'Serge Konan',
    notes: 'Prend rendez-vous le vendredi fin d\'après-midi.',
    loyaltyPoints: 180,
    totalPointsEarned: 380,
    loyaltyTier: 'silver'
  },
  {
    id: 'client-3',
    salonId: 'salon-1',
    name: 'Moussa Diarra',
    phone: '+225 01 02 44 88 99',
    segment: 'active',
    totalSpent: 18000,
    visitsCount: 3,
    lastVisit: '2026-10-31',
    favoriteService: 'Dégradé américain (Fade)',
    preferredBarber: 'Ibrahim Touré',
    notes: 'Exige des contours très nets au coupe-chou.',
    loyaltyPoints: 120,
    totalPointsEarned: 180,
    loyaltyTier: 'silver'
  },
  {
    id: 'client-4',
    salonId: 'salon-1',
    name: 'Fabrice Bamba',
    phone: '+225 07 77 12 34 90',
    segment: 'to_reactivate',
    totalSpent: 12000,
    visitsCount: 2,
    lastVisit: '2026-09-12',
    favoriteService: 'Coupe classique',
    notes: 'Dernière visite il y a plus de 50 jours. À relancer sur WhatsApp.',
    loyaltyPoints: 40,
    totalPointsEarned: 120,
    loyaltyTier: 'bronze'
  },
  {
    id: 'client-5',
    salonId: 'salon-1',
    name: 'Patrick N\'Dri',
    phone: '+225 05 08 90 22 11',
    segment: 'new',
    totalSpent: 4000,
    visitsCount: 1,
    lastVisit: '2026-11-01',
    favoriteService: 'Dégradé américain (Fade)',
    notes: 'Venu via la Marketplace Barber Cuts.',
    loyaltyPoints: 40,
    totalPointsEarned: 40,
    loyaltyTier: 'bronze'
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    salonId: 'salon-1',
    clientName: 'Kouadio Armand',
    clientPhone: '+225 07 49 10 20 30',
    clientEmail: 'armand.kouadio@gmail.com',
    serviceId: 'srv-4',
    serviceName: 'Formule VIP Gentleman (Coupe + Barbe + Soin)',
    price: 7000,
    staffId: 'staff-1',
    staffName: 'Ibrahim Touré',
    date: '2026-11-02',
    time: '10:15',
    durationMinutes: 60,
    status: 'completed',
    paymentStatus: 'paid',
    paymentMethod: 'wave',
    source: 'marketplace',
    notes: 'Client VIP, a réglé via Wave',
    createdAt: '2026-11-01T18:20:00Z'
  },
  {
    id: 'apt-2',
    salonId: 'salon-1',
    clientName: 'Moussa Diarra',
    clientPhone: '+225 01 02 44 88 99',
    serviceId: 'srv-2',
    serviceName: 'Dégradé américain (Fade)',
    price: 4000,
    staffId: 'staff-2',
    staffName: 'Serge Konan',
    date: '2026-11-02',
    time: '14:00',
    durationMinutes: 40,
    status: 'in_progress',
    paymentStatus: 'paid',
    paymentMethod: 'orange_money',
    source: 'marketplace',
    notes: 'En cabine actuellement',
    createdAt: '2026-11-02T08:15:00Z'
  },
  {
    id: 'apt-3',
    salonId: 'salon-1',
    clientName: 'Patrick N\'Dri',
    clientPhone: '+225 05 08 90 22 11',
    serviceId: 'srv-1',
    serviceName: 'Coupe classique',
    price: 3000,
    staffId: 'staff-1',
    staffName: 'Ibrahim Touré',
    date: '2026-11-02',
    time: '15:30',
    durationMinutes: 30,
    status: 'confirmed',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash',
    source: 'marketplace',
    notes: 'Paiement prévu sur place à l\'arrivée',
    createdAt: '2026-11-02T11:00:00Z'
  },
  {
    id: 'apt-4',
    salonId: 'salon-1',
    clientName: 'Christian Yao',
    clientPhone: '+225 07 12 34 56 78',
    serviceId: 'srv-3',
    serviceName: 'Taille & Traçage de Barbe',
    price: 2500,
    staffId: 'staff-3',
    staffName: 'Aristide Kouamé',
    date: '2026-11-02',
    time: '17:00',
    durationMinutes: 25,
    status: 'confirmed',
    paymentStatus: 'deposit_paid',
    paymentMethod: 'wave',
    source: 'whatsapp',
    notes: 'Acompte 1000 FCFA versé via Wave, solde 1500 FCFA sur place',
    createdAt: '2026-11-02T12:30:00Z'
  },
  {
    id: 'apt-5',
    salonId: 'salon-1',
    clientName: 'Marc-Aurèle Koné',
    clientPhone: '+225 05 90 80 70 60',
    serviceId: 'srv-2',
    serviceName: 'Dégradé américain (Fade)',
    price: 4000,
    staffId: 'staff-2',
    staffName: 'Serge Konan',
    date: '2026-11-03',
    time: '11:00',
    durationMinutes: 40,
    status: 'pending',
    paymentStatus: 'unpaid',
    source: 'marketplace',
    notes: 'Réservation web en attente de validation',
    createdAt: '2026-11-02T13:45:00Z'
  }
];

export const INITIAL_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: 'tx-1',
    salonId: 'salon-1',
    appointmentId: 'apt-1',
    clientName: 'Kouadio Armand',
    amount: 7000,
    method: 'wave',
    type: 'full',
    reference: 'WAVE-CI-9842104',
    status: 'completed',
    date: '2026-11-02',
    time: '10:55',
    cashSessionId: 'sess-today'
  },
  {
    id: 'tx-2',
    salonId: 'salon-1',
    appointmentId: 'apt-2',
    clientName: 'Moussa Diarra',
    amount: 4000,
    method: 'orange_money',
    type: 'full',
    reference: 'OM-CI-7738291',
    status: 'completed',
    date: '2026-11-02',
    time: '14:38',
    cashSessionId: 'sess-today'
  },
  {
    id: 'tx-3',
    salonId: 'salon-1',
    appointmentId: 'apt-4',
    clientName: 'Christian Yao',
    amount: 1000,
    method: 'wave',
    type: 'deposit',
    reference: 'WAVE-CI-1102934',
    status: 'completed',
    date: '2026-11-02',
    time: '12:35',
    cashSessionId: 'sess-today'
  },
  {
    id: 'tx-4',
    salonId: 'salon-1',
    clientName: 'Client Comptoir (Vente Gel Cire)',
    amount: 3500,
    method: 'cash',
    type: 'full',
    reference: 'ESP-1102-001',
    status: 'completed',
    date: '2026-11-02',
    time: '11:20',
    cashSessionId: 'sess-today'
  }
];

export const INITIAL_CASH_SESSION: CashSession = {
  id: 'sess-today',
  salonId: 'salon-1',
  openedAt: '2026-11-02T08:30:00Z',
  openingBalance: 25000, // Fond de caisse en espèces
  totalCashIn: 3500,
  totalMobileMoneyIn: 12000,
  totalOut: 2000, // Petit retrait fournitures
  theoreticalBalance: 26500,
  status: 'open',
  notes: 'Session ouverte par Ibrahim (Master Barber)'
};

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    salonId: 'salon-1',
    title: 'Facture CIE Électricité (Octobre)',
    category: 'electricity',
    amount: 45000,
    date: '2026-10-30',
    paymentMethod: 'orange_money',
    notes: 'Climatisation + chauffe-eau 24/7'
  },
  {
    id: 'exp-2',
    salonId: 'salon-1',
    title: 'Achat boîte lames Derby Premium & lingettes désinfectantes',
    category: 'products',
    amount: 18000,
    date: '2026-11-01',
    paymentMethod: 'wave'
  },
  {
    id: 'exp-3',
    salonId: 'salon-1',
    title: 'Abonnement Fibre Orange Pro',
    category: 'other',
    amount: 25000,
    date: '2026-10-25',
    paymentMethod: 'orange_money',
    notes: 'Wi-Fi haut débit pour les clients'
  },
  {
    id: 'exp-4',
    salonId: 'salon-1',
    title: 'Café Nespresso & Thé menthe pour le bar client',
    category: 'maintenance',
    amount: 15000,
    date: '2026-10-29',
    paymentMethod: 'cash'
  }
];

export const INITIAL_STOCKS: StockItem[] = [
  {
    id: 'stk-1',
    salonId: 'salon-1',
    name: 'Cire coiffante Matte Clay Elegance',
    category: 'gel_cire',
    quantity: 14,
    minThreshold: 5,
    unitCost: 2000,
    sellingPrice: 4000,
    supplier: 'Beauty Pro Abidjan',
    lastRestock: '2026-10-20'
  },
  {
    id: 'stk-2',
    salonId: 'salon-1',
    name: 'Huile de barbe parfum Santal & Cèdre',
    category: 'huile_barbe',
    quantity: 8,
    minThreshold: 4,
    unitCost: 3000,
    sellingPrice: 6000,
    supplier: 'Afro Barber Goods',
    lastRestock: '2026-10-15'
  },
  {
    id: 'stk-3',
    salonId: 'salon-1',
    name: 'Lames de rasoir Derby Professional (Paquet 100)',
    category: 'lames',
    quantity: 3,
    minThreshold: 2,
    unitCost: 4500,
    supplier: 'Comptoir Médical Treichville',
    lastRestock: '2026-10-05'
  },
  {
    id: 'stk-4',
    salonId: 'salon-1',
    name: 'Shampoing purifiant à l\'huile d\'arbre à thé 1L',
    category: 'shampoing',
    quantity: 2,
    minThreshold: 3, // ALERTE RUPTURE
    unitCost: 7500,
    supplier: 'L\'Oréal Pro CI',
    lastRestock: '2026-09-28'
  },
  {
    id: 'stk-5',
    salonId: 'salon-1',
    name: 'Poudre coiffante volumisante Slick Gorilla',
    category: 'gel_cire',
    quantity: 11,
    minThreshold: 4,
    unitCost: 2500,
    sellingPrice: 5000,
    supplier: 'Beauty Pro Abidjan',
    lastRestock: '2026-10-25'
  }
];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    salonId: 'salon-1',
    author: 'Kouadio A.',
    rating: 5,
    date: 'Il y a 3 jours',
    comment: 'Je réserve mon barbier en 30 secondes. Fini l\'attente interminable au salon le samedi. Ibrahim est un artiste !',
    verified: true
  },
  {
    id: 'rev-2',
    salonId: 'salon-1',
    author: 'Aminata T.',
    rating: 5,
    date: 'Il y a 1 semaine',
    comment: 'Je compare les prix et je vois les vraies photos avant de choisir. Le soin capillaire était divin.',
    verified: true
  },
  {
    id: 'rev-3',
    salonId: 'salon-1',
    author: 'Moussa D.',
    rating: 5,
    date: 'Il y a 2 semaines',
    comment: 'Le rappel WhatsApp la veille et 1h avant, c\'est exactement ce qu\'il me fallait. Très pro !',
    verified: true
  }
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter',
    tagline: 'Pour barbier indépendant ou petit salon de quartier',
    priceMonth: 9900,
    priceYear: 99000,
    features: [
      '1 Établissement / Succursale',
      'Jusqu\'à 2 collaborateurs',
      'Prise de RDV en ligne & Marketplace',
      'Gestion de caisse & Encaissement Mobile Money',
      'Fichier clients illimité',
      'Support par WhatsApp'
    ],
    limits: {
      staff: 2,
      branches: 1,
      appointmentsPerMonth: 150,
      inventory: false,
      whatsappAutomations: false
    }
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    tagline: 'Le plus populaire pour les salons réputés en pleine croissance',
    priceMonth: 19900,
    priceYear: 199000,
    isPopular: true,
    features: [
      '1 Établissement + option succursale',
      'Jusqu\'à 6 collaborateurs',
      'Réservation temps réel avec synchronisation',
      'Rappels automatiques par WhatsApp & SMS',
      'Gestion des stocks & alertes ruptures',
      'Calcul des commissions barbiers',
      'Bilan financier recettes & dépenses',
      'Mise en avant Prioritaire sur la Marketplace'
    ],
    limits: {
      staff: 6,
      branches: 2,
      appointmentsPerMonth: 500,
      inventory: true,
      whatsappAutomations: true
    }
  },
  {
    id: 'plan-business',
    name: 'Business Multi-salons',
    tagline: 'Pour les chaînes, franchises et instituts de prestige',
    priceMonth: 39900,
    priceYear: 399000,
    features: [
      'Multi-établissements illimités',
      'Collaborateurs illimités',
      'Tableaux de bord consolidés',
      'Gestion des rôles & permissions fines (Manager, Caissier, Barbier)',
      'Intégration API Mobile Money personnalisée',
      'Campagnes marketing & segmentation VIP avancée',
      'Gestionnaire de compte dédié 24/7'
    ],
    limits: {
      staff: 999,
      branches: 999,
      appointmentsPerMonth: 99999,
      inventory: true,
      whatsappAutomations: true
    }
  }
];

export const INITIAL_LOYALTY_REWARDS: LoyaltyReward[] = [
  {
    id: 'rew-1',
    salonId: 'salon-1',
    name: 'Taille & Traçage de Barbe Offerte',
    description: 'Serviette chaude parfumée aux huiles essentielles et rasage traditionnel au coupe-chou.',
    pointsCost: 50,
    category: 'free_service',
    isActive: true,
    timesRedeemed: 18,
    freeServiceName: 'Taille & Traçage de Barbe',
    createdAt: '2026-09-01T10:00:00Z'
  },
  {
    id: 'rew-2',
    salonId: 'salon-1',
    name: 'Coupe Signature ou Dégradé Offert',
    description: 'Coupe complète au choix (Dégradé américain, Taper ou ciseaux) avec finitions au rasoir.',
    pointsCost: 100,
    category: 'free_service',
    isActive: true,
    timesRedeemed: 24,
    freeServiceName: 'Dégradé américain (Fade)',
    createdAt: '2026-09-01T10:00:00Z'
  },
  {
    id: 'rew-3',
    salonId: 'salon-1',
    name: '-30% sur tous les Soins & Produits Capillaires',
    description: 'Remise immédiate sur votre panier de cires, baumes à barbe et shampoings professionnels.',
    pointsCost: 40,
    category: 'discount',
    isActive: true,
    timesRedeemed: 12,
    discountPercentage: 30,
    createdAt: '2026-09-15T14:00:00Z'
  },
  {
    id: 'rew-4',
    salonId: 'salon-1',
    name: 'Soin du Visage Purifiant au Charbon Actif',
    description: 'Nettoyage en profondeur des pores, serviette chaude et massage facial relaxant.',
    pointsCost: 120,
    category: 'free_service',
    isActive: true,
    timesRedeemed: 9,
    freeServiceName: 'Soin visage purifiant',
    createdAt: '2026-10-01T12:00:00Z'
  },
  {
    id: 'rew-5',
    salonId: 'salon-1',
    name: 'Surclassement VIP Gentleman (Boisson + Soin)',
    description: 'Accueil privilégié en fauteuil cuir, café espresso offert et soin barbe offert.',
    pointsCost: 75,
    category: 'vip_upgrade',
    isActive: true,
    timesRedeemed: 15,
    createdAt: '2026-10-10T16:00:00Z'
  }
];

export const INITIAL_LOYALTY_SETTINGS: LoyaltySettings = {
  salonId: 'salon-1',
  pointsPer100Fcfa: 1, // 1 point pour 100 FCFA dépensés (ex: coupe à 4 000 FCFA = 40 points)
  welcomeBonus: 20, // 20 points de bienvenue
  silverThreshold: 100,
  goldThreshold: 250,
  vipThreshold: 500,
  programEnabled: true
};

export const INITIAL_LOYALTY_TRANSACTIONS: LoyaltyTransaction[] = [
  {
    id: 'ltx-1',
    salonId: 'salon-1',
    clientId: 'client-1',
    clientName: 'Kouadio Armand',
    clientPhone: '+225 07 49 10 20 30',
    points: 70,
    type: 'earned_service',
    description: 'Prestation Formule VIP Gentleman (7 000 FCFA)',
    appointmentId: 'apt-1',
    createdAt: '2026-11-02T10:15:00Z'
  },
  {
    id: 'ltx-2',
    salonId: 'salon-1',
    clientId: 'client-1',
    clientName: 'Kouadio Armand',
    clientPhone: '+225 07 49 10 20 30',
    points: -50,
    type: 'redeemed_reward',
    description: 'Récompense utilisée : Taille & Traçage de Barbe Offerte',
    rewardId: 'rew-1',
    rewardName: 'Taille & Traçage de Barbe Offerte',
    createdAt: '2026-10-28T14:30:00Z'
  },
  {
    id: 'ltx-3',
    salonId: 'salon-1',
    clientId: 'client-2',
    clientName: 'Aminata Traoré',
    clientPhone: '+225 05 55 12 34 56',
    points: 40,
    type: 'earned_service',
    description: 'Prestation Soins capillaires (4 000 FCFA)',
    createdAt: '2026-10-24T16:00:00Z'
  },
  {
    id: 'ltx-4',
    salonId: 'salon-1',
    clientId: 'client-3',
    clientName: 'Moussa Diarra',
    clientPhone: '+225 01 02 44 88 99',
    points: 40,
    type: 'earned_service',
    description: 'Prestation Dégradé américain (4 000 FCFA)',
    appointmentId: 'apt-2',
    createdAt: '2026-11-02T14:00:00Z'
  },
  {
    id: 'ltx-5',
    salonId: 'salon-1',
    clientId: 'client-5',
    clientName: 'Patrick N\'Dri',
    clientPhone: '+225 05 08 90 22 11',
    points: 20,
    type: 'welcome_bonus',
    description: 'Bonus de bienvenue nouveau client',
    createdAt: '2026-11-01T15:00:00Z'
  }
];

