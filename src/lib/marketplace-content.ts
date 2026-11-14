import { useCallback, useSyncExternalStore } from 'react';
import type { Salon, ServiceCategory } from '../types';

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
  iconName:
    'ShieldCheck' | 'Scissors' | 'Clock' | 'Smartphone' | 'Star' | 'Sparkles' | 'Award' | 'CheckCircle';
  isVisible: boolean;
}

export interface MarketplaceCategoryItem {
  id: string;
  label: string;
  slug: string;
  serviceCategory?: ServiceCategory;
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

/** Bandeau d'annonce affiché tout en haut de la marketplace (site-wide). */
export interface MarketplaceAnnouncementConfig {
  enabled: boolean;
  text: string;
  linkLabel: string;
  linkUrl: string;
}

/** Section « à la une » mise en avant sur la page d'accueil de la marketplace. */
export interface MarketplaceFeaturedSection {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaLink: string;
  theme: 'gold' | 'dark' | 'emerald';
  isVisible: boolean;
  order: number;
}

/** Métadonnées globales du site : SEO, identité, contact, réseaux et pied de page. */
export interface MarketplaceSiteMetadata {
  siteName: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  contactEmail: string;
  contactPhone: string;
  footerText: string;
  copyrightText: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
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
  announcement: MarketplaceAnnouncementConfig;
  featuredSections: MarketplaceFeaturedSection[];
  siteMetadata: MarketplaceSiteMetadata;
  updatedAt: string;
}

export const MARKETPLACE_CONTENT_STORAGE_KEY = 'barbercuts_marketplace_content_config';
export const MARKETPLACE_CONFIG_EVENT = 'marketplace_config_updated';
const DEFAULT_AUDIT_ACTION = 'Mise à jour des sections & onglets Marketplace';

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
      title: 'Réservation en ligne',
      subtitle: 'Choisissez un créneau proposé sur la fiche du salon',
      iconName: 'Clock',
      isVisible: true,
    },
    {
      id: 'trust-2',
      title: 'Salons publiés',
      subtitle: 'Seuls les salons qui ont publié leur fiche sont affichés',
      iconName: 'Award',
      isVisible: true,
    },
    {
      id: 'trust-3',
      title: 'Paiement selon le salon',
      subtitle: 'Les modes de paiement sont indiqués sur chaque fiche',
      iconName: 'Smartphone',
      isVisible: true,
    },
    {
      id: 'trust-4',
      title: 'Avis vérifiés',
      subtitle: 'Un avis lié à un rendez-vous terminé est marqué comme vérifié',
      iconName: 'Star',
      isVisible: true,
    },
  ],
  categories: [
    {
      id: 'cat-1',
      label: 'Dégradé (Fade)',
      slug: 'degrade',
      serviceCategory: 'coupe',
      iconName: 'Scissors',
      description: 'Dégradé à blanc, taper fade, shadow fade et coupe homme',
      isPopular: true,
      isVisible: true,
    },
    {
      id: 'cat-2',
      label: 'Taille de Barbe',
      slug: 'barbe',
      serviceCategory: 'barbe',
      iconName: 'Sparkles',
      description: 'Traçage, sculpture et entretien complet de la barbe',
      isPopular: true,
      isVisible: true,
    },
    {
      id: 'cat-3',
      label: 'Rasage Traditionnel',
      slug: 'rasage',
      serviceCategory: 'barbe',
      iconName: 'ShieldCheck',
      description: 'Rasage à l’ancienne au coupe-chou et serviette chaude',
      isPopular: true,
      isVisible: true,
    },
    {
      id: 'cat-4',
      label: 'Soin Visage',
      slug: 'visage',
      serviceCategory: 'visage',
      iconName: 'Sparkles',
      description: 'Nettoyage en profondeur, masque noir et vapeur',
      isPopular: false,
      isVisible: true,
    },
    {
      id: 'cat-5',
      label: 'Soins Capillaires',
      slug: 'soins',
      serviceCategory: 'soins',
      iconName: 'ShieldCheck',
      description: 'Hydratation, soin du cuir chevelu et massage crânien',
      isPopular: false,
      isVisible: true,
    },
    {
      id: 'cat-6',
      label: 'Tresses & Locks',
      slug: 'tresses',
      serviceCategory: 'tresses',
      iconName: 'Scissors',
      description: 'Vanilles, nattes collées, locks et coiffures protectrices',
      isPopular: false,
      isVisible: true,
    },
    {
      id: 'cat-7',
      label: 'Coloration',
      slug: 'coloration',
      serviceCategory: 'coloration',
      iconName: 'Sparkles',
      description: 'Teinture barbe et cheveux, mèches et décoloration',
      isPopular: false,
      isVisible: true,
    },
    {
      id: 'cat-8',
      label: 'Formule Combo VIP',
      slug: 'combo',
      serviceCategory: 'combo',
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
      description: 'Parcourez les salons publiés, leurs prestations et leurs informations.',
      iconName: 'Search',
      isVisible: true,
    },
    {
      id: 'step-2',
      stepNumber: '02',
      title: 'Réservez',
      description: 'Choisissez un service et un créneau proposé sur la fiche du salon.',
      iconName: 'Clock',
      isVisible: true,
    },
    {
      id: 'step-3',
      stepNumber: '03',
      title: 'Payez',
      description: 'Les modes de paiement dépendent de chaque salon. Consultez sa fiche.',
      iconName: 'Smartphone',
      isVisible: true,
    },
  ],
  promoBanner: {
    enabled: false,
    badge: '',
    title: '',
    description: '',
    buttonText: '',
    buttonLink: '#salons-section',
    theme: 'gold',
  },
  proCta: {
    badge: 'BARBER CUTS BUSINESS',
    title: 'Gérez votre salon avec l’ERP Barber Cuts.',
    description: 'Planning, caisse, clients, services, personnel et statistiques réunis dans un même espace.',
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
        'Sélectionnez le salon de votre choix, puis un service et un créneau proposé sur sa fiche. Renseignez ensuite votre nom, votre prénom et votre numéro de téléphone.',
      isVisible: true,
    },
    {
      id: 'faq-2',
      question: 'Quels moyens de paiement sont acceptés ?',
      answer: 'Les moyens de paiement dépendent de chaque salon. Ils sont indiqués sur sa fiche.',
      isVisible: true,
    },
    {
      id: 'faq-3',
      question: 'Comment annuler ou modifier ma réservation ?',
      answer:
        'Ouvrez le lien de suivi de votre réservation : vous pouvez l’annuler ou contacter le salon. Les liens enregistrés sur cet appareil sont listés dans « Mes réservations ».',
      isVisible: true,
    },
    {
      id: 'faq-4',
      question: 'Comment sont sélectionnés et vérifiés les salons affichés ?',
      answer:
        'Seuls les établissements actifs ayant complété et publié leur fiche (prestations, tarifs, horaires et coordonnées) apparaissent sur BarberCuts. Le badge de vérification est attribué par l’équipe après contrôle des informations du salon.',
      isVisible: true,
    },
    {
      id: 'faq-5',
      question: 'Les avis clients publiés sur les fiches sont-ils authentiques ?',
      answer:
        'Oui. Un avis déposé via le lien de suivi d’un rendez-vous honoré et clôturé est marqué comme vérifié afin d’aider chaque client à choisir en toute confiance.',
      isVisible: true,
    },
  ],
  customSections: [],
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
  announcement: {
    enabled: false,
    text: '',
    linkLabel: '',
    linkUrl: '',
  },
  // Aucune section à la une par défaut : rien n'est affiché tant que le SuperAdmin n'en crée pas.
  featuredSections: [],
  siteMetadata: {
    siteName: 'BarberCuts',
    tagline: 'La plateforme des barbershops d’élite',
    metaTitle: 'BarberCuts | Réservez votre barbier en ligne',
    metaDescription:
      'Parcourez les salons publiés sur BarberCuts et réservez votre prochain rendez-vous en ligne.',
    contactEmail: '',
    contactPhone: '',
    footerText: "La plateforme SaaS ERP et Marketplace leader des barbershops d'élite.",
    copyrightText: '© 2026 Barber Cuts. Tous droits réservés.',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    whatsappUrl: '',
  },
  updatedAt: new Date().toISOString(),
};

