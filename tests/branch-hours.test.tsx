import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBranchHours, toBranchHoursRows } from '../src/lib/branch-hours';

test('les horaires SQL se convertissent en semaine française avec des valeurs par défaut', () => {
  assert.deepEqual(
    mapBranchHours([
      { weekday: 0, is_open: false, opens_at: null, closes_at: null },
      { weekday: 1, is_open: true, opens_at: '08:30:00', closes_at: '17:00:00' },
    ]),
    [
      { day: 'Lundi', isOpen: true, open: '08:30', close: '17:00' },
      { day: 'Mardi', isOpen: true, open: '09:00', close: '19:00' },
      { day: 'Mercredi', isOpen: true, open: '09:00', close: '19:00' },
      { day: 'Jeudi', isOpen: true, open: '09:00', close: '19:00' },
      { day: 'Vendredi', isOpen: true, open: '09:00', close: '19:00' },
      { day: 'Samedi', isOpen: true, open: '09:00', close: '19:00' },
      { day: 'Dimanche', isOpen: false, open: '09:00', close: '19:00' },
    ],
  );
});

test('les horaires préparés portent le tenant, la succursale et la convention PostgreSQL', () => {
  assert.deepEqual(
    toBranchHoursRows('salon-id', 'branch-id', [
      { day: 'Lundi', isOpen: true, open: '08:30', close: '17:00' },
      { day: 'Dimanche', isOpen: false, open: '10:00', close: '18:00' },
    ]),
    [
      {
        salon_id: 'salon-id',
        branch_id: 'branch-id',
        weekday: 1,
        is_open: true,
        opens_at: '08:30',
        closes_at: '17:00',
      },
      {
        salon_id: 'salon-id',
        branch_id: 'branch-id',
        weekday: 0,
        is_open: false,
        opens_at: null,
        closes_at: null,
      },
    ],
  );
});

test('les horaires ouverts invalides sont rejetés avant l’écriture', () => {
  assert.throws(
    () =>
      toBranchHoursRows('salon-id', 'branch-id', [
        { day: 'Lundi', isOpen: true, open: '18:00', close: '09:00' },
      ]),
    /horaires du Lundi sont invalides/,
  );
});
