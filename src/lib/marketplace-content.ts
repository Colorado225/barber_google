import { useState, useEffect } from 'react';
import { logAdminAction } from './superadmin';

export interface MarketplaceTabConfig {
  id: string;
  label: string;
  path: string;
  isExternal?: boolean;
  isVisible: boolean;
  order: number;
}

export interface MarketplaceTrustItem {
  id: string;
  title: string;
  subtitle: string;
  iconName: 'ShieldCheck' | 'Scissors' | 'Clock' | 'Smartphone' | 'Star' | 'Sparkles' | 'Award' | 'CheckCircle';
  isVisible: boolean;
}

export interface MarketplaceCategoryItem {
  id: string;
  label: string;
  slug: string;
  iconName: string;
  description?: string;
  isPopular: boolean;
  isVisible: boolean;
}

export interface MarketplaceStepItem {
  id: string;
  stepNumber: string; // e.g. "01", "02", "03", "04"
  title: string;
  description: string;
  iconName: string;
  isVisible: boolean;
}

export interface MarketplaceCustomSectionItem {
  id: string;
  title: string;
  description: string;
  tag?: string;
  linkUrl?: string;
  linkText?: string;
}

export interface MarketplaceCustomSection {
  id: string;
  title: string;
  badgeText: string;
  description: string;
  layout: 'cards' | 'banner' | 'faq' | 'features';
  isVisible: boolean;
  order: number;
  items: MarketplaceCustomSectionItem[];
}

export interface MarketplaceHeroConfig {
  badgeText: string;
  headlineMain: string;
  headlineHighlight: string;
  description: string;
  searchPlaceholder: string;
  communeFilterText: string;
  ctaText: string;
  showVideo: boolean;
  videoUrl?: string;
}

export interface MarketplacePromoBannerConfig {
  enabled: boolean;
  badge: string;
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  theme: 'gold' | 'dark' | 'emerald';
}

export interface MarketplaceProCtaConfig {
  badge: string;
  title: string;
  description: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  showExistingProLink: boolean;
  isVisible: boolean;
}

export interface MarketplaceFaqItem {
  id: string;
  question: string;
  answer: string;
  isVisible: boolean;
}

export interface MarketplaceContentConfig {
  hero: MarketplaceHeroConfig;
  trustItems: MarketplaceTrustItem[];
  categories: MarketplaceCategoryItem[];
  steps: MarketplaceStepItem[];
  promoBanner: MarketplacePromoBannerConfig;
  proCta: MarketplaceProCtaConfig;
  faqs: MarketplaceFaqItem[];
  customSections: MarketplaceCustomSection[];
  navTabs: MarketplaceTabConfig[];
  updatedAt: string;
}

export const MARKETPLACE_CONTENT_STORAGE_KEY = 'barbercuts_marketplace_content_config';
export const MARKETPLACE_CONFIG_EVENT = 'marketplace_config_updated';

