import type {
  AppointmentNotification,
  NotificationAlert,
  NotificationCapabilities,
  NotificationChannelHealth,
  NotificationDispatchRunRecord,
  NotificationHealthSummary,
  NotificationProbeResult,
  NotificationSchedulerHealth,
  PlatformNotificationHealthSummary,
} from '../types';

export const SMS_UNAVAILABLE_TITLE = 'Canal SMS non disponible';
export const SMS_UNAVAILABLE_MESSAGE =
  'Le canal SMS n’est pas disponible tant qu’il n’a pas de fournisseur raccordé. Seuls l’e-mail (Resend) et WhatsApp (Meta Cloud API avec modèles approuvés) peuvent être expédiés.';

export const NOTIFICATION_CHANNEL_HONEST_FEATURE =
  'Suivi des confirmations & rappels e-mail / WhatsApp (selon activation opérateur ; SMS non disponible)';

export const LEGACY_FALSE_SMS_FEATURE = 'Rappels SMS & WhatsApp anti-no-show';

export const LEGACY_FALSE_COMMISSION_FEATURE = "Calcul automatique des commissions d'équipe";
export const HONEST_COMMISSION_FEATURE =
  'Suivi des taux de commission par membre (calcul automatique des montants dus à venir)';

export const LEGACY_FALSE_ACCOUNTING_EXPORT_FEATURE = 'Export comptable et réconciliation des caisses';
export const HONEST_CASH_RECONCILIATION_FEATURE =
  'Rapprochement et réconciliation des caisses (export comptable non disponible)';

export const LEGACY_FALSE_PRIORITY_MARKETPLACE_FEATURE = 'Mise en avant prioritaire sur la Marketplace';
export const HONEST_MARKETPLACE_SHOWCASE_FEATURE =
  'Vitrine complète sur la Marketplace (classement par publication ; mise en avant non automatisée)';

export const LEGACY_FALSE_VIP_SUPPORT_FEATURE = 'Support technique VIP prioritaire 7j/7';
export const HONEST_PRESTIGE_SUPPORT_FEATURE =
  'Accompagnement à l’onboarding multi-sites (support VIP 7j/7 non intégré à l’application)';

export const LEGACY_OVERSTATED_NETWORK_FEATURE = 'Multi-succursales & gestion de réseau centralisée';
export const HONEST_MULTI_BRANCH_FEATURE =
  'Multi-succursales jusqu’à 5 établissements (quota serveur & sélecteur ERP)';

export const LEGACY_OVERSTATED_REPORTS_FEATURE = 'Rapports financiers et bilans comptables consolidés';
export const HONEST_REPORTS_FEATURE = 'Rapports financiers et indicateurs d’activité par établissement';

const LEGACY_FEATURE_REPLACEMENTS: Record<string, string> = {
  [LEGACY_FALSE_SMS_FEATURE]: NOTIFICATION_CHANNEL_HONEST_FEATURE,
  [LEGACY_FALSE_COMMISSION_FEATURE]: HONEST_COMMISSION_FEATURE,
  'Calcul automatique des commissions d’équipe': HONEST_COMMISSION_FEATURE,
  [LEGACY_FALSE_ACCOUNTING_EXPORT_FEATURE]: HONEST_CASH_RECONCILIATION_FEATURE,
  [LEGACY_FALSE_PRIORITY_MARKETPLACE_FEATURE]: HONEST_MARKETPLACE_SHOWCASE_FEATURE,
  [LEGACY_FALSE_VIP_SUPPORT_FEATURE]: HONEST_PRESTIGE_SUPPORT_FEATURE,
  [LEGACY_OVERSTATED_NETWORK_FEATURE]: HONEST_MULTI_BRANCH_FEATURE,
  [LEGACY_OVERSTATED_REPORTS_FEATURE]: HONEST_REPORTS_FEATURE,
};

export function normalizeSaasPlanFeatures(features: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of features) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const normalized = LEGACY_FEATURE_REPLACEMENTS[trimmed] ?? raw;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

