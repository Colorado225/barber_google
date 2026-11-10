import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import { AppProvider, useOptionalApp } from '../src/context/AppContext';
import {
  applyAppointmentRealtimeChange,
  applyNotificationRealtimeChange,
  createEventDeduper,
  createSalonRealtimeSync,
  upsertAppointmentInList,
  type PostgresChangePayload,
  type RealtimeChannelLike,
  type RealtimeClientLike,
} from '../src/lib/realtimeSync';
import type { Appointment, AppointmentNotification, RealtimeSyncStatus } from '../src/types';

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFakeWindowAndDoc() {
  const winListeners = new Map<string, Set<EventListener>>();
  const docListeners = new Map<string, Set<EventListener>>();
  let visibility: DocumentVisibilityState = 'visible';

  const win = {
    addEventListener(type: string, fn: EventListener) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: EventListener) {
      winListeners.get(type)?.delete(fn);
    },
    emit(type: string) {
      for (const fn of [...(winListeners.get(type) ?? [])]) {
        fn({ type } as Event);
      }
    },
    listenerCount(type: string) {
      return winListeners.get(type)?.size ?? 0;
    },
  };

  const doc = {
    get visibilityState() {
      return visibility;
    },
    setVisibility(next: DocumentVisibilityState) {
      visibility = next;
    },
    addEventListener(type: string, fn: EventListener) {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: EventListener) {
      docListeners.get(type)?.delete(fn);
    },
    emitVisibility(next: DocumentVisibilityState) {
      visibility = next;
      for (const fn of [...(docListeners.get('visibilitychange') ?? [])]) {
        fn({ type: 'visibilitychange' } as Event);
      }
    },
    listenerCount(type: string) {
      return docListeners.get(type)?.size ?? 0;
    },
  };

  return { win, doc };
}

interface MockBinding {
  table: string;
  filter: string;
  callback: (payload: PostgresChangePayload) => void;
}

class MockRealtimeChannel implements RealtimeChannelLike {
  bindings: MockBinding[] = [];
  subscribeCallback?: (status: string, err?: Error) => void;
  constructor(
    public readonly name: string,
    public readonly opts?: { config?: { postgres_changes_options?: { wait?: boolean; timeout?: number } } },
  ) {}

  on(
    _type: 'postgres_changes',
    filter: { event: '*'; schema: 'public'; table: string; filter: string },
    callback: (payload: PostgresChangePayload) => void,
  ): RealtimeChannelLike {
    this.bindings.push({ table: filter.table, filter: filter.filter, callback });
    return this;
  }

  subscribe(callback?: (status: string, err?: Error) => void): RealtimeChannelLike {
    this.subscribeCallback = callback;
    return this;
  }

  emitStatus(status: string, err?: Error) {
    this.subscribeCallback?.(status, err);
  }

  emitPostgres(payload: PostgresChangePayload) {
    for (const b of this.bindings) {
      if (b.table === payload.table) {
        b.callback(payload);
      }
    }
  }
}

function createMockRealtimeClient() {
  const createdChannels: MockRealtimeChannel[] = [];
  const removedChannels: MockRealtimeChannel[] = [];
  const client: RealtimeClientLike = {
    channel(name, opts) {
      const ch = new MockRealtimeChannel(name, opts);
      createdChannels.push(ch);
      return ch;
    },
    removeChannel(ch) {
      removedChannels.push(ch as MockRealtimeChannel);
      return Promise.resolve('ok');
    },
  };
  return {
    client,
    createdChannels,
    removedChannels,
    latestChannel: () => createdChannels[createdChannels.length - 1],
  };
}

function rawAppointmentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'appt-1',
    salon_id: 'salon-a',
    branch_id: 'branch-1',
    client_id: 'client-1',
    client_name: 'Koffi Jean',
    client_phone: '+22507000001',
    service_id: 'svc-1',
    service_name: 'Dégradé Signature',
    amount: 5000,
    staff_id: 'staff-1',
    staff_name: 'Issa',
    starts_at: '2026-11-10T10:00:00Z',
    ends_at: '2026-11-10T10:30:00Z',
    status: 'confirmed',
    payment_status: 'unpaid',
    source: 'marketplace',
    notes: '',
    created_at: '2026-11-10T08:00:00Z',
    updated_at: '2026-11-10T08:00:00Z',
    ...overrides,
  };
}

function rawNotificationRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'notif-1',
    salon_id: 'salon-a',
    appointment_id: 'appt-1',
    channel: 'whatsapp',
    kind: 'booking_received',
    recipient: '+22507000001',
    status: 'pending',
    scheduled_at: '2026-11-10T08:00:00Z',
    created_at: '2026-11-10T08:00:00Z',
    attempts: 0,
    ...overrides,
  };
}

test('createEventDeduper ignore les rejeux exacts, accepte les évolutions et reste borné', () => {
  const deduper = createEventDeduper(1000, 3);
  const p1: PostgresChangePayload = {
    table: 'appointments',
    eventType: 'UPDATE',
    commit_timestamp: '2026-11-10T09:00:00Z',
    new: rawAppointmentRow({ status: 'confirmed', updated_at: '2026-11-10T09:00:00Z' }),
  };

  assert.equal(deduper.isDuplicate(p1, 100), false);
  assert.equal(deduper.isDuplicate(p1, 200), true, 'Même commit + version doit être ignoré');

  // Nouvelle transaction réelle sur le même RDV -> acceptée
  const p2: PostgresChangePayload = {
    table: 'appointments',
    eventType: 'UPDATE',
    commit_timestamp: '2026-11-10T09:05:00Z',
    new: rawAppointmentRow({ status: 'in_progress', updated_at: '2026-11-10T09:05:00Z' }),
  };
  assert.equal(deduper.isDuplicate(p2, 300), false);

  // Expiration TTL -> redevient accepté
  assert.equal(deduper.isDuplicate(p1, 1500), false);

  // Borne maxEntries = 3 respectée
  for (let i = 0; i < 6; i++) {
    deduper.isDuplicate(
      {
        table: 'payments',
        eventType: 'INSERT',
        commit_timestamp: `2026-11-10T09:10:0${i}Z`,
        new: { id: `pay-${i}`, status: 'confirmed' },
      },
      1600,
    );
  }
  assert.equal(deduper.size(), 3);
});

test('applyAppointmentRealtimeChange & applyNotificationRealtimeChange : sans doublons, tri, ordre temporel et isolation salon', () => {
  let list: Appointment[] = [];

  // Insertion via Realtime
  list = applyAppointmentRealtimeChange(list, 'INSERT', rawAppointmentRow({ id: 'a1' }), 'salon-a');
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'confirmed');

  // Écho identique (ex: RPC locale + Realtime) -> aucun doublon, même référence
  const afterEcho = upsertAppointmentInList(list, { ...list[0] });
  assert.equal(afterEcho, list);

  // Événement d'un autre salon -> strictement ignoré
  const afterOtherSalon = applyAppointmentRealtimeChange(
    list,
    'INSERT',
    rawAppointmentRow({ id: 'a-rogue', salon_id: 'salon-b' }),
    'salon-a',
  );
  assert.equal(afterOtherSalon, list);

  // Mise à jour plus récente acceptée
  list = applyAppointmentRealtimeChange(
    list,
    'UPDATE',
    rawAppointmentRow({ id: 'a1', status: 'in_progress', updated_at: '2026-11-10T09:30:00Z' }),
    'salon-a',
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'in_progress');

  // Mise à jour obsolète (out-of-order) rejetée
  const afterStale = applyAppointmentRealtimeChange(
    list,
    'UPDATE',
    rawAppointmentRow({ id: 'a1', status: 'pending', updated_at: '2026-11-10T08:00:00Z' }),
    'salon-a',
  );
  assert.equal(afterStale, list);
  assert.equal(afterStale[0].status, 'in_progress');

  // Notifications : insertion + déduplication + suppression
  let notifs: AppointmentNotification[] = [];
  notifs = applyNotificationRealtimeChange(notifs, 'INSERT', rawNotificationRow({ id: 'n1' }), 'salon-a');
  assert.equal(notifs.length, 1);
  assert.equal(
    applyNotificationRealtimeChange(notifs, 'UPDATE', rawNotificationRow({ id: 'n1' }), 'salon-a'),
    notifs,
  );
  notifs = applyNotificationRealtimeChange(
    notifs,
    'UPDATE',
    rawNotificationRow({ id: 'n1', status: 'sent', attempts: 1, sent_at: '2026-11-10T08:05:00Z' }),
    'salon-a',
  );
  assert.equal(notifs[0].status, 'sent');
  notifs = applyNotificationRealtimeChange(notifs, 'DELETE', { id: 'n1', salon_id: 'salon-a' }, 'salon-a');
  assert.equal(notifs.length, 0);
});