type MarketplaceContentListener = () => void;

/**
 * Store partagé (source unique de vérité côté client).
 * Toute écriture notifie immédiatement les abonnés (useSyncExternalStore) : la marketplace,
 * la navbar et les écrans d'administration se mettent à jour dans le même cycle de rendu.
 */
const marketplaceContentListeners = new Set<MarketplaceContentListener>();

// Cache mémorisé : useSyncExternalStore exige une référence stable tant que la donnée brute ne change pas.
let cachedContentRaw: string | null | undefined;
let cachedContent: MarketplaceContentConfig = DEFAULT_MARKETPLACE_CONTENT;

function readRawMarketplaceContent(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(MARKETPLACE_CONTENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Parse la configuration stockée et complète les champs manquants avec les valeurs par défaut
 * (compatibilité avec les configurations enregistrées avant l'ajout des bannières, sections à la une et métadonnées).
 */
export function parseMarketplaceContent(raw: string | null): MarketplaceContentConfig {
  if (!raw) return DEFAULT_MARKETPLACE_CONTENT;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MARKETPLACE_CONTENT,
      ...parsed,
      hero: { ...DEFAULT_MARKETPLACE_CONTENT.hero, ...(parsed.hero || {}) },
      promoBanner: { ...DEFAULT_MARKETPLACE_CONTENT.promoBanner, ...(parsed.promoBanner || {}) },
      proCta: { ...DEFAULT_MARKETPLACE_CONTENT.proCta, ...(parsed.proCta || {}) },
      announcement: { ...DEFAULT_MARKETPLACE_CONTENT.announcement, ...(parsed.announcement || {}) },
      siteMetadata: { ...DEFAULT_MARKETPLACE_CONTENT.siteMetadata, ...(parsed.siteMetadata || {}) },
      trustItems: parsed.trustItems || DEFAULT_MARKETPLACE_CONTENT.trustItems,
      categories: parsed.categories || DEFAULT_MARKETPLACE_CONTENT.categories,
      steps: parsed.steps || DEFAULT_MARKETPLACE_CONTENT.steps,
      faqs: parsed.faqs || DEFAULT_MARKETPLACE_CONTENT.faqs,
      customSections: parsed.customSections || DEFAULT_MARKETPLACE_CONTENT.customSections,
      navTabs: parsed.navTabs || DEFAULT_MARKETPLACE_CONTENT.navTabs,
      featuredSections: parsed.featuredSections || DEFAULT_MARKETPLACE_CONTENT.featuredSections,
    };
  } catch {
    return DEFAULT_MARKETPLACE_CONTENT;
  }
}

function getMarketplaceContentSnapshot(): MarketplaceContentConfig {
  const raw = readRawMarketplaceContent();
  if (raw !== cachedContentRaw) {
    cachedContentRaw = raw;
    cachedContent = parseMarketplaceContent(raw);
  }
  return cachedContent;
}

function subscribeToMarketplaceContent(listener: MarketplaceContentListener): () => void {
  marketplaceContentListeners.add(listener);
  // Synchronisation entre onglets du navigateur (l'événement storage ne se déclenche pas dans l'onglet émetteur).
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === MARKETPLACE_CONTENT_STORAGE_KEY) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    marketplaceContentListeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

function notifyMarketplaceContentChanged(detail: MarketplaceContentConfig): void {
  marketplaceContentListeners.forEach((listener) => listener());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MARKETPLACE_CONFIG_EVENT, { detail }));
  }
}

