import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { AppointmentNotification } from '../../types';
import {
  Send,
  Mail,
  MessageCircle,
  Smartphone,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MinusCircle,
} from 'lucide-react';

const KIND_LABEL: Record<AppointmentNotification['kind'], string> = {
  booking_received: 'Demande reçue',
  booking_confirmed: 'Réservation confirmée',
  booking_cancelled: 'Réservation annulée',
  reminder_24h: 'Rappel J-1',
  review_request: 'Invitation à noter',
};

const STATUS_META: Record<AppointmentNotification['status'], { label: string; className: string }> = {
  pending: { label: 'En file', className: 'border-amber-500/40 bg-amber-950 text-amber-300' },
  sending: { label: 'En cours d’envoi', className: 'border-sky-500/40 bg-sky-950 text-sky-300' },
  sent: { label: 'Envoyé', className: 'border-emerald-500/40 bg-emerald-950 text-emerald-300' },
  failed: { label: 'Échec', className: 'border-red-500/40 bg-red-950 text-red-300' },
  skipped: { label: 'Ignoré', className: 'border-stone-600 bg-stone-800 text-stone-300' },
};

function channelIcon(channel: AppointmentNotification['channel']) {
  if (channel === 'email') return Mail;
  if (channel === 'whatsapp') return MessageCircle;
  return Smartphone;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** File d'envoi des notifications : déclenchement réel + statut honnête. */
export const NotificationsView: React.FC = () => {
  const { activeSalon, notifications, dispatchNotifications, retryNotification, refreshNotifications } =
    useApp();
  const { hasPermission } = useOptionalAuth();
  const canDispatch = hasPermission('appointments.write', activeSalon.id);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | AppointmentNotification['status']>('all');

  const rows = useMemo(
    () =>
      notifications
        .filter((n) => n.salonId === activeSalon.id)
        .filter((n) => filter === 'all' || n.status === filter),
    [notifications, activeSalon.id, filter],
  );

  const counts = useMemo(() => {
    const base = { pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };
    for (const n of notifications) if (n.salonId === activeSalon.id) base[n.status] += 1;
    return base;
  }, [notifications, activeSalon.id]);

  const providerMissing = notifications.some((n) => (n.error ?? '').includes('provider_not_configured'));

  const runDispatch = async () => {
    setBusy(true);
    await dispatchNotifications();
    setBusy(false);
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Send className="h-6 w-6 text-[#C9A45C]" />
          <div>
            <h1 className="text-xl font-bold text-white">Notifications clients</h1>
            <p className="text-sm text-stone-400">
              Confirmations, rappels et invitations à noter, envoyés par e-mail ou WhatsApp
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void refreshNotifications()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2b] bg-[#161619] px-3 py-2 text-xs font-semibold text-stone-300 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          {canDispatch && (
            <button
              onClick={() => void runDispatch()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2 text-xs font-bold text-[#101010] hover:bg-[#d8b46c] disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {busy ? 'Traitement…' : 'Traiter la file d’envoi'}
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-5">
        {(
          [
            ['pending', 'En file', 'text-amber-300'],
            ['sending', 'En cours', 'text-sky-300'],
            ['sent', 'Envoyés', 'text-emerald-300'],
            ['failed', 'Échecs', 'text-red-300'],
            ['skipped', 'Ignorés', 'text-stone-300'],
          ] as const
        ).map(([key, label, tone]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`rounded-xl border p-4 text-left ${filter === key ? 'border-[#C9A45C] bg-[#1c1a16]' : 'border-[#27272c] bg-[#161619]'}`}
          >
            <p className="text-xs text-stone-400">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${tone}`}>{counts[key]}</p>
          </button>
        ))}
      </div>

      {providerMissing && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-xs text-amber-200 space-y-1">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4" /> Fournisseur d’envoi non configuré
          </p>
          <p>
            Des messages sont marqués « ignorés » faute de clé fournisseur. Aucun message n’est réellement
            parti : renseignez <code>RESEND_API_KEY</code> + <code>NOTIFICATIONS_EMAIL_FROM</code> (e-mail)
            et/ou
            <code> WHATSAPP_TOKEN</code> + <code>WHATSAPP_PHONE_NUMBER_ID</code> dans les secrets de la
            fonction
            <code> notifications-dispatcher</code>, puis relancez les messages ignorés.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-[#27272c] bg-[#161619] p-6 text-sm text-stone-400">
          Aucun message dans cette catégorie. Les messages sont créés automatiquement à chaque réservation,
          confirmation, annulation et fin de prestation.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const Icon = channelIcon(n.channel);
            const meta = STATUS_META[n.status];
            return (
              <li key={n.id} className="rounded-xl border border-[#2a2a2b] bg-[#151516] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Icon className="h-4 w-4 text-stone-400" /> {KIND_LABEL[n.kind]}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400 truncate">{n.recipient}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-500">
                      <Clock className="h-3 w-3" />
                      {n.status === 'sent' && n.sentAt
                        ? `envoyé le ${formatWhen(n.sentAt)}`
                        : `prévu ${formatWhen(n.scheduledAt)}`}
                      {n.attempts > 0 && ` · ${n.attempts} tentative(s)`}
                    </p>
                    {n.error && <p className="mt-1 text-[11px] text-red-300">{n.error}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.className}`}
                    >
                      {n.status === 'sent' && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                      {n.status === 'failed' && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                      {n.status === 'skipped' && <MinusCircle className="mr-1 inline h-3 w-3" />}
                      {meta.label}
                    </span>
                    {canDispatch && (n.status === 'failed' || n.status === 'skipped') && (
                      <button
                        onClick={() => void retryNotification(n.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-[#232328] px-2.5 py-1.5 text-[11px] font-semibold text-stone-300 hover:text-white"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Relancer
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-stone-500">
        Un message n’est marqué « Envoyé » que si le fournisseur a confirmé la remise avec un identifiant. En
        l’absence de fournisseur configuré, il reste « Ignoré » — jamais « Envoyé ».
      </p>
    </section>
  );
};