test('createSalonRealtimeSync : filtrage salon actif, RBAC, déduplication et coalescing caisse', async (t) => {
  // 1. Barbier sans droits caisse/paiements -> n'écoute ni `payments` ni `cash_sessions`
  const barberMock = createMockRealtimeClient();
  const barberEvents = makeFakeWindowAndDoc();
  const barberSync = createSalonRealtimeSync({
    salonId: 'salon-a',
    client: barberMock.client,
    permissions: { appointments: true, payments: false, cash: false },
    onStatusChange: () => {},
    onAppointmentEvent: () => {},
    onNotificationEvent: () => {},
    onRefreshDomains: async () => {},
    windowObj: barberEvents.win as unknown as Window,
    documentObj: barberEvents.doc as unknown as Document,
  });
  t.after(() => barberSync.stop());
  const barberCh = barberMock.latestChannel();
  assert.deepEqual(
    barberCh.bindings.map((b) => [b.table, b.filter]),
    [
      ['appointments', 'salon_id=eq.salon-a'],
      ['appointment_notifications', 'salon_id=eq.salon-a'],
    ],
  );
  assert.equal(barberCh.opts?.config?.postgres_changes_options?.wait, true);
  barberSync.stop();

  // 2. Manager / Caissier avec tous les droits : 4 tables filtrées sur salon-a + déduplication + coalescing
  const mock = createMockRealtimeClient();
  const { win, doc } = makeFakeWindowAndDoc();
  const statuses: RealtimeSyncStatus[] = [];
  const appointmentEvents: Array<{ type: string; id: string }> = [];
  const notificationEvents: Array<{ type: string; id: string }> = [];
  const refreshCalls: Array<{ domains: string[]; reason: string }> = [];

  const controller = createSalonRealtimeSync({
    salonId: 'salon-a',
    client: mock.client,
    permissions: { appointments: true, payments: true, cash: true },
    debounceMs: 25,
    reconnectDelaysMs: [30, 60],
    fallbackOfflineIntervalMs: 5000,
    fallbackHealthyIntervalMs: 5000,
    onStatusChange: (s) => statuses.push(s),
    onAppointmentEvent: (type, row) => appointmentEvents.push({ type, id: String(row.id) }),
    onNotificationEvent: (type, row) => notificationEvents.push({ type, id: String(row.id) }),
    onRefreshDomains: async (domains, reason) => {
      refreshCalls.push({ domains: [...domains].sort(), reason });
    },
    windowObj: win as unknown as Window,
    documentObj: doc as unknown as Document,
  });
  t.after(() => controller.stop());

  const ch = mock.latestChannel();
  assert.deepEqual(
    ch.bindings.map((b) => [b.table, b.filter]),
    [
      ['appointments', 'salon_id=eq.salon-a'],
      ['appointment_notifications', 'salon_id=eq.salon-a'],
      ['payments', 'salon_id=eq.salon-a'],
      ['cash_sessions', 'salon_id=eq.salon-a'],
    ],
  );

  ch.emitStatus('SUBSCRIBED');
  assert.equal(controller.getStatus(), 'connected');

  // Rejeu en double d'un même RDV + tentative d'un autre salon -> 1 seul événement appliqué
  const apptPayload: PostgresChangePayload = {
    table: 'appointments',
    eventType: 'INSERT',
    commit_timestamp: '2026-11-10T10:00:00Z',
    new: rawAppointmentRow({ id: 'appt-live-1', salon_id: 'salon-a' }),
  };
  ch.emitPostgres(apptPayload);
  ch.emitPostgres(apptPayload);
  ch.emitPostgres({
    table: 'appointments',
    eventType: 'INSERT',
    commit_timestamp: '2026-11-10T10:00:01Z',
    new: rawAppointmentRow({ id: 'appt-rogue', salon_id: 'salon-other' }),
  });
  assert.deepEqual(appointmentEvents, [{ type: 'INSERT', id: 'appt-live-1' }]);

  // Rejeu en double d'une notification -> 1 seule notification traitée
  const notifPayload: PostgresChangePayload = {
    table: 'appointment_notifications',
    eventType: 'INSERT',
    commit_timestamp: '2026-11-10T10:00:02Z',
    new: rawNotificationRow({ id: 'notif-live-1', salon_id: 'salon-a' }),
  };
  ch.emitPostgres(notifPayload);
  ch.emitPostgres(notifPayload);
  assert.deepEqual(notificationEvents, [{ type: 'INSERT', id: 'notif-live-1' }]);

  // Rafale caisse (2 paiements distincts + 1 session caisse) -> regroupés en 1 seul refresh coalescé
  ch.emitPostgres({
    table: 'payments',
    eventType: 'INSERT',
    commit_timestamp: '2026-11-10T10:01:00Z',
    new: { id: 'pay-1', salon_id: 'salon-a', status: 'confirmed' },
  });
  ch.emitPostgres({
    table: 'payments',
    eventType: 'UPDATE',
    commit_timestamp: '2026-11-10T10:01:00Z',
    new: { id: 'pay-1', salon_id: 'salon-a', status: 'confirmed' },
  });
  ch.emitPostgres({
    table: 'cash_sessions',
    eventType: 'UPDATE',
    commit_timestamp: '2026-11-10T10:01:01Z',
    new: { id: 'cs-1', salon_id: 'salon-a', status: 'closed', closed_at: '2026-11-10T10:01:01Z' },
  });

  await waitMs(60);
  assert.equal(refreshCalls.length, 1);
  assert.deepEqual(refreshCalls[0], { domains: ['appointments', 'finance'], reason: 'realtime' });

  controller.stop();
  assert.equal(controller.getStatus(), 'disconnected');
  assert.equal(mock.removedChannels.length, 1);
  assert.equal(win.listenerCount('online'), 0);
  assert.equal(doc.listenerCount('visibilitychange'), 0);
});

