import React, { useState } from 'react';

interface ReasonDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  /** Appelé avec le motif saisi (non vide). Si elle lève une erreur, le message est affiché et la fenêtre reste ouverte. */
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Fenêtre de décision SuperAdmin avec motif obligatoire (trace d'audit).
 * Le motif est transmis au serveur ; rien n'est enregistré localement.
 */
export const ReasonDialog: React.FC<ReasonDialogProps> = ({
  title,
  description,
  confirmLabel,
  tone = 'default',
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = reason.trim();
    if (!clean) {
      setError('Le motif est obligatoire.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'L’action a échoué.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reason-dialog-title"
      className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
    >
      <form
        onSubmit={submit}
        className="bg-[#0f0f13] border border-[#262632] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
      >
        <div>
          <h3 id="reason-dialog-title" className="text-base font-bold text-white">
            {title}
          </h3>
          <p className="text-xs text-stone-400 mt-1">{description}</p>
        </div>
        <label className="block text-xs font-semibold text-stone-300">
          Motif (obligatoire, conservé dans le journal d’audit)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            required
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl bg-[#08080a] border border-[#202028] text-xs text-white focus:outline-none focus:border-[#C9A45C]"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1c1c24]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-[#181820] text-stone-400 text-xs font-semibold"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className={`px-4 py-2 rounded-xl font-bold text-xs disabled:opacity-50 ${
              tone === 'danger' ? 'bg-red-700 text-white' : 'bg-[#C9A45C] text-[#101010]'
            }`}
          >
            {pending ? 'Enregistrement…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