export const DEFAULT_MARKETPLACE_CONTENT: MarketplaceContentConfig = {
  hero: {
    badgeText: 'Découvrir les salons',
    headlineMain: 'Votre style mérite',
    headlineHighlight: 'l’excellence.',
    description:
      'Parcourez les salons qui ont publié leurs informations sur Barber Cuts. Recherchez par nom ou commune pour explorer les résultats disponibles.',
    searchPlaceholder: 'Nom du salon ou commune',
    communeFilterText: 'Toutes les communes',
    ctaText: 'Trouver mon salon',
    showVideo: true,
  },
  trustItems: [
    {
      id: 'trust-1',
      title: '15 000+ Coupes Réservées',
      subtitle: 'Sans attente inutile au salon',
      iconName: 'Clock',
      isVisible: true,
    },
    {
      id: 'trust-2',
      title: '100% Barbiers Certifiés',
      subtitle: 'Sélectionnés pour leur savoir-faire',
      iconName: 'Award',
      isVisible: true,
    },
    {
      id: 'trust-3',
      title: 'Paiement Wave & MoMo',
      subtitle: 'Mobile Money instantané & sécurisé',
      iconName: 'Smartphone',
      isVisible: true,
    },
    {
      id: 'trust-4',
      title: 'Avis Clients Vérifiés',
      subtitle: 'Notés uniquement après rendez-vous',
      iconName: 'Star',
      isVisible: true,
    },
  ],
  categories: [
    {
      id: 'cat-1',
      label: 'Dégradé Américain (Fade)',
      slug: 'degrade',
      iconName: 'Scissors',
      description: 'Dégradé à blanc, taper fade, shadow fade',
      isPopular: true,
      isVisible: true,
    },
    {
      id: 'cat-2',
      label: 'Taille & Traçage de Barbe',
      slug: 'barbe',
      iconName: 'Sparkles',
      description: 'Rasage traditionnel à l’ancienne, contour au rasoir',
      isPopular: true,
      isVisible: true,
    },
    {
      id: 'cat-3',
      label: 'Soin Capillaire & Visage',
      slug: 'soins',
      iconName: 'ShieldCheck',
      description: 'Masque noir purifiant, vapeur et serviette chaude',
      isPopular: false,
      isVisible: true,
    },
    {
      id: 'cat-4',
      label: 'Coloration & Décoloration',
      slug: 'coloration',
      iconName: 'Sparkles',
      description: 'Teintures barbes et cheveux, mèches stylisées',
      isPopular: false,
      isVisible: true,
    },
    {
      id: 'cat-5',
      label: 'Formule Combo VIP',
      slug: 'combo',
      iconName: 'Award',
      description: 'Coupe + barbe complète + serviette chaude + soin',
      isPopular: true,
      isVisible: true,
    },
  ],
  steps: [
    {
      id: 'step-1',
      stepNumber: '01',
      title: 'Trouvez',
      description:
        'Comparez les salons réputés, leurs prestations, photos réelles et avis vérifiés près de chez vous.',
      iconName: 'Search',
      isVisible: true,
    },
    {
      id: 'step-2',
      stepNumber: '02',
      title: 'Réservez',
      description:
        'Choisissez votre barbier favori et un créneau réellement disponible sans attendre au salon.',
      iconName: 'Clock',
      isVisible: true,
    },
    {
      id: 'step-3',
      stepNumber: '03',
      title: 'Payez',
      description:
        'Réglez sereinement sur place ou par Mobile Money : Wave, Orange Money, MTN MoMo, Moov.',
      iconName: 'Smartphone',
      isVisible: true,
    },
  ],
  promoBanner: {
    enabled: true,
    badge: 'OFFRE PRIVILÈGE',
    title: 'Grand Concours des Meilleurs Barbiers d’Abidjan 2026',
    description:
      'Votez pour vos artisans préférés et profitez de réductions exclusives sur vos prochaines coupes VIP.',
    buttonText: 'Découvrir les salons certifiés',
    buttonLink: '#salons-section',
    theme: 'gold',
  },
  proCta: {
    badge: 'BARBER CUTS BUSINESS',
    title: 'Développez votre salon avec notre ERP SaaS tout-en-un.',
    description:
      'Planning en direct, gestion de caisse et Mobile Money, relances automatiques WhatsApp, fidélisation CRM, gestion des stocks et multi-succursales.',
    primaryButtonText: 'Découvrir les Tarifs Salons',
    primaryButtonLink: '/tarifs',
    secondaryButtonText: 'Inscrire mon salon',
    secondaryButtonLink: '/inscription',
    showExistingProLink: true,
    isVisible: true,
  },
  faqs: [
    {
      id: 'faq-1',
      question: 'Comment réserver un rendez-vous sur BarberCuts ?',
      answer:
        'Sélectionnez le salon de votre choix, parcourez ses prestations et disponibilités en temps réel, choisissez votre créneau et renseignez votre prénom et numéro de téléphone.',
      isVisible: true,
    },
    {
      id: 'faq-2',
      question: 'Puis-je payer avec Wave ou Orange Money ?',
      answer:
        'Oui ! Les salons partenaires acceptent le règlement en espèces sur place ainsi que les paiements Mobile Money (Wave, Orange Money, MTN MoMo, Moov Money).',
      isVisible: true,
    },
    {
      id: 'faq-3',
      question: 'Comment annuler ou modifier ma réservation ?',
      answer:
        'Grâce au lien unique de réservation transmis par notification ou accessible depuis "Mes réservations", vous pouvez annuler ou contacter votre barbier directement.',
      isVisible: true,
    },
  ],
  customSections: [
    {
      id: 'custom-charte-qualite',
      title: 'Notre Charte d’Excellence & d’Hygiène',
      badgeText: 'STANDARDS ÉLITE',
      description:
        'Chaque établissement listé sur BarberCuts respecte un protocole rigoureux de confort et de propreté.',
      layout: 'cards',
      isVisible: true,
      order: 1,
      items: [
        {
          id: 'item-1',
          title: 'Stérilisation Systématique',
          description:
            'Tondeuses, ciseaux et lames désinfectés aux rayons UV et à l’alcool isopropylique avant chaque prestation.',
          tag: 'Hygiène Médicale',
        },
        {
          id: 'item-2',
          title: 'Ponctualité Sans Faille',
          description:
            'Votre créneau réservé vous attend. Votre barbier est prêt dès votre heure convenue.',
          tag: 'Zéro Attente',
        },
        {
          id: 'item-3',
          title: 'Produits de Soin Professionnels',
          description:
            'Huiles à barbe bio, baumes apaisants, cires modelantes et sérums sélectionnés auprès des meilleures marques.',
          tag: 'Cosmétique Haut de Gamme',
        },
      ],
    },
  ],
  navTabs: [
    {
      id: 'tab-explore',
      label: 'Explorer',
      path: '/',
      isVisible: true,
      order: 1,
    },
    {
      id: 'tab-pricing',
      label: 'Tarifs Salons',
      path: '/tarifs',
      isVisible: true,
      order: 2,
    },
    {
      id: 'tab-register',
      label: 'Inscrire mon salon',
      path: '/inscription',
      isVisible: true,
      order: 3,
    },
    {
      id: 'tab-erp',
      label: 'Espace salon',
      path: '/app/tableau-de-bord',
      isVisible: true,
      order: 4,
    },
  ],
  updatedAt: new Date().toISOString(),
};

