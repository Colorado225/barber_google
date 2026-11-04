import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const barberA = '33333333-3333-4333-8333-333333333333';
let salonA;
let salonB;

async function asUser(userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}

test('Supabase core migration applies and provisions a tenant atomically', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query(
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now())',
    [ownerA, ownerB, barberA],
  );
  await db.exec(
    await readFile(new URL('../../supabase/migrations/20261103160000_supabase_core.sql', import.meta.url), 'utf8'),
  );

  await asUser(ownerA);
  const createdA = await db.query(
    "select * from public.create_salon('Organisation A', 'Salon A', 'Principal')",
  );
  salonA = createdA.rows[0].salon_id;
  assert.ok(createdA.rows[0].organization_id);
  assert.ok(createdA.rows[0].branch_id);
  assert.deepEqual((await db.query('select name from public.salons')).rows, [{ name: 'Salon A' }]);
  assert.deepEqual(
    (await db.query('select branch_id from public.branch_memberships')).rows,
    [{ branch_id: createdA.rows[0].branch_id }],
  );
  assert.equal((await db.query('select * from public.onboarding_state where user_id = $1', [ownerA])).rows[0].current_step, 'setup');

  await asUser(ownerB);
  const createdB = await db.query(
    "select * from public.create_salon('Organisation B', 'Salon B', 'Principal')",
  );
  salonB = createdB.rows[0].salon_id;
  assert.deepEqual((await db.query('select name from public.salons')).rows, [{ name: 'Salon B' }]);
  assert.equal((await db.query('select name from public.organizations')).rows.length, 1);
  await assert.rejects(
    db.query("insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'owner')", [salonA, ownerB]),
  );
});

test('RLS and grants isolate tenants and prevent privilege escalation', async () => {
  await db.exec('reset role');
  await db.query(
    "insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'barber')",
    [salonA, barberA],
  );
  await asUser(ownerA);
  await db.query(
    `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Coupe', 'coupe', 5000, 30)`,
    [salonA],
  );
  await asUser(barberA);
  assert.equal((await db.query('select name from public.services where salon_id = $1', [salonA])).rows.length, 1);
  await assert.rejects(
    db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Intrusion', 'coupe', 1, 30)`,
      [salonA],
    ),
  );
  assert.equal((await db.query('select name from public.salons')).rows.length, 1);

  await asUser(ownerB);
  assert.equal((await db.query('select name from public.services')).rows.length, 0);
  assert.equal((await db.query('select name from public.salons')).rows[0].name, 'Salon B');
  await assert.rejects(db.query('insert into public.appointments(salon_id) values ($1)', [salonB]));
});

test('salon creation rejects unverified identities and invalid input without partial writes', async () => {
  const unverified = '44444444-4444-4444-8444-444444444444';
  await db.exec('reset role');
  await db.query('insert into auth.users(id, email_confirmed_at) values ($1, null)', [unverified]);
  assert.equal(
    (await db.query('select current_step from public.onboarding_state where user_id = $1', [unverified])).rows[0].current_step,
    'email_verification',
  );
  const before = (await db.query('select count(*)::int as count from public.organizations')).rows[0].count;
  await asUser(unverified);
  await assert.rejects(db.query("select * from public.create_salon('Organisation', 'Salon', 'Branch')"));
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as count from public.organizations')).rows[0].count, before);
  await db.query('update auth.users set email_confirmed_at = now() where id = $1', [unverified]);
  assert.equal(
    (await db.query('select current_step from public.onboarding_state where user_id = $1', [unverified])).rows[0].current_step,
    'salon_creation',
  );
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ownerA]);
  await db.exec('set role authenticated');
  await assert.rejects(db.query("select * from public.create_salon('Organisation', '', 'Branch')"));
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as count from public.organizations')).rows[0].count, before);
});

after(async () => {
  await db.close();
});
