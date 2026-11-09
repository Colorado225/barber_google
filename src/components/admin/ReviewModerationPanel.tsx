import React, { useState } from 'react';
import type { MarketplaceReviewItem } from '../../lib/superadmin';
import { setPlatformReviewHidden } from '../../lib/platform-admin';
import { useOptionalApp } from '../../context/AppContext';
import { ReasonDialog } from './ReasonDialog';

interface ReviewModerationPanelProps {
  reviews: MarketplaceReviewItem[];
  onRefresh: () => void | Promise<void>;
}

/**
 * Modération des avis clients. Le masquage est enregistré en base avec un motif obligatoire.
 * Limite : l'affichage public ne filtre pas encore les avis masqués (voir docs/implementation/LOT-1-RAPPORT.md).
 */
export const ReviewModerationPanel: React.FC<ReviewModerationPanelProps> = ({ reviews, onRefresh }) => {
  const { addToast } = useOptionalApp();
  const [hideTarget, setHideTarget] = useState<MarketplaceReviewItem | null>(null);

  const restore = async (review: MarketplaceReviewItem) => {
    try {
      await setPlatformReviewHidden(review.id, false);
      addToast('Avis rétabli.', 'success');
      await onRefresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Action impossible.', 'error');
    }
  };

  const confirmHide = async (reason: string) => {
    if (!hideTarget) return;
    await setPlatformReviewHidden(hideTarget.id, true, reason);
    setHideTarget(null);
    addToast('Avis masqué et enregistré dans le journal.', 'success');
    await onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-[#1f1f27]">
        <h2 className="text-xl font-black text-white">Modération des avis</h2>
        <p className="text-xs text-stone-400 mt-1">
          Masquez un avis avec un motif. La décision et son auteur sont conservés dans le journal d’audit.
        </p>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-stone-500">Aucun avis enregistré en base.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#1f1f27]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0a0d] text-stone-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Salon</th>
                <th className="py-2.5 px-4">Auteur</th>
                <th className="py-2.5 px-4">Note</th>
                <th className="py-2.5 px-4">Commentaire</th>
                <th className="py-2.5 px-4">Statut</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#15151c] text-stone-300">
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td className="py-3 px-4 text-stone-500">
                    {new Date(review.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 text-white font-semibold">{review.salonName}</td>
                  <td className="py-3 px-4">
                    {review.author}
                    {review.isVerified && (
                      <span className="ml-1.5 text-[10px] text-emerald-400">vérifié</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{review.rating} / 5</td>
                  <td className="py-3 px-4 max-w-xs">{review.comment || '—'}</td>
                  <td className="py-3 px-4">
                    {review.isHidden ? (
                      <span className="text-red-300">
                        Masqué{review.hiddenReason ? ` — ${review.hiddenReason}` : ''}
                      </span>
                    ) : (
                      <span className="text-emerald-300">Visible</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {review.isHidden ? (
                      <button
                        type="button"
                        onClick={() => void restore(review)}
                        className="px-2.5 py-1 rounded-lg bg-[#1a1a22] hover:bg-[#242430] text-stone-300 text-xs font-semibold"
                      >
                        Rétablir
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setHideTarget(review)}
                        className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 text-xs font-semibold"
                      >
                        Masquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hideTarget && (
        <ReasonDialog
          title="Masquer cet avis"
          description={`Avis de ${hideTarget.author} sur « ${hideTarget.salonName} ».`}
          confirmLabel="Masquer l’avis"
          tone="danger"
          onConfirm={confirmHide}
          onCancel={() => setHideTarget(null)}
        />
      )}
    </div>
  );
};