export function isRepeatedNotificationFailure(n: AppointmentNotification): boolean {
  return n.status === 'failed' && (n.attempts >= 2 || (n.failureCount ?? 0) >= 2);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function optStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function mapChannelHealth(raw: unknown, supportedDefault = true): NotificationChannelHealth {
  const row = asRecord(raw);
  return {
    supported: typeof row.supported === 'boolean' ? row.supported : supportedDefault,
    unavailableReason: optStr(row.unavailableReason) ?? undefined,
    pending: num(row.pending),
    sent: num(row.sent),
    failed: num(row.failed),
    skipped: num(row.skipped),
    repeatedFailures: num(row.repeatedFailures),
    latestError: optStr(row.latestError),
  };
}

function mapSchedulerHealth(raw: unknown): NotificationSchedulerHealth {
  const row = asRecord(raw);
  return {
    configured: bool(row.configured),
    isEnabled: bool(row.isEnabled),
    hasDispatchToken: bool(row.hasDispatchToken),
    hasEndpoint: bool(row.hasEndpoint),
    batchSize: num(row.batchSize, 50),
    updatedAt: optStr(row.updatedAt),
    cronAvailable: bool(row.cronAvailable),
    cronScheduled: bool(row.cronScheduled),
    cronActive: bool(row.cronActive),
    cronSchedule: optStr(row.cronSchedule),
    lastRunAt: optStr(row.lastRunAt),
    lastRunStatus: optStr(row.lastRunStatus),
    lastReturnMessage: optStr(row.lastReturnMessage),
    httpAvailable: bool(row.httpAvailable),
    lastHttpStatus: row.lastHttpStatus == null ? null : num(row.lastHttpStatus),
    lastHttpError: optStr(row.lastHttpError),
    lastHttpAt: optStr(row.lastHttpAt),
    lastHttpPreview: optStr(row.lastHttpPreview),
  };
}

function mapDispatchRun(raw: unknown): NotificationDispatchRunRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = asRecord(raw);
  const id = optStr(row.id);
  if (!id) return null;
  const source = row.triggerSource;
  return {
    id,
    salonId: optStr(row.salonId),
    triggerSource: source === 'manual' || source === 'probe' ? source : 'cron',
    providerConfigured: bool(row.providerConfigured),
    emailConfigured: bool(row.emailConfigured),
    whatsappConfigured: bool(row.whatsappConfigured),
    whatsappTemplateMode: bool(row.whatsappTemplateMode),
    smsSupported: bool(row.smsSupported),
    processed: num(row.processed),
    sent: num(row.sent),
    failed: num(row.failed),
    skipped: num(row.skipped),
    error: optStr(row.error),
    createdAt: optStr(row.createdAt) ?? '',
  };
}

export function mapCapabilities(raw: unknown): NotificationCapabilities | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const root = asRecord(raw);
  const email = asRecord(root.email);
  const whatsapp = asRecord(root.whatsapp);
  const sms = asRecord(root.sms);
  const scheduler = asRecord(root.scheduler);
  return {
    email: {
      provider: optStr(email.provider) ?? 'resend',
      supported: email.supported !== false,
      configured: bool(email.configured),
      hasApiKey: bool(email.hasApiKey),
      hasSender: bool(email.hasSender),
    },
    whatsapp: {
      provider: optStr(whatsapp.provider) ?? 'meta_cloud_api',
      supported: whatsapp.supported !== false,
      configured: bool(whatsapp.configured),
      hasToken: bool(whatsapp.hasToken),
      hasPhoneNumberId: bool(whatsapp.hasPhoneNumberId),
      hasBusinessAccountId: bool(whatsapp.hasBusinessAccountId),
      templateModeEnabled: bool(whatsapp.templateModeEnabled),
      templatePrefixConfigured: bool(whatsapp.templatePrefixConfigured),
      templateLang: optStr(whatsapp.templateLang) ?? 'fr',
      defaultCountryCode: optStr(whatsapp.defaultCountryCode) ?? '225',
      expectedTemplates: Array.isArray(whatsapp.expectedTemplates)
        ? whatsapp.expectedTemplates.filter((x): x is string => typeof x === 'string')
        : [],
    },
    sms: {
      provider: null,
      supported: false,
      configured: false,
      reason: optStr(sms.reason) ?? 'channel_not_supported: sms',
      message: optStr(sms.message) ?? SMS_UNAVAILABLE_MESSAGE,
    },
    scheduler: {
      dispatchTokenConfigured: bool(scheduler.dispatchTokenConfigured),
      publicAppUrlConfigured: bool(scheduler.publicAppUrlConfigured),
    },
  };
}

