import assert from 'node:assert/strict';
import test from 'node:test';
import type { Appointment } from '../src/types';
import {
  isAnyStaff,
  toBookingPayload,
  toReschedulePayload,
  toStartsAt,
  toWalkInPayload,
  transitionReason,
  walkInAddedMessage,
  DEFAULT_TRANSITION_REASON,
} from '../src/features/appointments/appointmentRules';
import {
  createBooking,
  registerWalkIn,
  rescheduleAppointment,
  transitionAppointment,
  type AppointmentCommandPort,
} from '../src/features/appointments/appointmentCommands';
import { newIdempotencyKey } from '../src/features/shared/idempotency';

const current = {
  id: 'a1',
  serviceId: 'svc-1',
  staffId: 'staff-1',
  date: '2026-11-20',
  time: '10:00',
  notes: 'Sans rasoir',
  status: 'confirmed',
} as Appointment;

test('début : date et heure combinées en ISO, secondes ignorées', () => {
  assert.equal(toStartsAt('2026-11-20', '14:30'), '2026-11-20T14:30:00.000Z');
  assert.equal(toStartsAt('2026-11-20', '14:30:59'), '2026-11-20T14:30:00.000Z');
});

test('« any » ou collaborateur vide : le serveur choisit', () => {
  assert.equal(isAnyStaff('any'), true);
  assert.equal(isAnyStaff(''), true);
  assert.equal(isAnyStaff(null), true);
  assert.equal(isAnyStaff('staff-2'), false);
});

test('réservation : valeurs par défaut explicites (direct, notes vides, client nul)', () => {
  const payload = toBookingPayload({
    serviceId: 'svc-1',
    date: '2026-11-20',
    time: '09:00',
    clientName: 'Awa',
    clientPhone: '+2250700000001',
    staffId: 'any',
  });
  assert.deepEqual(payload, {
    serviceId: 'svc-1',
    startsAt: '2026-11-20T09:00:00.000Z',
    clientName: 'Awa',
    clientPhone: '+2250700000001',
    clientId: null,
    staffId: null,
    source: 'direct',
    notes: '',
  });
});

test('transition : motif seulement pour annulation et absence ; motif par défaut si vide', () => {
  assert.equal(transitionReason('cancelled', ''), DEFAULT_TRANSITION_REASON);
  assert.equal(transitionReason('no_show', 'Client injoignable'), 'Client injoignable');
  assert.equal(transitionReason('completed', 'ignoré'), undefined);
  assert.equal(transitionReason('confirmed'), undefined);
});

test('passage sans rendez-vous : clé fournie conservée, sinon nouvelle clé ; défauts nuls', () => {
  const generated = toWalkInPayload({ serviceId: 's' }, () => 'key-new');
  assert.equal(generated.idempotencyKey, 'key-new');
  assert.equal(generated.clientName, null);
  assert.equal(generated.startImmediately, false);
  assert.equal(generated.notes, '');
  const kept = toWalkInPayload({ serviceId: 's', idempotencyKey: 'key-old' }, () => 'key-new');
  assert.equal(kept.idempotencyKey, 'key-old');
});

test('déplacement : « any » garde le collaborateur actuel, un choix explicite le remplace', () => {
  const anyStaff = toReschedulePayload(current, { ...current, staffId: 'any', time: '11:15' });
  assert.equal(anyStaff.staffId, 'staff-1');
  assert.equal(anyStaff.startsAt, '2026-11-20T11:15:00.000Z');
  const chosen = toReschedulePayload(current, { ...current, staffId: 'staff-2' });
  assert.equal(chosen.staffId, 'staff-2');
  assert.equal(chosen.notes, 'Sans rasoir');
});

test('message après accueil : démarrage immédiat ou file d’attente', () => {
  assert.equal(walkInAddedMessage('in_progress'), 'Client de passage installé : prestation démarrée.');
  assert.equal(walkInAddedMessage('pending'), 'Client de passage ajouté à la file d’attente.');
});

test('clé d’idempotence : format UUID v4 quand crypto.randomUUID est disponible', () => {
  assert.match(newIdempotencyKey(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

/** Port factice : enregistre les appels pour vérifier les paramètres transmis à la base. */
function fakePort() {
  const calls: unknown[][] = [];
  const row = current;
  const port: AppointmentCommandPort = {
    create: async (data) => (calls.push(['create', data]), row),
    registerWalkIn: async (data) => (calls.push(['registerWalkIn', data]), row),
    startWalkIn: async (id) => (calls.push(['startWalkIn', id]), row),
    completeWalkIn: async (id) => (calls.push(['completeWalkIn', id]), row),
    reschedule: async (id, data) => (calls.push(['reschedule', id, data]), row),
    transition: async (id, status, reason) => (calls.push(['transition', id, status, reason]), row),
    cancel: async (id, reason) => (calls.push(['cancel', id, reason]), row),
  };
  return { port, calls };
}

test('commandes : réservation transmise avec le début calculé', async () => {
  const { port, calls } = fakePort();
  await createBooking(port, {
    serviceId: 'svc-1',
    date: '2026-11-20',
    time: '09:00',
    clientName: 'Awa',
    clientPhone: '+2250700000001',
    staffId: 'staff-2',
  });
  assert.equal((calls[0][1] as { startsAt: string }).startsAt, '2026-11-20T09:00:00.000Z');
});

test('commandes : transition d’annulation avec motif, transition de fin sans motif', async () => {
  const { port, calls } = fakePort();
  await transitionAppointment(port, 'a1', 'cancelled');
  await transitionAppointment(port, 'a1', 'completed', 'ignoré');
  assert.deepEqual(calls, [
    ['transition', 'a1', 'cancelled', DEFAULT_TRANSITION_REASON],
    ['transition', 'a1', 'completed', undefined],
  ]);
});

test('commandes : déplacement envoyé sur l’identifiant du rendez-vous courant', async () => {
  const { port, calls } = fakePort();
  await rescheduleAppointment(port, current, { ...current, time: '12:00' });
  assert.equal(calls[0][1], 'a1');
  assert.equal((calls[0][2] as { startsAt: string }).startsAt, '2026-11-20T12:00:00.000Z');
});

test('commandes : passage sans rendez-vous transmet une clé générée une seule fois', async () => {
  const { port, calls } = fakePort();
  await registerWalkIn(port, { serviceId: 's' }, () => 'k1');
  assert.equal((calls[0][1] as { idempotencyKey: string }).idempotencyKey, 'k1');
});
