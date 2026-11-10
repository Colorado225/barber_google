/**
 * Mode démonstration de la marketplace (opt-in).
 *
 * Activé uniquement par `VITE_MARKETPLACE_DEMO=true` au build ou en local. Tous les contenus
 * ci-dessous sont fictifs et étiquetés « [DÉMO] » : aucun chiffre, aucune note réelle, aucune
 * offre, aucun moyen de paiement ni aucune garantie. Ils ne sont jamais envoyés à l'administration,
 * ne sont jamais écrits en base et ne sont pas réservables. Sans le drapeau, ce module n'est pas chargé.
 */
import type { PublicSalonDetail, Salon, Service, StaffMember } from '../types';
import type {
  MarketplaceContentConfig,
  MarketplaceCustomSection,
  MarketplaceFaqItem,
  MarketplaceFeaturedSection,
  MarketplaceStepItem,
  MarketplaceTrustItem,
} from './marketplace-content';

const DEMO_SALON_SEED: Salon[] = [
  {
    id: 'demo-salon-1',
    name: '[DÉMO] Barbershop exemple — Plateau',
    tagline: 'Fiche fictive pour tester la mise en page.',
    type: 'barbershop',
    commune: 'Plateau',
  },
  {
    id: 'demo-salon-2',
    name: '[DÉMO] Salon mixte exemple — Cocody',
    tagline: 'Fiche fictive. Aucun salon réel.',
    type: 'salon_mixte',
    commune: 'Cocody',
  },
  {
    id: 'demo-salon-3',
    name: '[DÉMO] Institut exemple — Marcory',
    tagline: 'Fiche fictive de démonstration.',
    type: 'institut',
    commune: 'Marcory',
  },
  {
    id: 'demo-salon-4',
    name: '[DÉMO] Barber studio exemple — Yopougon',
    tagline: 'Fiche fictive de démonstration.',
    type: 'barbershop',
    commune: 'Yopougon',
  },
  {
    id: 'demo-salon-5',
    name: '[DÉMO] Salon femme exemple — Riviera',
    tagline: 'Fiche fictive. Aucun salon réel.',
    type: 'salon_femme',
    commune: 'Riviera',
  },
  {
    id: 'demo-salon-6',
    name: '[DÉMO] Salon mixte exemple — Treichville',
    tagline: 'Fiche fictive pour tester les filtres.',
    type: 'salon_mixte',
    commune: 'Treichville',
  },
  {
    id: 'demo-salon-7',
    name: '[DÉMO] Barbershop exemple — Adjamé',
    tagline: 'Fiche fictive de démonstration.',
    type: 'barbershop',
    commune: 'Adjamé',
  },
  {
    id: 'demo-salon-8',
    name: '[DÉMO] Institut exemple — Bingerville',
    tagline: 'Fiche fictive. Aucun salon réel.',
    type: 'institut',
    commune: 'Bingerville',
  },
];

export const DEMO_SALONS: Salon[] = DEMO_SALON_SEED.map((salon) => ({
  ...salon,
  isVerified: false,
  isPublishedOnMarketplace: true,
  isDemo: true,
}));

export interface DemoTestimonial {
  id: string;
  author: string;
  role: string;
  rating: number;
  comment: string;
}

export const DEMO_TESTIMONIALS: DemoTestimonial[] = [
  {
    id: 'demo-t1',
    author: 'Client Exemple A',
    role: '[DÉMO] Avis fictif',
    rating: 5,
    comment: '[DÉMO] Avis fictif : texte d’exemple pour tester la mise en page des témoignages.',
  },
  {
    id: 'demo-t2',
    author: 'Client Exemple B',
    role: '[DÉMO] Avis fictif',
    rating: 4,
    comment: '[DÉMO] Avis fictif : un deuxième texte d’exemple, sans valeur réelle.',
  },
  {
    id: 'demo-t3',
    author: 'Gérant Exemple C',
    role: '[DÉMO] Avis fictif',
    rating: 5,
    comment: '[DÉMO] Témoignage fictif d’un gérant, uniquement pour la démonstration.',
  },
  {
    id: 'demo-t4',
    author: 'Client Exemple D',
    role: '[DÉMO] Avis fictif',
    rating: 4,
    comment: '[DÉMO] Avis fictif de démonstration. Aucun client réel n’est cité.',
  },
];

