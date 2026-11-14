import React from 'react';
import { useOptionalUI } from '../../context/UIContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useOptionalUI();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-slide-up ${
            toast.type === 'success'
              ? 'bg-[#18231c]/95 border-[#16A36A]/40 text-emerald-100'
              : toast.type === 'error'
                ? 'bg-[#291717]/95 border-[#DC4545]/40 text-red-100'
                : 'bg-[#1b1b1e]/95 border-[#C9A45C]/40 text-amber-100'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#16A36A] shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[#DC4545] shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-[#C9A45C] shrink-0 mt-0.5" />}

          <div className="flex-1 text-sm leading-relaxed">{toast.message}</div>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
