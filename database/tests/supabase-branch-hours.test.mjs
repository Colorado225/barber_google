import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const managerA = '22222222-2222-4222-8222-222222222222';
const ownerB = '33333333-3333-4333-8333-333333333333';
const receptionistA = '55555555-5555-4555-8555-555555555555';
let salonA;
let branchA;
let salonB;

async function asUser(userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}

test('branch hours migration applies and stores validated weekly schedules', async () => {
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
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now())',
    [ownerA, managerA, ownerB, receptionistA],
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/20261103160000_supabase_core.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/20261103170000_branch_hours.sql', import.meta.url),
      'utf8',
    ),
  );

  await asUser(ownerA);
  const createdA = await db.query(
    "select * from public.create_salon('Organisation A', 'Salon A', 'Principal')",
  );
  salonA = createdA.rows[0].salon_id;
  branchA = createdA.rows[0].branch_id;
  await db.query(
    `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
     values ($1, $2, 1, true, '09:00', '18:00'),
            ($1, $2, 0, false, null, null)`,
    [salonA, branchA],
  );
  const rows = await db.query(
    'select weekday, is_open, opens_at::text, closes_at::text from public.branch_hours order by weekday',
  );
  assert.deepEqual(rows.rows, [
    { weekday: 0, is_open: false, opens_at: null, closes_at: null },
    { weekday: 1, is_open: true, opens_at: '09:00:00', closes_at: '18:00:00' },
  ]);
});

test('branch hours policies isolate tenants and allow only authorized managers to write', async () => {
  await db.exec('reset role');
  await db.query(
    `insert into public.memberships(salon_id, user_id, role)
     values ($1, $2, 'manager'), ($1, $3, 'receptionist')`,
    [salonA, managerA, receptionistA],
  );
  await asUser(ownerB);
  const createdB = await db.query(
    "select * from public.create_salon('Organisation B', 'Salon B', 'Principal')",
  );
  salonB = createdB.rows[0].salon_id;

  await asUser(managerA);
  assert.equal((await db.query('select * from public.branch_hours')).rows.length, 2);
  await db.query(
    `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
     values ($1, $2, 2, true, '08:00', '17:00')`,
    [salonA, branchA],
  );
  await db.query(
    'update public.branch_hours set closes_at = $1 where salon_id = $2 and branch_id = $3 and weekday = 1',
    ['20:00', salonA, branchA],
  );
  await asUser(receptionistA);
  await db.query(
    'update public.branch_hours set closes_at = $1 where salon_id = $2 and branch_id = $3 and weekday = 1',
    ['21:00', salonA, branchA],
  );
  assert.equal(
    (
      await db.query(
        'select closes_at::text from public.branch_hours where salon_id = $1 and branch_id = $2 and weekday = 1',
        [salonA, branchA],
      )
    ).rows[0].closes_at,
    '20:00:00',
  );

  await asUser(ownerB);
  assert.equal((await db.query('select * from public.branch_hours')).rows.length, 0);
  await assert.rejects(
    db.query(
      `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
       values ($1, (select id from public.branches where salon_id = $2), 1, true, '09:00', '18:00')`,
      [salonA, salonB],
    ),
  );
});

test('branch hours reject invalid weekdays, inconsistent closed rows, and reversed times', async () => {
  await asUser(ownerA);
  const invalidSchedules = [
    [7, true, '09:00', '18:00'],
    [3, false, '09:00', null],
    [4, true, '18:00', '09:00'],
  ];
  for (const [weekday, isOpen, opensAt, closesAt] of invalidSchedules) {
    await assert.rejects(
      db.query(
        `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [salonA, branchA, weekday, isOpen, opensAt, closesAt],
      ),
    );
  }
});

after(async () => {
  await db.close();
});
