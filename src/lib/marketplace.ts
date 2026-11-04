import type { PaymentMethod, Review, Salon, SalonGalleryItem, Service, StaffMember } from '../types';
import { getSupabaseClient } from './supabase';
import { ApiError } from './api';

type DbRow = Record<string, unknown>;

export interface MarketplaceFilters {
  query?: string;
  commune?: string;
  city?: string;
  category?: string;
  limit?: number;
}

export interface PublicBooking {
  id: string;
  salonId: string;
  status: string;
  paymentStatus: string;
  clientName: string;
  serviceName: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  amount: number;
  currency: string;
  source: string;
  cancelToken: string;
}

export interface PublicAvailabilitySlot {
  staffId: string;
  startsAt: string;
  time: string;
  available: boolean;
}

export interface PublicSalonDetail {
  salon: Salon;
  services: Service[];
  staff: Pick<StaffMember, 'id' | 'name' | 'role' | 'specialties' | 'serviceIds'>[];
  reviews: Review[];
  branches: { id: string; name: string; timezone: string; hours: { weekday: number; isOpen: boolean; opensAt: string | null; closesAt: string | null }[] }[];
  rating: number | null;
  reviewCount: number;
  minPrice: number | null;
}

function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) {
    const status = result.error.code === '42501' ? 403 : result.error.code === '23505' ? 409 : 400;
    throw new ApiError(result.error.message, status, result.error.code);
  }
  if (result.data === null) throw new ApiError('Supabase n’a retourné aucune donnée.');
  return result.data;
}

const str = (row: DbRow, key: string, fallback = ''): string =>
  typeof row[key] === 'string' ? (row[key] as string) : fallback;
const num = (row: DbRow, key: string): number | undefined =>
  row[key] === null || row[key] === undefined ? undefined : Number(row[key]);

export function mapPublicSalon(row: DbRow): Salon {
  const galleryRaw = Array.isArray(row.gallery) ? (row.gallery as DbRow[]) : [];
  const galleryItems: SalonGalleryItem[] = galleryRaw
    .filter((item) => typeof item.url === 'string')
    .map((item, index) => ({
      id: `gallery-${index}`,
      url: item.url as string,
      title: typeof item.title === 'string' ? item.title : '',
      description: typeof item.description === 'string' ? item.description : '',
    }));
  return {
    id: str(row, 'id'),
    name: str(row, 'name'),
    slug: str(row, 'slug') || undefined,
    tagline: str(row, 'tagline'),
    description: str(row, 'description'),
    type: (str(row, 'type') || undefined) as Salon['type'],
    logo: str(row, 'logo_url') || undefined,
    coverImage: str(row, 'cover_url') || undefined,
    gallery: galleryItems.map((item) => item.url),
    galleryItems,
    country: str(row, 'country') || undefined,
    city: str(row, 'city') || undefined,
    commune: str(row, 'commune') || undefined,
    quarter: str(row, 'quarter') || undefined,
    address: str(row, 'address') || undefined,
    phone: str(row, 'phone') || undefined,
    whatsapp: str(row, 'whatsapp') || undefined,
    email: str(row, 'email') || undefined,
    currency: str(row, 'currency', 'XOF'),
    rating: num(row, 'rating') ?? undefined,
    reviewCount: num(row, 'review_count') ?? undefined,
    minPrice: num(row, 'min_price') ?? undefined,
    isPublishedOnMarketplace: row.is_published === true,
    isVerified: row.is_verified === true,
    publicationDate: str(row, 'publication_date') || undefined,
    paymentMethods: Array.isArray(row.payment_methods) ? (row.payment_methods as PaymentMethod[]) : undefined,
    featuredPrestations: Array.isArray(row.featured_service_ids) ? (row.featured_service_ids as string[]) : undefined,
  };
}

function mapPublicService(row: DbRow): Service {
  return {
    id: str(row, 'id'),
    salonId: str(row, 'salon_id'),
    name: str(row, 'name'),
    category: str(row, 'category') as Service['category'],
    description: str(row, 'description'),
    price: Number(row.price ?? 0),
    durationMinutes: Number(row.duration_minutes ?? 0),
    prepMinutes: Number(row.prep_minutes ?? 0),
    popular: row.popular === true,
    isActive: row.is_active === true,
  };
}

function mapPublicReview(row: DbRow): Review {
  return {
    id: str(row, 'id'),
    salonId: str(row, 'salon_id'),
    author: str(row, 'author'),
    rating: Number(row.rating ?? 0),
    date: str(row, 'created_at').slice(0, 10),
    comment: str(row, 'comment'),
    verified: row.verified === true,
  };
}