export function mapNotificationProbe(raw: unknown): NotificationProbeResult {
  const row = asRecord(raw);
  const caps = mapCapabilities(row.capabilities) ?? {
    email: { provider: 'resend', supported: true, configured: false, hasApiKey: false, hasSender: false },
    whatsapp: {
      provider: 'meta_cloud_api',
      supported: true,
      configured: false,
      hasToken: false,
      hasPhoneNumberId: false,
      hasBusinessAccountId: false,
      templateModeEnabled: false,
      templatePrefixConfigured: false,
      templateLang: 'fr',
      defaultCountryCode: '225',
      expectedTemplates: [],
    },
    sms: {
      provider: null,
      supported: false,
      configured: false,
      reason: 'channel_not_supported: sms',
      message: SMS_UNAVAILABLE_MESSAGE,
    },
    scheduler: { dispatchTokenConfigured: false, publicAppUrlConfigured: false },
  };
  const waRaw =
    row.whatsappAudit && typeof row.whatsappAudit === 'object' ? asRecord(row.whatsappAudit) : null;
  return {
    service: optStr(row.service) ?? 'notifications-dispatcher',
    ok: row.ok !== false,
    providerConfigured: bool(row.provider_configured, caps.email.configured || caps.whatsapp.configured),
    capabilities: caps,
    whatsappAudit: waRaw
      ? {
          checked: bool(waRaw.checked),
          phoneVerified: bool(waRaw.phoneVerified),
          verifiedName: optStr(waRaw.verifiedName) ?? undefined,
          displayPhoneNumber: optStr(waRaw.displayPhoneNumber) ?? undefined,
          qualityRating: optStr(waRaw.qualityRating) ?? undefined,
          templatesChecked: bool(waRaw.templatesChecked),
          approvedTemplates: Array.isArray(waRaw.approvedTemplates)
            ? waRaw.approvedTemplates.map((t) => {
                const tr = asRecord(t);
                return {
                  name: optStr(tr.name) ?? '',
                  status: optStr(tr.status) ?? '',
                  language: optStr(tr.language) ?? '',
                };
              })
            : [],
          missingTemplates: Array.isArray(waRaw.missingTemplates)
            ? waRaw.missingTemplates.filter((x): x is string => typeof x === 'string')
            : [],
          error: optStr(waRaw.error),
        }
      : null,
    checkedAt: optStr(row.checkedAt) ?? new Date().toISOString(),
  };
}

export function mapSalonNotificationHealth(raw: unknown): NotificationHealthSummary {
  const row = asRecord(raw);
  const counts = asRecord(row.counts);
  const byChannel = asRecord(row.byChannel);
  const items = Array.isArray(row.repeatedFailureItems) ? row.repeatedFailureItems : [];

  return {
    salonId: optStr(row.salonId) ?? '',
    counts: {
      pending: num(counts.pending),
      sending: num(counts.sending),
      sent: num(counts.sent),
      failed: num(counts.failed),
      skipped: num(counts.skipped),
      total: num(counts.total),
    },
    repeatedFailures: num(row.repeatedFailures),
    exhaustedFailures: num(row.exhaustedFailures),
    recentFailures24h: num(row.recentFailures24h),
    overduePending: num(row.overduePending),
    stuckSending: num(row.stuckSending),
    byChannel: {
      email: mapChannelHealth(byChannel.email, true),
      whatsapp: mapChannelHealth(byChannel.whatsapp, true),
      sms: mapChannelHealth(byChannel.sms, false),
    },
    repeatedFailureItems: items.map((item) => {
      const it = asRecord(item);
      const ch = it.channel;
      return {
        id: optStr(it.id) ?? '',
        channel: ch === 'email' || ch === 'sms' ? ch : 'whatsapp',
        kind: (optStr(it.kind) ?? 'booking_received') as AppointmentNotification['kind'],
        recipient: optStr(it.recipient) ?? '',
        attempts: num(it.attempts),
        failureCount: num(it.failureCount),
        lastAttemptAt: optStr(it.lastAttemptAt),
        error: optStr(it.error),
      };
    }),
    scheduler: mapSchedulerHealth(row.scheduler),
    lastRun: mapDispatchRun(row.lastRun),
    lastSalonRun: mapDispatchRun(row.lastSalonRun),
    smsUnavailableReason: optStr(row.smsUnavailableReason) ?? SMS_UNAVAILABLE_MESSAGE,
  };
}

