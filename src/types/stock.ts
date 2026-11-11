// Types du domaine stock : fournisseurs, produits et mouvements historisés.

export interface Supplier {
  id: string;
  salonId: string;
  name: string;
  contactName: string;
  phone: string;
  email?: string;
  address: string;
  notes: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type StockCategory = 'shampoing' | 'gel_cire' | 'huile_barbe' | 'lames' | 'soin' | 'accessoires';

export type StockMovementType =
  'initial' | 'restock' | 'sale' | 'service_use' | 'loss' | 'adjustment' | 'return';

export interface StockItem {
  id: string;
  salonId: string;
  name: string;
  category: StockCategory;
  quantity: number;
  minThreshold: number;
  unitCost: number;
  sellingPrice?: number;
  supplierId?: string | null;
  supplier: string;
  lastRestock?: string;
  isActive?: boolean;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  salonId: string;
  branchId?: string | null;
  stockItemId: string;
  stockItemName?: string;
  supplierId?: string | null;
  supplierName?: string;
  movementType: StockMovementType;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost?: number | null;
  reason: string;
  reference?: string;
  appointmentId?: string | null;
  actorId?: string | null;
  createdAt: string;
}
