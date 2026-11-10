import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const barberA = '33333333-3333-4333-8333-333333333333';
const ownerB = '22222222-2222-4222-8222-222222222222';
let salonA;
let salonB;
let itemA;
let itemB;

async function asUser(userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}

async function expectCode(promise, code, pattern) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `attendu SQLSTATE ${code}, reçu ${err.code} : ${err.message}`);
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
}

const quantityOf = async (id) => {
  await db.exec('reset role');
  const { rows } = await db.query('select quantity from public.stock_items where id = $1', [id]);
  return rows[0].quantity;
};

test('migration stock : provisionnement du tenant puis ajustement atomique', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query(
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now())',
    [ownerA, ownerB, barberA],
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/20261103160000_supabase_core.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/20261112090000_stock_atomic_adjustment.sql', import.meta.url),
      'utf8',
    ),
  );

  await asUser(ownerA);
  salonA = (await db.query("select * from public.create_salon('Org A', 'Salon A', 'Principal')")).rows[0]
    .salon_id;
  await asUser(ownerB);
  salonB = (await db.query("select * from public.create_salon('Org B', 'Salon B', 'Principal')")).rows[0]
    .salon_id;

  await asUser(ownerA);
  itemA = (
    await db.query(
      "insert into public.stock_items(salon_id, name, category, quantity) values ($1, 'Shampoing', 'shampoing', 4) returning id",
      [salonA],
    )
  ).rows[0].id;
  await db.exec('reset role');
  await db.query("insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'barber')", [
    salonA,
    barberA,
  ]);
  await asUser(ownerB);
  itemB = (
    await db.query(
      "insert into public.stock_items(salon_id, name, category, quantity) values ($1, 'Gel', 'gel_cire', 9) returning id",
      [salonB],
    )
  ).rows[0].id;
});

test('ajustement : hausse puis baisse renvoient la ligne mise à jour', async () => {
  await asUser(ownerA);
  const up = await db.query('select * from public.adjust_stock_quantity($1, $2, 5)', [salonA, itemA]);
  assert.equal(up.rows[0].quantity, 9);
  const down = await db.query('select * from public.adjust_stock_quantity($1, $2, -3)', [salonA, itemA]);
  assert.equal(down.rows[0].quantity, 6);
  assert.equal(await quantityOf(itemA), 6);
});

test('ajustement : stock insuffisant refusé, quantité inchangée (pas d’écriture partielle)', async () => {
  await asUser(ownerA);
  await expectCode(
    db.query('select * from public.adjust_stock_quantity($1, $2, -100)', [salonA, itemA]),
    '22023',
    /Insufficient stock/,
  );
  assert.equal(await quantityOf(itemA), 6);
});

test('ajustement : retrait jusqu’à zéro accepté', async () => {
  await asUser(ownerA);
  const drained = await db.query('select * from public.adjust_stock_quantity($1, $2, -6)', [salonA, itemA]);
  assert.equal(drained.rows[0].quantity, 0);
});

test('ajustement : delta nul, hors bornes ou fractionnaire refusés', async () => {
  await asUser(ownerA);
  await expectCode(
    db.query('select * from public.adjust_stock_quantity($1, $2, 0)', [salonA, itemA]),
    '22023',
  );
  await expectCode(
    db.query('select * from public.adjust_stock_quantity($1, $2, 2000000)', [salonA, itemA]),
    '22023',
    /Invalid adjustment/,
  );
  // Un delta fractionnaire ne peut pas être appliqué à un entier : refus avant toute écriture.
  // Selon le chemin d'appel, PostgreSQL le signale par 22P02 (conversion) ou 42883 (signature).
  await assert.rejects(
    db.query('select * from public.adjust_stock_quantity($1, $2, 0.25)', [salonA, itemA]),
    (err) => {
      assert.ok(['22P02', '42883'].includes(err.code), `code inattendu ${err.code} : ${err.message}`);
      return true;
    },
  );
  assert.equal(await quantityOf(itemA), 0);
});

test('ajustement : plafond de quantité respecté', async () => {
  await asUser(ownerA);
  await db.query('select * from public.adjust_stock_quantity($1, $2, 1000000)', [salonA, itemA]);
  await expectCode(
    db.query('select * from public.adjust_stock_quantity($1, $2, 1)', [salonA, itemA]),
    '22023',
    /out of range/,
  );
  await asUser(ownerA);
  await db.query('select * from public.adjust_stock_quantity($1, $2, -1000000)', [salonA, itemA]);
  assert.equal(await quantityOf(itemA), 0);
});

test('autorisation : un collaborateur sans stock.write ne peut pas ajuster', async () => {
  await asUser(barberA);
  await expectCode(
    db.query('select * from public.adjust_stock_quantity($1, $2, 1)', [salonA, itemA]),
    '42501',
    /Not authorized/,
  );
});

test('cloisonnement : un propriétaire d’un autre salon ne peut pas toucher ce stock', async () => {
  await asUser(ownerB);
  await expectCode(
    db.query('select * from public.adjust_stock_quantity($1, $2, 1)', [salonA, itemA]),
    '42501',
    /Not authorized/,
  );
  // Même salon autorisé, mais identifiant d'un autre salon : la ligne n'est pas trouvée.
  await expectCode(
    db.query('select * from public.adjust_stock_quantity($1, $2, 1)', [salonB, itemA]),
    '22023',
    /Stock item not found/,
  );
  assert.equal(await quantityOf(itemB), 9);
});

test('grants : anonyme sans droit d’exécution', async () => {
  await db.exec('reset role');
  await db.exec('set role anon');
  await expectCode(
    db.query('select * from public.adjust_stock_quantity($1, $2, 1)', [salonA, itemA]),
    '42501',
    /permission denied/,
  );
  await db.exec('reset role');
});

after(async () => {
  await db.close();
});
