import type {
  Appointment,
  Client,
  Expense,
  LoyaltyReward,
  Review,
  Service,
  StaffMember,
  StockItem,
} from '../types';
import { getSupabaseClient } from './supabase';

type DbRow = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function throwSupabaseError(error: { message: string; code?: string }): never {
  const status =
    error.code === '42501'
      ? 403
      : error.code === '28000' || error.code === 'PGRST301'
        ? 401
        : error.code === '23505'
          ? 409
          : error.code?.startsWith('22') || error.code === '23514'
            ? 400
            : 500;
  throw new ApiError(error.message, status, error.code);
}

function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throwSupabaseError(result.error);
  if (result.data === null) throw new ApiError('Supabase n’a retourné aucune donnée.');
  return result.data;
}

function unavailable<T>(operation: string): Promise<T> {
  return Promise.reject(new ApiError(
    `L’opération « ${operation} » n’est pas encore migrée vers une fonction Supabase sécurisée.`,
    501,
    'SUPABASE_OPERATION_NOT_MIGRATED',
  ));
}

function stringValue(row: DbRow, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

function optionalString(row: DbRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.length ? value : undefined;
}

function numberValue(row: DbRow, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function optionalNumber(row: DbRow, key: string): number | undefined {
  const value = row[key];
  return value === null || value === undefined ? undefined : Number(value);
}

function booleanValue(row: DbRow, key: string): boolean {
  return row[key] === true;
}

function mapClient(row: DbRow): Client {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    phone: stringValue(row, 'phone'),
    email: optionalString(row, 'email'),
    segment: stringValue(row, 'segment', 'new') as Client['segment'],
    favoriteService: stringValue(row, 'favorite_service'),
    notes: stringValue(row, 'notes'),
    totalSpent: optionalNumber(row, 'total_spent'),
    visitsCount: optionalNumber(row, 'visits_count'),
    lastVisit: optionalString(row, 'last_visit'),
  };
}

function mapService(row: DbRow): Service {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    category: stringValue(row, 'category') as Service['category'],
    description: stringValue(row, 'description'),
    price: numberValue(row, 'price'),
    durationMinutes: numberValue(row, 'duration_minutes'),
    prepMinutes: numberValue(row, 'prep_minutes'),
    popular: booleanValue(row, 'popular'),
    isActive: booleanValue(row, 'is_active'),
  };
}

function mapStaff(row: DbRow): StaffMember {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    role: stringValue(row, 'role') as StaffMember['role'],
    avatar: optionalString(row, 'avatar'),
    specialties: Array.isArray(row.specialties) ? row.specialties.filter((value): value is string => typeof value === 'string') : [],
    rating: optionalNumber(row, 'rating'),
    commissionRate: numberValue(row, 'commission_rate'),
    phone: stringValue(row, 'phone'),
    email: optionalString(row, 'email'),
    branchId: optionalString(row, 'branch_id') ?? null,
    isAvailable: booleanValue(row, 'is_available'),
    isActive: booleanValue(row, 'is_active'),
    serviceIds: Array.isArray(row.service_ids) ? row.service_ids.filter((value): value is string => typeof value === 'string') : [],
    userId: optionalString(row, 'user_id') ?? null,
  };
}

function mapAppointment(row: DbRow): Appointment {
  const startsAt = stringValue(row, 'starts_at');
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    branchId: stringValue(row, 'branch_id'),
    clientId: optionalString(row, 'client_id') ?? null,
    clientName: stringValue(row, 'client_name'),
    clientPhone: stringValue(row, 'client_phone'),
    serviceId: stringValue(row, 'service_id'),
    serviceName: stringValue(row, 'service_name'),
    price: numberValue(row, 'amount'),
    staffId: optionalString(row, 'staff_id') ?? null,
    staffName: stringValue(row, 'staff_name'),
    date: startsAt.slice(0, 10),
    time: startsAt.slice(11, 16),
    durationMinutes: Math.max(
      0,
      (Date.parse(stringValue(row, 'ends_at')) - Date.parse(startsAt)) / 60000,
    ),
    status: stringValue(row, 'status') as Appointment['status'],
    paymentStatus: stringValue(row, 'payment_status') as Appointment['paymentStatus'],
    source: stringValue(row, 'source') as Appointment['source'],
    notes: stringValue(row, 'notes'),
    createdAt: stringValue(row, 'created_at'),
    startsAt,
    endsAt: stringValue(row, 'ends_at'),
  };
}

