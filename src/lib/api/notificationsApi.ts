// Domaine notifications : file du salon, santé, sonde et déclenchement de l'envoi
// (extrait de l'ancien src/lib/api.ts monolithique).
import type {
  AppointmentNotification,
  NotificationDispatchResult,
  NotificationHealthSummary,
  NotificationProbeResult,
} from '../../types';
import { ApiError } from '../apiError';
import { mapCapabilities, mapNotificationProbe, mapSalonNotificationHealth } from '../notifications';
import type { DbRow, SalonApiDeps } from './internal';
import { unwrap } from './internal';
import { mapNotification } from './mappers';

export function createNotificationsApi(deps: SalonApiDeps) {
  const { supabase, salonId } = deps;
  return {
    notifications: {
      async list(limit = 200): Promise<AppointmentNotification[]> {
        const result = await supabase
          .from('appointment_notifications')
          .select('*')
          .eq('salon_id', salonId)
          .order('created_at', { ascending: false })
          .limit(limit);
        return (unwrap(result) ?? []).map((row) => mapNotification(row as DbRow));
      },
      async health(): Promise<NotificationHealthSummary> {
        const result = await supabase.rpc('get_salon_notification_health', { p_salon_id: salonId });
        return mapSalonNotificationHealth(unwrap(result));
      },
      async probe(checkWhatsappApi = false): Promise<NotificationProbeResult> {
        const { data, error } = await supabase.functions.invoke('notifications-dispatcher', {
          body: { salon_id: salonId, mode: 'health', check_whatsapp_api: checkWhatsappApi },
        });
        if (error) {
          throw new ApiError(
            `Expéditeur injoignable : ${error.message}. Vérifiez que la fonction « notifications-dispatcher » est déployée.`,
            502,
          );
        }
        const payload = (data ?? {}) as { error?: string };
        if (payload.error) throw new ApiError(payload.error, 400);
        return mapNotificationProbe(data);
      },
      async retry(id: string): Promise<AppointmentNotification> {
        const result = await supabase.rpc('retry_notification', { p_salon_id: salonId, p_id: id });
        return mapNotification(unwrap(result) as DbRow);
      },
      // L'envoi réel est effectué par l'edge function (secrets fournisseur côté
      // serveur). Le navigateur ne fait que déclencher le traitement du salon.
      async dispatch(limit = 50): Promise<NotificationDispatchResult> {
        const { data, error } = await supabase.functions.invoke('notifications-dispatcher', {
          body: { salon_id: salonId, limit },
        });
        if (error) {
          throw new ApiError(
            `Expéditeur injoignable : ${error.message}. Vérifiez que la fonction « notifications-dispatcher » est déployée.`,
            502,
          );
        }
        const payload = (data ?? {}) as {
          processed?: number;
          sent?: number;
          failed?: number;
          skipped?: number;
          provider_configured?: boolean;
          capabilities?: unknown;
          error?: string;
        };
        if (payload.error) throw new ApiError(payload.error, 400);
        return {
          processed: Number(payload.processed ?? 0),
          sent: Number(payload.sent ?? 0),
          failed: Number(payload.failed ?? 0),
          skipped: Number(payload.skipped ?? 0),
          providerConfigured: payload.provider_configured !== false,
          capabilities: mapCapabilities(payload.capabilities),
        };
      },
    },
  };
}
