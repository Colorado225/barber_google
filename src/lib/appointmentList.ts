import type { Appointment } from '../types';

export function sameAppointmentState(a: Appointment, b: Appointment): boolean {
  return (
    a.id === b.id &&
    a.salonId === b.salonId &&
    a.branchId === b.branchId &&
    a.clientId === b.clientId &&
    a.clientName === b.clientName &&
    a.clientPhone === b.clientPhone &&
    a.clientEmail === b.clientEmail &&
    a.serviceId === b.serviceId &&
    a.serviceName === b.serviceName &&
    a.price === b.price &&
    a.staffId === b.staffId &&
    a.staffName === b.staffName &&
    a.date === b.date &&
    a.time === b.time &&
    a.durationMinutes === b.durationMinutes &&
    a.status === b.status &&
    a.paymentStatus === b.paymentStatus &&
    a.source === b.source &&
    a.notes === b.notes &&
    a.startsAt === b.startsAt &&
    a.endsAt === b.endsAt &&
    a.arrivalAt === b.arrivalAt &&
    a.serviceStartedAt === b.serviceStartedAt &&
    a.serviceCompletedAt === b.serviceCompletedAt &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Insère ou met à jour un rendez-vous de manière idempotente (sans doublons d'ID)
 * et rejette les mises à jour plus anciennes que l'état déjà en mémoire.
 */
export function upsertAppointmentInList(prev: Appointment[], incoming: Appointment): Appointment[] {
  const index = prev.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    const existing = prev[index];
    if (existing.updatedAt && incoming.updatedAt) {
      const existingTs = Date.parse(existing.updatedAt);
      const incomingTs = Date.parse(incoming.updatedAt);
      if (Number.isFinite(existingTs) && Number.isFinite(incomingTs) && incomingTs < existingTs) {
        return prev;
      }
    }
    const merged: Appointment = { ...existing, ...incoming };
    if (sameAppointmentState(existing, merged)) return prev;
    const next = [...prev];
    next[index] = merged;
    return next.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  }
  return [...prev, incoming].sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
}
