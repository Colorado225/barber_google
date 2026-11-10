import assert from 'node:assert/strict';
import test from 'node:test';
import type { StaffMember } from '../src/types';
import { toStaffPayload } from '../src/features/staff/staffRules';
import { toClientPayload } from '../src/features/clients/clientRules';

test('personnel : charge utile limitée aux six champs éditables', () => {
  const member = {
    id: 'm1',
    salonId: 's1',
    name: 'Awa',
    role: 'barber',
    specialties: ['Dégradé'],
    commissionRate: 30,
    phone: '0700000000',
    isAvailable: true,
    rating: 4.8,
  } as unknown as StaffMember;
  const payload = toStaffPayload(member);
  assert.deepEqual(Object.keys(payload).sort(), [
    'commissionRate',
    'isAvailable',
    'name',
    'phone',
    'role',
    'specialties',
  ]);
  assert.equal(payload.commissionRate, 30);
});

test('client : e-mail absent devient une chaîne vide', () => {
  const payload = toClientPayload({
    name: 'Koffi',
    phone: '0701',
    segment: 'active' as const,
    favoriteService: 'Coupe',
    notes: 'Préfère le matin',
  });
  assert.equal(payload.email, '');
  assert.equal(payload.notes, 'Préfère le matin');
});

test('client : e-mail fourni transmis tel quel', () => {
  const payload = toClientPayload({
    name: 'Koffi',
    phone: '0701',
    email: 'koffi@example.com',
    segment: 'active' as const,
    favoriteService: 'Coupe',
    notes: '',
  });
  assert.equal(payload.email, 'koffi@example.com');
});
