import React, { useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Mail,
  MessageCircle,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import type { NotificationProbeResult, PlatformNotificationHealthSummary } from '../../types';
import {
  evaluateNotificationAlerts,
  SMS_UNAVAILABLE_MESSAGE,
  SMS_UNAVAILABLE_TITLE,
} from '../../lib/notifications';

interface AdminNotificationsPanelProps {
  health: PlatformNotificationHealthSummary | null;
  probe: NotificationProbeResult | null;
  probing: boolean;
  onRefresh: () => void;
  onProbe: () => void;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export const AdminNotificationsPanel: React.FC<AdminNotificationsPanelProps> = ({
  health,
  probe,
  probing,
  onRefresh,
  onProbe,
}) => {
  const alerts = useMemo(() => evaluateNotificationAlerts({ health, probe }), [health, probe]);

  const emailReady = probe ? probe.capabilities.email.configured : health?.lastRun?.emailConfigured;
  const whatsappReady = probe ? probe.capabilities.whatsapp.configured : health?.lastRun?.whatsappConfigured;
  const whatsappTemplatesEnabled = probe
    ? probe.capabilities.whatsapp.templateModeEnabled
    : health?.lastRun?.whatsappTemplateMode;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Notifications, Secrets & Alertes</h1>
          <p className="text-xs text-stone-400 mt-1">
            Observabilité en temps réel des canaux Resend, WhatsApp Meta, modèles approuvés, tâche pg_cron et
            échecs répétés.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-xl bg-[#121216] hover:bg-[#1a1a22] border border-[#22222c] text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C9A45C]" />
            <span>Actualiser</span>
          </button>
          <button
            type="button"
            disabled={probing}
            onClick={onProbe}
            className="px-4 py-2 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{probing ? 'Audit en cours…' : 'Auditer les secrets & modèles'}</span>
          </button>
        </div>
      </div>

      {/* Statut explicite canal SMS indisponible */}
      <div
        data-testid="admin-sms-unavailable-notice"
        className="rounded-2xl border border-stone-700/70 bg-[#101014] p-4 flex items-start gap-3 text-xs"
      >
        <Ban className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-stone-200">{SMS_UNAVAILABLE_TITLE}</p>
          <p className="text-stone-400 mt-0.5">{health?.smsUnavailableReason ?? SMS_UNAVAILABLE_MESSAGE}</p>
        </div>
      </div>

      {/* Alertes échecs répétés & anomalies */}
      {alerts.length > 0 && (
        <div className="space-y-3" data-testid="admin-notification-alerts">
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            return (
              <div
                key={alert.id}
                role="alert"
                className={`rounded-2xl border p-4 text-xs flex items-start gap-3 ${
                  isCritical
                    ? 'border-red-500/50 bg-red-950/35 text-red-100'
                    : 'border-amber-500/40 bg-amber-950/35 text-amber-100'
                }`}
              >
                {isCritical ? (
                  <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-bold">{alert.title}</p>
                  <p className={isCritical ? 'text-red-200/90' : 'text-amber-200/90'}>{alert.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cartes canaux & planificateur */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <Mail className="w-4 h-4 text-[#C9A45C]" /> E-mail (Resend)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                emailReady === true
                  ? 'border-emerald-500/40 bg-emerald-950 text-emerald-300'
                  : emailReady === false
                    ? 'border-amber-500/40 bg-amber-950 text-amber-300'
                    : 'border-stone-700 bg-stone-900 text-stone-400'
              }`}
            >
              {emailReady === true ? 'Configuré' : emailReady === false ? 'Secrets absents' : 'Non sondé'}
            </span>
          </div>
          {probe && (
            <p className="text-[11px] text-stone-400">
              RESEND_API_KEY : {probe.capabilities.email.hasApiKey ? 'OK' : 'Absent'} · FROM :{' '}
              {probe.capabilities.email.hasSender ? 'OK' : 'Absent'}
            </p>
          )}
          {health && (
            <p className="text-[11px] text-stone-400">
              {health.byChannel.email.sent} envoyé(s) · {health.byChannel.email.failed} échec(s) ·{' '}
              {health.byChannel.email.pending} en attente
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <MessageCircle className="w-4 h-4 text-emerald-400" /> WhatsApp (Meta)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                whatsappReady === true
                  ? 'border-emerald-500/40 bg-emerald-950 text-emerald-300'
                  : whatsappReady === false
                    ? 'border-amber-500/40 bg-amber-950 text-amber-300'
                    : 'border-stone-700 bg-stone-900 text-stone-400'
              }`}
            >
              {whatsappReady === true
                ? 'Configuré'
                : whatsappReady === false
                  ? 'Secrets absents'
                  : 'Non sondé'}
            </span>
          </div>
          <p className="text-[11px] text-stone-400">
            Modèles approuvés :{' '}
            <strong className="text-stone-200">
              {whatsappTemplatesEnabled === true
                ? 'Activés'
                : whatsappTemplatesEnabled === false
                  ? 'Désactivés'
                  : 'Non sondé'}
            </strong>
          </p>
          {health && (
            <p className="text-[11px] text-stone-400">
              {health.byChannel.whatsapp.sent} envoyé(s) · {health.byChannel.whatsapp.failed} échec(s) ·{' '}
              {health.byChannel.whatsapp.pending} en attente
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <Smartphone className="w-4 h-4 text-stone-400" /> Canal SMS
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-stone-600 bg-stone-800 text-stone-300">
              Indisponible
            </span>
          </div>
          <p className="text-[11px] text-stone-400">
            Aucun fournisseur SMS raccordé (`channel_not_supported: sms`).
          </p>
        </div>

        <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <Activity className="w-4 h-4 text-sky-400" /> Planificateur pg_cron
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                health?.scheduler.isEnabled && health?.scheduler.cronActive
                  ? 'border-emerald-500/40 bg-emerald-950 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-950 text-amber-300'
              }`}
            >
              {health?.scheduler.cronActive && health?.scheduler.isEnabled ? 'Actif' : 'À vérifier'}
            </span>
          </div>
          <p className="text-[11px] text-stone-400">
            Fréquence : {health?.scheduler.cronSchedule ?? 'Non planifiée'} · Dernier run :{' '}
            {formatWhen(health?.scheduler.lastRunAt)}
          </p>
          <p className="text-[11px] text-stone-400">
            HTTP pg_net : {health?.scheduler.lastHttpStatus ?? '—'} ·{' '}
            {health?.scheduler.lastRunStatus ?? 'aucun log'}
          </p>
        </div>
      </div>

      {/* Résultat d'audit WhatsApp Meta si sondé */}
      {probe?.whatsappAudit && (
        <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Audit WhatsApp Cloud API & Modèles Meta</h3>
            <span className="text-[11px] text-stone-500">Vérifié le {formatWhen(probe.checkedAt)}</span>
          </div>
          {probe.whatsappAudit.error && <p className="text-amber-300">{probe.whatsappAudit.error}</p>}
          {probe.whatsappAudit.phoneVerified && (
            <p className="text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Numéro vérifié : {probe.whatsappAudit.verifiedName || 'WhatsApp Business'} (
              {probe.whatsappAudit.displayPhoneNumber || '—'})
            </p>
          )}
          {probe.whatsappAudit.templatesChecked && (
            <div className="space-y-1.5">
              <p className="text-stone-300 font-semibold">
                Modèles détectés ({probe.whatsappAudit.approvedTemplates.length}) :
              </p>
              <div className="flex flex-wrap gap-2">
                {probe.whatsappAudit.approvedTemplates.map((tpl) => (
                  <span
                    key={`${tpl.name}-${tpl.language}`}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                      tpl.status.toUpperCase() === 'APPROVED'
                        ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-950/50 text-amber-200'
                    }`}
                  >
                    {tpl.name} ({tpl.language}) · {tpl.status}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Salons impactés par des échecs répétés ou des files bloquées */}
      <div className="rounded-2xl bg-[#0c0c10] border border-[#1a1a22] overflow-hidden">
        <div className="p-4 border-b border-[#1a1a22] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Salons avec échecs ou messages en retard</h3>
          {health && (
            <span className="text-[11px] text-stone-400">
              Total file : {health.counts.pending} en attente · {health.counts.sent} envoyé(s) ·{' '}
              {health.counts.failed} échec(s) ({health.repeatedFailures} répété(s))
            </span>
          )}
        </div>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Santé des notifications, défilement horizontal"
        >
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-[#101014] border-b border-[#1a1a22] text-stone-400 text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4">Salon</th>
                <th className="py-2.5 px-4">Échecs répétés</th>
                <th className="py-2.5 px-4">Échecs totaux</th>
                <th className="py-2.5 px-4">En retard (&gt;15m)</th>
                <th className="py-2.5 px-4">Dernier retour fournisseur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#15151c] text-stone-300 text-[11px]">
              {!health || health.salonsWithIssues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-stone-500">
                    Aucun salon en erreur ou en retard dans la file de notifications.
                  </td>
                </tr>
              ) : (
                health.salonsWithIssues.map((row) => (
                  <tr key={row.salonId}>
                    <td className="py-2.5 px-4 font-semibold text-white">{row.salonName}</td>
                    <td className="py-2.5 px-4">
                      {row.repeatedFailures > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-500/40 text-red-200 font-bold">
                          {row.repeatedFailures}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="py-2.5 px-4">{row.failedCount}</td>
                    <td className="py-2.5 px-4">{row.overduePending}</td>
                    <td className="py-2.5 px-4 text-red-300 font-mono truncate max-w-xs">
                      {row.latestError || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
