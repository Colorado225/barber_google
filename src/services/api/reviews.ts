import { mapReview, throwSupabaseError, unwrap } from './shared';
import type { DbRow, ReviewInput, SalonApiClient } from './shared';
import type { Review } from '../../types';

export async function listReviews(supabase: SalonApiClient, salonId: string) {
  const result = await supabase
    .from('reviews')
    .select('*')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false });
  return (unwrap(result) ?? []).map((row) => mapReview(row as DbRow));
}
export function createReviewsApi(supabase: SalonApiClient, salonId: string) {
  return {
    reviews: {
      list: () => listReviews(supabase, salonId),
      async create(data: ReviewInput): Promise<Review> {
        const result = await supabase.rpc('create_review', {
          p_salon_id: salonId,
          p_author: data.author,
          p_rating: data.rating,
          p_comment: data.comment,
          p_appointment_id: data.appointmentId ?? null,
        });
        return mapReview(unwrap(result) as DbRow);
      },
      async remove(id: string): Promise<void> {
        const { error } = await supabase.rpc('delete_review', {
          p_salon_id: salonId,
          p_review_id: id,
        });
        if (error) throwSupabaseError(error);
      },
    },
  };
}