/** Abonnement au store (utilisable hors React, p. ex. dans les tests ou d'autres modules). */
export function subscribeMarketplaceContent(listener: MarketplaceContentListener): () => void {
  return subscribeToMarketplaceContent(listener);
}

/**
 * Récupère la configuration actuelle des sections et onglets de la Marketplace
 */
export function getMarketplaceContent(): MarketplaceContentConfig {
  return getMarketplaceContentSnapshot();
}

/**
 * Enregistre la configuration mise à jour par le SuperAdmin et déclenche la synchronisation en direct
 */
export function saveMarketplaceContent(
  config: MarketplaceContentConfig,
  _adminEmail: string = 'dominiquek051@gmail.com',
  _auditAction: string = DEFAULT_AUDIT_ACTION,
): MarketplaceContentConfig {
  const updated: MarketplaceContentConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window === 'undefined') return updated;
  try {
    localStorage.setItem(MARKETPLACE_CONTENT_STORAGE_KEY, JSON.stringify(updated));
    notifyMarketplaceContentChanged(updated);
  } catch (err) {
    console.error('Erreur lors de la sauvegarde de la configuration marketplace', err);
  }
  return updated;
}

/**
 * Réinitialise la configuration aux valeurs par défaut d'usine
 */
export function resetMarketplaceContent(
  _adminEmail: string = 'dominiquek051@gmail.com',
): MarketplaceContentConfig {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MARKETPLACE_CONTENT_STORAGE_KEY, JSON.stringify(DEFAULT_MARKETPLACE_CONTENT));
      notifyMarketplaceContentChanged(DEFAULT_MARKETPLACE_CONTENT);
    } catch {
      // ignore
    }
  }
  return DEFAULT_MARKETPLACE_CONTENT;
}

