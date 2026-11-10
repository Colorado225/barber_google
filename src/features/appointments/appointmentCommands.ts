/**
 * Commandes des rendez-vous. Le port est injecté : chaque charge utile est testable sans réseau.
 * Les validations de disponibilité et de montant sont faites par la base, pas ici.
 */
import type { Appointment, AppointmentStatus } from '../../types';
import type { AppointmentInput, RescheduleInput, WalkInInput } from '../../services/api/shared';
import {
  toBookingPayload,
  toReschedulePayload,
  toWalkInPayload,
  transitionReason,
  type BookingDraft,
  type WalkInDraft,
} from './appointmentRules';

export interface AppointmentCommandPort {
  create: (data: AppointmentInput) => Promise<Appointment>;
  registerWalkIn: (data: WalkInInput) => Promise<Appointment>;
  startWalkIn: (id: string, staffId?: string | null) => Promise<Appointment>;
  completeWalkIn: (id: string) => Promise<Appointment>;
  reschedule: (id: string, data: RescheduleInput) => Promise<Appointment>;
  transition: (id: string, status: string, reason?: string) => Promise<Appointment>;
  cancel: (id: string, reason: string) => Promise<Appointment>;
}

export function createBooking(port: AppointmentCommandPort, draft: BookingDraft): Promise<Appointment> {
  return port.create(toBookingPayload(draft));
}

export function registerWalkIn(
  port: AppointmentCommandPort,
  draft: WalkInDraft,
  newKey: () => string,
): Promise<Appointment> {
  return port.registerWalkIn(toWalkInPayload(draft, newKey));
}

export function transitionAppointment(
  port: AppointmentCommandPort,
  id: string,
  status: AppointmentStatus,
  reason?: string,
): Promise<Appointment> {
  return port.transition(id, status, transitionReason(status, reason));
}

export function rescheduleAppointment(
  port: AppointmentCommandPort,
  current: Appointment,
  merged: Appointment,
): Promise<Appointment> {
  return port.reschedule(current.id, toReschedulePayload(current, merged));
}