function mapBooking(row: DbRow): PublicBooking {
  return {
    id: str(row, 'id'),
    salonId: str(row, 'salon_id'),
    status: str(row, 'status'),
    paymentStatus: str(row, 'payment_status'),
    clientName: str(row, 'client_name'),
    serviceName: str(row, 'service_name'),
    staffName: str(row, 'staff_name'),
    startsAt: str(row, 'starts_at'),
    endsAt: str(row, 'ends_at'),
    amount: Number(row.amount ?? 0),
    currency: str(row, 'currency', 'XOF'),
    source: str(row, 'source'),
    cancelToken: str(row, 'cancel_token'),
  };
}

export async function listMarketplaceSalons(filters: MarketplaceFilters = {}): Promise<Salon[]> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('marketplace_list_salons', {
    p_query: filters.query ?? null,
    p_commune: filters.commune ?? null,
    p_city: filters.city ?? null,
    p_category: filters.category ?? null,
    p_limit: filters.limit ?? 50,
  });
  const data = unwrap(result);
  return (Array.isArray(data) ? data : []).map((row) => mapPublicSalon(row as DbRow));
}

export async function getMarketplaceSalonDetail(key: string): Promise<PublicSalonDetail> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('marketplace_salon_detail', { p_key: key });
  const data = unwrap(result) as DbRow;
  const salonRow = (data.salon ?? {}) as DbRow;
  const salon = mapPublicSalon({ ...salonRow, rating: data.rating, review_count: data.review_count, min_price: data.min_price });
  return {
    salon,
    services: ((data.services as DbRow[]) ?? []).map(mapPublicService),
    staff: ((data.staff as DbRow[]) ?? []).map((row) => ({
      id: str(row, 'id'),
      name: str(row, 'name'),
      role: str(row, 'role') as StaffMember['role'],
      specialties: Array.isArray(row.specialties) ? (row.specialties as string[]) : [],
      serviceIds: Array.isArray(row.service_ids) ? (row.service_ids as string[]) : [],
    })),
    reviews: ((data.reviews as DbRow[]) ?? []).map(mapPublicReview),
    branches: ((data.branches as DbRow[]) ?? []).map((branch) => ({
      id: str(branch, 'id'),
      name: str(branch, 'name'),
      timezone: str(branch, 'timezone', 'Africa/Abidjan'),
      hours: ((branch.hours as DbRow[]) ?? []).map((hour) => ({
        weekday: Number(hour.weekday ?? 0),
        isOpen: hour.is_open === true,
        opensAt: typeof hour.opens_at === 'string' ? hour.opens_at : null,
        closesAt: typeof hour.closes_at === 'string' ? hour.closes_at : null,
      })),
    })),
    rating: data.rating === null || data.rating === undefined ? null : Number(data.rating),
    reviewCount: Number(data.review_count ?? 0),
    minPrice: data.min_price === null || data.min_price === undefined ? null : Number(data.min_price),
  };
}

export async function getMarketplaceAvailability(
  salonId: string,
  date: string,
  serviceId?: string | null,
  staffId?: string | null,
): Promise<PublicAvailabilitySlot[]> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('marketplace_day_availability', {
    p_salon_id: salonId,
    p_date: date,
    p_service_id: serviceId ?? null,
    p_staff_id: staffId ?? null,
  });
  const data = unwrap(result);
  return (Array.isArray(data) ? data : []).map((row) => {
    const r = row as DbRow;
    const startsAt = str(r, 'starts_at');
    return {
      staffId: str(r, 'staff_id'),
      startsAt,
      time: startsAt.slice(11, 16),
      available: r.available === true,
    };
  });
}

export interface PublicBookingInput {
  salonId: string;
  serviceId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  idempotencyKey: string;
  staffId?: string | null;
  clientEmail?: string | null;
  notes?: string;
}

export async function bookMarketplaceAppointment(input: PublicBookingInput): Promise<PublicBooking> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('marketplace_book_appointment', {
    p_salon_id: input.salonId,
    p_service_id: input.serviceId,
    p_starts_at: input.startsAt,
    p_client_name: input.clientName,
    p_client_phone: input.clientPhone,
    p_idempotency_key: input.idempotencyKey,
    p_staff_id: input.staffId ?? null,
    p_client_email: input.clientEmail ?? null,
    p_notes: input.notes ?? '',
  });
  return mapBooking(unwrap(result) as DbRow);
}