/**
 * Hook React pour consommer dynamiquement les contenus de la Marketplace.
 * Tous les composants qui l'utilisent partagent le même état : une mise à jour est visible partout immédiatement.
 */
export function useMarketplaceContent() {
  const config = useSyncExternalStore(
    subscribeToMarketplaceContent,
    getMarketplaceContentSnapshot,
    getMarketplaceContentSnapshot,
  );

  const updateConfig = useCallback(
    (newConfig: MarketplaceContentConfig, adminEmail?: string, auditAction?: string) =>
      saveMarketplaceContent(newConfig, adminEmail, auditAction),
    [],
  );

  const resetConfig = useCallback((adminEmail?: string) => resetMarketplaceContent(adminEmail), []);

  return { config, updateConfig, resetConfig };
}

const SLUG_TO_SERVICE_CATEGORY: Record<string, ServiceCategory> = {
  coupe: 'coupe',
  degrade: 'coupe',
  fade: 'coupe',
  barbe: 'barbe',
  beard: 'barbe',
  rasage: 'barbe',
  shave: 'barbe',
  tresses: 'tresses',
  braids: 'tresses',
  soins: 'soins',
  soin: 'soins',
  coloration: 'coloration',
  visage: 'visage',
  facial: 'visage',
  combo: 'combo',
};

/** Associe une catégorie éditoriale de la marketplace à la catégorie de prestation PostgreSQL. */
export function resolveCategoryFilter(
  category: Pick<MarketplaceCategoryItem, 'slug' | 'label' | 'serviceCategory'>,
): ServiceCategory | null {
  if (category.serviceCategory) return category.serviceCategory;
  const slugKey = category.slug.trim().toLowerCase();
  if (SLUG_TO_SERVICE_CATEGORY[slugKey]) return SLUG_TO_SERVICE_CATEGORY[slugKey];
  const label = category.label.toLowerCase();
  if (label.includes('fade') || label.includes('dégradé') || label.includes('coupe')) return 'coupe';
  if (label.includes('barbe') || label.includes('rasage') || label.includes('shave')) return 'barbe';
  if (label.includes('tresse') || label.includes('locks')) return 'tresses';
  if (label.includes('visage')) return 'visage';
  if (label.includes('color')) return 'coloration';
  if (label.includes('combo')) return 'combo';
  if (label.includes('soin')) return 'soins';
  return null;
}