const DEMO_TRUST_ITEMS: MarketplaceTrustItem[] = [
  {
    id: 'demo-trust-1',
    title: '[DÉMO] Point de confiance 1',
    subtitle: 'Texte fictif',
    iconName: 'Clock',
    isVisible: true,
  },
  {
    id: 'demo-trust-2',
    title: '[DÉMO] Point de confiance 2',
    subtitle: 'Texte fictif',
    iconName: 'Award',
    isVisible: true,
  },
  {
    id: 'demo-trust-3',
    title: '[DÉMO] Point de confiance 3',
    subtitle: 'Texte fictif',
    iconName: 'Smartphone',
    isVisible: true,
  },
  {
    id: 'demo-trust-4',
    title: '[DÉMO] Point de confiance 4',
    subtitle: 'Texte fictif',
    iconName: 'Star',
    isVisible: true,
  },
];

const DEMO_STEPS: MarketplaceStepItem[] = [
  {
    id: 'demo-step-1',
    stepNumber: '01',
    title: '[DÉMO] Étape exemple 1',
    description: 'Texte fictif de démonstration.',
    iconName: 'Search',
    isVisible: true,
  },
  {
    id: 'demo-step-2',
    stepNumber: '02',
    title: '[DÉMO] Étape exemple 2',
    description: 'Texte fictif de démonstration.',
    iconName: 'Clock',
    isVisible: true,
  },
  {
    id: 'demo-step-3',
    stepNumber: '03',
    title: '[DÉMO] Étape exemple 3',
    description: 'Texte fictif de démonstration.',
    iconName: 'Smartphone',
    isVisible: true,
  },
];

const DEMO_FAQS: MarketplaceFaqItem[] = [
  {
    id: 'demo-faq-1',
    question: '[DÉMO] Question exemple 1 ?',
    answer: '[DÉMO] Réponse fictive de démonstration.',
    isVisible: true,
  },
  {
    id: 'demo-faq-2',
    question: '[DÉMO] Question exemple 2 ?',
    answer: '[DÉMO] Réponse fictive de démonstration.',
    isVisible: true,
  },
  {
    id: 'demo-faq-3',
    question: '[DÉMO] Question exemple 3 ?',
    answer: '[DÉMO] Réponse fictive de démonstration.',
    isVisible: true,
  },
];

const DEMO_CUSTOM_SECTIONS: MarketplaceCustomSection[] = [
  {
    id: 'demo-custom-1',
    title: '[DÉMO] Section personnalisée exemple',
    badgeText: '[DÉMO]',
    description: 'Texte fictif de démonstration pour une section personnalisée.',
    layout: 'cards',
    isVisible: true,
    order: 1,
    items: [1, 2, 3].map((n) => ({
      id: `demo-custom-1-item-${n}`,
      title: `[DÉMO] Élément exemple ${n}`,
      description: 'Texte fictif de démonstration.',
      tag: '[DÉMO]',
    })),
  },
];

const DEMO_FEATURED_SECTIONS: MarketplaceFeaturedSection[] = [
  {
    id: 'demo-featured-1',
    eyebrow: '[DÉMO] À LA UNE',
    title: '[DÉMO] Sélection exemple 1',
    description: 'Texte fictif de démonstration.',
    ctaLabel: 'Voir les salons',
    ctaLink: '#salons-section',
    theme: 'gold',
    isVisible: true,
    order: 1,
  },
  {
    id: 'demo-featured-2',
    eyebrow: '[DÉMO] À LA UNE',
    title: '[DÉMO] Sélection exemple 2',
    description: 'Texte fictif de démonstration.',
    ctaLabel: 'Voir les salons',
    ctaLink: '#salons-section',
    theme: 'emerald',
    isVisible: true,
    order: 2,
  },
];

/** Contenus remplacés en mode démo. Les autres champs (hero, catégories, méta-données) restent ceux de la configuration. */
export type MarketplaceDemoContent = Pick<
  MarketplaceContentConfig,
  'trustItems' | 'steps' | 'promoBanner' | 'proCta' | 'faqs' | 'customSections' | 'featuredSections'
