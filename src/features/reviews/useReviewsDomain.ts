import { useState } from 'react';
import { salonApi, ApiError } from '../../lib/api';
import type { Review } from '../../types';
import { INITIAL_REVIEWS_STATE, toReviewPayload, type ReviewDraft } from './reviewRules';

export interface ReviewsDomainDeps {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Domaine avis : liste du salon et ajout d'un avis. La date, l'identifiant et le statut « vérifié »
 * sont fixés par la base ; le client ne les envoie jamais.
 */
export function useReviewsDomain({ addToast }: ReviewsDomainDeps) {
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS_STATE);

  const addReview = async (review: ReviewDraft): Promise<Review> => {
    try {
      const saved = await salonApi(review.salonId).reviews.create(toReviewPayload(review));
      setReviews((prev) => [saved, ...prev]);
      return saved;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Enregistrement de l'avis impossible";
      addToast(message, 'error');
      throw error;
    }
  };

  return { reviews, setReviews, addReview };
}
