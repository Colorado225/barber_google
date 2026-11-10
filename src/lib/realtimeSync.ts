import type { Appointment, AppointmentNotification, RealtimeSyncStatus } from '../types';
import { mapAppointmentRow, mapNotificationRow } from './api';
import { upsertAppointmentInList } from './appointmentList';

export { upsertAppointmentInList };

export type RealtimeDomain = 'appointments' | 'notifications' | 'finance';

export interface PostgresChangePayload {
  schema?: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  commit_timestamp?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
  errors?: unknown;
}

export interface RealtimeChannelLike {
  on(
    type: 'postgres_changes',
    filter: { event: '*'; schema: 'public'; table: string; filter: string },
    callback: (payload: PostgresChangePayload) => void,
  ): RealtimeChannelLike;
  subscribe(callback?: (status: string, err?: Error) => void): RealtimeChannelLike;
  unsubscribe?: () => Promise<unknown> | unknown;
}

export interface RealtimeClientLike {
  channel(
    name: string,
    opts?: { config?: { postgres_changes_options?: { wait?: boolean; timeout?: number } } },
  ): RealtimeChannelLike;
  removeChannel(channel: RealtimeChannelLike): Promise<unknown> | unknown;
}

export interface RealtimePermissions {
  appointments: boolean;
  payments: boolean;
  cash: boolean;
}

export interface SalonRealtimeSyncOptions {
  salonId: string;
  client: RealtimeClientLike;
  permissions: RealtimePermissions;
  onStatusChange: (status: RealtimeSyncStatus) => void;
  onAppointmentEvent: (eventType: string, row: Record<string, unknown>) => void;
  onNotificationEvent: (eventType: string, row: Record<string, unknown>) => void;
  onRefreshDomains: (
    domains: Set<RealtimeDomain>,
    reason: 'realtime' | 'reconnect' | 'fallback' | 'visibility',
  ) => Promise<void>;
  onSyncSuccess?: (syncedAtIso: string) => void;
  onSyncError?: (error: unknown) => void;
  debounceMs?: number;
  reconnectDelaysMs?: number[];
  fallbackOfflineIntervalMs?: number;
  fallbackHealthyIntervalMs?: number;
  visibilityThrottleMs?: number;
  dedupeTtlMs?: number;
  windowObj?: Window;
  documentObj?: Document;
}

export interface SalonRealtimeController {
  stop: () => void;
  triggerSyncNow: (reason?: 'reconnect' | 'fallback' | 'visibility') => Promise<void>;
  getStatus: () => RealtimeSyncStatus;
}

const DEFAULT_RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000];
const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_FALLBACK_OFFLINE_MS = 15000;
const DEFAULT_FALLBACK_HEALTHY_MS = 60000;
const DEFAULT_VISIBILITY_THROTTLE_MS = 5000;
const DEFAULT_DEDUPE_TTL_MS = 60000;
const MAX_DEDUPE_ENTRIES = 500;

function readRowId(row: Record<string, unknown> | null | undefined): string {
  const id = row?.id;
  return typeof id === 'string' ? id : '';
}

function readRowSalonId(row: Record<string, unknown> | null | undefined): string {
  const salonId = row?.salon_id;
  return typeof salonId === 'string' ? salonId : '';
}

function buildVersionSignature(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  return [
    row.updated_at,
    row.status,
    row.payment_status,
    row.attempts,
    row.last_attempt_at,
    row.sent_at,
    row.settled_at,
    row.closed_at,
    row.reconciled_at,
    row.starts_at,
    row.ends_at,
    row.staff_id,
    row.service_id,
    row.amount,
  ]
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join('|');
}

export function buildRealtimeEventKey(payload: PostgresChangePayload): string | null {
  const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
  const id = readRowId(row);
  if (!id) return null;
  const commitTs = payload.commit_timestamp ? String(payload.commit_timestamp) : '';
  const version = payload.eventType === 'DELETE' ? 'deleted' : buildVersionSignature(row);
  return `${payload.table}:${payload.eventType}:${id}:${commitTs}:${version}`;
}

/**
 * Cache borné TTL + taille max pour ignorer les livraisons en double
 * d'un même événement Postgres Changes (rejeu réseau, reconnexion, double trigger).
 */
