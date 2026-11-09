import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  declareSaasPayment,
  getPendingSalonSubscription,
  getSalonSubscription,
  reviewSaasPayment,
  subscribeSalonToPlan,
} from '../src/lib/saas';
import { getAuditLogs } from '../src/lib/superadmin';
import { listPlatformAuditLogs, listPlatformReviews } from '../src/lib/platform-admin';

// Lot 1 (P0) : aucun abonnement ne doit être activé ni fabriqué depuis le navigateur.
// Les tests tournent sans Supabase configuré : toute écriture d'abonnement doit échouer,
// et aucune donnée d'abonnement ne doit apparaître dans localStorage.

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
};

(globalThis as unknown as { localStorage: typeof fakeStorage }).localStorage = fakeStorage;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: fakeStorage,
  dispatchEvent: () => true,
  location: { pathname: '/' },
};

test('sans base de données, une souscription échoue et n’est jamais enregistrée localement', async () => {
  await assert.rejects(subscribeSalonToPlan('salon-1', 'pro'), /base de données n’est pas configurée/);
  assert.equal(store.has('barbercuts_saas_subscriptions'), false);
});

test('sans base de données, aucun abonnement « starter » n’est fabriqué', async () => {
  const sub = await getSalonSubscription('salon-1');
  assert.equal(sub, null);
  assert.equal(store.has('barbercuts_saas_subscriptions'), false);
});

test('aucune demande en attente ni déclaration de paiement sans base de données', async () => {
  assert.equal(await getPendingSalonSubscription('salon-1'), null);
  await assert.rejects(declareSaasPayment('salon-1', 'cash', 'REF-123'), /base de données/);
  await assert.rejects(reviewSaasPayment('pay-1', 'confirm'), /base de données/);
});

test('journal d’audit et avis SuperAdmin ne contiennent aucune entrée pré-remplie', async () => {
  assert.deepEqual(getAuditLogs(), []);
  assert.equal(store.has('barbercuts_admin_reviews'), false);
  // Sans base, ni le journal ni les avis ne sont reconstitués localement.
  await assert.rejects(listPlatformAuditLogs(), /non configurée/);
  await assert.rejects(listPlatformReviews(), /non configurée/);
});

test('régression : le code d’abonnement ne contient plus de repli local ni de plan simulé', async () => {
  const source = await readFile(new URL('../src/lib/saas.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('barbercuts_saas_subscriptions'), false, 'clé localStorage des abonnements');
  assert.equal(source.includes('setLocalSubscription'), false, 'écriture locale d’un abonnement');
  assert.equal(source.includes("simule le plan 'starter'"), false, 'abonnement starter simulé');
  assert.equal(
    /status:\s*'active',\s*\n\s*priceAtSubscription/.test(source),
    false,
    'abonnement actif codé en dur',
  );
});
