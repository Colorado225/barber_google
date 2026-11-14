import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareMigrationHistory } from '../scripts/compare-migration-history.mjs';

test('la comparaison distingue collision, renommage de version et migrations uniques', () => {
  const actual = compareMigrationHistory(
    [
      '20260101000000_core.sql',
      '20260102000000_local.sql',
      '20260103000000_shift.sql',
      '20260104000000_pending.sql',
    ],
    [
      { version: '20260101000000', name: 'core' },
      { version: '20260102000000', name: 'different' },
      { version: '20260105000000', name: 'shift' },
      { version: '20260106000000', name: 'remote' },
    ],
  );
  assert.equal(actual.common.length, 1);
  assert.deepEqual(actual.collisions, [
    { version: '20260102000000', localName: 'local', remoteName: 'different' },
  ]);
  assert.deepEqual(actual.nameMatches, [
    { name: 'shift', localVersion: '20260103000000', remoteVersion: '20260105000000' },
  ]);
  assert.equal(actual.localOnly.length, 2);
  assert.equal(actual.remoteOnly.length, 2);
});

test('la comparaison refuse les entrées invalides et les doublons de version', () => {
  assert.throws(() => compareMigrationHistory(['bad.sql'], []), /invalide/);
  assert.throws(() => compareMigrationHistory([], [{ version: '1', name: 'a' }]), /14 chiffres/);
  assert.throws(
    () => compareMigrationHistory(['20260101000000_a.sql', '20260101000000_b.sql'], []),
    /dupliquée/,
  );
  assert.throws(
    () =>
      compareMigrationHistory(
        [],
        [
          { version: '20260101000000', name: 'a' },
          { version: '20260101000000', name: 'b' },
        ],
      ),
    /dupliquée/,
  );
});

test('une collision de version ne masque pas les correspondances de noms ailleurs', () => {
  const result = compareMigrationHistory(
    ['20260101000000_pricing.sql'],
    [
      { version: '20260101000000', name: 'privacy' },
      { version: '20260102000000', name: 'pricing' },
    ],
  );
  assert.equal(result.collisions.length, 1);
  assert.deepEqual(result.nameMatches, [
    { name: 'pricing', localVersion: '20260101000000', remoteVersion: '20260102000000' },
  ]);
});
