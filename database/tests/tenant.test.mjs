// Tests RLS sur PGlite : ne remplacent pas les tests sur PostgreSQL réel.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const worker = '33333333-3333-4333-8333-333333333333';
let salonA, salonB, branchA;
const asUser = async (id) => {
  await db.exec('reset role');
  await db.query("select set_config('barber.user_id', $1, false)", [id]);
  await db.exec('set role bc_app');
};

test('migration et isolation entre deux salons', async () => {
  await db.exec(await readFile(new URL('../migrations/20261102230000_postgresql_identity.sql', import.meta.url), 'utf8'));
  await db.query('insert into public.bc_users(id) values ($1), ($2), ($3)', [alice, bob, worker]);
  await db.exec(await readFile(new URL('../migrations/20261103000000_tenant_foundation.sql', import.meta.url), 'utf8'));
  await asUser(alice);
  const a = await db.query("select * from public.bc_create_salon('Réseau A', 'Salon A', 'Principal')");
  salonA = a.rows[0].salon_id; branchA = a.rows[0].branch_id;
  await asUser(bob);
  const b = await db.query("select * from public.bc_create_salon('Réseau B', 'Salon B', 'Principal')");
  salonB = b.rows[0].salon_id;
  assert.deepEqual((await db.query('select name from public.bc_salons')).rows, [{ name: 'Salon B' }]);
  assert.equal((await db.query('select * from public.bc_branches where id = $1', [branchA])).rows.length, 0);
  assert.equal((await db.query("update public.bc_salons set name = 'intrusion' where id = $1 returning id", [salonA])).rows.length, 0);
  await assert.rejects(db.query("insert into public.bc_branches (salon_id, name) values ($1, 'intrusion')", [salonA]));
  await assert.rejects(db.query("update public.bc_memberships set role = 'owner' where user_id = $1", [bob]));
  await assert.rejects(db.query("insert into public.bc_memberships(salon_id, user_id, role) values ($1, $2, 'owner')", [salonA, bob]));
  await assert.rejects(db.query('update public.bc_branches set salon_id = $1 where id = $2', [salonB, branchA]));
});

test('droits employés, suspension et rattachement à plusieurs salons', async () => {
  await db.exec('reset role');
  await db.query("insert into public.bc_memberships(salon_id, user_id, role) values ($1, $2, 'barber'), ($3, $2, 'manager')", [salonA, worker, salonB]);
  await asUser(worker);
  assert.equal((await db.query('select id from public.bc_salons')).rows.length, 2);
  assert.equal((await db.query("update public.bc_salons set name = 'non autorisé' where id = $1 returning id", [salonA])).rows.length, 0);
  await assert.rejects(db.query("insert into public.bc_branches(salon_id, name) values ($1, 'interdit')", [salonA]));
  assert.equal((await db.query("insert into public.bc_branches(salon_id, name) values ($1, 'autorisée') returning id", [salonB])).rows.length, 1);
  await db.exec('reset role');
  await db.query("update public.bc_memberships set status = 'suspended' where salon_id = $1 and user_id = $2", [salonB, worker]);
  await asUser(worker);
  assert.deepEqual((await db.query('select id from public.bc_salons')).rows.map(r => r.id), [salonA]);
});

test('anonyme refusé et bootstrap invalide atomique', async () => {
  await asUser(alice);
  const before = (await db.query('select count(*)::int as count from public.bc_salons')).rows[0].count;
  await assert.rejects(db.query("select * from public.bc_create_salon('Organisation', '', 'Principal')"));
  assert.equal((await db.query('select count(*)::int as count from public.bc_salons')).rows[0].count, before);
  await asUser('');
  await assert.rejects(db.query("select * from public.bc_create_salon('x', 'y', 'z')"));
  assert.equal((await db.query('select * from public.bc_salons')).rows.length, 0);
  await db.exec('reset role; create role bc_anonymous nologin; set role bc_anonymous');
  await assert.rejects(db.query('select * from public.bc_salons'));
  await assert.rejects(db.query("select * from public.bc_create_salon('x', 'y', 'z')"));
});

after(async () => { await db.close(); });