function mapExpense(row: DbRow): Expense {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    title: stringValue(row, 'title'),
    category: stringValue(row, 'category') as Expense['category'],
    amount: numberValue(row, 'amount'),
    date: stringValue(row, 'spent_on'),
    paymentMethod: undefined,
    notes: stringValue(row, 'notes'),
  };
}

function mapStock(row: DbRow): StockItem {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    category: stringValue(row, 'category') as StockItem['category'],
    quantity: numberValue(row, 'quantity'),
    minThreshold: numberValue(row, 'min_threshold'),
    unitCost: numberValue(row, 'unit_cost'),
    supplier: stringValue(row, 'supplier'),
    lastRestock: optionalString(row, 'last_restock'),
  };
}

function mapReward(row: DbRow): LoyaltyReward {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    name: stringValue(row, 'name'),
    description: stringValue(row, 'description'),
    pointsCost: numberValue(row, 'points_cost'),
    category: stringValue(row, 'category') as LoyaltyReward['category'],
    isActive: booleanValue(row, 'is_active'),
    timesRedeemed: optionalNumber(row, 'times_redeemed'),
    discountPercentage: optionalNumber(row, 'discount_percentage'),
    freeServiceName: optionalString(row, 'free_service_name'),
    createdAt: stringValue(row, 'created_at'),
  };
}

function mapReview(row: DbRow): Review {
  return {
    id: stringValue(row, 'id'),
    salonId: stringValue(row, 'salon_id'),
    author: stringValue(row, 'author'),
    rating: numberValue(row, 'rating'),
    date: stringValue(row, 'created_at').slice(0, 10),
    comment: stringValue(row, 'comment'),
    verified: booleanValue(row, 'verified'),
  };
}

type ClientInput = Pick<Client, 'name' | 'phone'> &
  Partial<Pick<Client, 'email' | 'segment' | 'favoriteService' | 'notes'>>;
type ServiceInput = Pick<Service, 'name' | 'category' | 'price' | 'durationMinutes'> &
  Partial<Pick<Service, 'description' | 'prepMinutes' | 'popular' | 'isActive'>>;
type StaffInput = Pick<StaffMember, 'name' | 'role' | 'commissionRate'> &
  Partial<Pick<StaffMember, 'phone' | 'email' | 'specialties' | 'branchId' | 'isAvailable' | 'isActive' | 'serviceIds'>>;
type ExpenseInput = Pick<Expense, 'title' | 'category' | 'amount' | 'date'> & Partial<Pick<Expense, 'notes'>>;
type StockInput = Pick<StockItem, 'name' | 'category' | 'quantity' | 'minThreshold' | 'unitCost'> &
  Partial<Pick<StockItem, 'supplier'>>;
type RewardInput = Pick<LoyaltyReward, 'name' | 'pointsCost' | 'category'> &
  Partial<Pick<LoyaltyReward, 'description' | 'isActive' | 'discountPercentage' | 'freeServiceName'>>;

interface StaffSchedule {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
}

interface StaffAbsence {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
}

type Availability = Record<string, { startsAt: string; available: boolean }[]>;

