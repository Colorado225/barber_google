import type { AppointmentStatus } from '../types';

/**
 * Machine à états officielle des rendez-vous, alignée sur la fonction serveur
 * `public.transition_appointment`. Toute transition hors de cette table est
 * refusée par Supabase : l'UI ne doit proposer que ces transitions.
 */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Prochaine étape « avant » du workflow (hors annulation), ou null si clos. */
export function forwardStatus(from: AppointmentStatus): AppointmentStatus | null {
  const forward: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
    pending: 'confirmed',
    confirmed: 'checked_in',
    checked_in: 'in_progress',
    in_progress: 'completed',
  };
  return forward[from] ?? null;
}
