import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppointmentBalance, CashSession, PaymentTransaction } from '../src/types';
import {
  assertNonNegativeInteger,
  assertPaymentRequest,
  currentOpenSession,
  financeRange,
  paymentRecordedMessage,
  paymentStatusFromBalance,
  resolveOpeningBranch,
  FINANCE_RANGE_MONTHS,
} from '../src/features/finance/financeRules';
import {
  closeCashSession,
  correctPayment,
  fetchFinanceSnapshot,
  openCashSession,
  recordPayment,
  type FinanceCommandPort,
} from '../src/features/finance/financeCommands';

const balance = (collected: number, refunded = 0): AppointmentBalance =>
  ({ collected, refunded, billed: 0 }) as unknown as AppointmentBalance;

test('période : 12 mois glissants, du 1er du 11e mois précédent à aujourd’hui (UTC)', () => {
  assert.equal(FINANCE_RANGE_MONTHS, 12);
  const range = financeRange(new Date('2026-11-09T10:00:00.000Z'));
  assert.deepEqual(range, { from: '2025-12-01', to: '2026-11-09', monthStart: '2026-11-01' });
});

test('statut de paiement dérivé du solde serveur', () => {
  assert.equal(paymentStatusFromBalance(balance(15000), 15000), 'paid');
  assert.equal(paymentStatusFromBalance(balance(5000), 15000), 'deposit_paid');
  assert.equal(paymentStatusFromBalance(balance(0, 3000), 15000), 'refunded');
  assert.equal(paymentStatusFromBalance(balance(0), 15000), 'unpaid');
  // Prestation sans montant facturé : un encaissement partiel reste un acompte, jamais « payé ».
  assert.equal(paymentStatusFromBalance(balance(5000), 0), 'deposit_paid');
});

test('encaissement : rendez-vous requis et montant entier strictement positif', () => {
  assert.throws(() => assertPaymentRequest({ appointmentId: '', amount: 1000 }), /Un rendez-vous est requis/);
  assert.throws(() => assertPaymentRequest({ appointmentId: 'a1', amount: 0 }), /entier positif en FCFA/);
  assert.throws(() => assertPaymentRequest({ appointmentId: 'a1', amount: 10.5 }), /entier positif en FCFA/);
  assert.doesNotThrow(() => assertPaymentRequest({ appointmentId: 'a1', amount: 1000 }));
});

test('montant de caisse : zéro accepté, négatif et décimal refusés', () => {
  assert.doesNotThrow(() => assertNonNegativeInteger(0, 'msg'));
  assert.throws(() => assertNonNegativeInteger(-1, 'msg'), /msg/);
  assert.throws(() => assertNonNegativeInteger(1.5, 'msg'), /msg/);
});

test('succursale d’ouverture : demandée, puis adhésion, puis première ; aucune → erreur', () => {
  assert.equal(resolveOpeningBranch('b-req', 'b-mem', [{ id: 'b-first' }]), 'b-req');
  assert.equal(resolveOpeningBranch(undefined, 'b-mem', [{ id: 'b-first' }]), 'b-mem');
  assert.equal(resolveOpeningBranch(undefined, null, [{ id: 'b-first' }]), 'b-first');
  assert.throws(() => resolveOpeningBranch(undefined, null, []), /Aucune succursale disponible/);
});

test('session ouverte : première session au statut « open », sinon absence', () => {
  const sessions = [
    { id: 's1', status: 'closed' },
    { id: 's2', status: 'open' },
  ] as CashSession[];
  assert.equal(currentOpenSession(sessions)?.id, 's2');
  assert.equal(currentOpenSession([]), null);
});

test('message d’encaissement : Mobile Money en attente distingué de l’encaissement confirmé', () => {
  assert.match(paymentRecordedMessage('pending'), /attente de vérification manuelle/);
  assert.match(paymentRecordedMessage('confirmed'), /journal de caisse/);
});

