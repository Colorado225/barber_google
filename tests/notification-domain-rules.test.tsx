import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppointmentNotification, NotificationDispatchResult } from '../src/types';
import { describeDispatchResult } from '../src/features/notifications/notificationRules';
import {
  dispatchNotificationQueue,
  fetchNotifications,
  NOTIFICATION_DISPATCH_LIMIT,
  NOTIFICATION_LIST_LIMIT,
  retryNotification,
  type NotificationCommandPort,
} from '../src/features/notifications/notificationCommands';

const result = (overrides: Partial<NotificationDispatchResult> = {}): NotificationDispatchResult => ({
  processed: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  providerConfigured: true,
  ...overrides,
});

test('déclenchement sans fournisseur : erreur explicite, file conservée, aucun envoi annoncé', () => {
  const toast = describeDispatchResult(result({ providerConfigured: false, processed: 3, sent: 3 }));
  assert.equal(toast.type, 'error');
  assert.match(toast.message, /Aucun fournisseur/);
  assert.match(toast.message, /file est conservée/);
  assert.doesNotMatch(toast.message, /envoyé\(s\)/);
});

test('déclenchement sans message : information neutre', () => {
  assert.deepEqual(describeDispatchResult(result()), {
    message: 'Aucun message à envoyer pour le moment.',
    type: 'info',
  });
});

test('déclenchement avec échecs : le compte réel est affiché, type erreur', () => {
  const toast = describeDispatchResult(result({ processed: 4, sent: 2, failed: 1, skipped: 1 }));
  assert.equal(toast.type, 'error');
  assert.equal(toast.message, '4 message(s) traité(s) : 2 envoyé(s), 1 échec(s), 1 ignoré(s).');
});

test('déclenchement sans échec mais avec envois : succès ; seulement ignorés : information', () => {
  assert.equal(describeDispatchResult(result({ processed: 2, sent: 2 })).type, 'success');
  assert.equal(describeDispatchResult(result({ processed: 2, skipped: 2 })).type, 'info');
});

/** Port factice : enregistre les appels pour vérifier les paramètres envoyés à la base. */
function fakePort() {
  const calls: string[] = [];
  const item = { id: 'n1' } as AppointmentNotification;
  const port: NotificationCommandPort = {
    list: async (limit) => (calls.push(`list:${limit}`), [item]),
    retry: async (id) => (calls.push(`retry:${id}`), item),
    dispatch: async (limit) => (calls.push(`dispatch:${limit}`), result({ processed: 1, sent: 1 })),
  };
  return { port, calls };
}

test('lecture : sans permission appointments.read, aucune requête et liste vide', async () => {
  const { port, calls } = fakePort();
  let requested = false;
  const list = await fetchNotifications(() => ((requested = true), port), false);
  assert.deepEqual(list, []);
  assert.equal(requested, false);
  assert.deepEqual(calls, []);
});

test('lecture : avec permission, 200 notifications au plus', async () => {
  const { port, calls } = fakePort();
  const list = await fetchNotifications(() => port, true);
  assert.equal(list.length, 1);
  assert.deepEqual(calls, [`list:${NOTIFICATION_LIST_LIMIT}`]);
  assert.equal(NOTIFICATION_LIST_LIMIT, 200);
});

test('commandes : déclenchement borné à 50 messages, relance par identifiant', async () => {
  const { port, calls } = fakePort();
  const dispatched = await dispatchNotificationQueue(port);
  await retryNotification(port, 'n7');
  assert.deepEqual(calls, [`dispatch:${NOTIFICATION_DISPATCH_LIMIT}`, 'retry:n7']);
  assert.equal(dispatched.sent, 1);
  assert.equal(NOTIFICATION_DISPATCH_LIMIT, 50);
});
