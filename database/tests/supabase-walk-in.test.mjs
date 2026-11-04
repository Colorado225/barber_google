import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const receptionistA = '55555555-5555-4555-8555-555555555555';
const barberA = '66666666-6666-4666-8666-666666666666';
const cashierA = '88888888-8888-4888-8888-888888888888';
const ownerB = '33333333-3333-4333-8333-333333333333';

let salonA;
let branchA;
let serviceCoupe;
let staffKouassi;
let clientA;
let waitingAnonymous;
let cashSession;

async function asUser(userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}
async function asAnon() {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec('set role anon');
}
async function asAdmin() {
  await db.exec('reset role');
}
async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}
const readMigration = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const key = (n) => `eeeeeeee-eeee-4eee-8eee-${String(n).padStart(12, '0')}`;

test('walk-in migration applies on top of the full Supabase stack', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query('insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now()), ($5, now())',
    [ownerA, receptionistA, barberA, cashierA, ownerB]);
  for (const name of [
    '20261103160000_supabase_core.sql',
    '20261103170000_branch_hours.sql',
    '20261104090000_staff_schedules.sql',
    '20261104090100_appointment_operations.sql',
    '20261104090200_review_moderation.sql',
    '20261104100000_finance_foundation.sql',
    '20261104100100_payment_journal.sql',
    '20261104100200_finance_reporting.sql',
    '20261104100300_finance_permissions_fix.sql',
    '20261104110000_marketplace_profile.sql',
    '20261104110100_marketplace_booking.sql',
    '20261104110200_appointment_notifications.sql',
    '20261104120000_walk_in_services.sql',
  ]) {
    await db.exec(await readMigration(name));
  }

  await asUser(ownerA);
  const a = await db.query("select * from public.create_salon('Organisation A', 'Salon A', 'Principal')");
  salonA = a.rows[0].salon_id;
  branchA = a.rows[0].branch_id;
  await asUser(ownerB);
  await db.query("select * from public.create_salon('Organisation B', 'Salon B', 'Principal')");

  await asAdmin();
  await db.query(
    `insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'receptionist'), ($1, $3, 'barber'), ($1, $4, 'cashier')`,
    [salonA, receptionistA, barberA, cashierA],
  );

  await asUser(ownerA);
  serviceCoupe = (await db.query(
    `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Coupe', 'coupe', 4000, 30) returning id`, [salonA],
  )).rows[0].id;
  staffKouassi = (await db.query(
    `insert into public.staff(salon_id, name, role, branch_id, service_ids)
     values ($1, 'Kouassi', 'barber', $2, $3) returning id`, [salonA, branchA, [serviceCoupe]],
  )).rows[0].id;
  clientA = (await db.query(
    `insert into public.clients(salon_id, name, phone) values ($1, 'Awa Koné', '0700000001') returning id`, [salonA],
  )).rows[0].id;
  assert.ok(salonA && branchA && serviceCoupe && staffKouassi && clientA);
});

test('anonymous arrival is queued without name, phone, staff or future slot; replay is idempotent', async () => {
  await asUser(receptionistA);
  waitingAnonymous = (await db.query(
    `select * from public.register_walk_in($1, $2, $3, null, null, null, null, null, false, '')`,
    [salonA, serviceCoupe, key(1)],
  )).rows[0];
  assert.equal(waitingAnonymous.source, 'walk_in');
  assert.equal(waitingAnonymous.status, 'checked_in');
  assert.equal(waitingAnonymous.client_name, 'Client de passage');
  assert.equal(waitingAnonymous.client_phone, '');
  assert.equal(waitingAnonymous.staff_id, null);
  assert.equal(Number(waitingAnonymous.amount), 4000);
  assert.ok(waitingAnonymous.arrival_at);
  assert.equal(waitingAnonymous.service_started_at, null);

  const replay = (await db.query(
    `select * from public.register_walk_in($1, $2, $3, 'Autre nom', null, null, null, null, true, '')`,
    [salonA, serviceCoupe, key(1)],
  )).rows[0];
  assert.equal(replay.id, waitingAnonymous.id);
  assert.equal(replay.client_name, 'Client de passage');

  await asUser(barberA);
  await expectCode(db.query(`select public.register_walk_in($1, $2, $3)`, [salonA, serviceCoupe, key(2)]), '42501');
  await asAnon();
  await expectCode(db.query(`select public.register_walk_in($1, $2, $3)`, [salonA, serviceCoupe, key(3)]), '42501');
});

