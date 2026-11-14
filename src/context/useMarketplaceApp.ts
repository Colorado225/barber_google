import { useMarketplaceDomain } from './domains/MarketplaceDomainContext';
import { useOptionalAuth } from './AuthContext';
import { useUI } from './UIContext';

/** Interface limitée aux besoins publics, également compatible avec le fournisseur ERP. */
export function useMarketplaceApp() {
  const marketplace = useMarketplaceDomain();
  const ui = useUI();
  const { activeSalonId } = useOptionalAuth();
  return {
    ...marketplace,
    ...ui,
    activeSalon: marketplace.salons.find((salon) => salon.id === activeSalonId) ?? null,
  };
}
