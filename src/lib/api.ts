import { getSupabaseClient } from './supabase';
import { unwrap } from '../services/api/shared';
import { createClientsApi, listClients } from '../services/api/clients';
import { createServicesApi, listServices } from '../services/api/services';
import { createBranchesApi } from '../services/api/branches';
import { createStaffApi, listStaff } from '../services/api/staff';
import { createAppointmentsApi } from '../services/api/appointments';
import { createExpensesApi, listExpenses } from '../services/api/expenses';
import { createFinanceApi } from '../services/api/finance';
import { createStockApi, listStock } from '../services/api/stock';
import { createRewardsApi, listRewards } from '../services/api/rewards';
import { createNotificationsApi } from '../services/api/notifications';
import { createLoyaltyApi } from '../services/api/loyalty';
import { createReviewsApi, listReviews } from '../services/api/reviews';

export { ApiError } from '../services/api/shared';
export type {
  RecordPaymentInput,
  PaymentCorrectionInput,
  PaymentListParams,
  AppointmentInput,
  RescheduleInput,
  WalkInInput,
  ReviewInput,
} from '../services/api/shared';

export function salonApi(salonId: string) {
  const supabase = getSupabaseClient();
  return {
    async workspace() {
      const [salonResult, branchesResult, clients, services, staff, expenses, stock, rewards, reviews] =
        await Promise.all([
          supabase.from('salons').select('*').eq('id', salonId).single(),
          supabase.from('branches').select('id, name').eq('salon_id', salonId).order('created_at'),
          listClients(supabase, salonId),
          listServices(supabase, salonId, true),
          listStaff(supabase, salonId),
          listExpenses(supabase, salonId),
          listStock(supabase, salonId),
          listRewards(supabase, salonId),
          listReviews(supabase, salonId),
        ]);
      const salon = unwrap(salonResult);
      const branches = (unwrap(branchesResult) ?? []) as { id: string; name: string }[];
      return { salon, branches, clients, services, staff, expenses, stock, rewards, reviews };
    },
    ...createClientsApi(supabase, salonId),
    ...createServicesApi(supabase, salonId),
    ...createBranchesApi(supabase, salonId),
    ...createStaffApi(supabase, salonId),
    ...createAppointmentsApi(supabase, salonId),
    ...createExpensesApi(supabase, salonId),
    ...createFinanceApi(supabase, salonId),
    ...createStockApi(supabase, salonId),
    ...createRewardsApi(supabase, salonId),
    ...createNotificationsApi(supabase, salonId),
    ...createLoyaltyApi(supabase, salonId),
    ...createReviewsApi(supabase, salonId),
  };
}
