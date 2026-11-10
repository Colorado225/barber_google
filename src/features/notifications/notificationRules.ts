/**
 * Règles de la file de notifications (fonctions pures). Le libellé affiché reflète le résultat réel du
 * traitement serveur : aucun envoi n'est annoncé s'il n'a pas eu lieu.
 */
import type { NotificationDispatchResult } from '../../types';

export type NotificationToast = { message: string; type: 'success' | 'error' | 'info' };

/** Message de statut après un déclenchement de la file. */
export function describeDispatchResult(result: NotificationDispatchResult): NotificationToast {
  if (!result.providerConfigured) {
    return {
      message:
        'Aucun fournisseur d’envoi configuré : la file est conservée. Ajoutez RESEND_API_KEY ou WHATSAPP_TOKEN dans les secrets Supabase.',
      type: 'error',
    };
  }
  if (result.processed === 0) {
    return { message: 'Aucun message à envoyer pour le moment.', type: 'info' };
  }
  return {
    message: `${result.processed} message(s) traité(s) : ${result.sent} envoyé(s), ${result.failed} échec(s), ${result.skipped} ignoré(s).`,
    type: result.failed > 0 ? 'error' : result.sent > 0 ? 'success' : 'info',
  };
}
