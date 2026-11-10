// Types d'entrée des opérations ERP (extraits de l'ancien src/lib/api.ts).
import type {
  Client,
  Expense,
  LoyaltyReward,
  PaymentEntryKind,
  PaymentMethod,
  Service,
  StaffMember,
  StockItem,
  StockMovementType,
} from '../../types';

export type ClientInput = Pick<Client, 'name' | 'phone'> &
  Partial<Pick<Client, 'email' | 'segment' | 'favoriteService' | 'notes'>>;
export type ServiceInput = Pick<Service, 'name' | 'category' | 'price' | 'durationMinutes'> &
  Partial<Pick<Service, 'description' | 'prepMinutes' | 'popular' | 'isActive'>>;
export type StaffInput = Pick<StaffMember, 'name' | 'role' | 'commissionRate'> &
  Partial<
    Pick<
      StaffMember,
      'phone' | 'email' | 'specialties' | 'branchId' | 'isAvailable' | 'isActive' | 'serviceIds'
    >
  >;
export type ExpenseInput = Pick<Expense, 'title' | 'category' | 'amount' | 'date'> &
  Partial<
    Pick<
      Expense,
      | 'notes'
      | 'branchId'
      | 'receiptRef'
      | 'supplierId'
      | 'attachmentPath'
      | 'attachmentName'
      | 'attachmentMime'
      | 'attachmentSize'
    >
  >;

export interface ExpenseCorrectionInput {
  originalExpenseId: string;
  title: string;
  category: Expense['category'];
  amount: number;
  date: string;
  reason: string;
  branchId?: string | null;
  notes?: string;
  receiptRef?: string | null;
  supplierId?: string | null;
}

export interface SupplierInput {
  id?: string | null;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string | null;
  address?: string;
  notes?: string;
  isActive?: boolean;
}

export interface RecordStockMovementInput {
  stockItemId: string;
  movementType: Exclude<StockMovementType, 'initial'>;
  quantityDelta: number;
  reason: string;
  branchId?: string | null;
  supplierId?: string | null;
  unitCost?: number | null;
  reference?: string | null;
  appointmentId?: string | null;
}

export interface RecordPaymentInput {
  appointmentId: string;
  amount: number;
  method: PaymentMethod;
  idempotencyKey: string;
  providerReference?: string | null;
  reason?: string;
}

export interface PaymentCorrectionInput {
  originalEntryId: string;
  kind: Exclude<PaymentEntryKind, 'payment'>;
  amount: number;
  reason: string;
  idempotencyKey: string;
  providerReference?: string | null;
  settlementNote?: string;
}

export interface PaymentListParams {
  from?: string;
  to?: string;
  appointmentId?: string;
  cashSessionId?: string;
  status?: 'pending' | 'confirmed' | 'failed';
  limit?: number;
}
export type StockInput = Pick<StockItem, 'name' | 'category' | 'quantity' | 'minThreshold' | 'unitCost'> &
  Partial<Pick<StockItem, 'supplier' | 'supplierId' | 'sellingPrice' | 'isActive'>> & {
    reason?: string;
    branchId?: string | null;
  };
export type RewardInput = Pick<LoyaltyReward, 'name' | 'pointsCost' | 'category'> &
  Partial<Pick<LoyaltyReward, 'description' | 'isActive' | 'discountPercentage' | 'freeServiceName'>>;

export interface AppointmentInput {
  serviceId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  staffId?: string | null;
  clientId?: string | null;
  branchId?: string | null;
  source?: 'direct' | 'whatsapp' | 'phone';
  notes?: string;
}

export interface RescheduleInput {
  staffId?: string | null;
  serviceId?: string | null;
  startsAt?: string | null;
  notes?: string | null;
}

export interface WalkInInput {
  serviceId: string;
  idempotencyKey: string;
  clientName?: string | null;
  clientPhone?: string | null;
  clientId?: string | null;
  staffId?: string | null;
  branchId?: string | null;
  startImmediately?: boolean;
  notes?: string;
}

export interface ReviewInput {
  author: string;
  rating: number;
  comment: string;
  appointmentId?: string | null;
}

export interface StaffSchedule {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
}

export interface StaffAbsence {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
}

export type Availability = Record<string, { startsAt: string; available: boolean }[]>;