export function createEventDeduper(ttlMs = DEFAULT_DEDUPE_TTL_MS, maxEntries = MAX_DEDUPE_ENTRIES) {
  const seen = new Map<string, number>();

  const prune = (now: number) => {
    for (const [key, ts] of seen) {
      if (now - ts > ttlMs) seen.delete(key);
    }
    while (seen.size > maxEntries) {
      const oldestKey = seen.keys().next().value;
      if (oldestKey === undefined) break;
      seen.delete(oldestKey);
    }
  };

  return {
    isDuplicate(payload: PostgresChangePayload, now = Date.now()): boolean {
      const key = buildRealtimeEventKey(payload);
      if (!key) return false;
      prune(now);
      const prevTs = seen.get(key);
      if (prevTs !== undefined && now - prevTs <= ttlMs) {
        return true;
      }
      seen.set(key, now);
      prune(now);
      return false;
    },
    size(): number {
      return seen.size;
    },
  };
}

export function applyAppointmentRealtimeChange(
  prev: Appointment[],
  eventType: string,
  row: Record<string, unknown>,
  activeSalonId: string,
  timeZone?: string,
): Appointment[] {
  const id = readRowId(row);
  if (!id) return prev;
  const rowSalonId = readRowSalonId(row);
  if (rowSalonId && rowSalonId !== activeSalonId) return prev;
  if (eventType === 'DELETE') {
    const next = prev.filter((item) => item.id !== id);
    return next.length === prev.length ? prev : next;
  }
  const mapped = mapAppointmentRow(row, timeZone);
  if (mapped.salonId !== activeSalonId) return prev;
  return upsertAppointmentInList(prev, mapped);
}

function sameNotificationState(a: AppointmentNotification, b: AppointmentNotification): boolean {
  return (
    a.id === b.id &&
    a.salonId === b.salonId &&
    a.appointmentId === b.appointmentId &&
    a.channel === b.channel &&
    a.kind === b.kind &&
    a.recipient === b.recipient &&
    a.status === b.status &&
    a.scheduledAt === b.scheduledAt &&
    a.sentAt === b.sentAt &&
    a.error === b.error &&
    a.attempts === b.attempts &&
    a.providerMessageId === b.providerMessageId
  );
}