test('reconnexion automatique, rattrapage après coupure, visibilité et rafraîchissement de secours', async (t) => {
  const mock = createMockRealtimeClient();
  const { win, doc } = makeFakeWindowAndDoc();
  const statuses: RealtimeSyncStatus[] = [];
  const refreshReasons: string[] = [];

  const controller = createSalonRealtimeSync({
    salonId: 'salon-a',
    client: mock.client,
    permissions: { appointments: true, payments: true, cash: true },
    debounceMs: 10,
    reconnectDelaysMs: [20, 40],
    fallbackOfflineIntervalMs: 35,
    fallbackHealthyIntervalMs: 5000,
    visibilityThrottleMs: 10,
    onStatusChange: (s) => statuses.push(s),
    onAppointmentEvent: () => {},
    onNotificationEvent: () => {},
    onRefreshDomains: async (_domains, reason) => {
      refreshReasons.push(reason);
    },
    windowObj: win as unknown as Window,
    documentObj: doc as unknown as Document,
  });
  t.after(() => controller.stop());

  // 1. Connexion initiale
  mock.latestChannel().emitStatus('SUBSCRIBED');
  assert.equal(controller.getStatus(), 'connected');
  assert.equal(refreshReasons.length, 0, 'Pas de rattrapage superflu au premier SUBSCRIBED');

  // 2. Coupure réseau / erreur canal -> passe en reconnecting, puis error après épuisement des paliers, et secours actif
  mock.latestChannel().emitStatus('CHANNEL_ERROR', new Error('Socket lost'));
  assert.equal(controller.getStatus(), 'reconnecting');
  assert.equal(mock.removedChannels.length, 1);

  // Attend la 1re tentative de reconnexion (20ms) + déclenchement du secours offline (35ms)
  await waitMs(45);
  assert.ok(mock.createdChannels.length >= 2, 'Un nouveau canal de reconnexion doit être ouvert');
  assert.ok(refreshReasons.includes('fallback'), 'Le rafraîchissement de secours doit prendre le relais');

  // Échecs répétés -> passe au statut 'error' après épuisement de [20, 40], tout en continuant de tenter
  mock.latestChannel().emitStatus('TIMED_OUT');
  await waitMs(55);
  mock.latestChannel().emitStatus('CHANNEL_ERROR', new Error('Still down'));
  assert.ok(statuses.includes('error'));

  // Attend l'ouverture du nouveau canal après le backoff de 40ms, puis rétablit la connexion
  await waitMs(55);
  const beforeReconnect = refreshReasons.filter((r) => r === 'reconnect').length;
  mock.latestChannel().emitStatus('SUBSCRIBED');
  await waitMs(15);
  assert.equal(controller.getStatus(), 'connected');
  assert.equal(
    refreshReasons.filter((r) => r === 'reconnect').length,
    beforeReconnect + 1,
    'La reconnexion doit déclencher un rattrapage immédiat des données',
  );

  // 4. Retour de visibilité d'onglet -> rattrapage 'visibility'
  doc.emitVisibility('hidden');
  await waitMs(15);
  doc.emitVisibility('visible');
  await waitMs(15);
  assert.ok(refreshReasons.includes('visibility'));

  // 5. Passage offline -> online -> rattrapage immédiat et rétablissement du canal
  win.emit('offline');
  assert.equal(controller.getStatus(), 'reconnecting');
  win.emit('online');
  await waitMs(15);
  assert.ok(refreshReasons.filter((r) => r === 'reconnect').length >= 2);
  mock.latestChannel().emitStatus('SUBSCRIBED');
  assert.equal(controller.getStatus(), 'connected');

  controller.stop();
  assert.equal(controller.getStatus(), 'disconnected');
});

