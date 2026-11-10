// Domaine stocks & fournisseurs (extrait de l'ancien src/lib/api.ts monolithique).
import type { RecordStockMovementInput, StockInput, SupplierInput } from './inputs';
import type { DbRow, SalonApiDeps } from './internal';
import { unwrap } from './internal';
import { mapStock, mapStockMovement, mapSupplier } from './mappers';

export async function listStock(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  const result = await supabase.from('stock_items').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapStock(row as DbRow));
}

export async function listSuppliers(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  const result = await supabase.from('suppliers').select('*').eq('salon_id', salonId).order('name');
  return (unwrap(result) ?? []).map((row) => mapSupplier(row as DbRow));
}

export function createInventoryApi(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  return {
    suppliers: {
      async list(includeInactive = false) {
        const result = await supabase.rpc('list_suppliers', {
          p_salon_id: salonId,
          p_include_inactive: includeInactive,
        });
        const data = unwrap(result);
        return (Array.isArray(data) ? data : []).map((row) => mapSupplier(row as DbRow));
      },
      async upsert(data: SupplierInput) {
        const result = await supabase.rpc('upsert_supplier', {
          p_salon_id: salonId,
          p_name: data.name,
          p_contact_name: data.contactName ?? '',
          p_phone: data.phone ?? '',
          p_email: data.email ?? null,
          p_address: data.address ?? '',
          p_notes: data.notes ?? '',
          p_is_active: data.isActive ?? true,
          p_supplier_id: data.id ?? null,
        });
        return mapSupplier(unwrap(result) as DbRow);
      },
    },
    stock: {
      list: () => listStock(deps),
      async movements(stockItemId?: string | null, limit = 200) {
        const result = await supabase.rpc('list_stock_movements', {
          p_salon_id: salonId,
          p_stock_item_id: stockItemId ?? null,
          p_limit: limit,
        });
        const data = unwrap(result);
        return (Array.isArray(data) ? data : []).map((row) => mapStockMovement(row as DbRow));
      },
      async create(data: StockInput) {
        const result = await supabase.rpc('create_stock_item', {
          p_salon_id: salonId,
          p_name: data.name,
          p_category: data.category,
          p_initial_quantity: data.quantity,
          p_min_threshold: data.minThreshold,
          p_unit_cost: data.unitCost,
          p_supplier_id: data.supplierId ?? null,
          p_supplier_name: data.supplier ?? '',
          p_reason: data.reason ?? 'Stock initial',
          p_branch_id: data.branchId ?? null,
          p_selling_price: data.sellingPrice ?? null,
        });
        return mapStock(unwrap(result) as DbRow);
      },
      async updateMetadata(id: string, data: Omit<StockInput, 'quantity' | 'reason' | 'branchId'>) {
        const result = await supabase.rpc('update_stock_item_metadata', {
          p_salon_id: salonId,
          p_stock_item_id: id,
          p_name: data.name,
          p_category: data.category,
          p_min_threshold: data.minThreshold,
          p_unit_cost: data.unitCost,
          p_supplier_id: data.supplierId ?? null,
          p_supplier_name: data.supplier ?? '',
          p_selling_price: data.sellingPrice ?? null,
          p_is_active: data.isActive ?? true,
        });
        return mapStock(unwrap(result) as DbRow);
      },
      async recordMovement(data: RecordStockMovementInput) {
        const result = await supabase.rpc('record_stock_movement', {
          p_salon_id: salonId,
          p_stock_item_id: data.stockItemId,
          p_movement_type: data.movementType,
          p_quantity_delta: data.quantityDelta,
          p_reason: data.reason,
          p_branch_id: data.branchId ?? null,
          p_supplier_id: data.supplierId ?? null,
          p_unit_cost: data.unitCost ?? null,
          p_reference: data.reference ?? null,
          p_appointment_id: data.appointmentId ?? null,
        });
        return mapStockMovement(unwrap(result) as DbRow);
      },
    },
  };
}