export function upsertNotificationInList(
  prev: AppointmentNotification[],
  incoming: AppointmentNotification,
): AppointmentNotification[] {
  const index = prev.findIndex((item) => item.id === incoming.id);
  if (index >= 0) {
    const existing = prev[index];
    if (sameNotificationState(existing, incoming)) return prev;
    const next = [...prev];
    next[index] = incoming;
    return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
  }
  return [incoming, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
}

export function applyNotificationRealtimeChange(
  prev: AppointmentNotification[],
  eventType: string,
  row: Record<string, unknown>,
  activeSalonId: string,
): AppointmentNotification[] {
  const id = readRowId(row);
  if (!id) return prev;
  const rowSalonId = readRowSalonId(row);
  if (rowSalonId && rowSalonId !== activeSalonId) return prev;
  if (eventType === 'DELETE') {
    const next = prev.filter((item) => item.id !== id);
    return next.length === prev.length ? prev : next;
  }
  const mapped = mapNotificationRow(row);
  if (mapped.salonId !== activeSalonId) return prev;
  return upsertNotificationInList(prev, mapped);
}

/**
 * Orchestrateur Realtime limité au salon actif :
 * - Abonnement Postgres Changes filtré par `salon_id=eq.${salonId}` et permissions RBAC ;
 * - Déduplication des événements rejoués ;
 * - Regroupement (debounce + single-flight) des rechargements caisse/solde ;
 * - Reconnexion exponentielle + rattrapage automatique à la reconnexion ;
 * - Rattrapage au retour réseau (`online`) / retour d'onglet (`visibilitychange`, `focus`) ;
 * - Rafraîchissement de secours périodique (accéléré tant que le canal n'est pas connecté).
 */
export function createSalonRealtimeSync(options: SalonRealtimeSyncOptions): SalonRealtimeController {
  const {
    salonId,
    client,
    permissions,
    onStatusChange,
    onAppointmentEvent,
    onNotificationEvent,
    onRefreshDomains,
    onSyncSuccess,
    onSyncError,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    reconnectDelaysMs = DEFAULT_RECONNECT_DELAYS_MS,
    fallbackOfflineIntervalMs = DEFAULT_FALLBACK_OFFLINE_MS,
    fallbackHealthyIntervalMs = DEFAULT_FALLBACK_HEALTHY_MS,
    visibilityThrottleMs = DEFAULT_VISIBILITY_THROTTLE_MS,
    dedupeTtlMs = DEFAULT_DEDUPE_TTL_MS,
    windowObj = typeof window !== 'undefined' ? window : undefined,
    documentObj = typeof document !== 'undefined' ? document : undefined,
  } = options;

  const hasAnySubscription = permissions.appointments || permissions.payments || permissions.cash;
  if (!salonId || !hasAnySubscription) {
    onStatusChange('disconnected');
    return {
      stop: () => {},
      triggerSyncNow: async () => {},
      getStatus: () => 'disconnected',
    };
  }

  let stopped = false;
  let status: RealtimeSyncStatus = 'disconnected';
  let activeChannel: RealtimeChannelLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let needsCatchUpOnSubscribe = false;
  let refreshInFlight = false;
  let lastSyncAtMs = Date.now();
  const queuedDomains = new Set<RealtimeDomain>();
  const debouncedDomains = new Set<RealtimeDomain>();
  const deduper = createEventDeduper(dedupeTtlMs);

  const allowedDomains = (): Set<RealtimeDomain> => {
    const domains = new Set<RealtimeDomain>();
    if (permissions.appointments) {
      domains.add('appointments');
      domains.add('notifications');
    }
    if (permissions.payments || permissions.cash) {
      domains.add('finance');
    }
    return domains;
  };

  const setStatus = (next: RealtimeSyncStatus) => {
    if (status === next) return;
    status = next;
    onStatusChange(next);
  };

  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer !== null) clearTimeout(timer);
  };

  const cleanupChannel = () => {
    const ch = activeChannel;
    activeChannel = null;
    if (!ch) return;
    try {
      void Promise.resolve(client.removeChannel(ch)).catch(() => {});
    } catch {
      // Ignore teardown errors during disconnect
    }
  };

  const scheduleFallback = () => {
    clearTimer(fallbackTimer);
    fallbackTimer = null;
    if (stopped) return;
    const interval = status === 'connected' ? fallbackHealthyIntervalMs : fallbackOfflineIntervalMs;
    fallbackTimer = setTimeout(() => {
      if (stopped) return;
      const navigatorOnline =
        typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
      if (!navigatorOnline) {
        scheduleFallback();
        return;
      }
      void runDomainRefresh(allowedDomains(), 'fallback').finally(() => {
        if (!stopped) scheduleFallback();
      });
    }, interval);
  };

  const runDomainRefresh = async (
    domains: Set<RealtimeDomain>,
    reason: 'realtime' | 'reconnect' | 'fallback' | 'visibility',
  ): Promise<void> => {
    if (stopped || domains.size === 0) return;
    for (const d of domains) queuedDomains.add(d);
    if (refreshInFlight) return;

    refreshInFlight = true;
    try {
      while (!stopped && queuedDomains.size > 0) {
        const batch = new Set(queuedDomains);
        queuedDomains.clear();
        try {
          await onRefreshDomains(batch, reason);
          lastSyncAtMs = Date.now();
          onSyncSuccess?.(new Date(lastSyncAtMs).toISOString());
        } catch (err) {
          onSyncError?.(err);
        }
      }
    } finally {
      refreshInFlight = false;
    }
  };

  const queueDebouncedRefresh = (domains: RealtimeDomain[]) => {
    for (const d of domains) debouncedDomains.add(d);
    clearTimer(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (stopped || debouncedDomains.size === 0) return;
      const batch = new Set(debouncedDomains);
      debouncedDomains.clear();
      void runDomainRefresh(batch, 'realtime');
    }, debounceMs);
  };

  const handlePostgresChange = (payload: PostgresChangePayload) => {
    if (stopped) return;
    const targetRow = payload.eventType === 'DELETE' ? payload.old : payload.new;
    if (!targetRow) return;
    const rowSalonId = readRowSalonId(targetRow);
    if (rowSalonId && rowSalonId !== salonId) return;
    if (deduper.isDuplicate(payload)) return;

    if (payload.table === 'appointments') {
      onAppointmentEvent(payload.eventType, targetRow);
      lastSyncAtMs = Date.now();
      onSyncSuccess?.(new Date(lastSyncAtMs).toISOString());
      return;
    }
    if (payload.table === 'appointment_notifications') {
      onNotificationEvent(payload.eventType, targetRow);
      lastSyncAtMs = Date.now();
      onSyncSuccess?.(new Date(lastSyncAtMs).toISOString());
      return;
    }
    if (payload.table === 'payments') {
      queueDebouncedRefresh(permissions.appointments ? ['finance', 'appointments'] : ['finance']);
      return;
    }
    if (payload.table === 'cash_sessions') {
      queueDebouncedRefresh(['finance']);
    }
  };

  const scheduleReconnect = () => {
    clearTimer(reconnectTimer);
    reconnectTimer = null;
    if (stopped) return;
    const navigatorOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    if (!navigatorOnline) {
      setStatus('reconnecting');
      scheduleFallback();
      return;
    }
    const delay = reconnectDelaysMs[Math.min(reconnectAttempt, reconnectDelaysMs.length - 1)] ?? 30000;
    const nextStatus: RealtimeSyncStatus =
      reconnectAttempt >= reconnectDelaysMs.length ? 'error' : 'reconnecting';
    reconnectAttempt += 1;
    setStatus(nextStatus);
    scheduleFallback();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!stopped) connect();
    }, delay);
  };

  const connect = () => {
    if (stopped) return;
    clearTimer(reconnectTimer);
    reconnectTimer = null;
    cleanupChannel();

    setStatus(reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    const filter = `salon_id=eq.${salonId}`;
    const channel = client.channel(`erp-salon-${salonId}`, {
      config: { postgres_changes_options: { wait: true } },
    });
    activeChannel = channel;

    if (permissions.appointments) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter },
        handlePostgresChange,
      );
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointment_notifications', filter },
        handlePostgresChange,
      );
    }
    if (permissions.payments) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter },
        handlePostgresChange,
      );
    }
    if (permissions.cash) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_sessions', filter },
        handlePostgresChange,
      );
    }

    channel.subscribe((channelStatus) => {
      if (stopped || activeChannel !== channel) return;
      if (channelStatus === 'SUBSCRIBED') {
        const shouldCatchUp = needsCatchUpOnSubscribe;
        needsCatchUpOnSubscribe = false;
        reconnectAttempt = 0;
        setStatus('connected');
        scheduleFallback();
        if (shouldCatchUp) {
          void runDomainRefresh(allowedDomains(), 'reconnect');
        }
        return;
      }
      if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
        needsCatchUpOnSubscribe = true;
        cleanupChannel();
        scheduleReconnect();
      }
    });
  };

  const handleOffline = () => {
    if (stopped) return;
    needsCatchUpOnSubscribe = true;
    clearTimer(reconnectTimer);
    reconnectTimer = null;
    setStatus('reconnecting');
    scheduleFallback();
  };

  const handleOnline = () => {
    if (stopped) return;
    reconnectAttempt = 0;
    needsCatchUpOnSubscribe = true;
    if (status !== 'connected') {
      connect();
    }
    void runDomainRefresh(allowedDomains(), 'reconnect');
  };

  const handleVisibilityOrFocus = () => {
    if (stopped) return;
    if (documentObj && documentObj.visibilityState === 'hidden') return;
    const navigatorOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    if (!navigatorOnline) return;
    if (status !== 'connected' && !activeChannel) {
      reconnectAttempt = 0;
      needsCatchUpOnSubscribe = true;
      connect();
    }
    if (needsCatchUpOnSubscribe || Date.now() - lastSyncAtMs >= visibilityThrottleMs) {
      void runDomainRefresh(allowedDomains(), 'visibility');
    }
  };

  if (windowObj) {
    windowObj.addEventListener('online', handleOnline);
    windowObj.addEventListener('offline', handleOffline);
    windowObj.addEventListener('focus', handleVisibilityOrFocus);
  }
  if (documentObj) {
    documentObj.addEventListener('visibilitychange', handleVisibilityOrFocus);
  }

  connect();
  scheduleFallback();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimer(reconnectTimer);
      clearTimer(debounceTimer);
      clearTimer(fallbackTimer);
      reconnectTimer = null;
      debounceTimer = null;
      fallbackTimer = null;
      if (windowObj) {
        windowObj.removeEventListener('online', handleOnline);
        windowObj.removeEventListener('offline', handleOffline);
        windowObj.removeEventListener('focus', handleVisibilityOrFocus);
      }
      if (documentObj) {
        documentObj.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
      cleanupChannel();
      setStatus('disconnected');
    },
    async triggerSyncNow(reason = 'fallback') {
      await runDomainRefresh(allowedDomains(), reason);
    },
    getStatus() {
      return status;
    },
  };
}
