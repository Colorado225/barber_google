import assert from 'node:assert/strict';
import test from 'node:test';
import type { Client, LoyaltyAccount, LoyaltyLedgerEntry, LoyaltySettings } from '../src/types';
import { toLoyaltyTransactions, UNKNOWN_CLIENT_NAME } from '../src/features/loyalty/loyaltyRules';
import {
  adjustLoyaltyPoints,
  fetchLoyaltySnapshot,
  LOYALTY_LEDGER_LIMIT,
  redeemLoyaltyReward,
  saveLoyaltyProgram,
  type LoyaltyCommandPort,
} from '../src/features/loyalty/loyaltyCommands';

const client = { id: 'c1', name: 'Awa Koné', phone: '+2250700000001' } as Client;

const entry = (overrides: Partial<LoyaltyLedgerEntry> = {}): LoyaltyLedgerEntry =>
  ({
    id: 'e1',
    salonId: 's1',
    clientId: 'c1',
    kind: 'earn',
    points: 50,
    reason: 'Visite',
    rewardId: null,
    appointmentId: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  }) as LoyaltyLedgerEntry;

test('journal : nom et téléphone résolus depuis la liste des clients chargée', () => {
  const [row] = toLoyaltyTransactions([entry()], [client]);
  assert.equal(row.clientName, 'Awa Koné');
  assert.equal(row.clientPhone, '+2250700000001');
  assert.equal(row.points, 50);
  assert.equal(row.type, 'earn');
  assert.equal(row.description, 'Visite');
});

test('journal : client absent de la liste → libellé neutre, sans téléphone inventé', () => {
  const [row] = toLoyaltyTransactions([entry({ clientId: 'inconnu' })], [client]);
  assert.equal(row.clientName, UNKNOWN_CLIENT_NAME);
  assert.equal(row.clientPhone, undefined);
});

test('journal : références nulles converties en absence, ordre serveur conservé', () => {
  const rows = toLoyaltyTransactions(
    [entry({ id: 'a', rewardId: 'r9', appointmentId: null }), entry({ id: 'b', rewardId: null })],
    [client],
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a', 'b'],
  );
  assert.equal(rows[0].rewardId, 'r9');
  assert.equal(rows[0].appointmentId, undefined);
  assert.equal(rows[1].rewardId, undefined);
});

/** Port factice : enregistre les appels pour vérifier ce qui part vers la base. */
function fakePort() {
  const calls: string[] = [];
  const program: LoyaltySettings = { salonId: 's1', programEnabled: true } as LoyaltySettings;
  const port: LoyaltyCommandPort = {
    program: async () => (calls.push('program'), program),
    accounts: async () => (calls.push('accounts'), [] as LoyaltyAccount[]),
    ledger: async (limit) => (calls.push(`ledger:${limit}`), [entry()]),
    setProgram: async (settings) => (calls.push(`setProgram:${JSON.stringify(settings)}`), program),
    redeem: async (c, r) => (
      calls.push(`redeem:${c}:${r}`),
      { transaction_id: 't1', points_balance: 20, tier: 'silver', reward_name: 'Coupe' }
    ),
    adjust: async (c, p, reason) => (
      calls.push(`adjust:${c}:${p}:${reason}`),
      { transaction_id: 't2', points_balance: 70, tier: 'silver' }
    ),
  };
  return { port, calls };
}

test('lecture : sans permission loyalty.read, aucune requête vers la base', async () => {
  const { port, calls } = fakePort();
  let portRequested = false;
  const snapshot = await fetchLoyaltySnapshot(() => ((portRequested = true), port), false);
  assert.deepEqual(snapshot, { readable: false });
  assert.equal(portRequested, false);
  assert.deepEqual(calls, []);
});

test('lecture : avec permission, programme, soldes et journal (150 lignes max) sont chargés', async () => {
  const { port, calls } = fakePort();
  const snapshot = await fetchLoyaltySnapshot(() => port, true);
  assert.equal(snapshot.readable, true);
  assert.deepEqual(calls.sort(), ['accounts', `ledger:${LOYALTY_LEDGER_LIMIT}`, 'program'].sort());
  assert.equal(LOYALTY_LEDGER_LIMIT, 150);
});

test('commandes : le programme est envoyé tel quel, seulement avec les champs fournis', async () => {
  const { port, calls } = fakePort();
  await saveLoyaltyProgram(port, { pointsPer100Fcfa: 5 });
  assert.deepEqual(calls, ['setProgram:{"pointsPer100Fcfa":5}']);
});

test('commandes : échange et ajustement transmettent client, récompense, points et motif', async () => {
  const { port, calls } = fakePort();
  const redeemed = await redeemLoyaltyReward(port, 'c1', 'r1');
  const adjusted = await adjustLoyaltyPoints(port, 'c1', -20, 'Correction de saisie');
  assert.deepEqual(calls, ['redeem:c1:r1', 'adjust:c1:-20:Correction de saisie']);
  assert.equal(redeemed.points_balance, 20);
  assert.equal(adjusted.points_balance, 70);
});
