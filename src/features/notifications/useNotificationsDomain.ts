import { useState } from 'react';
import { salonApi, ApiError } from '../../lib/api';
import type { AppointmentNotification, NotificationDispatchResult, Salon } from '../../types';
import { describeDispatchResult } from './notificationRules';
import {
  dispatchNotificationQueue,
  fetchNotifications,
  retryNotification as retryQueued,
} from './notificationCommands';

export interface NotificationsDomainDeps {
  hasPermission: (permission: string, salonId?: string) => boolean;
  requireActiveSalon: () => Salon;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeSalonId: string;
}

/** Domaine notifications : file d'envoi, déclenchement serveur et relance d'un message. */
export function useNotificationsDomain({
  hasPermission,
  requireActiveSalon,
  addToast,
  activeSalonId,
}: NotificationsDomainDeps) {
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);

  const loadNotifications = async (salonId: string) => {
    setNotifications(
      await fetchNotifications(
        () => salonApi(salonId).notifications,
        hasPermission('appointments.read', salonId),
      ),
    );
  };

  const refreshNotifications = async () => {
    if (!activeSalonId) return;
    await loadNotifications(activeSalonId);
  };

  const dispatchNotifications = async (): Promise<NotificationDispatchResult | null> => {
    const salonId = requireActiveSalon().id;
    try {
      const result = await dispatchNotificationQueue(salonApi(salonId).notifications);
      await loadNotifications(salonId);
      const toast = describeDispatchResult(result);
      addToast(toast.message, toast.type);
      return result;
    } catch (error) {
      addToast(error instanceof ApiError ? error.message : 'Traitement de la file impossible.', 'error');
      return null;
    }
  };

  const retryNotification = async (id: string) => {
    const salonId = requireActiveSalon().id;
    try {
      await retryQueued(salonApi(salonId).notifications, id);
      await loadNotifications(salonId);
      addToast('Message replacé dans la file d’envoi.', 'success');
    } catch (error) {
      addToast(error instanceof ApiError ? error.message : 'Relance impossible.', 'error');
    }
  };

  return {
    notifications,
    setNotifications,
    loadNotifications,
    refreshNotifications,
    dispatchNotifications,
    retryNotification,
  };
}
