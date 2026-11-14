import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface FormModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  submitLabel?: string;
  children: React.ReactNode;
  wide?: boolean;
}

/** Modal shell shared by every ERP CRUD form. */
export const FormModal: React.FC<FormModalProps> = ({
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel = 'Enregistrer',
  children,
  wide,
}) => {
  // Escape closes the modal (keyboard accessibility).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[calc(100dvh-0.75rem)] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-y-auto rounded-t-2xl border border-[#2a2a2b] bg-[#161619] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#26262a] p-4 sm:p-5">
          <div>
            <h2 className="text-base font-bold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#a9a9a9]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-[#232328] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5"
        >
          {children}

          <div className="flex flex-col-reverse gap-2 border-t border-[#26262a] pt-3 min-[380px]:flex-row min-[380px]:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl bg-[#232328] px-4 text-sm font-semibold text-stone-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] min-[380px]:text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-[#C9A45C] px-5 text-sm font-bold text-[#101010] transition-colors hover:bg-[#d8b56d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white min-[380px]:text-xs"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, required, hint, children }) => (
  <label className="block">
    <span className="text-[11px] font-semibold text-stone-300 block mb-1">
      {label} {required && <span className="text-[#C9A45C]">*</span>}
    </span>
    {children}
    {hint && <span className="text-[10px] text-stone-500 block mt-1">{hint}</span>}
  </label>
);

export const inputClass =
  'min-h-11 w-full rounded-xl border border-[#29292e] bg-[#111113] px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-[#C9A45C]';

interface ConfirmDeleteProps {
  onConfirm: () => void;
  label?: string;
  className?: string;
}

/** Two-step delete: the first click asks for confirmation. */
export const ConfirmDelete: React.FC<ConfirmDeleteProps> = ({
  onConfirm,
  label = 'Supprimer',
  className,
}) => {
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
        armed ? 'border-red-500 bg-red-600 text-white' : 'border-red-900/50 text-red-400 hover:bg-red-950/40'
      } ${className ?? ''}`}
    >
      {armed ? 'Confirmer ?' : label}
    </button>
  );
};
