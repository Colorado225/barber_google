import type React from 'react';
import type { salonApi } from '../../lib/api';
import type { DomainCache } from '../../lib/domainCache';
import type { Salon } from '../../types';
import type { SalonMembership } from '../AuthContext';

export type SalonApiClient = ReturnType<typeof salonApi>;

export interface DomainSharedDeps {
  resolveApi: (salonId: string) => Promise<SalonApiClient>;
  domainCache: DomainCache;
  activeSalonId: string;
  activeSalonIdRef: React.MutableRefObject<string>;
  requireActiveSalon: () => Salon;
  memberships: SalonMembership[];
  hasActiveMembership: boolean;
  hasPermissionRef: React.MutableRefObject<(permission: string, salonId?: string) => boolean>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  formatPrice: (amount: number) => string;
  newIdempotencyKey: () => string;
}
