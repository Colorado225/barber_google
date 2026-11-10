import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicBooking, PublicBookingInput } from '../src/lib/marketplace';
import {
  bookPublicAppointment,
  cancelPublicBooking,
  publicIdempotencyKey,
  type PublicBookingPort,
} from '../src/features/marketplace/publicBookingCommands';

const booking = { id: 'b1', status: 'confirmed' } as unknown as PublicBooking;

function fakePort(overrides: Partial<PublicBookingPort> = {}) {
  const calls: unknown[][] = [];
  const port: PublicBookingPort = {
    book: async (input) => (calls.push(['book', input]), booking),
    cancel: async (...args) => (calls.push(['cancel', ...args]), booking),
    ...overrides,
  };
  return { port, calls };
}

const input = {
  salonId: 'salon-1',
  serviceId: 'svc-1',
  startsAt: '2026-11-20T09:00:00.000Z',
  clientName: 'Awa',
  clientPhone: '+2250700000001',
};

test('clé d’idempotence : fournie telle quelle, même vide (comportement « ?? » conservé)', () => {
  assert.equal(publicIdempotencyKey('key-1', {}), 'key-1');
  assert.equal(publicIdempotencyKey('', {}), '');
});

test('clé d’idempotence : UUID du navigateur quand il existe, sinon valeur horodatée', () => {
  assert.equal(publicIdempotencyKey(undefined, { randomUUID: () => 'uuid-1' }), 'uuid-1');
  assert.equal(
    publicIdempotencyKey(undefined, { now: () => 1000, random: () => 0.5 }),
    `1000-${(0.5).toString(16).slice(2)}`,
  );
});

test('réservation : la clé générée est transmise à la base avec les données saisies', async () => {
  const { port, calls } = fakePort();
  const result = await bookPublicAppointment(input, port, { randomUUID: () => 'uuid-2' });
  assert.deepEqual(result, { success: true, booking });
  assert.equal(calls.length, 1);
  assert.equal((calls[0][1] as PublicBookingInput).idempotencyKey, 'uuid-2');
  assert.equal((calls[0][1] as PublicBookingInput).clientName, 'Awa');
});

test('réservation : erreur serveur renvoyée sous forme de résultat, sans exception', async () => {
  const { port } = fakePort({
    book: async () => {
      throw new Error('Créneau indisponible');
    },
  });
  assert.deepEqual(await bookPublicAppointment(input, port, { randomUUID: () => 'u' }), {
    success: false,
    error: 'Créneau indisponible',
  });
});

test('réservation : erreur non standard → message neutre', async () => {
  const { port } = fakePort({
    book: async () => {
      throw 'chaîne brute';
    },
  });
  assert.deepEqual(await bookPublicAppointment(input, port, { randomUUID: () => 'u' }), {
    success: false,
    error: 'Réservation en ligne impossible.',
  });
});

test('annulation : jeton, identifiant et motif transmis tels quels', async () => {
  const { port, calls } = fakePort();
  const result = await cancelPublicBooking('salon-1', 'appt-1', 'token-xyz', 'Empêchement', port);
  assert.deepEqual(result, { success: true, booking });
  assert.deepEqual(calls, [['cancel', 'salon-1', 'appt-1', 'token-xyz', 'Empêchement']]);
});

test('annulation : erreur → résultat d’échec avec message neutre', async () => {
  const { port } = fakePort({
    cancel: async () => {
      throw 'refus';
    },
  });
  assert.deepEqual(await cancelPublicBooking('s', 'a', 't', 'r', port), {
    success: false,
    error: 'Annulation impossible.',
  });
});
