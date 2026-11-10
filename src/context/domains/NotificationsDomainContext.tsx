import { createContext, useCallback, useContext, useState } from 'react';
import type {
  AppointmentNotification,
  NotificationDispatchResult,
  NotificationHealthSummary,
  NotificationProbeResult,
} from '../../types';
import { getApiErrorMessage } from '../../lib/apiError';
import type { DomainSharedDeps } from './shared';

export interface NotificationsDomainValue {
  notifications: AppointmentNotification[];
  notificationHealth: NotificationHealthSummary | null;
  notificationProbe: NotificationProbeResult | null;
  refreshNotifications: () => Promise<void>;
  probeNotifications: (checkWhatsappApi?: boolean) => Promise<NotificationProbeResult | null>;
  dispatchNotifications: () => Promise<NotificationDispatchResult | null>;
  retryNotification: (id: string) => Promise<void>;
}

export const NotificationsDomainContext = createContext<NotificationsDomainValue | undefined>(undefined);

export function useNotificationsDomain(): NotificationsDomainValue {
  const ctx = useContext(NotificationsDomainContext);
  if (!ctx) throw new Error('useNotificationsDomain must be used within an AppProvider');
  return ctx;
}

export function useNotificationsDomainState(
  deps: Pick<
    DomainSharedDeps,
    'resolveApi' | 'domainCache' | 'activeSalonId' | 'requireActiveSalon' | 'hasPermissionRef' | 'addToast'
  >,
) {
  const { resolveApi, domainCache, activeSalonId, requireActiveSalon, hasPermissionRef, addToast } = deps;
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);
  const [notificationHealth, setNotificationHealth] = useState<NotificationHealthSummary | null>(null);
  const [notificationProbe, setNotificationProbe] = useState<NotificationProbeResult | null>(null);

  const loadNotifications = useCallback(
    async (salonId: string, isGuardActive?: () => boolean, options?: { force?: boolean }) => {
      if (!hasPermissionRef.current('appointments.read', salonId)) {
        if (!isGuardActive || isGuardActive()) {
          setNotifications([]);
          setNotificationHealth(null);
        }
        return;
      }

      const payload = await domainCache.getOrLoad(
        salonId,
        'notifications',
        async () => {
          const notifClient = (await resolveApi(salonId)).notifications;
          const [listResult, healthResult] = await Promise.allSettled([
            notifClient.list(200),
            typeof notifClient.health === 'function' ? notifClient.health() : Promise.resolve(null),
          ]);
          if (listResult.status === 'rejected') {
            throw listResult.reason;
          }
          return {
            list: listResult.value,
            health: healthResult.status === 'fulfilled' ? healthResult.value : null,
          };
        },
        { force: options?.force ?? true },
      );

      if (isGuardActive && !isGuardActive()) return;
      setNotifications(payload.list);
      if (payload.health !== null || options?.force) {
        setNotificationHealth(payload.health);
      }
    },
    [resolveApi, domainCache, hasPermissionRef],
  );

  const refreshNotifications = useCallback(async () => {
    if (!activeSalonId) return;
    await loadNotifications(activeSalonId, undefined, { force: true });
  }, [activeSalonId, loadNotifications]);

  const probeNotifications = useCallback(
    async (checkWhatsappApi = false): Promise<NotificationProbeResult | null> => {
      const salonId = requireActiveSalon().id;
      try {
        const notifClient = (await resolveApi(salonId)).notifications;
        if (typeof notifClient.probe !== 'function') return null;
        const result = await notifClient.probe(checkWhatsappApi);
        setNotificationProbe(result);
        domainCache.invalidate(salonId, 'notifications');
        await loadNotifications(salonId, undefined, { force: true });
        return result;
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Vérification des canaux impossible.'), 'error');
        return null;
      }
    },
    [resolveApi, requireActiveSalon, domainCache, loadNotifications, addToast],
  );

  const dispatchNotifications = useCallback(async (): Promise<NotificationDispatchResult | null> => {
    const salonId = requireActiveSalon().id;
    try {
      const notifClient = (await resolveApi(salonId)).notifications;
      const result = await notifClient.dispatch(50);
      if (result.capabilities) {
        setNotificationProbe({
          service: 'notifications-dispatcher',
          ok: true,
          providerConfigured: result.providerConfigured,
          capabilities: result.capabilities,
          whatsappAudit: null,
          checkedAt: new Date().toISOString(),
        });
      }
      domainCache.invalidate(salonId, 'notifications');
      await loadNotifications(salonId, undefined, { force: true });
      if (!result.providerConfigured) {
        addToast(
          'Aucun fournisseur d’envoi configuré : la file est conservée. Ajoutez RESEND_API_KEY ou WHATSAPP_TOKEN dans les secrets Supabase.',
          'error',
        );
      } else if (result.processed === 0) {
        addToast('Aucun message à envoyer pour le moment.', 'info');
      } else {
        addToast(
          `${result.processed} message(s) traité(s) : ${result.sent} envoyé(s), ${result.failed} échec(s), ${result.skipped} ignoré(s).`,
          result.failed > 0 ? 'error' : result.sent > 0 ? 'success' : 'info',
        );
      }
      return result;
    } catch (error) {
      addToast(getApiErrorMessage(error, 'Traitement de la file impossible.'), 'error');
      return null;
    }
  }, [resolveApi, requireActiveSalon, domainCache, loadNotifications, addToast]);

  const retryNotification = useCallback(
    async (id: string) => {
      const salonId = requireActiveSalon().id;
      try {
        const notifClient = (await resolveApi(salonId)).notifications;
        await notifClient.retry(id);
        domainCache.invalidate(salonId, 'notifications');
        await loadNotifications(salonId, undefined, { force: true });
        addToast('Message replacé dans la file d’envoi.', 'success');
      } catch (error) {
        addToast(getApiErrorMessage(error, 'Relance impossible.'), 'error');
      }
    },
    [resolveApi, requireActiveSalon, domainCache, loadNotifications, addToast],
  );

  const resetNotificationsDomain = useCallback(() => {
    setNotifications([]);
    setNotificationHealth(null);
    setNotificationProbe(null);
  }, []);

  return {
    notifications,
    setNotifications,
    notificationHealth,
    notificationProbe,
    loadNotifications,
    refreshNotifications,
    probeNotifications,
    dispatchNotifications,
    retryNotification,
    resetNotificationsDomain,
  };
}