export function mapPlatformNotificationHealth(raw: unknown): PlatformNotificationHealthSummary {
  const row = asRecord(raw);
  const counts = asRecord(row.counts);
  const byChannel = asRecord(row.byChannel);
  const salons = Array.isArray(row.salonsWithIssues) ? row.salonsWithIssues : [];

  return {
    counts: {
      pending: num(counts.pending),
      sending: num(counts.sending),
      sent: num(counts.sent),
      failed: num(counts.failed),
      skipped: num(counts.skipped),
      total: num(counts.total),
    },
    repeatedFailures: num(row.repeatedFailures),
    exhaustedFailures: num(row.exhaustedFailures),
    recentFailures24h: num(row.recentFailures24h),
    overduePending: num(row.overduePending),
    stuckSending: num(row.stuckSending),
    byChannel: {
      email: mapChannelHealth(byChannel.email, true),
      whatsapp: mapChannelHealth(byChannel.whatsapp, true),
      sms: mapChannelHealth(byChannel.sms, false),
    },
    salonsWithIssues: salons.map((item) => {
      const s = asRecord(item);
      return {
        salonId: optStr(s.salonId) ?? '',
        salonName: optStr(s.salonName) ?? 'Salon',
        failedCount: num(s.failedCount),
        repeatedFailures: num(s.repeatedFailures),
        recentFailures24h: num(s.recentFailures24h),
        overduePending: num(s.overduePending),
        latestError: optStr(s.latestError),
      };
    }),
    scheduler: mapSchedulerHealth(row.scheduler),
    lastRun: mapDispatchRun(row.lastRun),
    smsUnavailableReason: optStr(row.smsUnavailableReason) ?? SMS_UNAVAILABLE_MESSAGE,
  };
}