export async function getMarketplaceBooking(salonId: string, appointmentId: string, cancelToken: string): Promise<PublicBooking> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('marketplace_get_booking', {
    p_salon_id: salonId,
    p_appointment_id: appointmentId,
    p_cancel_token: cancelToken,
  });
  return mapBooking(unwrap(result) as DbRow);
}

export async function cancelMarketplaceBooking(salonId: string, appointmentId: string, cancelToken: string, reason: string): Promise<PublicBooking> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('marketplace_cancel_booking', {
    p_salon_id: salonId,
    p_appointment_id: appointmentId,
    p_cancel_token: cancelToken,
    p_reason: reason,
  });
  return mapBooking(unwrap(result) as DbRow);
}

export async function updateSalonProfile(salonId: string, profile: Record<string, unknown>): Promise<Salon> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('update_salon_profile', { p_salon_id: salonId, p_profile: profile });
  return mapPublicSalon(unwrap(result) as DbRow);
}

export async function setSalonPublication(salonId: string, published: boolean): Promise<Salon> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('set_salon_publication', { p_salon_id: salonId, p_published: published });
  return mapPublicSalon(unwrap(result) as DbRow);
}

// ---------------------------------------------------------------------------
// Portail client « Ma réservation » : accès par jeton secret, sans compte.
// ---------------------------------------------------------------------------

export interface PortalReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  verified: boolean;
  createdAt: string;
}

export interface BookingPortal {
  booking: PublicBooking & { clientEmail: string; clientPhone: string; notes: string; createdAt: string };
  salon: {
    id: string; name: string; slug: string; type: string; city: string; commune: string;
    address: string; phone: string; whatsapp: string; logoUrl: string; coverUrl: string; currency: string;
  };
  canCancel: boolean;
  canReview: boolean;
  review: PortalReview | null;
  loyalty: { pointsBalance: number; tier: string; pointsEarned: number } | null;
  timeline: { status: string; reason: string; createdAt: string }[];
}

function mapPortalReview(row: DbRow): PortalReview {
  return {
    id: str(row, 'id'),
    author: str(row, 'author'),
    rating: Number(row.rating ?? 0),
    comment: str(row, 'comment'),
    verified: row.verified === true,
    createdAt: str(row, 'created_at'),
  };
}

export async function getBookingPortal(token: string): Promise<BookingPortal> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('marketplace_booking_by_token', { p_token: token });
  const row = unwrap(result) as DbRow;
  const booking = (row.booking ?? {}) as DbRow;
  const salon = (row.salon ?? {}) as DbRow;
  const loyalty = row.loyalty ? (row.loyalty as DbRow) : null;
  return {
    booking: {
      ...mapBooking(booking),
      clientEmail: str(booking, 'client_email'),
      clientPhone: str(booking, 'client_phone'),
      notes: str(booking, 'notes'),
      createdAt: str(booking, 'created_at'),
    },
    salon: {
      id: str(salon, 'id'), name: str(salon, 'name'), slug: str(salon, 'slug'), type: str(salon, 'type'),
      city: str(salon, 'city'), commune: str(salon, 'commune'), address: str(salon, 'address'),
      phone: str(salon, 'phone'), whatsapp: str(salon, 'whatsapp'),
      logoUrl: str(salon, 'logo_url'), coverUrl: str(salon, 'cover_url'), currency: str(salon, 'currency', 'XOF'),
    },
    canCancel: row.can_cancel === true,
    canReview: row.can_review === true,
    review: row.review ? mapPortalReview(row.review as DbRow) : null,
    loyalty: loyalty
      ? {
          pointsBalance: Number(loyalty.points_balance ?? 0),
          tier: str(loyalty, 'tier', 'bronze'),
          pointsEarned: Number(loyalty.points_earned ?? 0),
        }
      : null,
    timeline: Array.isArray(row.timeline)
      ? (row.timeline as DbRow[]).map((e) => ({
          status: str(e, 'status'), reason: str(e, 'reason'), createdAt: str(e, 'created_at'),
        }))
      : [],
  };
}

export async function submitBookingReview(token: string, rating: number, comment: string, author?: string): Promise<PortalReview> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('marketplace_submit_review', {
    p_token: token,
    p_rating: rating,
    p_comment: comment,
    p_author: author ?? null,
  });
  return mapPortalReview(unwrap(result) as DbRow);
}