/** Filtre côté client (mode démo ou données déjà hydratées avec `serviceCategories`). */
export function matchesSalonCategory(
  salon: Salon,
  category: MarketplaceCategoryItem,
  options: { serverFiltered?: boolean } = {},
): boolean {
  const dbCategory = resolveCategoryFilter(category);
  if (Array.isArray(salon.serviceCategories)) {
    if (dbCategory && salon.serviceCategories.includes(dbCategory)) {
      return true;
    }
    const keyword = category.slug.toLowerCase();
    const haystack = `${salon.name} ${salon.tagline ?? ''} ${salon.description ?? ''}`.toLowerCase();
    return haystack.includes(keyword) || haystack.includes(category.label.toLowerCase());
  }
  if (options.serverFiltered && dbCategory) {
    return true;
  }
  const haystack =
    `${salon.name} ${salon.tagline ?? ''} ${salon.description ?? ''} ${salon.type ?? ''}`.toLowerCase();
  const tokens = [category.slug, ...category.label.split(/[\s&()/]+/)]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 3);
  if (tokens.some((token) => haystack.includes(token))) {
    return true;
  }
  if (dbCategory === 'barbe' || dbCategory === 'coupe' || dbCategory === 'combo') {
    return salon.type === 'barbershop' || salon.type === 'salon_mixte';
  }
  if (dbCategory === 'tresses') {
    return salon.type === 'salon_femme' || salon.type === 'salon_mixte';
  }
  if (dbCategory === 'visage' || dbCategory === 'soins') {
    return salon.type === 'institut' || salon.type === 'salon_mixte' || salon.type === 'salon_femme';
  }
  return false;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Filtre un salon en temps réel par nom ou localisation (ville, commune, quartier, adresse) ou slogan. */
export function matchesSalonSearch(salon: Salon, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystack = normalizeSearchText(
    [salon.name, salon.city, salon.commune, salon.quarter, salon.address, salon.country, salon.tagline]
      .filter((part): part is string => Boolean(part))
      .join(' '),
  );

  return tokens.every((token) => haystack.includes(token));
}

/** Extrait les slugs de catégories de services mentionnés dans une recherche texte libre. */
export function extractSearchedCategoriesFromQuery(
  query: string,
  categories: MarketplaceCategoryItem[] = DEFAULT_MARKETPLACE_CONTENT.categories,
): string[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 3) return [];

  const words = normalizedQuery.split(/[\s,.;:/()-]+/).filter((word) => word.length >= 3);
  if (words.length === 0) return [];

  const matchedSlugs = new Set<string>();

  for (const cat of categories) {
    const normSlug = normalizeSearchText(cat.slug);
    const normLabel = normalizeSearchText(cat.label);
    const labelTokens = normLabel.split(/[\s&()/]+/).filter((token) => token.length >= 4);

    if (
      words.some(
        (word) =>
          word === normSlug ||
          normLabel.includes(word) ||
          labelTokens.some((token) => token.startsWith(word) || word.startsWith(token)),
      )
    ) {
      matchedSlugs.add(cat.slug);
    }
  }

  for (const [alias, serviceCat] of Object.entries(SLUG_TO_SERVICE_CATEGORY)) {
    const normAlias = normalizeSearchText(alias);
    if (words.some((word) => word === normAlias || (word.length >= 4 && normAlias.startsWith(word)))) {
      const catMatch = categories.find(
        (cat) => cat.slug === alias || resolveCategoryFilter(cat) === serviceCat,
      );
      matchedSlugs.add(catMatch ? catMatch.slug : serviceCat);
    }
  }

  return [...matchedSlugs];
}

