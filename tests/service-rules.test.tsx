import assert from 'node:assert/strict';
import test from 'node:test';
import {
  toServicePayload,
  validateServiceFields,
  type ServiceFields,
} from '../src/features/services/serviceRules';

const valid: ServiceFields = {
  name: 'Coupe dégradé',
  category: 'coupe',
  description: 'Dégradé net',
  price: 3500,
  durationMinutes: 45,
  prepMinutes: undefined,
  popular: undefined,
} as unknown as ServiceFields;

test('charge utile : préparation absente = 0, mise en avant booléenne', () => {
  const payload = toServicePayload(valid);
  assert.equal(payload.prepMinutes, 0);
  assert.equal(payload.popular, false);
  assert.equal(toServicePayload({ ...valid, popular: true, prepMinutes: 10 }).popular, true);
});

test('validation : prestation valide acceptée', () => {
  assert.deepEqual(validateServiceFields(valid), { ok: true });
});

test('validation : nom vide ou blanc refusé', () => {
  assert.equal(validateServiceFields({ ...valid, name: '   ' }).ok, false);
});

test('validation : prix décimal, négatif ou non fini refusé', () => {
  assert.equal(validateServiceFields({ ...valid, price: 3500.5 }).ok, false);
  assert.equal(validateServiceFields({ ...valid, price: -1 }).ok, false);
  assert.equal(validateServiceFields({ ...valid, price: Number.NaN }).ok, false);
  assert.equal(validateServiceFields({ ...valid, price: 0 }).ok, true, 'un prix nul reste accepté');
});

test('validation : durée strictement positive et entière', () => {
  assert.equal(validateServiceFields({ ...valid, durationMinutes: 0 }).ok, false);
  assert.equal(validateServiceFields({ ...valid, durationMinutes: 22.5 }).ok, false);
});

test('validation : préparation négative refusée', () => {
  assert.equal(validateServiceFields({ ...valid, prepMinutes: -5 }).ok, false);
});