test('walk-in can be started, completed and paid through the existing cash journal', async () => {
  await asUser(receptionistA);
  const started = (await db.query(`select * from public.start_walk_in($1, $2, $3)`,
    [salonA, waitingAnonymous.id, staffKouassi])).rows[0];
  assert.equal(started.status, 'in_progress');
  assert.equal(started.staff_id, staffKouassi);
  assert.ok(started.service_started_at);

  const completed = (await db.query(`select * from public.complete_walk_in($1, $2)`,
    [salonA, waitingAnonymous.id])).rows[0];
  assert.equal(completed.status, 'completed');
  assert.ok(completed.service_completed_at);
  assert.ok(new Date(completed.ends_at) > new Date(completed.starts_at));

  await asUser(receptionistA);
  await expectCode(db.query(`select public.record_payment($1, $2, 4000, 'cash', $3, null, 'Paiement coupe')`,
    [salonA, waitingAnonymous.id, key(10)]), '42501');

  await asUser(cashierA);
  const register = (await db.query('select public.ensure_default_register($1, $2) as id', [salonA, branchA])).rows[0].id;
  cashSession = (await db.query('select public.open_cash_session($1, $2, 10000, $3, $4) as id',
    [salonA, branchA, register, 'Fond de caisse'])).rows[0].id;
  const payment = (await db.query(
    `select * from public.record_payment($1, $2, 4000, 'cash', $3, null, 'Paiement coupe sans rendez-vous')`,
    [salonA, waitingAnonymous.id, key(11)],
  )).rows[0];
  assert.equal(payment.status, 'confirmed');
  assert.equal(payment.cash_session_id, cashSession);
  const apt = (await db.query('select payment_status from public.appointments where id = $1', [waitingAnonymous.id])).rows[0];
  assert.equal(apt.payment_status, 'paid');
});

test('queue tolerates a busy barber; starting the same barber concurrently is refused until completion', async () => {
  await asUser(receptionistA);
  const busy = (await db.query(
    `select * from public.register_walk_in($1, $2, $3, 'Client occupé', null, null, $4, null, true, '')`,
    [salonA, serviceCoupe, key(20), staffKouassi],
  )).rows[0];
  assert.equal(busy.status, 'in_progress');

  const queued = (await db.query(
    `select * from public.register_walk_in($1, $2, $3, 'Client suivant', null, null, null, null, false, '')`,
    [salonA, serviceCoupe, key(21)],
  )).rows[0];
  assert.equal(queued.status, 'checked_in');
  assert.equal(queued.staff_id, null);

  await expectCode(db.query(`select public.start_walk_in($1, $2, $3)`, [salonA, queued.id, staffKouassi]), '23P01');
  await db.query(`select public.complete_walk_in($1, $2)`, [salonA, busy.id]);
  const started = (await db.query(`select * from public.start_walk_in($1, $2, $3)`, [salonA, queued.id, staffKouassi])).rows[0];
  assert.equal(started.status, 'in_progress');
});

test('existing CRM client can be linked; tenant isolation and invalid service are enforced', async () => {
  await asUser(receptionistA);
  const linked = (await db.query(
    `select * from public.register_walk_in($1, $2, $3, null, null, $4, null, null, false, 'Préfère contours fins')`,
    [salonA, serviceCoupe, key(30), clientA],
  )).rows[0];
  assert.equal(linked.client_id, clientA);
  assert.equal(linked.client_name, 'Awa Koné');
  assert.equal(linked.client_phone, '0700000001');

  await asUser(ownerB);
  await expectCode(db.query(`select public.start_walk_in($1, $2, $3)`, [salonA, linked.id, staffKouassi]), '42501');

  await asUser(ownerA);
  const inactive = (await db.query(
    `insert into public.services(salon_id, name, category, price, duration_minutes, is_active)
     values ($1, 'Ancienne', 'coupe', 1000, 10, false) returning id`, [salonA],
  )).rows[0].id;
  await asUser(receptionistA);
  await expectCode(db.query(`select public.register_walk_in($1, $2, $3)`, [salonA, inactive, key(31)]), '22023');
});

after(async () => {
  await db.close();
});
