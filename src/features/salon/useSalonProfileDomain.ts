import type { Dispatch, SetStateAction } from 'react';
import { setSalonPublication, updateSalonProfile } from '../../lib/marketplace';
import type { Salon } from '../../types';
import { toSalonProfilePayload } from './salonProfileRules';

export interface SalonProfileDomainDeps {
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setSalons: Dispatch<SetStateAction<Salon[]>>;
}

/** Profil public du salon et publication sur la marketplace. Chaque réponse serveur remplace la fiche. */
export function useSalonProfileDomain({ remote, addToast, setSalons }: SalonProfileDomainDeps) {
  const updateSalonDetails = (salonId: string, updates: Partial<Salon>) => {
    void remote(async () => {
      const saved = await updateSalonProfile(salonId, toSalonProfilePayload(updates));
      setSalons((prev) => prev.map((s) => (s.id === salonId ? saved : s)));
      addToast('Profil du salon enregistré.', 'success');
    }, 'Enregistrement du profil impossible');
  };

  const setSalonPublished = async (salonId: string, published: boolean): Promise<void> => {
    try {
      const saved = await setSalonPublication(salonId, published);
      setSalons((prev) => prev.map((s) => (s.id === salonId ? saved : s)));
      addToast(published ? 'Salon publié sur la marketplace.' : 'Salon retiré de la marketplace.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Changement de publication impossible.';
      addToast(message, 'error');
      throw error;
    }
  };

  return { updateSalonDetails, setSalonPublished };
}