/**
 * Récupère la configuration actuelle des sections et onglets de la Marketplace
 */
export function getMarketplaceContent(): MarketplaceContentConfig {
  if (typeof window === 'undefined') return DEFAULT_MARKETPLACE_CONTENT;
  try {
    const raw = localStorage.getItem(MARKETPLACE_CONTENT_STORAGE_KEY);
    if (!raw) return DEFAULT_MARKETPLACE_CONTENT;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MARKETPLACE_CONTENT,
      ...parsed,
      hero: { ...DEFAULT_MARKETPLACE_CONTENT.hero, ...(parsed.hero || {}) },
      promoBanner: { ...DEFAULT_MARKETPLACE_CONTENT.promoBanner, ...(parsed.promoBanner || {}) },
      proCta: { ...DEFAULT_MARKETPLACE_CONTENT.proCta, ...(parsed.proCta || {}) },
      trustItems: parsed.trustItems || DEFAULT_MARKETPLACE_CONTENT.trustItems,
      categories: parsed.categories || DEFAULT_MARKETPLACE_CONTENT.categories,
      steps: parsed.steps || DEFAULT_MARKETPLACE_CONTENT.steps,
      faqs: parsed.faqs || DEFAULT_MARKETPLACE_CONTENT.faqs,
      customSections: parsed.customSections || DEFAULT_MARKETPLACE_CONTENT.customSections,
      navTabs: parsed.navTabs || DEFAULT_MARKETPLACE_CONTENT.navTabs,
    };
  } catch {
    return DEFAULT_MARKETPLACE_CONTENT;
  }
}

/**
 * Enregistre la configuration mise à jour par le SuperAdmin et déclenche la synchronisation en direct
 */
export function saveMarketplaceContent(config: MarketplaceContentConfig, adminEmail: string = 'admin@barbercuts.com'): void {
  if (typeof window === 'undefined') return;
  try {
    const updated = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(MARKETPLACE_CONTENT_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(MARKETPLACE_CONFIG_EVENT, { detail: updated }));
    logAdminAction('Mise à jour des sections & onglets Marketplace', 'Marketplace Globale', adminEmail, 'info');
  } catch (err) {
    console.error('Erreur lors de la sauvegarde de la configuration marketplace', err);
  }
}

/**
 * Réinitialise la configuration aux valeurs par défaut d'usine
 */
export function resetMarketplaceContent(adminEmail: string = 'admin@barbercuts.com'): MarketplaceContentConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MARKETPLACE_CONTENT_STORAGE_KEY, JSON.stringify(DEFAULT_MARKETPLACE_CONTENT));
      window.dispatchEvent(new CustomEvent(MARKETPLACE_CONFIG_EVENT, { detail: DEFAULT_MARKETPLACE_CONTENT }));
      logAdminAction('Réinitialisation des contenus Marketplace', 'Marketplace Globale', adminEmail, 'warning');
    } catch {
      // ignore
    }
  }
  return DEFAULT_MARKETPLACE_CONTENT;
}

/**
 * Hook React pour consommer dynamiquement les contenus de la Marketplace
 */
export function useMarketplaceContent() {
  const [config, setConfig] = useState<MarketplaceContentConfig>(() => getMarketplaceContent());

  useEffect(() => {
    const handleUpdate = () => {
      setConfig(getMarketplaceContent());
    };
    window.addEventListener(MARKETPLACE_CONFIG_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(MARKETPLACE_CONFIG_EVENT, handleUpdate);
    };
  }, []);

  const updateConfig = (newConfig: MarketplaceContentConfig, adminEmail?: string) => {
    saveMarketplaceContent(newConfig, adminEmail);
    setConfig(newConfig);
  };

  const resetConfig = (adminEmail?: string) => {
    const res = resetMarketplaceContent(adminEmail);
    setConfig(res);
  };

  return { config, updateConfig, resetConfig };
}
