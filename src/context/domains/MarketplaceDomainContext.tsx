import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ErpBranch, Review, Salon } from '../../types';
import {
  bookMarketplaceAppointment,
  cancelMarketplaceBooking,
  listMarketplaceSalons,
  setSalonPublication,
  updateSalonProfile,
  type PublicBooking,
  type PublicBookingInput,
} from '../../lib/marketplace';
import {
  extractSearchedCategoriesFromQuery,
  getMarketplaceContent,
  resolveCategoryFilter,
} from '../../lib/marketplace-content';
import { getApiErrorMessage } from '../../lib/apiError';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import type { AppMode } from '../UIContext';
import type { DomainSharedDeps } from './shared';

export type MarketplaceViewMode = 'list' | 'map';

const FAVORITES_STORAGE_PREFIX = 'barber_cuts_favorites_v1:';
const SEARCHED_CATEGORIES_STORAGE_KEY = 'barber_cuts_searched_categories_v1';
const MAX_SEARCHED_CATEGORIES = 8;

function readStoredSearchedCategories(): string[] {
  if (typeof globalThis.localStorage === 'undefined') return [];
  try {
    const raw = globalThis.localStorage.getItem(SEARCHED_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0))].slice(
          0,
          MAX_SEARCHED_CATEGORIES,
        )
      : [];
  } catch {
    return [];
  }
}

function writeStoredSearchedCategories(categories: string[]): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  try {
    globalThis.localStorage.setItem(SEARCHED_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // Stockage local indisponible.
  }
}

function normalizeFavoriteIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))];
}