>;

export const DEMO_CONTENT: MarketplaceDemoContent = {
  trustItems: DEMO_TRUST_ITEMS,
  steps: DEMO_STEPS,
  promoBanner: {
    enabled: true,
    badge: '[DÉMO] BANDEAU',
    title: '[DÉMO] Bannière promotionnelle exemple',
    description: 'Texte fictif. Aucune offre réelle n’est associée à cette bannière.',
    buttonText: '[DÉMO] Voir les salons',
    buttonLink: '#salons-section',
    theme: 'gold',
  },
  proCta: {
    badge: '[DÉMO] BLOC PROFESSIONNEL',
    title: '[DÉMO] Appel à l’action exemple',
    description: 'Texte fictif de démonstration.',
    primaryButtonText: 'Découvrir les tarifs',
    primaryButtonLink: '/tarifs',
    secondaryButtonText: 'Inscrire mon salon',
    secondaryButtonLink: '/inscription',
    showExistingProLink: true,
    isVisible: true,
  },
  faqs: DEMO_FAQS,
  customSections: DEMO_CUSTOM_SECTIONS,
  featuredSections: DEMO_FEATURED_SECTIONS,
};

export interface MarketplaceDemoData {
  salons: Salon[];
  testimonials: DemoTestimonial[];
  content: MarketplaceDemoContent;
}

export const DEMO_DATA: MarketplaceDemoData = {
  salons: DEMO_SALONS,
  testimonials: DEMO_TESTIMONIALS,
  content: DEMO_CONTENT,
};

const DEMO_SERVICE_TEMPLATES: Array<
  Pick<Service, 'name' | 'category' | 'description' | 'price' | 'durationMinutes'>
> = [
  {
    name: '[DÉMO] Coupe exemple',
    category: 'coupe',
    description: 'Prestation fictive de démonstration.',
    price: 5000,
    durationMinutes: 60,
  },
  {
    name: '[DÉMO] Taille de barbe exemple',
    category: 'barbe',
    description: 'Prestation fictive de démonstration.',
    price: 3000,
    durationMinutes: 30,
  },
  {
    name: '[DÉMO] Soin exemple',
    category: 'soins',
    description: 'Prestation fictive de démonstration.',
    price: 7000,
    durationMinutes: 45,
  },
];

/**
 * Fiche publique fictive pour un salon démo : prestations, équipe et horaires fictifs.
 * Aucune note, aucun avis et aucun créneau ne sont inventés (rating null, reviews vides, disponibilité désactivée).
 */
export function buildDemoSalonDetail(salon: Salon): PublicSalonDetail {
  const services: Service[] = DEMO_SERVICE_TEMPLATES.map((template, index) => ({
    id: `${salon.id}-service-${index + 1}`,
    salonId: salon.id,
    ...template,
    popular: index === 0,
    isActive: true,
  }));
  const serviceIds = services.map((service) => service.id);
  const staff: PublicSalonDetail['staff'] = [1, 2].map((n) => ({
    id: `${salon.id}-staff-${n}`,
    name: `[DÉMO] Barbier exemple ${n}`,
    role: 'barber' as StaffMember['role'],
    specialties: ['Prestation fictive'],
    serviceIds,
  }));
  const openHours = [1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
  }));
  const closedSunday = { weekday: 0, isOpen: false, opensAt: null, closesAt: null };
  return {
    salon: {
      ...salon,
      description: '[DÉMO] Description fictive du salon exemple.',
      minPrice: Math.min(...services.map((service) => service.price)),
    },
    services,
    staff,
    reviews: [],
    branches: [
      {
        id: `${salon.id}-branch-1`,
        name: `[DÉMO] Succursale exemple${salon.commune ? ` — ${salon.commune}` : ''}`,
        timezone: 'Africa/Abidjan',
        hours: [closedSunday, ...openHours],
      },
    ],
    rating: null,
    reviewCount: 0,
    minPrice: Math.min(...services.map((service) => service.price)),
  };
}
