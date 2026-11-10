import { unwrap } from './shared';
import type { SalonApiClient } from './shared';

export function createBranchesApi(supabase: SalonApiClient, salonId: string) {
  return {
    branches: {
      async list() {
        const result = await supabase
          .from('branches')
          .select('id, name')
          .eq('salon_id', salonId)
          .order('created_at');
        return unwrap(result) ?? [];
      },
    },
  };
}
