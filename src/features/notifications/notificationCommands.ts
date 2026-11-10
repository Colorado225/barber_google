/**
 * Commandes de la file de notifications. Le port est injecté pour tester chaque commande sans réseau.
 * L'envoi réel est effectué côté serveur (edge function) : le client ne fait que déclencher le traitement.
 */
import type { AppointmentNotification, NotificationDispatchResult } from '../../types';

export interface NotificationCommandPort {
  list: (limit?: number) => Promise<AppointmentNotification[]>;
  retry: (id: string) => Promise<AppointmentNotification>;
  dispatch: (limit?: number) => Promise<NotificationDispatchResult>;
}

/** Nombre maximal de notifications lues pour l'affichage. */
export const NOTIFICATION_LIST_LIMIT = 200;
/** Nombre maximal de messages traités par un déclenchement. */
export const NOTIFICATION_DISPATCH_LIMIT = 50;

/** Liste vide sans permission `appointments.read` : aucune requête n'est émise. */
export async function fetchNotifications(
  getPort: () => NotificationCommandPort,
  canRead: boolean,
): Promise<AppointmentNotification[]> {
  if (!canRead) return [];
  return getPort().list(NOTIFICATION_LIST_LIMIT);
}

export function dispatchNotificationQueue(
  port: NotificationCommandPort,
): Promise<NotificationDispatchResult> {
  return port.dispatch(NOTIFICATION_DISPATCH_LIMIT);
}

export function retryNotification(
  port: NotificationCommandPort,
  id: string,
): Promise<AppointmentNotification> {
  return port.retry(id);
}
