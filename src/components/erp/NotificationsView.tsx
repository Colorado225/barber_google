import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { AppointmentNotification } from '../../types';
import {
  evaluateNotificationAlerts,
  isRepeatedNotificationFailure,
  SMS_UNAVAILABLE_MESSAGE,
  SMS_UNAVAILABLE_TITLE,
} from '../../lib/notifications';
import {
  Send,
  Mail,
  MessageCircle,
  Smartphone,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  MinusCircle,
  Activity,
  Ban,
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

/** File d'envoi des notifications : déclenchement réel, observabilité et alertes d'échecs répétés. */
export const NotificationsView: React.FC = () => {
  const {
    activeSalon,
    notifications,
    notificationHealth,
    notificationProbe,
    dispatchNotifications,
    retryNotification,
    refreshNotifications,
    probeNotifications,
  } = useApp();
  const { hasPermission } = useOptionalAuth();
  const canDispatch = hasPermission('appointments.write', activeSalon.id);
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [filter, setFilter] = useState<'all' | AppointmentNotification['status']>('all');

  const salonNotifications = useMemo(
    () => notifications.filter((n) => n.salonId === activeSalon.id),
    [notifications, activeSalon.id],
  );

  const rows = useMemo(
    () => salonNotifications.filter((n) => filter === 'all' || n.status === filter),
    [salonNotifications, filter],
  );

  const counts = useMemo(() => {
    const base = { pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };
    for (const n of salonNotifications) base[n.status] += 1;
    return base;
  }, [salonNotifications]);

  const alerts = useMemo(
    () =>
      evaluateNotificationAlerts({
        notifications: salonNotifications,
        health: notificationHealth,
        probe: notificationProbe,
      }),
    [salonNotifications, notificationHealth, notificationProbe],
  );

  const emailReady = notificationProbe
    ? notificationProbe.capabilities.email.configured
    : notificationHealth?.lastRun?.emailConfigured;
  const whatsappReady = notificationProbe
    ? notificationProbe.capabilities.whatsapp.configured
    : notificationHealth?.lastRun?.whatsappConfigured;
  const whatsappTemplatesEnabled = notificationProbe
    ? notificationProbe.capabilities.whatsapp.templateModeEnabled
    : notificationHealth?.lastRun?.whatsappTemplateMode;

  const runDispatch = async () => {
    setBusy(true);
    await dispatchNotifications();
    setBusy(false);
  };

  const runProbe = async () => {
    setProbing(true);
    await probeNotifications(true);
    setProbing(false);
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Send className="h-6 w-6 text-[#C9A45C]" />
          <div>
            <h1 className="text-xl font-bold text-white">Notifications clients</h1>
            <p className="text-sm text-stone-400">
              Confirmations, rappels et invitations à noter par e-mail (Resend) ou WhatsApp (Meta). Le SMS
              n’est pas disponible.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshNotifications()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2b] bg-[#161619] px-3 py-2 text-xs font-semibold text-stone-300 hover:text-white cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          {canDispatch && (
            <button
              type="button"
              onClick={() => void runProbe()}
              disabled={probing}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2a2a2b] bg-[#161619] px-3 py-2 text-xs font-semibold text-[#E5C378] hover:border-[#C9A45C]/50 disabled:opacity-50 cursor-pointer"
            >
              <Activity className="h-4 w-4" /> {probing ? 'Vérification…' : 'Vérifier les canaux'}
            </button>
          )}
          {canDispatch && (
            <button
              type="button"
              onClick={() => void runDispatch()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2 text-xs font-bold text-[#101010] hover:bg-[#d8b46c] disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-4 w-4" /> {busy ? 'Traitement…' : 'Traiter la file d’envoi'}
            </button>
          )}
        </div>
      </header>

      {/* Mention explicite canal SMS non disponible */}
      <div
        data-testid="sms-unavailable-notice"
        className="rounded-xl border border-stone-700/80 bg-[#141418] p-3.5 text-xs text-stone-300 flex items-start gap-2.5"
      >
        <Ban className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-stone-200">{SMS_UNAVAILABLE_TITLE}</p>
          <p className="mt-0.5 text-stone-400">{SMS_UNAVAILABLE_MESSAGE}</p>
        </div>
      </div>

      {/* Alertes échecs répétés & anomalies d'exécution */}
      {alerts.length > 0 && (
        <div className="space-y-2.5" data-testid="notification-alerts">
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            return (
              <div
                key={alert.id}
                role="alert"
                className={`rounded-xl border p-4 text-xs flex flex-wrap items-start justify-between gap-3 ${
                  isCritical
                    ? 'border-red-500/50 bg-red-950/40 text-red-100'
                    : 'border-amber-500/40 bg-amber-950/40 text-amber-100'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {isCritical ? (
                    <AlertOctagon className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold">{alert.title}</p>
                    <p className={isCritical ? 'text-red-200/90' : 'text-amber-200/90'}>
                      {alert.description}
                    </p>
                  </div>
                </div>
                {(alert.code === 'repeated_failures' || alert.code === 'failure_burst') &&
                  counts.failed > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilter('failed')}
                      className="shrink-0 rounded-lg border border-red-400/40 bg-red-900/50 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-800/70 cursor-pointer"
                    >
                      Voir les échecs ({counts.failed})
                    </button>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {/* Observabilité des canaux et du planificateur */}
      <div data-testid="notification-observability-panel" className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
              <Mail className="h-3.5 w-3.5 text-[#C9A45C]" /> E-mail (Resend)
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                emailReady === true
                  ? 'border-emerald-500/40 bg-emerald-950 text-emerald-300'
                  : emailReady === false
                    ? 'border-amber-500/40 bg-amber-950 text-amber-300'
                    : 'border-stone-700 bg-stone-800 text-stone-300'
              }`}
            >
              {emailReady === true ? 'Prêt' : emailReady === false ? 'Secrets manquants' : 'À vérifier'}
            </span>
          </div>
          {notificationHealth && (
            <p className="text-[11px] text-stone-400">
              {notificationHealth.byChannel.email.sent} envoyé(s) ·{' '}
              {notificationHealth.byChannel.email.failed} échec(s) ·{' '}
              {notificationHealth.byChannel.email.pending} en file
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp (Meta)
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                whatsappReady === true
                  ? 'border-emerald-500/40 bg-emerald-950 text-emerald-300'
                  : whatsappReady === false
                    ? 'border-amber-500/40 bg-amber-950 text-amber-300'
                    : 'border-stone-700 bg-stone-800 text-stone-300'
              }`}
            >
              {whatsappReady === true ? 'Prêt' : whatsappReady === false ? 'Secrets manquants' : 'À vérifier'}
            </span>
          </div>
          <p className="text-[11px] text-stone-400">
            Modèles approuvés :{' '}
            <strong className="text-stone-200">
              {whatsappTemplatesEnabled === true
                ? 'Activés'
                : whatsappTemplatesEnabled === false
                  ? 'Non configurés'
                  : 'Non vérifié'}
            </strong>
          </p>
        </div>

        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
              <Smartphone className="h-3.5 w-3.5 text-stone-400" /> SMS
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold border border-stone-600 bg-stone-800 text-stone-300">
              Indisponible
            </span>
          </div>
          <p className="text-[11px] text-stone-400">Aucun fournisseur SMS raccordé</p>
        </div>

        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
              <Activity className="h-3.5 w-3.5 text-sky-400" /> Planificateur
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                notificationHealth?.scheduler.isEnabled && notificationHealth?.scheduler.cronActive
                  ? 'border-emerald-500/40 bg-emerald-950 text-emerald-300'
                  : 'border-stone-700 bg-stone-800 text-stone-300'
              }`}
            >
              {notificationHealth?.scheduler
                ? notificationHealth.scheduler.cronActive && notificationHealth.scheduler.isEnabled
                  ? `Actif (${notificationHealth.scheduler.cronSchedule ?? '*/5 * * * *'})`
                  : notificationHealth.scheduler.configured
                    ? 'Inactif'
                    : 'Non configuré'
                : 'En attente'}
            </span>
          </div>
          <p className="text-[11px] text-stone-400">
            {notificationHealth?.scheduler.lastRunAt
              ? `Dernier cron : ${formatWhen(notificationHealth.scheduler.lastRunAt)} (${notificationHealth.scheduler.lastRunStatus ?? 'ok'}${notificationHealth.scheduler.lastHttpStatus ? ` · HTTP ${notificationHealth.scheduler.lastHttpStatus}` : ''})`
              : notificationHealth?.lastRun
                ? `Dernier passage : ${formatWhen(notificationHealth.lastRun.createdAt)} (${notificationHealth.lastRun.triggerSource})`
                : 'Aucune exécution enregistrée'}
          </p>
        </div>
      </div>

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
            type="button"
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`rounded-xl border p-4 text-left cursor-pointer ${filter === key ? 'border-[#C9A45C] bg-[#1c1a16]' : 'border-[#27272c] bg-[#161619]'}`}
          >
            <p className="text-xs text-stone-400">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${tone}`}>{counts[key]}</p>
          </button>
        ))}
      </div>

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
            const repeated = isRepeatedNotificationFailure(n);
            const totalFailures = Math.max(n.failureCount ?? 0, n.status === 'failed' ? n.attempts : 0);
            return (
              <li
                key={n.id}
                className={`rounded-xl border p-4 ${
                  repeated ? 'border-red-500/50 bg-[#1a1214]' : 'border-[#2a2a2b] bg-[#151516]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                      <Icon className="h-4 w-4 text-stone-400" /> {KIND_LABEL[n.kind]}
                      {n.channel === 'sms' && (
                        <span className="rounded-full border border-stone-600 bg-stone-800 px-2 py-0.5 text-[10px] font-bold text-stone-300">
                          SMS indisponible
                        </span>
                      )}
                      {repeated && (
                        <span className="rounded-full border border-red-500/50 bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-200">
                          Échec répété (×{Math.max(totalFailures, 2)})
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400 truncate">{n.recipient}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {n.status === 'sent' && n.sentAt
                          ? `envoyé le ${formatWhen(n.sentAt)}`
                          : `prévu ${formatWhen(n.scheduledAt)}`}
                      </span>
                      {n.attempts > 0 && <span>· {n.attempts} tentative(s)</span>}
                      {totalFailures > 0 && n.status !== 'sent' && (
                        <span>· {totalFailures} échec(s) cumulé(s)</span>
                      )}
                      {n.providerMessageId && (
                        <span className="font-mono text-stone-400">· ID {n.providerMessageId}</span>
                      )}
                    </p>
                    {(n.error || n.lastError) && (
                      <p className="mt-1 text-[11px] text-red-300">{n.error || n.lastError}</p>
                    )}
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
                    {canDispatch &&
                      n.channel !== 'sms' &&
                      (n.status === 'failed' || n.status === 'skipped') && (
                        <button
                          type="button"
                          onClick={() => void retryNotification(n.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#232328] px-2.5 py-1.5 text-[11px] font-semibold text-stone-300 hover:text-white cursor-pointer"
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
        l’absence de fournisseur configuré, il reste en attente ou « Ignoré » — jamais « Envoyé ».
      </p>
    </section>
  );
};
