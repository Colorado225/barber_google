import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiError,
  abidjanDateTime,
  firstRow,
  mapClient,
  mapReward,
  mapStock,
  numberValue,
  throwSupabaseError,
  unwrap,
} from '../src/services/api/shared';

test('stock : colonnes snake_case converties, nombres texte acceptés, date vide absente', () => {
  const item = mapStock({
    id: 's1',
    salon_id: 'salon-1',
    name: 'Cire mate',
    category: 'gel_cire',
    quantity: '3.5',
    min_threshold: 1,
    unit_cost: 2500,
    supplier: 'Fournisseur',
    last_restock: '',
  });
  assert.equal(item.salonId, 'salon-1');
  assert.equal(item.quantity, 3.5);
  assert.equal(item.minThreshold, 1);
  assert.equal(item.unitCost, 2500);
  assert.equal(item.lastRestock, undefined);
});

test('stock : valeur absente ramenée à zéro, texte absent ramené à la chaîne vide', () => {
  const item = mapStock({ id: 's2', salon_id: 'salon-1' });
  assert.equal(item.quantity, 0);
  assert.equal(item.name, '');
  assert.equal(item.supplier, '');
});

test('récompense : is_active vrai seulement pour le booléen true', () => {
  const base = { id: 'r1', salon_id: 'salon-1', name: 'Coupe', points_cost: 100, category: 'free_service' };
  assert.equal(mapReward({ ...base, is_active: true }).isActive, true);
  assert.equal(mapReward({ ...base, is_active: 'true' }).isActive, false);
  assert.equal(mapReward({ ...base, is_active: null }).isActive, false);
  assert.equal(
    mapReward({ ...base, is_active: true, discount_percentage: null }).discountPercentage,
    undefined,
  );
});

test('client : segment absent devient « new », e-mail vide devient absent', () => {
  const client = mapClient({ id: 'c1', salon_id: 'salon-1', name: 'Awa', phone: '0700', email: '' });
  assert.equal(client.segment, 'new');
  assert.equal(client.email, undefined);
});

test('nombre : null et absent valent zéro, nombre texte converti', () => {
  assert.equal(numberValue({ n: null }, 'n'), 0);
  assert.equal(numberValue({}, 'n'), 0);
  assert.equal(numberValue({ n: '12' }, 'n'), 12);
});

test('erreurs Supabase : codes convertis en statuts HTTP', () => {
  const status = (code: string) => {
    try {
      throwSupabaseError({ message: 'x', code });
    } catch (error) {
      return error instanceof ApiError ? error.status : 'autre';
    }
    return 'aucune';
  };
  assert.equal(status('42501'), 403);
  assert.equal(status('28000'), 401);
  assert.equal(status('23505'), 409);
  assert.equal(status('22P02'), 400);
  assert.equal(status('23514'), 400);
  assert.equal(status('XX000'), 500);
});

test('unwrap : erreur levée, données absentes signalées', () => {
  assert.throws(() => unwrap({ data: null, error: { message: 'refusé', code: '42501' } }), ApiError);
  assert.throws(() => unwrap({ data: null, error: null }), /aucune donnée/);
  assert.deepEqual(unwrap({ data: [1], error: null }), [1]);
});

test('firstRow : premier élément, tableau vide ou valeur nulle', () => {
  assert.equal(firstRow([{ a: 1 }, { a: 2 }])?.a, 1);
  assert.equal(firstRow([]), null);
  assert.equal(firstRow(null), null);
  assert.equal(firstRow({ a: 3 })?.a, 3);
});

test('date : instant ISO convertie au fuseau d’Abidjan (UTC)', () => {
  assert.deepEqual(abidjanDateTime('2026-11-09T12:30:00Z'), { date: '2026-11-09', time: '12:30' });
});
