import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assignPlatformSalonPlan,
  listPlatformAuditLogs,
  listPlatformReviews,
  listPlatformSalons,
  mapPlatformAudit,
  mapPlatformReview,
  setPlatformReviewHidden,
  setPlatformSalonPublication,
  setPlatformSalonStatus,
} from '../src/lib/platform-admin';

// Lot 1 : les décisions SuperAdmin passent par la base. Sans base, rien n'est fait ni mémorisé localement.

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

test('sans base de données, chaque opération SuperAdmin échoue et n’écrit rien localement', async () => {
  await assert.rejects(listPlatformSalons(), /non configurée/);
  await assert.rejects(setPlatformSalonStatus('s1', 'suspended', 'Motif'), /non configurée/);
  await assert.rejects(setPlatformSalonPublication('s1', true), /non configurée/);
  await assert.rejects(assignPlatformSalonPlan('s1', 'pro', 'Virement'), /non configurée/);
  await assert.rejects(setPlatformReviewHidden('r1', true, 'Motif'), /non configurée/);
  await assert.rejects(listPlatformAuditLogs(), /non configurée/);
  assert.equal(store.size, 0, 'Aucune clé localStorage ne doit être écrite');
});

test('avis : la ligne serveur est relayée sans valeur inventée', () => {
  const review = mapPlatformReview({
    id: 'r1',
    salon_id: 's1',
    salon_name: 'Salon A',
    author: 'Client',
    rating: 2,
    comment: null,
    verified: true,
    created_at: '2026-11-01T10:00:00Z',
    platform_hidden: true,
    platform_hidden_reason: 'Propos injurieux',
  });
  assert.equal(review.comment, '');
  assert.equal(review.isHidden, true);
  assert.equal(review.hiddenReason, 'Propos injurieux');
  assert.equal(review.isVerified, true);
});

test('journal : chaque entrée serveur conserve son motif et son opérateur', () => {
  const entry = mapPlatformAudit({
    id: 'a1',
    action: 'salon.suspended',
    target_type: 'salon',
    target_id: 's1',
    details: { reason: 'Plainte client', name: 'Salon A' },
    created_at: '2026-11-02T08:00:00Z',
    actor_email: 'dominiquek051@gmail.com',
  });
  assert.equal(entry.action, 'salon.suspended');
  assert.equal(entry.actorEmail, 'dominiquek051@gmail.com');
  assert.equal(entry.details.reason, 'Plainte client');
});

test('régression : aucun repli localStorage pour les surcharges, avis ou journal SuperAdmin', async () => {
  const superadmin = await readFile(new URL('../src/lib/superadmin.ts', import.meta.url), 'utf8');
  assert.equal(superadmin.includes('barbercuts_admin_salon_overrides'), false);
  assert.equal(superadmin.includes('barbercuts_admin_reviews'), false);
});

test('régression : le tableau des abonnements n’affiche plus d’échéance fabriquée ni « Impayé » inventé', async () => {
  const admin = await readFile(
    new URL('../src/components/admin/AdminDashboard.tsx', import.meta.url),
    'utf8',
  );
  assert.equal(admin.includes('Date.now() + 25'), false);
  assert.equal(admin.includes('Impayé'), false);
  assert.equal(admin.includes('getAdminSalonsList'), false);
});
