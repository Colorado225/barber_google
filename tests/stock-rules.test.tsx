import assert from 'node:assert/strict';
import test from 'node:test';
import type { StockItem } from '../src/types';
import {
  MAX_STOCK_QUANTITY,
  planStockAdjustment,
  planStockQuantity,
  toStockPayload,
} from '../src/features/stock/stockRules';

test('ajustement : hausse et baisse jusqu’à zéro acceptées', () => {
  assert.deepEqual(planStockAdjustment({ quantity: 4 }, 1), { ok: true, value: 5 });
  assert.deepEqual(planStockAdjustment({ quantity: 4 }, -4), { ok: true, value: 0 });
});

test('ajustement : quantité négative refusée avec le message existant', () => {
  assert.deepEqual(planStockAdjustment({ quantity: 1 }, -2), {
    ok: false,
    error: 'La quantité ne peut pas être négative.',
  });
});

test('ajustement : delta non fini refusé', () => {
  assert.equal(planStockAdjustment({ quantity: 1 }, Number.NaN).ok, false);
  assert.equal(planStockAdjustment({ quantity: 1 }, Number.POSITIVE_INFINITY).ok, false);
});

test('ajustement : delta fractionnaire refusé (D11 : quantités entières)', () => {
  const plan = planStockAdjustment({ quantity: 1 }, 0.25);
  assert.equal(plan.ok, false);
});

test('ajustement : borne haute de la base respectée', () => {
  assert.deepEqual(planStockAdjustment({ quantity: MAX_STOCK_QUANTITY - 1 }, 1), {
    ok: true,
    value: MAX_STOCK_QUANTITY,
  });
  assert.equal(planStockAdjustment({ quantity: MAX_STOCK_QUANTITY }, 1).ok, false);
});

test('quantité absolue : entiers entre 0 et 1 000 000 uniquement', () => {
  assert.deepEqual(planStockQuantity(0), { ok: true, value: 0 });
  assert.deepEqual(planStockQuantity(MAX_STOCK_QUANTITY), { ok: true, value: MAX_STOCK_QUANTITY });
  for (const bad of [1.5, -1, MAX_STOCK_QUANTITY + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(planStockQuantity(bad).ok, false, `refusé : ${bad}`);
  }
});

test('charge utile : seuls les six champs éditables sont envoyés', () => {
  const item: StockItem = {
    id: 's1',
    salonId: 'salon-1',
    name: 'Cire',
    category: 'gel_cire',
    quantity: 3,
    minThreshold: 1,
    unitCost: 2500,
    supplier: 'Fournisseur',
    lastRestock: '2026-11-01',
  };
  const payload = toStockPayload(item);
  assert.deepEqual(Object.keys(payload).sort(), [
    'category',
    'minThreshold',
    'name',
    'quantity',
    'supplier',
    'unitCost',
  ]);
  assert.equal(payload.quantity, 3);
});