/** Détermine si un salon doit recevoir le badge dynamique "Recommandé" selon les catégories recherchées. */
export function isSalonRecommendedByHistory(
  salon: Salon,
  searchedCategories: string[],
  categories: MarketplaceCategoryItem[] = DEFAULT_MARKETPLACE_CONTENT.categories,
): boolean {
  if (!searchedCategories || searchedCategories.length === 0) return false;

  return searchedCategories.some((key) => {
    const matchedCategory = categories.find((cat) => cat.slug === key || cat.serviceCategory === key) ?? {
      id: `history-${key}`,
      label: key,
      slug: key,
      serviceCategory: SLUG_TO_SERVICE_CATEGORY[key.toLowerCase()],
      iconName: 'Sparkles',
      isPopular: false,
      isVisible: true,
    };
    return matchesSalonCategory(salon, matchedCategory);
  });
}

/** Coût moyen représentatif d'un salon (prix moyen des prestations ou tarif d'entrée si absent). */
export function resolveSalonAveragePrice(salon: Salon): number | null {
  if (typeof salon.avgPrice === 'number' && Number.isFinite(salon.avgPrice) && salon.avgPrice >= 0) {
    return salon.avgPrice;
  }
  if (typeof salon.minPrice === 'number' && Number.isFinite(salon.minPrice) && salon.minPrice >= 0) {
    return salon.minPrice;
  }
  return null;
}

export interface MarketplacePriceBounds {
  min: number;
  max: number;
  step: number;
}

/** Calcule les bornes du curseur de prix à partir des salons publiés. */
export function computeMarketplacePriceBounds(salons: Salon[]): MarketplacePriceBounds {
  const prices = salons
    .map(resolveSalonAveragePrice)
    .filter((price): price is number => price !== null && Number.isFinite(price));

  const step = 500;
  if (prices.length === 0) {
    return { min: 0, max: 25000, step };
  }

  const maxObserved = Math.max(...prices);
  const roundedMax = Math.max(2000, Math.ceil(maxObserved / step) * step);
  return { min: 0, max: roundedMax, step };
}

/** Vérifie si un salon correspond à la fourchette de prix moyen choisie. */
export function matchesSalonPriceRange(
  salon: Salon,
  priceRange: [number, number] | null,
  bounds: Pick<MarketplacePriceBounds, 'min' | 'max'>,
): boolean {
  if (!priceRange) return true;
  const [minFilter, maxFilter] = priceRange;
  if (minFilter <= bounds.min && maxFilter >= bounds.max) return true;

  const avgPrice = resolveSalonAveragePrice(salon);
  if (avgPrice === null) return false;
  return avgPrice >= minFilter && avgPrice <= maxFilter;
}

/** Sélectionne les salons les mieux notés parmi les établissements publiés et actifs. */
export function selectTopRatedBarbers(salons: Salon[], limit = 8): Salon[] {
  return salons
    .filter(
      (salon) =>
        salon.isPublishedOnMarketplace === true &&
        salon.status !== 'suspended' &&
        typeof salon.rating === 'number' &&
        Number.isFinite(salon.rating) &&
        salon.rating > 0,
    )
    .slice()
    .sort((a, b) => {
      const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;

      const reviewDiff = (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      if (reviewDiff !== 0) return reviewDiff;

      const verifiedDiff = Number(Boolean(b.isVerified)) - Number(Boolean(a.isVerified));
      if (verifiedDiff !== 0) return verifiedDiff;

      const barberPriority = (salon: Salon) =>
        salon.type === 'barbershop' ? 2 : salon.type === 'salon_mixte' ? 1 : 0;
      const typeDiff = barberPriority(b) - barberPriority(a);
      if (typeDiff !== 0) return typeDiff;

      return a.name.localeCompare(b.name, 'fr');
    })
    .slice(0, limit);
}
