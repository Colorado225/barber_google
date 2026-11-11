// Point d'entrée de l'API salon : recompose les modules domaine
// (clients/prestations/équipe, rendez-vous, finance, stocks, fidélité,
// notifications) derrière une seule façade `salonApi(salonId)` — l'ancien
// src/lib/api.ts monolithique (~1 700 lignes) est désormais éclaté par domaine.
import { DEFAULT_BUSINESS_TIMEZONE, normalizeTimeZone, resolveSalonTimezone } from '../businessTime';
import { unwrap } from './internal';
import { getSupabaseClient } from '../supabase';
import type { ErpBranch } from '../../types';
import { createAppointmentsApi } from './appointmentsApi';
import { createCatalogApi, listClients, listReviews, listServices, listStaff } from './catalog';
import { createFinanceApi, listExpenses } from './financeApi';
import { createInventoryApi, listStock, listSuppliers } from './inventoryApi';
import { createLoyaltyApi, listRewards } from './loyaltyApi';
import { createNotificationsApi } from './notificationsApi';
import type { SalonApiDeps } from './internal';

export function salonApi(salonId: string, initialTimeZone: string = DEFAULT_BUSINESS_TIMEZONE) {
  const supabase = getSupabaseClient();
  let activeTimeZone = normalizeTimeZone(initialTimeZone);
  const deps: SalonApiDeps = {
    supabase,
    salonId,
    getTimeZone: () => activeTimeZone,
  };

  return {
    setTimeZone(timeZone?: string | null) {
      activeTimeZone = normalizeTimeZone(timeZone);
    },
    getTimeZone() {
      return activeTimeZone;
    },
    async workspace() {
      const [
        salonResult,
        branchesResult,
        clients,
        services,
        staff,
        expenses,
        stock,
        suppliers,
        rewards,
        reviews,
      ] = await Promise.all([
        supabase.from('salons').select('*').eq('id', salonId).single(),
        supabase.from('branches').select('id, name, timezone').eq('salon_id', salonId).order('created_at'),
        listClients(deps),
        listServices(deps, true),
        listStaff(deps),
        listExpenses(deps),
        listStock(deps),
        listSuppliers(deps),
        listRewards(deps),
        listReviews(deps),
      ]);
      const salon = unwrap(salonResult);
      const branches = (unwrap(branchesResult) ?? []) as ErpBranch[];
      activeTimeZone = resolveSalonTimezone(salon as { timezone?: string | null }, branches);
      return { salon, branches, clients, services, staff, expenses, stock, suppliers, rewards, reviews };
    },
    ...createCatalogApi(deps),
    ...createAppointmentsApi(deps),
    ...createFinanceApi(deps),
    ...createInventoryApi(deps),
    ...createLoyaltyApi(deps),
    ...createNotificationsApi(deps),
  };
}
