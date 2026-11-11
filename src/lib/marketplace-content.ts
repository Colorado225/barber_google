import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

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
    setContentStatus('local', null);
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
      setContentStatus('local', null);
      notifyMarketplaceContentChanged(DEFAULT_MARKETPLACE_CONTENT);
    } catch {
      // ignore
    }
  }
  return DEFAULT_MARKETPLACE_CONTENT;
}

// ---------------------------------------------------------------------------
// Persistance serveur (P1 SuperAdmin) : le contenu global Marketplace est une
// configuration de plateforme réellement utilisée par les pages publiques.
// Elle est donc persistée en base (public.platform_marketplace_content), modifiée
// uniquement via des opérations serveur réservées au SuperAdmin (motif + audit),
// le stockage navigateur ne servant plus que de cache de lecture / aperçu local.
// ---------------------------------------------------------------------------

export type MarketplaceContentSource = 'server' | 'local';

export interface MarketplaceContentStatus {
  source: MarketplaceContentSource;
  serverUpdatedAt: string | null;
}

let contentSource: MarketplaceContentSource = 'local';
let contentServerUpdatedAt: string | null = null;
let cachedStatus: MarketplaceContentStatus = { source: contentSource, serverUpdatedAt: null };

function setContentStatus(source: MarketplaceContentSource, serverUpdatedAt: string | null): void {
  if (source === contentSource && serverUpdatedAt === contentServerUpdatedAt) return;
  contentSource = source;
  contentServerUpdatedAt = serverUpdatedAt;
  cachedStatus = { source, serverUpdatedAt };
  notifyMarketplaceContentChanged(getMarketplaceContentSnapshot());
}

export function getMarketplaceContentStatus(): MarketplaceContentStatus {
  return cachedStatus;
}

function hydrateFromServerRow(row: Record<string, unknown>): MarketplaceContentConfig {
  const rawContent = (row.content ?? null) as unknown;
  const merged =
    rawContent && typeof rawContent === 'object'
      ? parseMarketplaceContent(JSON.stringify(rawContent))
      : DEFAULT_MARKETPLACE_CONTENT;
  cachedContentRaw = JSON.stringify(merged);
  cachedContent = merged;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MARKETPLACE_CONTENT_STORAGE_KEY, cachedContentRaw);
    } catch {
      // ignore
    }
  }
  setContentStatus('server', typeof row.updated_at === 'string' ? row.updated_at : null);
  return merged;
}

/**
 * Lit le contenu Marketplace réellement publié en base et hydrate le store partagé.
 * Ne fait rien (et reste en aperçu local) lorsque Supabase n'est pas configuré.
 */
export async function refreshMarketplaceContentFromServer(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data, error } = await getSupabaseClient().rpc('get_public_marketplace_content');
  if (error) throw new Error(error.message || 'Impossible de charger le contenu Marketplace publié.');
  const row = (data ?? {}) as Record<string, unknown>;
  if (!row.content) return false;
  hydrateFromServerRow(row);
  return true;
}

/**
 * Publie une mise à jour du contenu Marketplace :
 * - Supabase configuré : opération serveur réservée au SuperAdmin (motif + audit obligatoires),
 *   le store est hydraté depuis la réponse du serveur ;
 * - sans Supabase (développement local / tests) : aperçu local honnête, marqué « local »
 *   et jamais présenté comme publié.
 */
export async function publishMarketplaceContentUpdate(
  config: MarketplaceContentConfig,
  reason: string,
): Promise<MarketplaceContentStatus> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) {
    throw new Error('Un motif de publication est obligatoire (3 caractères minimum).');
  }
  const { updatedAt: _ignored, ...payload } = config;
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseClient().rpc('admin_update_marketplace_content', {
      p_content: payload,
      p_reason: cleanReason,
    });
    if (error) throw new Error(error.message || 'Publication impossible côté serveur.');
    const row = (data ?? {}) as Record<string, unknown>;
    hydrateFromServerRow(row);
    return getMarketplaceContentStatus();
  }
  saveMarketplaceContent(config);
  return getMarketplaceContentStatus();
}

/** Réinitialise le contenu publié aux valeurs d'usine (même chemin serveur qu'une publication). */
export async function publishMarketplaceContentReset(reason: string): Promise<MarketplaceContentConfig> {
  const status = await publishMarketplaceContentUpdate(
    { ...DEFAULT_MARKETPLACE_CONTENT, updatedAt: new Date().toISOString() },
    reason,
  );
  void status;
  return getMarketplaceContentSnapshot();
}

/** Hook d'état de la source : « server » (publié en base) ou « local » (aperçu sans base). */
export function useMarketplaceContentStatus(): MarketplaceContentStatus {
  return useSyncExternalStore(
    subscribeToMarketplaceContent,
    getMarketplaceContentStatus,
    getMarketplaceContentStatus,
  );
}

/**
 * Charge une seule fois le contenu publié côté serveur (app conteneur).
 * Sans Supabase configuré, c'est un no-op : l'aperçu local reste affiché.
 */
export function useMarketplaceContentServerSync(): void {
  useEffect(() => {
    refreshMarketplaceContentFromServer().catch(() => {
      // Échec de chargement non bloquant : le cache local reste affiché.
    });
  }, []);
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
    (newConfig: MarketplaceContentConfig, reason = '') => publishMarketplaceContentUpdate(newConfig, reason),
    [],
  );

  const resetConfig = useCallback((reason = '') => publishMarketplaceContentReset(reason), []);

  return { config, updateConfig, resetConfig };
}
