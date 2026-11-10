import { useState } from 'react';
import { salonApi, ApiError } from '../../lib/api';
import type { Appointment, AppointmentStatus, PaymentMethod, Salon, Service } from '../../types';
import { newIdempotencyKey } from '../shared/idempotency';
import {
  CANCEL_REASON_PLANNING,
  CANCEL_REASON_TEAM,
  walkInAddedMessage,
  type BookingDraft,
  type WalkInDraft,
} from './appointmentRules';
import {
  createBooking,
  registerWalkIn as registerWalkInCommand,
  rescheduleAppointment,
  transitionAppointment,
} from './appointmentCommands';

export interface AppointmentsDomainDeps {
  memberships: ReadonlyArray<{ salonId: string; status: string }>;
  activeSalonId: string;
  services: Service[];
  requireActiveSalon: () => Salon;
  remote: (action: () => Promise<void>, fallbackMessage: string) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  loadNotifications: (salonId: string) => Promise<void>;
  loadLoyalty: (salonId: string) => Promise<void>;
}

type ActionResult = { success: boolean; error?: string; appointment?: Appointment };

/** Demande de réservation depuis l'ERP. Le mode de paiement est accepté mais non persisté (voir caisse). */
export type BookingRequest = BookingDraft & {
  salonId: string;
  clientEmail?: string;
  paymentMethod: PaymentMethod;
};

/**
 * Domaine rendez-vous : planning, réservations, changements de statut, déplacements, passages sans rendez-vous.
 * Toutes les écritures passent par la base ; l'état local ne reçoit que la réponse serveur.
 */
export function useAppointmentsDomain({
  memberships,
  activeSalonId,
  services,
  requireActiveSalon,
  remote,
  addToast,
  loadNotifications,
  loadLoyalty,
}: AppointmentsDomainDeps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  /** Les opérations ERP nécessitent une adhésion Supabase active au salon. */
  const hasActiveMembership = memberships.some(
    (membership) => membership.status === 'active' && membership.salonId === activeSalonId,
  );

  const bookAppointment = async ({
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
  }: BookingRequest): Promise<ActionResult> => {
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
      // La disponibilité, la durée, le montant et l'affectation sont vérifiés côté serveur
      // (RPC create_appointment). « any » laisse le serveur choisir. Le règlement sera enregistré
      // en caisse : le mode de paiement n'est pas persisté à la réservation.
      const created = await createBooking(salonApi(salonId).appointments, {
        serviceId,
        date,
        time,
        clientName,
        clientPhone,
        clientId,
        staffId,
        source,
        notes,
      });
      setAppointments((prev) => [created, ...prev]);
      addToast('Rendez-vous enregistré au planning.', 'success');
      return { success: true, appointment: created };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Erreur lors de la réservation.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const updateAppointmentStatus = (appointmentId: string, status: AppointmentStatus, reason?: string) => {
    if (!hasActiveMembership) {
      addToast('Modification indisponible sans adhésion active à ce salon.', 'error');
      return;
    }

    void remote(async () => {
      const saved = await transitionAppointment(
        salonApi(requireActiveSalon().id).appointments,
        appointmentId,
        status,
        reason,
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      await Promise.all([loadNotifications(requireActiveSalon().id), loadLoyalty(requireActiveSalon().id)]);
      addToast(`Statut mis à jour : ${saved.status}`, 'info');
    }, 'Transition de statut refusée par Supabase.');
  };

  const updateAppointmentDetails = (appointmentId: string, updates: Partial<Appointment>) => {
    // Réaffectation de barbier, changement de prestation/horaire : même chemin sécurisé que
    // l'édition du planning (RPC reschedule_appointment).
    updateAppointment(appointmentId, updates);
  };

  const cancelAppointment = (appointmentId: string) => {
    void remote(async () => {
      const saved = await salonApi(requireActiveSalon().id).appointments.cancel(
        appointmentId,
        CANCEL_REASON_TEAM,
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      await loadNotifications(requireActiveSalon().id);
      addToast('Rendez-vous annulé.', 'info');
    }, 'Annulation du rendez-vous impossible.');
  };

  const registerWalkIn = async (data: WalkInDraft): Promise<ActionResult> => {
    try {
      const salonId = requireActiveSalon().id;
      if (!memberships.some((m) => m.salonId === salonId)) {
        throw new Error('Une adhésion active à ce salon est requise.');
      }
      const created = await registerWalkInCommand(salonApi(salonId).appointments, data, newIdempotencyKey);
      setAppointments((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      addToast(walkInAddedMessage(created.status), 'success');
      return { success: true, appointment: created };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Accueil du client de passage impossible.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const startWalkIn = async (appointmentId: string, staffId?: string | null): Promise<ActionResult> => {
    try {
      const saved = await salonApi(requireActiveSalon().id).appointments.startWalkIn(
        appointmentId,
        staffId ?? null,
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? saved : a)));
      addToast('Prestation démarrée.', 'success');
      return { success: true, appointment: saved };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Démarrage impossible.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const completeWalkIn = async (appointmentId: string): Promise<ActionResult> => {
    try {
      const saved = await salonApi(requireActiveSalon().id).appointments.completeWalkIn(appointmentId);
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? saved : a)));
      // La fin de prestation met l'invitation à laisser un avis dans la file.
      await loadNotifications(requireActiveSalon().id);
      addToast('Prestation terminée. Vous pouvez encaisser.', 'success');
      return { success: true, appointment: saved };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Clôture de la prestation impossible.';
      addToast(message, 'error');
      return { success: false, error: message };
    }
  };

  const updateAppointment = (appointmentId: string, updates: Partial<Appointment>) => {
    const current = appointments.find((a) => a.id === appointmentId);
    if (!current) return;
    const merged = { ...current, ...updates };

    if (!hasActiveMembership) {
      addToast('Modification indisponible sans adhésion active à ce salon.', 'error');
      return;
    }

    // La fin et le montant sont recalculés côté serveur depuis la prestation : le client n'envoie que
    // le début, le service, le collaborateur et les notes.
    void remote(async () => {
      const saved = await rescheduleAppointment(
        salonApi(requireActiveSalon().id).appointments,
        current,
        merged,
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      addToast('Rendez-vous modifié.', 'success');
    }, 'Modification du rendez-vous impossible (créneau indisponible ?)');
  };

  const deleteAppointment = (appointmentId: string) => {
    // Les rendez-vous ne sont jamais supprimés : l'historique est conservé.
    void remote(async () => {
      if (!hasActiveMembership) throw new Error('Annulation indisponible sans adhésion active au salon.');
      const saved = await salonApi(requireActiveSalon().id).appointments.cancel(
        appointmentId,
        CANCEL_REASON_PLANNING,
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, ...saved } : a)));
      addToast('Rendez-vous annulé, historique conservé.', 'info');
    }, 'Annulation du rendez-vous impossible');
  };

  return {
    appointments,
    setAppointments,
    hasActiveMembership,
    bookAppointment,
    updateAppointmentStatus,
    updateAppointmentDetails,
    updateAppointment,
    cancelAppointment,
    deleteAppointment,
    registerWalkIn,
    startWalkIn,
    completeWalkIn,
  };
}
