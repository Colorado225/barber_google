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
  wide
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} bg-[#161619] border border-[#2a2a2b] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[#26262a]">
          <div>
            <h2 className="text-base font-bold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-[#a9a9a9] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {children}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#26262a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#232328] text-stone-300 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold cursor-pointer"
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
  'w-full bg-[#111113] border border-[#29292e] rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#C9A45C]';

interface ConfirmDeleteProps {
  onConfirm: () => void;
  label?: string;
}

/** Two-step delete: the first click asks for confirmation. */
export const ConfirmDelete: React.FC<ConfirmDeleteProps> = ({ onConfirm, label = 'Supprimer' }) => {
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
      className={`text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${armed
        ? 'bg-red-600 text-white border-red-500'
        : 'text-red-400 border-red-900/50 hover:bg-red-950/40'
        }`}
    >
      {armed ? 'Confirmer ?' : label}
    </button>
  );
};
