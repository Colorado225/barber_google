import assert from 'node:assert/strict';
import test from 'node:test';
import type { LoyaltyReward } from '../src/types';
import { mergeRewardUpdate, toRewardPayload } from '../src/features/loyalty/rewardRules';

const current: LoyaltyReward = {
  id: 'r1',
  salonId: 'salon-1',
  name: 'Coupe offerte',
  description: 'Une coupe',
  pointsCost: 100,
  category: 'free_service',
  isActive: true,
  timesRedeemed: 4,
  discountPercentage: undefined,
  freeServiceName: 'Coupe',
  createdAt: '2026-10-01T00:00:00.000Z',
} as LoyaltyReward;

test('charge utile : seuls les sept champs éditables sont envoyés', () => {
  const payload = toRewardPayload(current);
  assert.deepEqual(Object.keys(payload).sort(), [
    'category',
    'description',
    'discountPercentage',
    'freeServiceName',
    'isActive',
    'name',
    'pointsCost',
  ]);
  assert.equal(payload.pointsCost, 100);
});

test('fusion : seuls les champs fournis changent, le reste est conservé', () => {
  const merged = mergeRewardUpdate(current, { pointsCost: 150, isActive: false });
  assert.equal(merged.pointsCost, 150);
  assert.equal(merged.isActive, false);
  assert.equal(merged.name, 'Coupe offerte');
  assert.equal(merged.timesRedeemed, 4);
  assert.equal(current.pointsCost, 100, 'l’original n’est pas modifié');
});
