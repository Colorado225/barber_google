import { useState } from 'react';
import { salonApi } from '../../lib/api';
import type { Salon, StaffMember } from '../../types';
import { toStaffPayload } from './staffRules';

export interface StaffDomainDeps {
  requireActiveSalon: () => Salon;
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/** Domaine personnel : état local et commandes d'écriture. Les noms exposés sont ceux du contexte. */
export function useStaffDomain({ requireActiveSalon, remote, addToast }: StaffDomainDeps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);

  const addStaff = (data: Omit<StaffMember, 'id'>) => {
    void remote(async () => {
      const created = await salonApi(requireActiveSalon().id).staff.create(toStaffPayload(data));
      setStaff((prev) => [...prev, created]);
      addToast(`${created.name} a été ajouté à l'équipe !`, 'success');
    }, 'Ajout du collaborateur impossible');
  };

  const updateStaff = (id: string, updates: Partial<StaffMember>) => {
    void remote(async () => {
      const current = staff.find((m) => m.id === id);
      if (!current) return;
      const saved = await salonApi(requireActiveSalon().id).staff.update(
        id,
        toStaffPayload({ ...current, ...updates }),
      );
      setStaff((prev) => prev.map((m) => (m.id === id ? saved : m)));
      addToast('Collaborateur mis à jour.', 'success');
    }, 'Modification du collaborateur impossible');
  };

  const deleteStaff = (id: string) => {
    void remote(async () => {
      await salonApi(requireActiveSalon().id).staff.remove(id);
      setStaff((prev) => prev.filter((m) => m.id !== id));
      addToast('Collaborateur retiré.', 'info');
    }, 'Suppression du collaborateur impossible');
  };

  return { staff, setStaff, addStaff, updateStaff, deleteStaff };
}
