import { useState } from 'react';
import { salonApi } from '../../lib/api';
import type { Salon, Service } from '../../types';
import { toServicePayload, validateServiceFields } from './serviceRules';

export interface ServicesDomainDeps {
  requireActiveSalon: () => Salon;
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Domaine prestations : catalogue local et commandes. Une prestation n'est jamais supprimée
 * (désactivée) par la réservation ; `deleteService` reste disponible côté API.
 */
export function useServicesDomain({ requireActiveSalon, remote, addToast }: ServicesDomainDeps) {
  const [services, setServices] = useState<Service[]>([]);

  const setServiceActive = (id: string, isActive: boolean) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).services.setActive(id, isActive);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, isActive } : s)));
      addToast(
        isActive ? 'Prestation réactivée.' : 'Prestation désactivée (retirée de la réservation).',
        'info',
      );
    }, 'Changement de statut de la prestation impossible');
  };

  const addService = (data: Omit<Service, 'id'>) => {
    const check = validateServiceFields(data);
    if (!check.ok) {
      addToast(check.error, 'error');
      return;
    }
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).services.create(toServicePayload(data));
      setServices((prev) => [...prev, created]);
      addToast('Prestation ajoutée au catalogue !', 'success');
    }, 'Ajout de la prestation impossible');
  };

  const updateService = (id: string, updates: Partial<Service>) => {
    const current = services.find((s) => s.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    const check = validateServiceFields(merged);
    if (!check.ok) {
      addToast(check.error, 'error');
      return;
    }
    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).services.update(id, toServicePayload(merged));
      setServices((prev) => prev.map((s) => (s.id === id ? saved : s)));
      addToast('Prestation mise à jour.', 'success');
    }, 'Modification de la prestation impossible');
  };

  const deleteService = (id: string) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).services.remove(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      addToast('Prestation supprimée.', 'info');
    }, 'Suppression de la prestation impossible');
  };

  return { services, setServices, setServiceActive, addService, updateService, deleteService };
}
