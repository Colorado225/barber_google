import React, { useCallback, useMemo } from 'react';
import { useOptionalAuth } from './AuthContext';
import { UIContext, useUiFeedbackState } from './UIContext';
import { MarketplaceDomainContext, useMarketplaceDomainState } from './domains/MarketplaceDomainContext';
import { createDomainCache } from '../lib/domainCache';
import { getApiErrorMessage } from '../lib/apiError';
import type { SalonApiClient } from './domains/shared';
import type { Salon } from '../types';

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

/** Fournisseur public : aucun domaine ERP n'est initialisé sur la marketplace. */
export const MarketplaceProvider: React.FC<{ children: React.ReactNode; initialSalons?: Salon[] }> = ({
  children,
  initialSalons,
}) => {
  const { user, isAuthenticated } = useOptionalAuth();
  const ui = useUiFeedbackState();
  const { addToast } = ui;
  const cache = useMemo(() => createDomainCache(), []);
  const resolveApi = useCallback(async (salonId: string): Promise<SalonApiClient> => {
    const { salonApi } = await import('../lib/api');
    return salonApi(salonId);
  }, []);
  const remote = useCallback(
    async (action: () => Promise<void>, fallback: string) => {
      try {
        await action();
      } catch (error) {
        addToast(getApiErrorMessage(error, fallback), 'error');
      }
    },
    [addToast],
  );
  const marketplace = useMarketplaceDomainState({
    resolveApi,
    domainCache: cache,
    addToast: ui.addToast,
    remote,
    newIdempotencyKey,
    mode: ui.mode,
    initialSalons,
    isAuthenticated,
    authUserId: user?.id ?? null,
    userFavoriteIds: user?.favoriteSalonIds ?? null,
  });
  return (
    <UIContext.Provider value={ui}>
      <MarketplaceDomainContext.Provider value={marketplace}>{children}</MarketplaceDomainContext.Provider>
    </UIContext.Provider>
  );
};
