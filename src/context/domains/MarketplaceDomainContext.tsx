import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Review, Salon } from '../../types';
import {
  bookMarketplaceAppointment,
  cancelMarketplaceBooking,
  listMarketplaceSalons,
  setSalonPublication,
  updateSalonProfile,
  type PublicBooking,
  type PublicBookingInput,
} from '../../lib/marketplace';
import { getApiErrorMessage } from '../../lib/apiError';
import type { AppMode } from '../UIContext';
import type { DomainSharedDeps } from './shared';

export interface MarketplaceDomainValue {
  salons: Salon[];
  branches: { id: string; name: string }[];
  reviews: Review[];
  marketplaceLoading: boolean;
  marketplaceError: string | null;
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
  },
) {
  const { resolveApi, domainCache, addToast, remote, newIdempotencyKey, mode } = deps;
  const [salons, setSalons] = useState<Salon[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);

  const refreshMarketplace = useCallback(
    async (force = true) => {
      setMarketplaceLoading(true);
      setMarketplaceError(null);
      try {
        const list = await domainCache.getOrLoad('public', 'marketplace', () => listMarketplaceSalons(), {
          force,
        });
        setSalons(list);
      } catch (error) {
        setMarketplaceError(
          error instanceof Error ? error.message : 'Le chargement de la marketplace a échoué.',
        );
      } finally {
        setMarketplaceLoading(false);
      }
    },
    [domainCache],
  );

  useEffect(() => {
    if (mode !== 'marketplace' || process.env.NODE_ENV === 'test') return;
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
    refreshMarketplace,
    addReview,
    bookPublicAppointment,
    cancelPublicBooking,
    setSalonPublished,
    updateSalonDetails,
    resetMarketplaceDomain,
  };
}