/** Port factice : enregistre chaque appel pour vérifier ce qui part vers la base. */
function fakePort() {
  const calls: unknown[][] = [];
  const payment = { id: 'p1', appointmentId: 'a1', status: 'confirmed' } as unknown as PaymentTransaction;
  const session = { id: 's1', status: 'open' } as CashSession;
  const port: FinanceCommandPort = {
    payments: {
      list: async (params) => (calls.push(['list', params]), [payment]),
      record: async (data) => (calls.push(['record', data]), payment),
      correct: async (data) => (calls.push(['correct', data]), payment),
      confirm: async () => payment,
      reject: async () => payment,
      balance: async () => balance(0),
    },
    cash: {
      sessions: async (limit) => (calls.push(['sessions', limit]), [session]),
      open: async (branchId, amount, note) => (calls.push(['open', branchId, amount, note]), session),
      close: async (id, counted, note) => (calls.push(['close', id, counted, note]), session),
      reconcile: async () => session,
    },
    reports: {
      summary: async (from, to) => (calls.push(['summary', from, to]), {} as never),
    },
  };
  return { port, calls };
}

test('lecture : chaque source n’est demandée que si la permission correspond', async () => {
  const { port, calls } = fakePort();
  await fetchFinanceSnapshot(
    () => port,
    { payments: true, cash: false, reports: false },
    new Date('2026-11-09T00:00:00Z'),
  );
  assert.deepEqual(calls, [['list', { from: '2025-12-01', to: '2026-11-09', limit: 500 }]]);
});

test('lecture : aucune permission, aucune requête', async () => {
  const { port, calls } = fakePort();
  const snapshot = await fetchFinanceSnapshot(() => port, { payments: false, cash: false, reports: false });
  assert.deepEqual(calls, []);
  assert.deepEqual(snapshot, { payments: [], sessions: [], summary: null });
});

test('encaissement : clé fournie conservée, sinon générée ; motif et référence par défaut', async () => {
  const { port, calls } = fakePort();
  await recordPayment(port, { appointmentId: 'a1', amount: 5000, method: 'cash' }, () => 'k-gen');
  await recordPayment(
    port,
    { appointmentId: 'a1', amount: 5000, method: 'wave', idempotencyKey: 'k-kept' },
    () => 'k-gen',
  );
  assert.deepEqual(calls[0], [
    'record',
    {
      appointmentId: 'a1',
      amount: 5000,
      method: 'cash',
      idempotencyKey: 'k-gen',
      providerReference: null,
      reason: '',
    },
  ]);
  assert.equal((calls[1][1] as { idempotencyKey: string }).idempotencyKey, 'k-kept');
});

test('encaissement invalide : rien n’est envoyé à la base', async () => {
  const { port, calls } = fakePort();
  await assert.rejects(recordPayment(port, { appointmentId: 'a1', amount: -5, method: 'cash' }, () => 'k'));
  assert.deepEqual(calls, []);
});

test('correction : montant entier positif obligatoire, sinon aucun appel', async () => {
  const { port, calls } = fakePort();
  await assert.rejects(
    correctPayment(port, { originalEntryId: 'p1', kind: 'refund', amount: 0, reason: 'Erreur' }, () => 'k'),
    /Le montant de correction doit être/,
  );
  assert.deepEqual(calls, []);
  await correctPayment(
    port,
    { originalEntryId: 'p1', kind: 'refund', amount: 2000, reason: 'Erreur' },
    () => 'k',
  );
  assert.deepEqual(calls[0], [
    'correct',
    {
      originalEntryId: 'p1',
      kind: 'refund',
      amount: 2000,
      reason: 'Erreur',
      idempotencyKey: 'k',
      providerReference: null,
      settlementNote: '',
    },
  ]);
});

test('clôture : identifiant de session requis, fond compté entier positif ou nul', async () => {
  const { port, calls } = fakePort();
  await assert.rejects(closeCashSession(port, undefined, 1000), /Aucune session de caisse ouverte/);
  await assert.rejects(closeCashSession(port, 's1', -1), /entier positif ou nul/);
  assert.deepEqual(calls, []);
  await closeCashSession(port, 's1', 0);
  assert.deepEqual(calls[0], ['close', 's1', 0, '']);
});

test('ouverture : fond de caisse négatif refusé, succursale et note transmises', async () => {
  const { port, calls } = fakePort();
  await assert.rejects(openCashSession(port, 'b1', -10), /Le fond de caisse doit être/);
  assert.deepEqual(calls, []);
  await openCashSession(port, 'b1', 20000, 'Matin');
  assert.deepEqual(calls[0], ['open', 'b1', 20000, 'Matin']);
});
