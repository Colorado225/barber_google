import { createContext, useCallback, useContext, useState } from 'react';
import type { Appointment, AppointmentStatus, PaymentMethod, Service, StaffMember } from '../../types';
import { getApiErrorMessage } from '../../lib/apiError';
import { upsertAppointmentInList } from '../../lib/appointmentList';
import { DEFAULT_BUSINESS_TIMEZONE, zonedDateTimeToIso } from '../../lib/businessTime';
import type { DomainSharedDeps } from './shared';

export interface AppointmentsDomainValue {
  appointments: Appointment[];
  services: Service[];
  staff: StaffMember[];
  bookAppointment: (data: {
    salonId: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    clientId?: string | null;
    serviceId: string;
    staffId: string;
    date: string;
    time: string;
    paymentMethod: PaymentMethod;
    source?: 'direct' | 'whatsapp' | 'phone';
    notes?: string;
  }) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus, reason?: string) => void;
  updateAppointmentDetails: (appointmentId: string, updates: Partial<Appointment>) => void;
  cancelAppointment: (appointmentId: string) => void;
  registerWalkIn: (data: {
    serviceId: string;
    clientName?: string;
    clientPhone?: string;
    clientId?: string | null;
    staffId?: string | null;
    branchId?: string | null;
    startImmediately?: boolean;
    notes?: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  startWalkIn: (
    appointmentId: string,
    staffId?: string | null,
  ) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  completeWalkIn: (
    appointmentId: string,
  ) => Promise<{ success: boolean; appointment?: Appointment; error?: string }>;
  updateAppointment: (appointmentId: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (appointmentId: string) => void;
  addService: (service: Omit<Service, 'id'>) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  deleteService: (id: string) => void;
  setServiceActive: (id: string, isActive: boolean) => void;
  addStaff: (member: Omit<StaffMember, 'id'>) => void;
  updateStaff: (id: string, updates: Partial<StaffMember>) => void;
  deleteStaff: (id: string) => void;
}

export const AppointmentsDomainContext = createContext<AppointmentsDomainValue | undefined>(undefined);

export function useAppointmentsDomain(): AppointmentsDomainValue {
  const ctx = useContext(AppointmentsDomainContext);
  if (!ctx) throw new Error('useAppointmentsDomain must be used within an AppProvider');
  return ctx;
}

export function useAppointmentsDomainState(
  deps: Pick<
    DomainSharedDeps,
    | 'resolveApi'
    | 'domainCache'
    | 'requireActiveSalon'
    | 'memberships'
    | 'hasActiveMembership'
    | 'addToast'
    | 'remote'
    | 'newIdempotencyKey'
  > & {
    salonTimezone?: string;
    loadNotifications: (
      salonId: string,
      isGuardActive?: () => boolean,
      options?: { force?: boolean },
    ) => Promise<void>;
    loadLoyalty: (
      salonId: string,
      isGuardActive?: () => boolean,
      options?: { force?: boolean },
    ) => Promise<void>;
  },
) {
  const {
    resolveApi,
    domainCache,
    requireActiveSalon,
    memberships,
    hasActiveMembership,
    addToast,
    remote,
    newIdempotencyKey,
    salonTimezone = DEFAULT_BUSINESS_TIMEZONE,
    loadNotifications,
    loadLoyalty,
  } = deps;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  const bookAppointment = useCallback(
    async ({
      salonId,
      clientName,
      clientPhone,
      clientId,
      serviceId,
      staffId,
      date,
      time,
      source,
      notes,
    }: {
      salonId: string;
      clientName: string;
      clientPhone: string;
      clientEmail?: string;
      clientId?: string | null;
      serviceId: string;
      staffId: string;
      date: string;
      time: string;
      paymentMethod: PaymentMethod;
      source?: 'direct' | 'whatsapp' | 'phone';
      notes?: string;
    }): Promise<{ success: boolean; error?: string; appointment?: Appointment }> => {
      const selectedService = services.find((s) => s.id === serviceId);
      if (!selectedService) {
        return { success: false, error: 'Prestation introuvable' };
      }
      if (!memberships.some((membership) => membership.salonId === salonId)) {
        const error = 'La réservation nécessite une session Supabase et une adhésion active à ce salon.';
        addToast(error, 'error');
        return { success: false, error };
      }

      try {
        const api = await resolveApi(salonId);
        const created = await api.appointments.create({
          serviceId,
          startsAt: zonedDateTimeToIso(date, time, salonTimezone),
          clientName,
          clientPhone,
          clientId: clientId ?? null,
          staffId: staffId === 'any' || !staffId ? null : staffId,
          source: source ?? 'direct',
          notes: notes ?? '',
        });
        setAppointments((prev) => upsertAppointmentInList(prev, created));
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        addToast('Rendez-vous enregistré au planning.', 'success');
        return { success: true, appointment: created };
      } catch (error) {
        const message = getApiErrorMessage(error, 'Erreur lors de la réservation.');
        addToast(message, 'error');
        return { success: false, error: message };
      }
    },
    [services, memberships, resolveApi, domainCache, addToast, salonTimezone],
  );

  const updateAppointmentStatus = useCallback(
    (appointmentId: string, status: AppointmentStatus, reason?: string) => {
      if (!hasActiveMembership) {
        addToast('Modification indisponible sans adhésion active à ce salon.', 'error');
        return;
      }

      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.appointments.transition(
          appointmentId,
          status,
          status === 'cancelled' || status === 'no_show' ? reason || 'Motif non précisé' : undefined,
        );
        setAppointments((prev) => upsertAppointmentInList(prev, saved));
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        domainCache.invalidate(salonId, 'notifications');
        domainCache.invalidate(salonId, 'loyalty');
        await Promise.all([
          loadNotifications(salonId, undefined, { force: true }),
          loadLoyalty(salonId, undefined, { force: true }),
        ]);
        addToast(`Statut mis à jour : ${saved.status}`, 'info');
      }, 'Transition de statut refusée par Supabase.');
    },
    [
      hasActiveMembership,
      addToast,
      remote,
      requireActiveSalon,
      resolveApi,
      domainCache,
      loadNotifications,
      loadLoyalty,
    ],
  );

  const updateAppointment = useCallback(
    (appointmentId: string, updates: Partial<Appointment>) => {
      const current = appointments.find((a) => a.id === appointmentId);
      if (!current) return;
      const merged = { ...current, ...updates };

      if (!hasActiveMembership) {
        addToast('Modification indisponible sans adhésion active à ce salon.', 'error');
        return;
      }

      const startsAt = zonedDateTimeToIso(merged.date, merged.time, salonTimezone);

      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.appointments.reschedule(appointmentId, {
          staffId: merged.staffId === 'any' || !merged.staffId ? current.staffId : merged.staffId,
          serviceId: merged.serviceId,
          startsAt,
          notes: merged.notes ?? '',
        });
        setAppointments((prev) => upsertAppointmentInList(prev, saved));
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        addToast('Rendez-vous modifié.', 'success');
      }, 'Modification du rendez-vous impossible (créneau indisponible ?)');
    },
    [
      appointments,
      hasActiveMembership,
      addToast,
      remote,
      requireActiveSalon,
      resolveApi,
      domainCache,
      salonTimezone,
    ],
  );

  const updateAppointmentDetails = useCallback(
    (appointmentId: string, updates: Partial<Appointment>) => {
      updateAppointment(appointmentId, updates);
    },
    [updateAppointment],
  );

  const cancelAppointment = useCallback(
    (appointmentId: string) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.appointments.cancel(appointmentId, 'Annulé par un membre du salon');
        setAppointments((prev) => upsertAppointmentInList(prev, saved));
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        domainCache.invalidate(salonId, 'notifications');
        await loadNotifications(salonId, undefined, { force: true });
        addToast('Rendez-vous annulé.', 'info');
      }, 'Annulation du rendez-vous impossible.');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, loadNotifications, addToast],
  );

  const deleteAppointment = useCallback(
    (appointmentId: string) => {
      void remote(async () => {
        if (!hasActiveMembership) throw new Error('Annulation indisponible sans adhésion active au salon.');
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.appointments.cancel(appointmentId, 'Annulé depuis le planning');
        setAppointments((prev) => upsertAppointmentInList(prev, saved));
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        addToast('Rendez-vous annulé, historique conservé.', 'info');
      }, 'Annulation du rendez-vous impossible');
    },
    [remote, hasActiveMembership, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const registerWalkIn = useCallback(
    async (data: {
      serviceId: string;
      clientName?: string;
      clientPhone?: string;
      clientId?: string | null;
      staffId?: string | null;
      branchId?: string | null;
      startImmediately?: boolean;
      notes?: string;
      idempotencyKey?: string;
    }): Promise<{ success: boolean; appointment?: Appointment; error?: string }> => {
      try {
        const salonId = requireActiveSalon().id;
        if (!memberships.some((m) => m.salonId === salonId)) {
          throw new Error('Une adhésion active à ce salon est requise.');
        }
        const api = await resolveApi(salonId);
        const created = await api.appointments.registerWalkIn({
          serviceId: data.serviceId,
          idempotencyKey: data.idempotencyKey ?? newIdempotencyKey(),
          clientName: data.clientName ?? null,
          clientPhone: data.clientPhone ?? null,
          clientId: data.clientId ?? null,
          staffId: data.staffId ?? null,
          branchId: data.branchId ?? null,
          startImmediately: data.startImmediately ?? false,
          notes: data.notes ?? '',
        });
        setAppointments((prev) => upsertAppointmentInList(prev, created));
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        addToast(
          created.status === 'in_progress'
            ? 'Client de passage installé : prestation démarrée.'
            : 'Client de passage ajouté à la file d’attente.',
          'success',
        );
        return { success: true, appointment: created };
      } catch (error) {
        const message = getApiErrorMessage(error, 'Accueil du client de passage impossible.');
        addToast(message, 'error');
        return { success: false, error: message };
      }
    },
    [requireActiveSalon, memberships, resolveApi, newIdempotencyKey, domainCache, addToast],
  );

  const startWalkIn = useCallback(
    async (appointmentId: string, staffId?: string | null) => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.appointments.startWalkIn(appointmentId, staffId ?? null);
        setAppointments((prev) => upsertAppointmentInList(prev, saved));
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        addToast('Prestation démarrée.', 'success');
        return { success: true, appointment: saved };
      } catch (error) {
        const message = getApiErrorMessage(error, 'Démarrage impossible.');
        addToast(message, 'error');
        return { success: false, error: message };
      }
    },
    [requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const completeWalkIn = useCallback(
    async (appointmentId: string) => {
      try {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const saved = await api.appointments.completeWalkIn(appointmentId);
        setAppointments((prev) => upsertAppointmentInList(prev, saved));
        domainCache.invalidate(salonId, 'appointments');
        domainCache.invalidate(salonId, 'dashboard');
        domainCache.invalidate(salonId, 'notifications');
        await loadNotifications(salonId, undefined, { force: true });
        addToast('Prestation terminée. Vous pouvez encaisser.', 'success');
        return { success: true, appointment: saved };
      } catch (error) {
        const message = getApiErrorMessage(error, 'Clôture de la prestation impossible.');
        addToast(message, 'error');
        return { success: false, error: message };
      }
    },
    [requireActiveSalon, resolveApi, domainCache, loadNotifications, addToast],
  );

  const setServiceActive = useCallback(
    (id: string, isActive: boolean) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        await api.services.setActive(id, isActive);
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, isActive } : s)));
        domainCache.invalidate(salonId, 'workspace');
        addToast(
          isActive ? 'Prestation réactivée.' : 'Prestation désactivée (retirée de la réservation).',
          'info',
        );
      }, 'Changement de statut de la prestation impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const addService = useCallback(
    (data: Omit<Service, 'id'>) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const created = await api.services.create({
          name: data.name,
          category: data.category,
          description: data.description,
          price: data.price,
          durationMinutes: data.durationMinutes,
          prepMinutes: data.prepMinutes ?? 0,
          popular: Boolean(data.popular),
        });
        setServices((prev) => [...prev, created]);
        domainCache.invalidate(salonId, 'workspace');
        addToast('Prestation ajoutée au catalogue !', 'success');
      }, 'Ajout de la prestation impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const updateService = useCallback(
    (id: string, updates: Partial<Service>) => {
      void remote(async () => {
        const current = services.find((s) => s.id === id);
        if (!current) return;
        const salonId = requireActiveSalon().id;
        const merged = { ...current, ...updates };
        const api = await resolveApi(salonId);
        const saved = await api.services.update(id, {
          name: merged.name,
          category: merged.category,
          description: merged.description,
          price: merged.price,
          durationMinutes: merged.durationMinutes,
          prepMinutes: merged.prepMinutes ?? 0,
          popular: Boolean(merged.popular),
        });
        setServices((prev) => prev.map((s) => (s.id === id ? saved : s)));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Prestation mise à jour.', 'success');
      }, 'Modification de la prestation impossible');
    },
    [remote, services, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const deleteService = useCallback(
    (id: string) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        await api.services.remove(id);
        setServices((prev) => prev.filter((s) => s.id !== id));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Prestation supprimée.', 'info');
      }, 'Suppression de la prestation impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const addStaff = useCallback(
    (data: Omit<StaffMember, 'id'>) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        const created = await api.staff.create({
          name: data.name,
          role: data.role,
          phone: data.phone,
          specialties: data.specialties,
          commissionRate: data.commissionRate,
          isAvailable: data.isAvailable,
        });
        setStaff((prev) => [...prev, created]);
        domainCache.invalidate(salonId, 'workspace');
        addToast(`${created.name} a été ajouté à l'équipe !`, 'success');
      }, 'Ajout du collaborateur impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const updateStaff = useCallback(
    (id: string, updates: Partial<StaffMember>) => {
      void remote(async () => {
        const current = staff.find((m) => m.id === id);
        if (!current) return;
        const salonId = requireActiveSalon().id;
        const merged = { ...current, ...updates };
        const api = await resolveApi(salonId);
        const saved = await api.staff.update(id, {
          name: merged.name,
          role: merged.role,
          phone: merged.phone,
          specialties: merged.specialties,
          commissionRate: merged.commissionRate,
          isAvailable: merged.isAvailable,
        });
        setStaff((prev) => prev.map((m) => (m.id === id ? saved : m)));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Collaborateur mis à jour.', 'success');
      }, 'Modification du collaborateur impossible');
    },
    [remote, staff, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const deleteStaff = useCallback(
    (id: string) => {
      void remote(async () => {
        const salonId = requireActiveSalon().id;
        const api = await resolveApi(salonId);
        await api.staff.remove(id);
        setStaff((prev) => prev.filter((m) => m.id !== id));
        domainCache.invalidate(salonId, 'workspace');
        addToast('Collaborateur retiré.', 'info');
      }, 'Suppression du collaborateur impossible');
    },
    [remote, requireActiveSalon, resolveApi, domainCache, addToast],
  );

  const resetAppointmentsDomain = useCallback(() => {
    setAppointments([]);
    setServices([]);
    setStaff([]);
  }, []);

  return {
    appointments,
    setAppointments,
    services,
    setServices,
    staff,
    setStaff,
    bookAppointment,
    updateAppointmentStatus,
    updateAppointmentDetails,
    cancelAppointment,
    registerWalkIn,
    startWalkIn,
    completeWalkIn,
    updateAppointment,
    deleteAppointment,
    addService,
    updateService,
    deleteService,
    setServiceActive,
    addStaff,
    updateStaff,
    deleteStaff,
    resetAppointmentsDomain,
  };
}
