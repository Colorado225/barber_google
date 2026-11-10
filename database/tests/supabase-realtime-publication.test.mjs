import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();

const ownerA = '11111111-1111-4111-8111-111111111111';
const barberA = '22222222-2222-4222-8222-222222222222';
const ownerB = '33333333-3333-4333-8333-333333333333';
const outsider = '44444444-4444-4444-8444-444444444444';

let salonA;
let salonB;

async function asUser(userId, email = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.query("select set_config('request.jwt.claim.email', $1, false)", [email]);
  await db.exec('set role authenticated');
}

async function asAnon() {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.query("select set_config('request.jwt.claim.email', '', false)");
  await db.exec('set role anon');
}

test('publication supabase_realtime idempotente + replica identity full sur les 4 tables', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);

  await db.query(
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now())',
    [ownerA, barberA, ownerB, outsider],
  );

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  // Simule un environnement Supabase doté de la publication `supabase_realtime`, puis réapplique la migration (idempotence)
  await db.exec('create publication supabase_realtime;');
  const realtimeMigrationSql = await readFile(
    new URL('../../supabase/migrations/20261110170000_erp_realtime_publication.sql', import.meta.url),
    'utf8',
  );
  await db.exec(realtimeMigrationSql);
  await db.exec(realtimeMigrationSql);

  const pubTables = (
    await db.query(
      `select tablename
         from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
        order by tablename`,
    )
  ).rows.map((r) => r.tablename);

  assert.deepEqual(pubTables, ['appointment_notifications', 'appointments', 'cash_sessions', 'payments']);

  const replIdents = (
    await db.query(
      `select c.relname, c.relreplident
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('appointments', 'appointment_notifications', 'payments', 'cash_sessions')
        order by c.relname`,
    )
  ).rows;
  for (const row of replIdents) {
    assert.equal(row.relreplident, 'f', `REPLICA IDENTITY FULL attendu sur ${row.relname}`);
  }
});

test('isolation RLS multi-postes et permissions sur les tables Realtime', async () => {
  await asUser(ownerA, 'ownera@example.com');
  const a = (await db.query("select * from public.create_salon('Org A', 'Salon A', 'Principal')")).rows[0];
  salonA = a.salon_id;

  await asUser(ownerB, 'ownerb@example.com');
  const b = (await db.query("select * from public.create_salon('Org B', 'Salon B', 'Principal')")).rows[0];
  salonB = b.salon_id;

  // Ajout d'un barbier sur Salon A (lit RDV + notifications, PAS paiements ni caisse)
  await db.exec('reset role');
  await db.query("insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'barber')", [
    salonA,
    barberA,
  ]);

  const svcA = (
    await db.query(
      "insert into public.services(salon_id, name, category, price, duration_minutes) values ($1, 'Coupe A', 'coupe', 5000, 30) returning id",
      [salonA],
    )
  ).rows[0].id;
  const staffA = (
    await db.query(
      "insert into public.staff(salon_id, name, role, branch_id, service_ids) values ($1, 'Koffi', 'barber', $2, $3) returning id",
      [salonA, a.branch_id, [svcA]],
    )
  ).rows[0].id;
  const svcB = (
    await db.query(
      "insert into public.services(salon_id, name, category, price, duration_minutes) values ($1, 'Coupe B', 'coupe', 6000, 30) returning id",
      [salonB],
    )
  ).rows[0].id;
  const staffB = (
    await db.query(
      "insert into public.staff(salon_id, name, role, branch_id, service_ids) values ($1, 'Moussa', 'barber', $2, $3) returning id",
      [salonB, b.branch_id, [svcB]],
    )
  ).rows[0].id;

  await asUser(ownerA);
  const apptA = (
    await db.query(
      "select id from public.create_appointment($1, $2, now() + interval '2 hours', 'Client A', '+22507000001', $3, null, null, 'direct', '')",
      [salonA, svcA, staffA],
    )
  ).rows[0].id;
  const regA = (await db.query('select public.ensure_default_register($1, $2) as id', [salonA, a.branch_id]))
    .rows[0].id;
  await db.query("select public.open_cash_session($1, $2, 10000, $3, 'Ouverture A')", [
    salonA,
    a.branch_id,
    regA,
  ]);
  await db.query(
    "select * from public.record_payment($1, $2, 5000, 'cash', '30000000-0000-4000-8000-000000000001', null, 'Encaissement A')",
    [salonA, apptA],
  );

  await asUser(ownerB);
  const apptB = (
    await db.query(
      "select id from public.create_appointment($1, $2, now() + interval '2 hours', 'Client B', '+22507000002', $3, null, null, 'direct', '')",
      [salonB, svcB, staffB],
    )
  ).rows[0].id;
  const regB = (await db.query('select public.ensure_default_register($1, $2) as id', [salonB, b.branch_id]))
    .rows[0].id;
  await db.query("select public.open_cash_session($1, $2, 20000, $3, 'Ouverture B')", [
    salonB,
    b.branch_id,
    regB,
  ]);
  await db.query(
    "select * from public.record_payment($1, $2, 6000, 'cash', '30000000-0000-4000-8000-000000000002', null, 'Encaissement B')",
    [salonB, apptB],
  );

  // Propriétaire A : voit uniquement les données du Salon A sur les 4 tables Realtime
  await asUser(ownerA);
  for (const table of ['appointments', 'appointment_notifications', 'payments', 'cash_sessions']) {
    const rows = (await db.query(`select salon_id from public.${table}`)).rows;
    assert.ok(rows.length >= 1, `${table} doit retourner au moins une ligne pour ownerA`);
    assert.ok(
      rows.every((r) => r.salon_id === salonA),
      `${table} ne doit jamais exposer le salon B à ownerA`,
    );
  }

  // Barbier A : voit RDV et notifications du Salon A, jamais les paiements/caisse ni le Salon B
  await asUser(barberA);
  assert.equal((await db.query('select id from public.appointments')).rows.length, 1);
  assert.equal((await db.query('select id from public.appointment_notifications')).rows.length, 1);
  assert.equal((await db.query('select id from public.payments')).rows.length, 0);
  assert.equal((await db.query('select id from public.cash_sessions')).rows.length, 0);

  // Tiers extérieur et anon : aucun accès direct SELECT aux 4 tables Realtime
  await asUser(outsider);
  for (const table of ['appointments', 'appointment_notifications', 'payments', 'cash_sessions']) {
    assert.equal((await db.query(`select id from public.${table}`)).rows.length, 0);
  }
  await asAnon();
  for (const table of ['appointments', 'appointment_notifications', 'payments', 'cash_sessions']) {
    await assert.rejects(db.query(`select id from public.${table}`), /permission denied/);
  }
});

after(async () => {
  await db.close();
});