export function evaluateNotificationAlerts(params: {
  notifications?: AppointmentNotification[];
  health?: NotificationHealthSummary | PlatformNotificationHealthSummary | null;
  probe?: NotificationProbeResult | null;
  nowMs?: number;
}): NotificationAlert[] {
  const { notifications = [], health = null, probe = null, nowMs = Date.now() } = params;
  const alerts: NotificationAlert[] = [];

  const localRepeated = notifications.filter(isRepeatedNotificationFailure);
  const localFailed = notifications.filter((n) => n.status === 'failed');
  const repeatedCount = Math.max(health?.repeatedFailures ?? 0, localRepeated.length);
  const exhaustedCount =
    health?.exhaustedFailures ?? notifications.filter((n) => n.status === 'failed' && n.attempts >= 5).length;

  const latestFailureError =
    health?.byChannel.whatsapp.latestError ||
    health?.byChannel.email.latestError ||
    localRepeated[0]?.error ||
    localFailed[0]?.error ||
    null;

  if (repeatedCount > 0) {
    alerts.push({
      id: 'alert-repeated-failures',
      severity: 'critical',
      code: 'repeated_failures',
      count: repeatedCount,
      title: `Alerte échecs répétés (${repeatedCount} message${repeatedCount > 1 ? 's' : ''})`,
      description:
        `${repeatedCount} notification(s) ont échoué à plusieurs reprises` +
        (exhaustedCount > 0 ? ` dont ${exhaustedCount} ayant atteint le plafond de 5 tentatives` : '') +
        (latestFailureError ? `. Dernier retour fournisseur : ${latestFailureError}` : '.'),
    });
  }

  const recent24hFailures =
    health?.recentFailures24h ??
    localFailed.filter((n) => {
      const ts = new Date(n.createdAt).getTime();
      return !Number.isNaN(ts) && nowMs - ts <= 86_400_000;
    }).length;
  const totalFailed = Math.max(health?.counts.failed ?? 0, localFailed.length);

  if (recent24hFailures >= 3 || (totalFailed >= 3 && repeatedCount === 0)) {
    const burstCount = Math.max(recent24hFailures, totalFailed);
    alerts.push({
      id: 'alert-failure-burst',
      severity: 'critical',
      code: 'failure_burst',
      count: burstCount,
      title: `Série d’échecs fournisseur (${burstCount} messages en échec)`,
      description:
        'Plusieurs envois consécutifs ont échoué récemment. Vérifiez la validité des clés API (Resend / Meta WhatsApp), l’expéditeur vérifié et l’approbation des modèles WhatsApp.' +
        (latestFailureError ? ` Retour : ${latestFailureError}` : ''),
    });
  }

  const stuckCount = health?.stuckSending ?? 0;
  if (stuckCount > 0) {
    alerts.push({
      id: 'alert-stuck-sending',
      severity: 'critical',
      code: 'stuck_sending',
      count: stuckCount,
      title: `${stuckCount} envoi(s) bloqué(s) en statut « En cours »`,
      description:
        'Des messages sont restés verrouillés plus de 10 minutes. Le prochain passage du dispatcher les reprendra automatiquement.',
    });
  }

  const scheduler = health?.scheduler;
  if (scheduler) {
    const schedulerBroken =
      (scheduler.configured && !scheduler.isEnabled) ||
      (scheduler.cronScheduled && !scheduler.cronActive) ||
      scheduler.lastRunStatus === 'failed' ||
      Boolean(scheduler.lastHttpError) ||
      (scheduler.lastHttpStatus !== null && scheduler.lastHttpStatus >= 400);

    if (schedulerBroken) {
      const reason =
        scheduler.lastHttpError ||
        (scheduler.lastHttpStatus !== null && scheduler.lastHttpStatus >= 400
          ? `HTTP ${scheduler.lastHttpStatus}`
          : null) ||
        scheduler.lastReturnMessage ||
        (scheduler.configured && !scheduler.isEnabled
          ? 'Planificateur désactivé dans private.notification_dispatch_config'
          : 'Tâche cron inactive');

      alerts.push({
        id: 'alert-scheduler-error',
        severity: 'critical',
        code: 'scheduler_error',
        title: 'Anomalie sur le déclenchement planifié (pg_cron / pg_net)',
        description: `Le déclencheur automatique ne répond pas nominalement : ${reason}.`,
      });
    }
  }

  const localOverduePending = notifications.filter((n) => {
    if (n.status !== 'pending') return false;
    const ts = new Date(n.scheduledAt).getTime();
    return !Number.isNaN(ts) && nowMs - ts > 15 * 60_000;
  }).length;
  const overdueCount = Math.max(health?.overduePending ?? 0, localOverduePending);
  if (overdueCount > 0) {
    alerts.push({
      id: 'alert-overdue-pending',
      severity: 'warning',
      code: 'overdue_pending',
      count: overdueCount,
      title: `${overdueCount} message(s) en attente au-delà de l’heure prévue`,
      description:
        'Des notifications arrivées à échéance depuis plus de 15 minutes n’ont pas été expédiées (clé fournisseur absente ou planificateur non actif).',
    });
  }

  const missingProviderFromQueue = notifications.some((n) =>
    (n.error ?? '').includes('provider_not_configured'),
  );
  const missingFromLastRun = health?.lastRun ? !health.lastRun.providerConfigured : false;
  const missingFromProbe = probe
    ? !probe.capabilities.email.configured || !probe.capabilities.whatsapp.configured
    : false;

  if (missingProviderFromQueue || missingFromLastRun || missingFromProbe) {
    const missingParts: string[] = [];
    if (probe) {
      if (!probe.capabilities.email.configured) {
        missingParts.push('E-mail (RESEND_API_KEY / NOTIFICATIONS_EMAIL_FROM)');
      }
      if (!probe.capabilities.whatsapp.configured) {
        missingParts.push('WhatsApp (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
      }
    }
    alerts.push({
      id: 'alert-provider-missing',
      severity: 'warning',
      code: 'provider_missing',
      title: 'Configuration fournisseur incomplète',
      description:
        missingParts.length > 0
          ? `Secrets manquants côté Edge Function notifications-dispatcher : ${missingParts.join(' ; ')}.`
          : 'Aucun fournisseur d’envoi complet n’est actif : les messages ne partent pas et restent en file ou marqués ignorés.',
    });
  }

  if (
    probe &&
    probe.capabilities.whatsapp.configured &&
    (!probe.capabilities.whatsapp.templateModeEnabled ||
      (probe.whatsappAudit?.missingTemplates.length ?? 0) > 0)
  ) {
    const missingTpls = probe.whatsappAudit?.missingTemplates ?? [];
    alerts.push({
      id: 'alert-whatsapp-templates',
      severity: 'warning',
      code: 'whatsapp_template_disabled',
      title:
        missingTpls.length > 0
          ? `Modèles WhatsApp manquants ou non approuvés (${missingTpls.length})`
          : 'Modèles WhatsApp approuvés non activés (WHATSAPP_TEMPLATE_PREFIX absent)',
      description:
        missingTpls.length > 0
          ? `Modèles attendus non approuvés chez Meta : ${missingTpls.join(', ')}.`
          : 'Sans WHATSAPP_TEMPLATE_PREFIX, Meta rejette les rappels envoyés plus de 24 h après le dernier message du client.',
    });
  }

  return alerts;
}
