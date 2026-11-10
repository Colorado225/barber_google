// Modale de confirmation de changement de statut d'un salon
// (suspension / réactivation) avec motif auditée obligatoire.
import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { SalonAdminDetail } from '../../../lib/superadmin';

export const SubscriptionStatusModal: React.FC<{
  salon: SalonAdminDetail;
  nextStatus: 'active' | 'suspended';
  reason: string;
  onReasonChange: (reason: string) => void;
  error: string | null;
  busy: boolean;
  onConfirm: (e: React.FormEvent) => void;
  onClose: () => void;
}> = ({ salon, nextStatus, reason, onReasonChange, error, busy, onConfirm, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <form
      onSubmit={onConfirm}
      className="bg-[#0f0f13] border border-[#262632] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">
            {nextStatus === 'suspended' ? `Suspendre « ${salon.name} »` : `Réactiver « ${salon.name} »`}
          </h3>
          <p className="text-xs text-stone-400 mt-1">
            {nextStatus === 'suspended'
              ? 'Le salon sera immédiatement retiré de la marketplace et ses réservations publiques bloquées.'
              : 'Le salon retrouvera un statut actif mais devra être republié pour redevenir visible.'}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onClose()}
          className="p-1.5 rounded-lg bg-[#181820] text-stone-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label htmlFor="sub-status-reason" className="block text-xs font-semibold text-stone-300 mb-1">
          Motif de l’opération *
        </label>
        <input
          id="sub-status-reason"
          type="text"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Ex. Impayé prolongé, régularisation effectuée..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-200"
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1c1c24]">
        <button
          type="button"
          disabled={busy}
          onClick={() => onClose()}
          className="px-4 py-2 rounded-xl bg-[#181820] text-stone-400 text-xs font-semibold"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={busy}
          className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50 ${
            nextStatus === 'suspended'
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-[#C9A45C] text-[#101010] hover:bg-[#d6b36a]'
          }`}
        >
          {busy ? 'Enregistrement…' : 'Confirmer'}
        </button>
      </div>
    </form>
  </div>
);
