import React, { useMemo, useState } from 'react';
import {
  MessageSquare,
  Search,
  Eye,
  EyeOff,
  Trash2,
  Star,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import { moderateReviewByAdmin, validateAuditReason, type MarketplaceReviewItem } from '../../lib/superadmin';
import { useOptionalApp } from '../../context/AppContext';

export interface AdminReviewsPanelProps {
  reviews: MarketplaceReviewItem[];
  onRefresh: () => Promise<void> | void;
  moderateAction?: typeof moderateReviewByAdmin;
}

type ReviewFilter = 'all' | 'visible' | 'hidden';

interface PendingModeration {
  review: MarketplaceReviewItem;
  action: 'hide' | 'restore' | 'delete';
}

export const AdminReviewsPanel: React.FC<AdminReviewsPanelProps> = ({
  reviews,
  onRefresh,
  moderateAction = moderateReviewByAdmin,
}) => {
  const { addToast } = useOptionalApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [pending, setPending] = useState<PendingModeration | null>(null);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleCount = useMemo(() => reviews.filter((r) => !r.isHidden).length, [reviews]);
  const hiddenCount = useMemo(() => reviews.filter((r) => r.isHidden).length, [reviews]);

  const filteredReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reviews.filter((review) => {
      if (filter === 'visible' && review.isHidden) return false;
      if (filter === 'hidden' && !review.isHidden) return false;
      if (!q) return true;
      return (
        review.salonName.toLowerCase().includes(q) ||
        review.author.toLowerCase().includes(q) ||
        review.comment.toLowerCase().includes(q) ||
        (review.moderationReason && review.moderationReason.toLowerCase().includes(q))
      );
    });
  }, [reviews, filter, searchQuery]);

  const openModerationModal = (review: MarketplaceReviewItem, action: 'hide' | 'restore' | 'delete') => {
    setPending({ review, action });
    setReason('');
    setErrorMsg(null);
  };

  const handleConfirmModeration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;

    setErrorMsg(null);
    let validReason: string;
    try {
      validReason = validateAuditReason(reason);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Motif invalide.');
      return;
    }

    setBusy(true);
    try {
      await moderateAction(pending.review.id, pending.action, validReason);
      await onRefresh();
      const label =
        pending.action === 'hide'
          ? 'Avis masqué de la marketplace.'
          : pending.action === 'restore'
            ? 'Avis rétabli sur la marketplace.'
            : 'Avis supprimé définitivement.';
      addToast(label, pending.action === 'delete' ? 'info' : 'success');
      setPending(null);
      setReason('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de la modération serveur.';
      setErrorMsg(msg);
      addToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1f1f27]">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#C9A45C] flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            MODÉRATION MARKETPLACE · SUPERADMIN
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">Modération des Avis Clients</h2>
          <p className="text-xs text-stone-400 mt-1">
            Masquez, rétablissez ou supprimez les avis signalés. Chaque décision met à jour la note publique
            et s’enregistre dans le journal d’audit.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          className="px-3.5 py-2 rounded-xl bg-[#17171d] hover:bg-[#22222a] border border-[#2c2c36] text-xs font-bold text-stone-300 hover:text-white flex items-center gap-2 self-start sm:self-auto transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Actualiser les avis</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4">
          <div className="text-xs text-stone-400">Total des avis</div>
          <div className="text-2xl font-black text-white mt-1">{reviews.length}</div>
        </div>
        <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4">
          <div className="text-xs text-stone-400">Visibles publiquement</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{visibleCount}</div>
        </div>
        <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4">
          <div className="text-xs text-stone-400">Masqués (modérés)</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{hiddenCount}</div>
        </div>
      </div>

      {/* Search & filters */}
      <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par salon, auteur, contenu ou motif..."
            className="w-full bg-[#18181f] border border-[#2b2b36] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#C9A45C]"
          />
        </div>

        <div className="flex items-center gap-2">
          {(
            [
              { id: 'all', label: `Tous (${reviews.length})` },
              { id: 'visible', label: `Visibles (${visibleCount})` },
              { id: 'hidden', label: `Masqués (${hiddenCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === item.id
                  ? 'bg-[#C9A45C] text-[#101010] font-bold'
                  : 'bg-[#18181f] text-stone-400 hover:text-white border border-[#292934]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {filteredReviews.length === 0 ? (
          <div className="bg-[#121216] border border-[#22222a] rounded-2xl p-10 text-center text-stone-400 text-xs">
            Aucun avis à afficher pour ces critères.
          </div>
        ) : (
          filteredReviews.map((review) => (
            <div
              key={review.id}
              className={`bg-[#121216] border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                review.isHidden ? 'border-amber-800/50 bg-amber-950/10' : 'border-[#22222a]'
              }`}
            >
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-white">{review.salonName}</span>
                  <span className="text-stone-500">·</span>
                  <span className="text-stone-300 font-medium">{review.author}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1b1b22] text-[#E5C378] font-bold">
                    <Star className="w-3 h-3 fill-[#E5C378]" />
                    {review.rating}/5
                  </span>
                  {review.isVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Vérifié
                    </span>
                  )}
                  {review.isHidden ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/50 text-[10px] font-bold">
                      <EyeOff className="w-3 h-3" />
                      Masqué
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/40 text-[10px] font-bold">
                      <Eye className="w-3 h-3" />
                      Visible
                    </span>
                  )}
                  <span className="text-[11px] text-stone-500">
                    {review.createdAt ? new Date(review.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>

                <p className="text-xs text-stone-200 leading-relaxed">{review.comment}</p>

                {review.moderationReason && (
                  <p className="text-[11px] text-amber-300/90">
                    Dernier motif de modération : {review.moderationReason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {review.isHidden ? (
                  <button
                    type="button"
                    onClick={() => openModerationModal(review, 'restore')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Rétablir</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openModerationModal(review, 'hide')}
                    className="px-3 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Masquer</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openModerationModal(review, 'delete')}
                  className="px-3 py-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Moderation confirmation + motif modal */}
      {pending && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmModeration}
            className="bg-[#121217] border border-[#2b2b36] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {pending.action === 'hide'
                    ? 'Masquer cet avis'
                    : pending.action === 'restore'
                      ? 'Rétablir cet avis'
                      : 'Supprimer définitivement cet avis'}
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Salon : {pending.review.salonName} · Auteur : {pending.review.author}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="p-1.5 rounded-lg bg-[#1b1b22] text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-[#181820] border border-[#282834] p-3 text-xs text-stone-300">
              “{pending.review.comment}”
            </div>

            <div>
              <label
                htmlFor="review-moderation-reason"
                className="block text-xs font-semibold text-stone-300 mb-1.5"
              >
                Motif de modération *
              </label>
              <input
                id="review-moderation-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. Propos injurieux, spam vérifié, erreur de modération..."
                className="w-full bg-[#181820] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C9A45C]"
              />
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-200"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22222c]">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="px-4 py-2 rounded-xl bg-[#1c1c24] text-xs font-bold text-stone-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={busy}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${
                  pending.action === 'delete'
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-[#C9A45C] text-[#101010] hover:bg-[#d6b36a]'
                }`}
              >
                {busy ? 'Enregistrement…' : 'Confirmer la décision'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
