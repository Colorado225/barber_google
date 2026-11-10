import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_XOF_AMOUNT,
  parseXofAmount,
  validateCorrection,
  validateNote,
  validateProviderReference,
  validateReason,
} from '../src/features/cash-register/cashRules';
import {
  closeCashSession,
  confirmCashPayment,
  openCashSession,
  recordCashCorrection,
  rejectCashPayment,
  type CashCommandPort,
} from '../src/features/cash-register/cashCommands';

test('montant XOF : entier positif accepté, décimales et signes refusés', () => {
  assert.deepEqual(parseXofAmount(' 15000 ', 'Montant'), { ok: true, value: 15000 });
  assert.equal(parseXofAmount('15000.5', 'Montant').ok, false);
  assert.equal(parseXofAmount('-100', 'Montant').ok, false);
  assert.equal(parseXofAmount('12 000', 'Montant').ok, false);
  assert.equal(parseXofAmount('', 'Montant').ok, false);
  assert.equal(parseXofAmount('abc', 'Montant').ok, false);
});

test('montant XOF : zéro refusé sauf si autorisé ; plafond respecté', () => {
  assert.equal(parseXofAmount('0', 'Montant').ok, false);
  assert.deepEqual(parseXofAmount('0', 'Fond', { allowZero: true }), { ok: true, value: 0 });
  assert.deepEqual(parseXofAmount(String(MAX_XOF_AMOUNT), 'Montant'), { ok: true, value: MAX_XOF_AMOUNT });
  assert.equal(parseXofAmount(String(MAX_XOF_AMOUNT + 1), 'Montant').ok, false);
  assert.equal(parseXofAmount('9'.repeat(30), 'Montant').ok, false);
});

test('note : trimmée, 500 caractères au plus', () => {
  assert.deepEqual(validateNote('  RAS  '), { ok: true, value: 'RAS' });
  assert.deepEqual(validateNote(''), { ok: true, value: '' });
  assert.equal(validateNote('x'.repeat(501)).ok, false);
  assert.equal(validateNote('x'.repeat(500)).ok, true);
});

test('motif : minimum après trim', () => {
  assert.equal(validateReason('  ab ', 3, 'Motif').ok, false);
  assert.deepEqual(validateReason(' abc ', 3, 'Motif'), { ok: true, value: 'abc' });
});

test('référence : obligatoire hors espèces, ignorée pour les espèces', () => {
  assert.deepEqual(validateProviderReference('cash', ''), { ok: true, value: undefined });
  assert.equal(validateProviderReference('wave', '   ').ok, false);
  assert.deepEqual(validateProviderReference('wave', ' WV-42 '), { ok: true, value: 'WV-42' });
});

test('correction : espèces sans référence ni note de règlement', () => {
  const result = validateCorrection({
    kind: 'refund',
    amount: '2500',
    reason: 'Client mécontent',
    method: 'cash',
    providerReference: '',
    settlementNote: 'ignorée',
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      kind: 'refund',
      amount: 2500,
      reason: 'Client mécontent',
      providerReference: undefined,
      settlementNote: undefined,
    },
  });
});

test('correction : mobile money exige une référence et transmet la note', () => {
  const missing = validateCorrection({
    kind: 'refund',
    amount: '2500',
    reason: 'Double encaissement',
    method: 'wave',
    providerReference: ' ',
    settlementNote: '',
  });
  assert.equal(missing.ok, false);

  const complete = validateCorrection({
    kind: 'refund',
    amount: '2500',
    reason: 'Double encaissement',
    method: 'wave',
    providerReference: 'WV-9',
    settlementNote: 'Remboursé par Wave',
  });
  assert.equal(complete.ok && complete.value.providerReference, 'WV-9');
  assert.equal(complete.ok && complete.value.settlementNote, 'Remboursé par Wave');
});

test('correction : refuse un motif trop court et un montant décimal', () => {
  const base = {
    kind: 'payment_reversal' as const,
    method: 'cash',
    providerReference: '',
    settlementNote: '',
  };
  assert.equal(validateCorrection({ ...base, amount: '100', reason: 'ab' }).ok, false);
  assert.equal(validateCorrection({ ...base, amount: '100.5', reason: 'erreur de saisie' }).ok, false);
});

// ---- Commandes : la base n'est appelée qu'après validation ----

function fakePort() {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      calls.push({ name, args });
      return {};
    };
  const port: CashCommandPort = {
    openNewCashSession: record('open') as CashCommandPort['openNewCashSession'],
    closeCurrentCashSession: record('close') as CashCommandPort['closeCurrentCashSession'],
    reconcileCashSession: record('reconcile') as CashCommandPort['reconcileCashSession'],
    confirmPendingPayment: record('confirm') as CashCommandPort['confirmPendingPayment'],
    rejectPendingPayment: record('reject') as CashCommandPort['rejectPendingPayment'],
    recordPaymentCorrection: record('correction') as CashCommandPort['recordPaymentCorrection'],
  };
  return { port, calls };
}

test('ouverture : fond valide envoyé en entier, note trimmée', async () => {
  const { port, calls } = fakePort();
  const result = await openCashSession(port, { openingBalance: '25000', branchId: 'b1', note: ' matin ' });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ name: 'open', args: [25000, 'b1', 'matin'] }]);
});

test('ouverture : fond vide ou décimal refusé sans appel', async () => {
  const { port, calls } = fakePort();
  const result = await openCashSession(port, { openingBalance: '', branchId: '', note: '' });
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
  const decimal = await openCashSession(port, { openingBalance: '10.5', branchId: '', note: '' });
  assert.equal(decimal.ok, false);
  assert.equal(calls.length, 0);
});

test('clôture : le fond compté peut être zéro, la session est transmise', async () => {
  const { port, calls } = fakePort();
  const result = await closeCashSession(port, { sessionId: 's1', counted: '0', note: '' });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ name: 'close', args: [0, '', 's1'] }]);
});

test('confirmation : référence obligatoire hors espèces', async () => {
  const { port, calls } = fakePort();
  const refused = await confirmCashPayment(port, {
    paymentId: 'p1',
    method: 'wave',
    reference: '',
    note: '',
  });
  assert.equal(refused.ok, false);
  assert.equal(calls.length, 0);
  const accepted = await confirmCashPayment(port, {
    paymentId: 'p1',
    method: 'wave',
    reference: 'WV-1',
    note: '',
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(calls, [{ name: 'confirm', args: ['p1', 'WV-1', ''] }]);
});

test('rejet : motif de moins de 3 caractères refusé', async () => {
  const { port, calls } = fakePort();
  assert.equal((await rejectCashPayment(port, 'p1', 'ok')).ok, false);
  assert.equal(calls.length, 0);
  assert.equal((await rejectCashPayment(port, 'p1', 'Référence introuvable')).ok, true);
  assert.equal(calls.length, 1);
});

test('correction : payload validé transmis avec l’entrée d’origine', async () => {
  const { port, calls } = fakePort();
  const result = await recordCashCorrection(port, 'e1', {
    kind: 'refund',
    amount: '1500',
    reason: 'Prestation annulée',
    method: 'cash',
    providerReference: '',
    settlementNote: '',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    {
      name: 'correction',
      args: [
        {
          originalEntryId: 'e1',
          kind: 'refund',
          amount: 1500,
          reason: 'Prestation annulée',
          providerReference: undefined,
          settlementNote: undefined,
        },
      ],
    },
  ]);
});
