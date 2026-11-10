import assert from 'node:assert/strict';
import test from 'node:test';
import { createStockApi } from '../src/services/api/stock';
import type { SalonApiClient } from '../src/services/api/shared';

const row = {
  id: 'item-1',
  salon_id: 'salon-1',
  name: 'Shampoing',
  category: 'shampoing',
  quantity: 7,
  min_threshold: 2,
  unit_cost: 1500,
  supplier: '',
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-09T00:00:00.000Z',
};

/** Faux client : enregistre chaque appel RPC et renvoie la réponse préparée. */
function fakeClient(response: { data: unknown; error: { message: string; code?: string } | null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return response;
    },
  } as unknown as SalonApiClient;
  return { client, calls };
}

test('ajustement : appelle la RPC atomique avec les paramètres attendus par la base', async () => {
  const { client, calls } = fakeClient({ data: row, error: null });
  const saved = await createStockApi(client, 'salon-1').stock.adjust('item-1', -2);
  assert.deepEqual(calls, [
    { fn: 'adjust_stock_quantity', args: { p_salon_id: 'salon-1', p_item_id: 'item-1', p_delta: -2 } },
  ]);
  assert.equal(saved.quantity, 7);
  assert.equal(saved.id, 'item-1');
});

test('ajustement : refus serveur remonté tel quel (stock insuffisant)', async () => {
  const { client } = fakeClient({ data: null, error: { message: 'Insufficient stock', code: '22023' } });
  await assert.rejects(
    createStockApi(client, 'salon-1').stock.adjust('item-1', -50),
    (err: Error & { status?: number }) => {
      assert.equal(err.message, 'Insufficient stock');
      assert.equal(err.status, 400);
      return true;
    },
  );
});

test('ajustement : permission refusée remonte en 403', async () => {
  const { client } = fakeClient({ data: null, error: { message: 'Not authorized', code: '42501' } });
  await assert.rejects(
    createStockApi(client, 'salon-1').stock.adjust('item-1', 1),
    (err: Error & { status?: number }) => {
      assert.equal(err.status, 403);
      return true;
    },
  );
});