test('single-flight caisse : un événement pendant un chargement en cours planifie un unique rattrapage séquentiel', async (t) => {
  const mock = createMockRealtimeClient();
  const { win, doc } = makeFakeWindowAndDoc();
  let concurrent = 0;
  let maxConcurrent = 0;
  let calls = 0;
  let releaseFirst!: () => void;
  const firstInFlight = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const controller = createSalonRealtimeSync({
    salonId: 'salon-a',
    client: mock.client,
    permissions: { appointments: true, payments: true, cash: true },
    debounceMs: 10,
    fallbackOfflineIntervalMs: 5000,
    fallbackHealthyIntervalMs: 5000,
    onStatusChange: () => {},
    onAppointmentEvent: () => {},
    onNotificationEvent: () => {},
    onRefreshDomains: async () => {
      calls += 1;
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      if (calls === 1) {
        await firstInFlight;
      }
      concurrent -= 1;
    },
    windowObj: win as unknown as Window,
    documentObj: doc as unknown as Document,
  });
  t.after(() => controller.stop());

  const ch = mock.latestChannel();
  ch.emitStatus('SUBSCRIBED');

  // 1er événement caisse -> démarre l'appel #1 (bloqué sur firstInFlight)
  ch.emitPostgres({
    table: 'payments',
    eventType: 'INSERT',
    commit_timestamp: '2026-11-10T11:00:00Z',
    new: { id: 'p-1', salon_id: 'salon-a', status: 'confirmed' },
  });
  await waitMs(25);
  assert.equal(calls, 1);

  // 2e événement caisse pendant que #1 est encore en vol -> file séquentielle, sans appel parallèle
  ch.emitPostgres({
    table: 'cash_sessions',
    eventType: 'UPDATE',
    commit_timestamp: '2026-11-10T11:00:01Z',
    new: { id: 'cs-1', salon_id: 'salon-a', status: 'closed', closed_at: '2026-11-10T11:00:01Z' },
  });
  await waitMs(25);
  assert.equal(calls, 1);

  releaseFirst();
  await waitMs(25);
  assert.equal(calls, 2);
  assert.equal(maxConcurrent, 1, 'Aucun chevauchement de rafraîchissement simultané');

  controller.stop();
});

test('AppProvider expose realtimeStatus, lastSyncedAt et syncNow sans erreur hors session active', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/app/planning',
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');

  const Probe: React.FC = () => {
    const app = useOptionalApp();
    return (
      <div data-testid="probe">
        {app.realtimeStatus}|{String(app.lastSyncedAt)}|{typeof app.syncNow}
      </div>
    );
  };

  const mock = createMockRealtimeClient();
  const rootEl = dom.window.document.getElementById('root')!;
  const root = createRoot(rootEl);

  await act(async () => {
    root.render(
      <AppProvider realtimeClient={mock.client}>
        <Probe />
      </AppProvider>,
    );
  });

  assert.equal(
    dom.window.document.querySelector('[data-testid="probe"]')?.textContent,
    'disconnected|null|function',
  );
  assert.equal(
    mock.createdChannels.length,
    0,
    'Aucun canal Realtime ne doit s’ouvrir sans salon actif ni adhésion authentifiée',
  );

  await act(async () => {
    root.unmount();
  });
});
