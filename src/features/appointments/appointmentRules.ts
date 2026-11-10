/**
 * Règles des rendez-vous (fonctions pures). Les montants, fins et disponibilités sont calculés par la base :
 * ces fonctions ne font que préparer les charges utiles.
 */
import type { Appointment, AppointmentStatus } from '../../types';
import type { AppointmentInput, RescheduleInput, WalkInInput } from '../../services/api/shared';

export const CANCEL_REASON_TEAM = 'Annulé par un membre du salon';
export const CANCEL_REASON_PLANNING = 'Annulé depuis le planning';
export const DEFAULT_TRANSITION_REASON = 'Motif non précisé';

/** Début du rendez-vous à partir de la date (AAAA-MM-JJ) et de l'heure (HH:MM). */
export function toStartsAt(date: string, time: string): string {
  return `${date}T${time.slice(0, 5)}:00.000Z`;
}

/** « any » ou vide : le serveur choisit le collaborateur. */
export function isAnyStaff(staffId: string | null | undefined): boolean {
  return staffId === 'any' || !staffId;
}

export interface BookingDraft {
  serviceId: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  clientId?: string | null;
  staffId: string;
  source?: 'direct' | 'whatsapp' | 'phone';
  notes?: string;
}

export function toBookingPayload(draft: BookingDraft): AppointmentInput {
  return {
    serviceId: draft.serviceId,
    startsAt: toStartsAt(draft.date, draft.time),
    clientName: draft.clientName,
    clientPhone: draft.clientPhone,
    clientId: draft.clientId ?? null,
    staffId: isAnyStaff(draft.staffId) ? null : draft.staffId,
    source: draft.source ?? 'direct',
    notes: draft.notes ?? '',
  };
}

/** Motif transmis avec une transition : seulement pour une annulation ou une absence. */
export function transitionReason(status: AppointmentStatus, reason?: string): string | undefined {
  return status === 'cancelled' || status === 'no_show' ? reason || DEFAULT_TRANSITION_REASON : undefined;
}

export interface WalkInDraft {
  serviceId: string;
  clientName?: string;
  clientPhone?: string;
  clientId?: string | null;
  staffId?: string | null;
  branchId?: string | null;
  startImmediately?: boolean;
  notes?: string;
  idempotencyKey?: string;
}

export function toWalkInPayload(draft: WalkInDraft, newKey: () => string): WalkInInput {
  return {
    serviceId: draft.serviceId,
    idempotencyKey: draft.idempotencyKey ?? newKey(),
    clientName: draft.clientName ?? null,
    clientPhone: draft.clientPhone ?? null,
    clientId: draft.clientId ?? null,
    staffId: draft.staffId ?? null,
    branchId: draft.branchId ?? null,
    startImmediately: draft.startImmediately ?? false,
    notes: draft.notes ?? '',
  };
}

/**
 * Déplacement : seul le début, le service, le collaborateur et les notes partent. La fin et le montant sont
 * recalculés côté serveur depuis la prestation. Sans collaborateur choisi, on garde l'actuel.
 */
export function toReschedulePayload(current: Appointment, merged: Appointment): RescheduleInput {
  return {
    staffId: isAnyStaff(merged.staffId) ? current.staffId : merged.staffId,
    serviceId: merged.serviceId,
    startsAt: toStartsAt(merged.date, merged.time),
    notes: merged.notes ?? '',
  };
}

/** Message affiché après l'accueil d'un passage sans rendez-vous, selon le statut obtenu. */
export function walkInAddedMessage(status: Appointment['status']): string {
  return status === 'in_progress'
    ? 'Client de passage installé : prestation démarrée.'
    : 'Client de passage ajouté à la file d’attente.';
}
