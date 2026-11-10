import { mapStock, throwSupabaseError, unwrap } from './shared';
import type { DbRow, SalonApiClient, StockInput } from './shared';
import type { StockItem } from '../../types';

export async function listStock(supabase: SalonApiClient, salonId: string) {
  const result = await supabase.from('stock_items').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapStock(row as DbRow));
}
export function createStockApi(supabase: SalonApiClient, salonId: string) {
  return {
    stock: {
      list: () => listStock(supabase, salonId),
      async create(data: StockInput) {
        const result = await supabase
          .from('stock_items')
          .insert({
            salon_id: salonId,
            name: data.name,
            category: data.category,
            quantity: data.quantity,
            min_threshold: data.minThreshold,
            unit_cost: data.unitCost,
            supplier: data.supplier ?? '',
          })
          .select('*')
          .single();
        return mapStock(unwrap(result) as DbRow);
      },
      async update(id: string, data: StockInput) {
        const result = await supabase
          .from('stock_items')
          .update({
            name: data.name,
            category: data.category,
            quantity: data.quantity,
            min_threshold: data.minThreshold,
            unit_cost: data.unitCost,
            supplier: data.supplier ?? '',
          })
          .eq('salon_id', salonId)
          .eq('id', id)
          .select('*')
          .single();
        return mapStock(unwrap(result) as DbRow);
      },
      /**
       * Ajustement atomique (RPC adjust_stock_quantity) : la base verrouille la ligne, calcule la nouvelle
       * quantité et refuse un stock négatif. Le client n'envoie que le delta entier.
       */
      async adjust(id: string, delta: number): Promise<StockItem> {
        const result = await supabase.rpc('adjust_stock_quantity', {
          p_salon_id: salonId,
          p_item_id: id,
          p_delta: delta,
        });
        return mapStock(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('stock_items').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
  };
}
