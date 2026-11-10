/**
 * Règles des avis (fonctions pures). Seuls l'auteur, la note et le commentaire sont envoyés à la base.
 */
import type { Review } from '../../types';

/** État initial : aucun avis fictif. Le chargement remplit la liste depuis la base. */
export const INITIAL_REVIEWS_STATE: Review[] = [];

export type ReviewDraft = Omit<Review, 'id' | 'date' | 'verified'>;

export function toReviewPayload(review: Pick<ReviewDraft, 'author' | 'rating' | 'comment'>) {
  return {
    author: review.author,
    rating: review.rating,
    comment: review.comment,
  };
}