function readStoredFavoriteIds(userId: string): string[] {
  if (typeof globalThis.localStorage === 'undefined') return [];
  try {
    const raw = globalThis.localStorage.getItem(`${FAVORITES_STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    return normalizeFavoriteIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeStoredFavoriteIds(userId: string, ids: string[]): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  try {
    globalThis.localStorage.setItem(`${FAVORITES_STORAGE_PREFIX}${userId}`, JSON.stringify(ids));
  } catch {
    // Stockage local indisponible (quota ou navigation privée).
  }
}

export interface MarketplaceDomainValue {
  salons: Salon[];
  branches: ErpBranch[];
  reviews: Review[];
  marketplaceLoading: boolean;
  marketplaceError: string | null;
  selectedCategory: string | null;
  setSelectedCategory: (slug: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  priceRange: [number, number] | null;
  setPriceRange: (range: [number, number] | null) => void;
  searchedCategories: string[];
  marketplaceViewMode: MarketplaceViewMode;
  setMarketplaceViewMode: (view: MarketplaceViewMode) => void;
  favoriteSalonIds: string[];
  isFavoriteSalon: (salonId: string) => boolean;
  toggleFavoriteSalon: (salonId: string) => Promise<void>;
  refreshMarketplace: (force?: boolean) => Promise<void>;
  addReview: (review: Omit<Review, 'id' | 'date' | 'verified'>) => Promise<Review>;
  bookPublicAppointment: (
    input: Omit<PublicBookingInput, 'idempotencyKey'> & { idempotencyKey?: string },
  ) => Promise<{ success: boolean; booking?: PublicBooking; error?: string }>;
  cancelPublicBooking: (
    salonId: string,
    appointmentId: string,
    cancelToken: string,
    reason: string,
  ) => Promise<{ success: boolean; booking?: PublicBooking; error?: string }>;
  setSalonPublished: (salonId: string, published: boolean) => Promise<void>;
  updateSalonDetails: (salonId: string, updates: Partial<Salon>) => void;
}

export const MarketplaceDomainContext = createContext<MarketplaceDomainValue | undefined>(undefined);

export function useMarketplaceDomain(): MarketplaceDomainValue {
  const ctx = useContext(MarketplaceDomainContext);
  if (!ctx) throw new Error('useMarketplaceDomain must be used within an AppProvider');
  return ctx;
}

export function useMarketplaceDomainState(
  deps: Pick<DomainSharedDeps, 'resolveApi' | 'domainCache' | 'addToast' | 'remote' | 'newIdempotencyKey'> & {
    mode: AppMode;
    initialSalons?: Salon[];
    isAuthenticated?: boolean;
    authUserId?: string | null;
    userFavoriteIds?: string[] | null;
  },
) {
  const {
    resolveApi,
    domainCache,
    addToast,
    remote,
    newIdempotencyKey,
    mode,
    initialSalons,
    isAuthenticated = false,
    authUserId = null,
    userFavoriteIds = null,
  } = deps;
  const [salons, setSalons] = useState<Salon[]>(() => initialSalons ?? []);
  const [branches, setBranches] = useState<ErpBranch[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(null);
  const [searchQuery, setSearchQueryState] = useState<string>('');
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [searchedCategories, setSearchedCategories] = useState<string[]>(() =>
    readStoredSearchedCategories(),
  );
  const [marketplaceViewMode, setMarketplaceViewMode] = useState<MarketplaceViewMode>('list');
  const [favoriteSalonIds, setFavoriteSalonIds] = useState<string[]>(() => {
    if (!isAuthenticated || !authUserId) return [];
    const localIds = readStoredFavoriteIds(authUserId);
    const metaIds = normalizeFavoriteIds(userFavoriteIds);
    return metaIds.length > 0 ? metaIds : localIds;
  });

  const favoriteSalonIdsRef = useRef(favoriteSalonIds);
  favoriteSalonIdsRef.current = favoriteSalonIds;

  useEffect(() => {
    if (!isAuthenticated || !authUserId) {
      setFavoriteSalonIds([]);
      return;
    }
    const localIds = readStoredFavoriteIds(authUserId);
    const metaIds = normalizeFavoriteIds(userFavoriteIds);
    const resolved = userFavoriteIds !== null && userFavoriteIds !== undefined ? metaIds : localIds;
    setFavoriteSalonIds(resolved);
    if (resolved.length > 0) {
      writeStoredFavoriteIds(authUserId, resolved);
    }
  }, [isAuthenticated, authUserId, userFavoriteIds]);

  const isFavoriteSalon = useCallback(
    (salonId: string) => isAuthenticated && Boolean(authUserId) && favoriteSalonIds.includes(salonId),
    [isAuthenticated, authUserId, favoriteSalonIds],
  );

  const toggleFavoriteSalon = useCallback(
    async (salonId: string) => {
      if (!isAuthenticated || !authUserId) {
        addToast('Connectez-vous pour enregistrer vos salons favoris.', 'info');
        return;
      }

      const current = favoriteSalonIdsRef.current;
      const alreadyFavorite = current.includes(salonId);
      const nextIds = alreadyFavorite ? current.filter((id) => id !== salonId) : [...current, salonId];

      setFavoriteSalonIds(nextIds);
      writeStoredFavoriteIds(authUserId, nextIds);
      addToast(
        alreadyFavorite ? 'Salon retiré de vos favoris.' : 'Salon ajouté à vos favoris.',
        alreadyFavorite ? 'info' : 'success',
      );

      if (isSupabaseConfigured()) {
        try {
          await getSupabaseClient().auth.updateUser({
            data: { favorite_salon_ids: nextIds },
          });
        } catch {
          // La copie locale reste active si la synchronisation distante échoue temporairement.
        }
      }
    },
    [isAuthenticated, authUserId, addToast],
  );

  const recordSearchedCategories = useCallback((slugs: string[]) => {
    const clean = slugs.map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) return;
    setSearchedCategories((prev) => {
      const next = [...new Set([...clean, ...prev])].slice(0, MAX_SEARCHED_CATEGORIES);
      if (next.length === prev.length && next.every((val, i) => val === prev[i])) {
        return prev;
      }
      writeStoredSearchedCategories(next);
      return next;
    });
  }, []);

  const setSelectedCategory = useCallback(
    (slug: string | null) => {
      setSelectedCategoryState(slug);
      if (slug) {
        recordSearchedCategories([slug]);
      }
    },
    [recordSearchedCategories],
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryState(query);
      const matched = extractSearchedCategoriesFromQuery(query, getMarketplaceContent().categories);
      if (matched.length > 0) {
        recordSearchedCategories(matched);
      }
    },
    [recordSearchedCategories],
  );

  const resolveDbCategory = useCallback((slug: string | null): string | null => {
    if (!slug) return null;
    const match = getMarketplaceContent().categories.find((cat) => cat.slug === slug);
    return match ? resolveCategoryFilter(match) : resolveCategoryFilter({ slug, label: slug });
  }, []);

  const refreshMarketplace = useCallback(
    async (force = true) => {
      const dbCategory = resolveDbCategory(selectedCategory);
      setMarketplaceLoading(true);
      setMarketplaceError(null);
      try {
        const list = await domainCache.getOrLoad(
          'public',
          'marketplace',
          () => listMarketplaceSalons(dbCategory ? { category: dbCategory } : {}),
          {
            force,
            qualifier: dbCategory ?? 'all',
          },
        );
        setSalons(list);
      } catch (error) {
        setMarketplaceError(
          error instanceof Error ? error.message : 'Le chargement de la marketplace a échoué.',
        );
      } finally {
        setMarketplaceLoading(false);
      }
    },
    [domainCache, resolveDbCategory, selectedCategory],
  );

  useEffect(() => {
    if (mode !== 'marketplace' || process.env.NODE_ENV === 'test') return;
    if (!isSupabaseConfigured()) return;
    void refreshMarketplace(false);
  }, [mode, refreshMarketplace]);

  const addReview = useCallback(
    async (review: Omit<Review, 'id' | 'date' | 'verified'>): Promise<Review> => {
      try {
        const api = await resolveApi(review.salonId);
        const saved = await api.reviews.create({
          author: review.author,
          rating: review.rating,
          comment: review.comment,
        });
        setReviews((prev) => [saved, ...prev]);
        domainCache.invalidate(review.salonId, 'workspace');
        return saved;
      } catch (error) {
        const message = getApiErrorMessage(error, "Enregistrement de l'avis impossible");
        addToast(message, 'error');
        throw error;
      }
    },
    [resolveApi, domainCache, addToast],
  );

  const updateSalonDetails = useCallback(
    (salonId: string, updates: Partial<Salon>) => {
      void remote(async () => {
        const profile: Record<string, unknown> = {};
        if (updates.name !== undefined) profile.name = updates.name;
        if (updates.slug !== undefined) profile.slug = updates.slug || null;
        if (updates.tagline !== undefined) profile.tagline = updates.tagline;
        if (updates.description !== undefined) profile.description = updates.description;
        if (updates.type !== undefined) profile.type = updates.type;
        if (updates.logo !== undefined) profile.logo_url = updates.logo || null;
        if (updates.coverImage !== undefined) profile.cover_url = updates.coverImage || null;
        if (updates.country !== undefined) profile.country = updates.country;
        if (updates.city !== undefined) profile.city = updates.city;
        if (updates.commune !== undefined) profile.commune = updates.commune;
        if (updates.quarter !== undefined) profile.quarter = updates.quarter;
        if (updates.address !== undefined) profile.address = updates.address;
        if (updates.phone !== undefined) profile.phone = updates.phone;
        if (updates.whatsapp !== undefined) profile.whatsapp = updates.whatsapp;
        if (updates.email !== undefined) profile.email = updates.email || null;
        if (updates.paymentMethods !== undefined) profile.payment_methods = updates.paymentMethods;
        if (updates.featuredPrestations !== undefined)
          profile.featured_service_ids = updates.featuredPrestations;
        if (updates.galleryItems !== undefined) {
          profile.gallery = updates.galleryItems.map((item) => ({
            url: item.url,
            title: item.title,
            description: item.description,
          }));
        } else if (updates.gallery !== undefined) {
          profile.gallery = updates.gallery.map((url) => ({ url, title: '', description: '' }));
        }
        const saved = await updateSalonProfile(salonId, profile);
        setSalons((prev) => prev.map((s) => (s.id === salonId ? saved : s)));
        domainCache.invalidate('public', 'marketplace');
        domainCache.invalidate(salonId, 'workspace');
        addToast('Profil du salon enregistré.', 'success');
      }, 'Enregistrement du profil impossible');
    },
    [remote, domainCache, addToast],
  );

  const setSalonPublished = useCallback(
    async (salonId: string, published: boolean): Promise<void> => {
      try {
        const saved = await setSalonPublication(salonId, published);
        setSalons((prev) => prev.map((s) => (s.id === salonId ? saved : s)));
        domainCache.invalidate('public', 'marketplace');
        addToast(
          published ? 'Salon publié sur la marketplace.' : 'Salon retiré de la marketplace.',
          'success',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Changement de publication impossible.';
        addToast(message, 'error');
        throw error;
      }
    },
    [domainCache, addToast],
  );

  const bookPublicAppointment = useCallback(
    async (
      input: Omit<PublicBookingInput, 'idempotencyKey'> & { idempotencyKey?: string },
    ): Promise<{ success: boolean; booking?: PublicBooking; error?: string }> => {
      try {
        const idempotencyKey = input.idempotencyKey ?? newIdempotencyKey();
        const booking = await bookMarketplaceAppointment({ ...input, idempotencyKey });
        domainCache.invalidate(input.salonId, 'appointments');
        return { success: true, booking };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Réservation en ligne impossible.';
        return { success: false, error: message };
      }
    },
    [newIdempotencyKey, domainCache],
  );

  const cancelPublicBooking = useCallback(
    async (
      salonId: string,
      appointmentId: string,
      cancelToken: string,
      reason: string,
    ): Promise<{ success: boolean; booking?: PublicBooking; error?: string }> => {
      try {
        const booking = await cancelMarketplaceBooking(salonId, appointmentId, cancelToken, reason);
        domainCache.invalidate(salonId, 'appointments');
        return { success: true, booking };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Annulation impossible.';
        return { success: false, error: message };
      }
    },
    [domainCache],
  );

  const resetMarketplaceDomain = useCallback(() => {
    setBranches([]);
    setReviews([]);
  }, []);

  return {
    salons,
    setSalons,
    branches,
    setBranches,
    reviews,
    setReviews,
    marketplaceLoading,
    marketplaceError,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    priceRange,
    setPriceRange,
    searchedCategories,
    marketplaceViewMode,
    setMarketplaceViewMode,
    favoriteSalonIds,
    isFavoriteSalon,
    toggleFavoriteSalon,
    refreshMarketplace,
    addReview,
    bookPublicAppointment,
    cancelPublicBooking,
    setSalonPublished,
    updateSalonDetails,
    resetMarketplaceDomain,
  };
}
