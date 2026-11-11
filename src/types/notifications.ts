// Types du domaine notifications : canaux, santé, dispatch et alertes.

export type NotificationChannel = 'email' | 'whatsapp' | 'sms';

export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface AppointmentNotification {
  id: string;
  salonId: string;
  appointmentId: string;
  channel: NotificationChannel;
  kind: 'booking_received' | 'booking_confirmed' | 'booking_cancelled' | 'reminder_24h' | 'review_request';
  recipient: string;
  status: NotificationStatus;
  scheduledAt: string;
  createdAt: string;
  sentAt?: string | null;
  error?: string | null;
  attempts: number;
  failureCount?: number;
  lastError?: string | null;
  providerMessageId?: string | null;
}

export interface NotificationCapabilities {
  email: {
    provider: string;
    supported: boolean;
    configured: boolean;
    hasApiKey: boolean;
    hasSender: boolean;
  };
  whatsapp: {
    provider: string;
    supported: boolean;
    configured: boolean;
    hasToken: boolean;
    hasPhoneNumberId: boolean;
    hasBusinessAccountId: boolean;
    templateModeEnabled: boolean;
    templatePrefixConfigured: boolean;
    templateLang: string;
    defaultCountryCode: string;
    expectedTemplates: string[];
  };
  sms: {
    provider: null | string;
    supported: false;
    configured: false;
    reason: string;
    message: string;
  };
  scheduler: {
    dispatchTokenConfigured: boolean;
    publicAppUrlConfigured: boolean;
  };
}

export interface WhatsappAuditResult {
  checked: boolean;
  phoneVerified: boolean;
  verifiedName?: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  templatesChecked: boolean;
  approvedTemplates: Array<{ name: string; status: string; language: string }>;
  missingTemplates: string[];
  error?: string | null;
}

export interface NotificationProbeResult {
  service: string;
  ok: boolean;
  providerConfigured: boolean;
  capabilities: NotificationCapabilities;
  whatsappAudit: WhatsappAuditResult | null;
  checkedAt: string;
}

export interface NotificationChannelHealth {
  supported: boolean;
  unavailableReason?: string;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  repeatedFailures: number;
  latestError: string | null;
}

export interface NotificationSchedulerHealth {
  configured: boolean;
  isEnabled: boolean;
  hasDispatchToken: boolean;
  hasEndpoint: boolean;
  batchSize: number;
  updatedAt: string | null;
  cronAvailable: boolean;
  cronScheduled: boolean;
  cronActive: boolean;
  cronSchedule: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastReturnMessage: string | null;
  httpAvailable: boolean;
  lastHttpStatus: number | null;
  lastHttpError: string | null;
  lastHttpAt: string | null;
  lastHttpPreview: string | null;
}

export interface NotificationDispatchRunRecord {
  id: string;
  salonId: string | null;
  triggerSource: 'cron' | 'manual' | 'probe';
  providerConfigured: boolean;
  emailConfigured: boolean;
  whatsappConfigured: boolean;
  whatsappTemplateMode: boolean;
  smsSupported: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  error: string | null;
  createdAt: string;
}

export interface NotificationHealthSummary {
  salonId: string;
  counts: {
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    skipped: number;
    total: number;
  };
  repeatedFailures: number;
  exhaustedFailures: number;
  recentFailures24h: number;
  overduePending: number;
  stuckSending: number;
  byChannel: {
    email: NotificationChannelHealth;
    whatsapp: NotificationChannelHealth;
    sms: NotificationChannelHealth;
  };
  repeatedFailureItems: Array<{
    id: string;
    channel: NotificationChannel;
    kind: AppointmentNotification['kind'];
    recipient: string;
    attempts: number;
    failureCount: number;
    lastAttemptAt: string | null;
    error: string | null;
  }>;
  scheduler: NotificationSchedulerHealth;
  lastRun: NotificationDispatchRunRecord | null;
  lastSalonRun: NotificationDispatchRunRecord | null;
  smsUnavailableReason: string;
}

export interface PlatformNotificationHealthSummary {
  counts: {
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    skipped: number;
    total: number;
  };
  repeatedFailures: number;
  exhaustedFailures: number;
  recentFailures24h: number;
  overduePending: number;
  stuckSending: number;
  byChannel: {
    email: NotificationChannelHealth;
    whatsapp: NotificationChannelHealth;
    sms: NotificationChannelHealth;
  };
  salonsWithIssues: Array<{
    salonId: string;
    salonName: string;
    failedCount: number;
    repeatedFailures: number;
    recentFailures24h: number;
    overduePending: number;
    latestError: string | null;
  }>;
  scheduler: NotificationSchedulerHealth;
  lastRun: NotificationDispatchRunRecord | null;
  smsUnavailableReason: string;
}

export interface NotificationAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  code:
    | 'repeated_failures'
    | 'failure_burst'
    | 'stuck_sending'
    | 'scheduler_error'
    | 'overdue_pending'
    | 'provider_missing'
    | 'whatsapp_template_disabled'
    | 'sms_unavailable';
  title: string;
  description: string;
  count?: number;
}

export interface NotificationDispatchResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  providerConfigured: boolean;
  capabilities?: NotificationCapabilities;
}