export function salonApi(salonId: string) {
  const supabase = getSupabaseClient();
  const listClients = async () => {
    const result = await supabase.from('clients').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapClient(row as DbRow));
  };
  const listServices = async (all = false) => {
    let query = supabase.from('services').select('*').eq('salon_id', salonId);
    if (!all) query = query.eq('is_active', true);
    const result = await query.order('name');
    return (unwrap(result) ?? []).map((row) => mapService(row as DbRow));
  };
  const listStaff = async () => {
    const result = await supabase.from('staff').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapStaff(row as DbRow));
  };
  const listExpenses = async () => {
    const result = await supabase.from('expenses').select('*').eq('salon_id', salonId).order('spent_on', { ascending: false });
    return (unwrap(result) ?? []).map((row) => mapExpense(row as DbRow));
  };
  const listStock = async () => {
    const result = await supabase.from('stock_items').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapStock(row as DbRow));
  };
  const listRewards = async () => {
    const result = await supabase.from('rewards').select('*').eq('salon_id', salonId).order('name');
    return (unwrap(result) ?? []).map((row) => mapReward(row as DbRow));
  };
  const listReviews = async () => {
    const result = await supabase.from('reviews').select('*').eq('salon_id', salonId).order('created_at', { ascending: false });
    return (unwrap(result) ?? []).map((row) => mapReview(row as DbRow));
  };

  return {
    async workspace() {
      const [salonResult, clients, services, staff, expenses, stock, rewards, reviews] = await Promise.all([
        supabase.from('salons').select('id, name').eq('id', salonId).single(),
        listClients(),
        listServices(true),
        listStaff(),
        listExpenses(),
        listStock(),
        listRewards(),
        listReviews(),
      ]);
      const salon = unwrap(salonResult);
      return { salon, clients, services, staff, expenses, stock, rewards, reviews };
    },
    clients: {
      list: listClients,
      async create(data: ClientInput) {
        const result = await supabase.from('clients').insert({
          salon_id: salonId,
          name: data.name,
          phone: data.phone,
          email: data.email?.trim().toLowerCase() || null,
          segment: data.segment ?? 'new',
          favorite_service: data.favoriteService ?? '',
          notes: data.notes ?? '',
        }).select('*').single();
        return mapClient(unwrap(result) as DbRow);
      },
      async update(id: string, data: ClientInput) {
        const result = await supabase.from('clients').update({
          name: data.name,
          phone: data.phone,
          email: data.email?.trim().toLowerCase() || null,
          segment: data.segment ?? 'new',
          favorite_service: data.favoriteService ?? '',
          notes: data.notes ?? '',
        }).eq('salon_id', salonId).eq('id', id).select('*').single();
        return mapClient(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('clients').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
    services: {
      list: () => listServices(),
      listAll: () => listServices(true),
      async create(data: ServiceInput) {
        const result = await supabase.from('services').insert({
          salon_id: salonId,
          name: data.name,
          category: data.category,
          description: data.description ?? '',
          price: data.price,
          duration_minutes: data.durationMinutes,
          prep_minutes: data.prepMinutes ?? 0,
          popular: data.popular ?? false,
          is_active: data.isActive ?? true,
        }).select('*').single();
        return mapService(unwrap(result) as DbRow);
      },
      async update(id: string, data: ServiceInput) {
        const result = await supabase.from('services').update({
          name: data.name,
          category: data.category,
          description: data.description ?? '',
          price: data.price,
          duration_minutes: data.durationMinutes,
          prep_minutes: data.prepMinutes ?? 0,
          popular: data.popular ?? false,
          is_active: data.isActive ?? true,
        }).eq('salon_id', salonId).eq('id', id).select('*').single();
        return mapService(unwrap(result) as DbRow);
      },
      async setActive(id: string, isActive: boolean) {
        const { error } = await supabase.from('services').update({ is_active: isActive })
          .eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
      async remove(id: string) {
        return this.setActive(id, false);
      },
    },
    branches: {
      async list() {
        const result = await supabase.from('branches').select('id, name').eq('salon_id', salonId).order('created_at');
        return unwrap(result) ?? [];
      },
    },
    staff: {
      list: listStaff,
      async create(data: StaffInput) {
        const result = await supabase.from('staff').insert({
          salon_id: salonId,
          name: data.name,
          role: data.role,
          phone: data.phone ?? '',
          email: data.email?.trim().toLowerCase() || null,
          specialties: data.specialties ?? [],
          commission_rate: data.commissionRate,
          branch_id: data.branchId ?? null,
          is_available: data.isAvailable ?? true,
          is_active: data.isActive ?? true,
          service_ids: data.serviceIds ?? [],
        }).select('*').single();
        return mapStaff(unwrap(result) as DbRow);
      },
      async update(id: string, data: StaffInput) {
        const result = await supabase.from('staff').update({
          name: data.name,
          role: data.role,
          phone: data.phone ?? '',
          email: data.email?.trim().toLowerCase() || null,
          specialties: data.specialties ?? [],
          commission_rate: data.commissionRate,
          branch_id: data.branchId ?? null,
          is_available: data.isAvailable ?? true,
          is_active: data.isActive ?? true,
          service_ids: data.serviceIds ?? [],
        }).eq('salon_id', salonId).eq('id', id).select('*').single();
        return mapStaff(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('staff').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
      schedule: (_id: string): Promise<StaffSchedule[]> => unavailable('horaires du personnel'),
      addSchedule: (_id: string, _data: unknown): Promise<StaffSchedule> =>
        unavailable('création d’horaires du personnel'),
      removeSchedule: (_id: string): Promise<void> => unavailable('suppression d’horaires du personnel'),
      absences: (_id: string): Promise<StaffAbsence[]> => unavailable('absences du personnel'),
      addAbsence: (_id: string, _data: unknown): Promise<StaffAbsence> => unavailable('création d’absence'),
      removeAbsence: (_id: string): Promise<void> => unavailable('suppression d’absence'),
    },
    appointments: {
      async list(params: { from?: string; to?: string; staffId?: string } = {}) {
        let query = supabase.from('appointments').select('*').eq('salon_id', salonId);
        if (params.from) query = query.gte('starts_at', `${params.from}T00:00:00.000Z`);
        if (params.to) query = query.lte('starts_at', `${params.to}T23:59:59.999Z`);
        if (params.staffId) query = query.eq('staff_id', params.staffId);
        const result = await query.order('starts_at');
        return (unwrap(result) ?? []).map((row) => mapAppointment(row as DbRow));
      },
      create: (_data: unknown): Promise<Appointment> => unavailable('création de rendez-vous'),
      reschedule: (_id: string, _data: unknown): Promise<Appointment> =>
        unavailable('déplacement de rendez-vous'),
      transition: (_id: string, _status: string, _reason?: string): Promise<Appointment> =>
        unavailable('changement de statut de rendez-vous'),
      cancel: (_id: string, _reason: string): Promise<Appointment> =>
        unavailable('annulation de rendez-vous'),
      events: (_id: string): Promise<unknown[]> => unavailable('historique de rendez-vous'),
      availability: (_date: string): Promise<Availability> => unavailable('calcul des disponibilités'),
    },
    expenses: {
      list: listExpenses,
      async create(data: ExpenseInput) {
        const result = await supabase.from('expenses').insert({
          salon_id: salonId,
          title: data.title,
          category: data.category,
          amount: data.amount,
          spent_on: data.date,
          notes: data.notes ?? '',
        }).select('*').single();
        return mapExpense(unwrap(result) as DbRow);
      },
    },
    stock: {
      list: listStock,
      async create(data: StockInput) {
        const result = await supabase.from('stock_items').insert({
          salon_id: salonId,
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          min_threshold: data.minThreshold,
          unit_cost: data.unitCost,
          supplier: data.supplier ?? '',
        }).select('*').single();
        return mapStock(unwrap(result) as DbRow);
      },
      async update(id: string, data: StockInput) {
        const result = await supabase.from('stock_items').update({
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          min_threshold: data.minThreshold,
          unit_cost: data.unitCost,
          supplier: data.supplier ?? '',
        }).eq('salon_id', salonId).eq('id', id).select('*').single();
        return mapStock(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('stock_items').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
    rewards: {
      list: listRewards,
      async create(data: RewardInput) {
        const result = await supabase.from('rewards').insert({
          salon_id: salonId,
          name: data.name,
          description: data.description ?? '',
          points_cost: data.pointsCost,
          category: data.category,
          discount_percentage: data.discountPercentage ?? null,
          free_service_name: data.freeServiceName ?? null,
          is_active: data.isActive ?? true,
        }).select('*').single();
        return mapReward(unwrap(result) as DbRow);
      },
      async update(id: string, data: RewardInput) {
        const result = await supabase.from('rewards').update({
          name: data.name,
          description: data.description ?? '',
          points_cost: data.pointsCost,
          category: data.category,
          discount_percentage: data.discountPercentage ?? null,
          free_service_name: data.freeServiceName ?? null,
          is_active: data.isActive ?? true,
        }).eq('salon_id', salonId).eq('id', id).select('*').single();
        return mapReward(unwrap(result) as DbRow);
      },
      async remove(id: string) {
        const { error } = await supabase.from('rewards').delete().eq('salon_id', salonId).eq('id', id);
        if (error) throwSupabaseError(error);
      },
    },
    reviews: {
      list: listReviews,
      create: (_data: unknown): Promise<Review> => unavailable('création d’avis publics'),
      remove: (_id: string): Promise<void> => unavailable('suppression d’avis'),
    },
  };
}
