import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Salon } from '../types';

export type AppMode = 'marketplace' | 'erp';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface UIContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  formatPrice: (amount: number) => string;
  selectedSalonForModal: Salon | null;
  setSelectedSalonForModal: (salon: Salon | null) => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'marketplace';
    return window.location.pathname.toLowerCase().startsWith('/app') ? 'erp' : 'marketplace';
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedSalonForModal, setSelectedSalonForModal] = useState<Salon | null>(null);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const formatPrice = useCallback((amount: number): string => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  }, []);

  const value = useMemo<UIContextValue>(() => ({
    mode,
    setMode,
    toasts,
    addToast,
    removeToast,
    formatPrice,
    selectedSalonForModal,
    setSelectedSalonForModal,
  }), [mode, toasts, selectedSalonForModal, addToast, removeToast, formatPrice]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextValue => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};

export const useOptionalUI = (): UIContextValue => {
  const context = useContext(UIContext);
  if (!context) {
    return {
      mode: 'marketplace',
      setMode: () => {},
      toasts: [],
      addToast: () => {},
      removeToast: () => {},
      formatPrice: (amount: number) => new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA',
      selectedSalonForModal: null,
      setSelectedSalonForModal: () => {},
    };
  }
  return context;
};