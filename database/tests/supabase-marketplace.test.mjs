import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const managerA = '22222222-2222-4222-8222-222222222222';
const ownerB = '33333333-3333-4333-8333-333333333333';

const BOOK_DATE = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const BOOK_WEEKDAY = new Date(`${BOOK_DATE}T00:00:00Z`).getUTCDay();
const STARTS = `${BOOK_DATE}T09:00:00Z`;

let salonA;
let salonB;
let branchA;
let serviceCoupe;
let staffKouassi;
let booking;

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
const rpc = async (name, params) => {
  const row = (await db.query(`select * from public.${name}`, params)).rows[0];
  const base = name.split('(')[0];
  if (row && Object.keys(row).length === 1 && base in row) return row[base];
  return row;
};

test('lot 7 migrations apply and seed two tenants with staff and hours', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query('insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now())', [ownerA, managerA, ownerB]);
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
  ]) {
    await db.exec(await readMigration(name));
  }

  await asUser(ownerA);
  const a = await db.query("select * from public.create_salon('Organisation A', 'Salon A', 'Principal')");
  salonA = a.rows[0].salon_id;
  branchA = a.rows[0].branch_id;
  await asUser(ownerB);
  const b = await db.query("select * from public.create_salon('Organisation B', 'Salon B', 'Principal')");
  salonB = b.rows[0].salon_id;

  await asAdmin();
  await db.query("insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'manager')", [salonA, managerA]);

  await asUser(managerA);
  serviceCoupe = (await db.query(
    `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Coupe', 'coupe', 4000, 30) returning id`, [salonA],
  )).rows[0].id;
  staffKouassi = (await db.query(
    `insert into public.staff(salon_id, name, role, branch_id, service_ids)
     values ($1, 'Kouassi', 'barber', $2, $3) returning id`, [salonA, branchA, [serviceCoupe]],
  )).rows[0].id;
  await db.query(
    `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
     values ($1, $2, $3, true, '09:00', '18:00')`, [salonA, branchA, BOOK_WEEKDAY],
  );
  assert.ok(salonA && salonB && branchA && serviceCoupe && staffKouassi);
});

test('publication is owner-controlled and never exposes unpublished salons', async () => {
  await asAnon();
  assert.deepEqual(await rpc('marketplace_list_salons(null, null, null, null, 50)', []), []);
  await expectCode(db.query('select public.marketplace_salon_detail($1)', [salonA]), '22023');

  await asUser(managerA);
  await expectCode(db.query('select public.update_salon_profile($1, $2::jsonb)', [salonA, JSON.stringify({ tagline: 'Pirate' })]), '42501');

  await asUser(ownerA);
  await expectCode(db.query('select public.set_salon_publication($1, true)', [salonA]), '22023'); // pas de couverture/adresse
  await rpc('update_salon_profile($1, $2::jsonb)', [salonA, JSON.stringify({
    slug: 'salon-a', tagline: 'Dégradés nets', description: 'Barbershop à Cocody',
    type: 'barbershop', commune: 'Cocody', quarter: 'Riviera', address: 'Rue des Jardins',
    phone: '0700000001', whatsapp: '0700000001', cover_url: 'https://example.com/cover.jpg',
    logo_url: 'https://example.com/logo.png', city: 'Abidjan',
    gallery: [{ url: 'https://example.com/1.jpg', title: 'Façade', description: '' }],
    featured_service_ids: [serviceCoupe],
  })]);
  const published = await rpc('set_salon_publication($1, true)', [salonA]);
  assert.equal(published.is_published, true);
  assert.ok(published.publication_date);

  await asAnon();
  const list = await rpc('marketplace_list_salons(null, null, null, null, 50)', []);
  assert.equal(list.length, 1);
  assert.equal(list[0].slug, 'salon-a');
  assert.equal(Number(list[0].min_price), 4000);
  const detail = await rpc('marketplace_salon_detail($1)', ['salon-a']);
  assert.equal(detail.salon.id, salonA);
  assert.equal(detail.services.length, 1);
  assert.equal(detail.staff.length, 1);
  assert.equal(detail.staff[0].phone, undefined);
  assert.equal(detail.branches[0].hours.length, 1);
  await expectCode(db.query('select public.marketplace_salon_detail($1)', [salonB]), '22023');
});

test('public availability reuses internal slot rules and is anon-readable', async () => {
  await asAnon();
  const slots = await db.query('select * from public.marketplace_day_availability($1, $2, $3, $4)',
    [salonA, BOOK_DATE, serviceCoupe, staffKouassi]);
  assert.ok(slots.rows.length > 0);
  const byHour = Object.fromEntries(slots.rows.map((r) => [r.starts_at.toISOString().slice(11, 16), r.available]));
  assert.equal(byHour['08:00'], false); // avant l'ouverture
  assert.equal(byHour['09:00'], true);
  assert.equal(byHour['17:00'], true); // fin 17:30 <= 18:00
  assert.equal(byHour['18:00'], false); // après la fermeture
  await expectCode(db.query('select * from public.marketplace_day_availability($1, $2, $3, null)',
    [salonB, BOOK_DATE, serviceCoupe]), '22023');
});

test('anonymous booking is pending, idempotent, conflict-safe and cancellable by token', async () => {
  await asAnon();
  const key = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
  booking = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [salonA, serviceCoupe, STARTS, 'Client Web', '0700000099', key, staffKouassi, 'client@example.com', 'Réservation en ligne']);
  assert.equal(booking.status, 'pending');
  assert.equal(booking.source, 'marketplace');
  assert.equal(Number(booking.amount), 4000);
  assert.ok(booking.cancel_token);

  const replay = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [salonA, serviceCoupe, STARTS, 'Client Web', '0700000099', key, staffKouassi, 'client@example.com', 'Réservation en ligne']);
  assert.equal(replay.id, booking.id);
  await expectCode(db.query('select public.marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [salonA, serviceCoupe, STARTS, 'Autre', '0700000098', 'ffffffff-ffff-4fff-8fff-fffffffffff2', staffKouassi, null, '']), '23P01');
  await expectCode(db.query('select public.marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [salonA, serviceCoupe, '2020-01-01T09:00:00Z', 'Past', '0700000097', 'ffffffff-ffff-4fff-8fff-fffffffffff3', staffKouassi, null, '']), '22023');

  const fetched = await rpc('marketplace_get_booking($1, $2, $3)', [salonA, booking.id, booking.cancel_token]);
  assert.equal(fetched.status, 'pending');
  await expectCode(db.query('select public.marketplace_get_booking($1, $2, $3)',
    [salonA, booking.id, '00000000-0000-4000-8000-000000000000']), '22023');

  const cancelled = await rpc('marketplace_cancel_booking($1, $2, $3, $4)',
    [salonA, booking.id, booking.cancel_token, 'Empêché']);
  assert.equal(cancelled.status, 'cancelled');
  await expectCode(db.query('select public.marketplace_cancel_booking($1, $2, $3, $4)',
    [salonA, booking.id, booking.cancel_token, 'Déjà annulé']), '22023');

  await asUser(managerA);
  const events = (await db.query('select new_status, actor_id from public.appointment_events where appointment_id = $1 order by created_at', [booking.id])).rows;
  assert.deepEqual(events.map((e) => e.new_status), ['pending', 'cancelled']);
  assert.equal(events[0].actor_id, null);
  const notifs = (await db.query('select channel, kind, status from public.appointment_notifications where appointment_id = $1', [booking.id])).rows;
  assert.ok(notifs.some((n) => n.channel === 'email' && n.kind === 'booking_received'));
  assert.ok(notifs.some((n) => n.channel === 'whatsapp' && n.kind === 'booking_received'));
  assert.ok(notifs.some((n) => n.kind === 'reminder_24h'));
  assert.ok(notifs.every((n) => n.status === 'pending'));
});

test('salon confirms a marketplace booking and search filters work', async () => {
  await asAnon();
  const key = 'ffffffff-ffff-4fff-8fff-fffffffffff4';
  const b2 = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [salonA, serviceCoupe, `${BOOK_DATE}T10:00:00Z`, 'Client Deux', '0700000096', key, staffKouassi, null, '']);
  await asUser(managerA);
  const confirmed = await rpc('transition_appointment($1, $2, $3, null)', [salonA, b2.id, 'confirmed']);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.payment_status, 'unpaid');
  const notifs = (await db.query("select kind from public.appointment_notifications where appointment_id = $1 and kind = 'booking_confirmed'", [b2.id])).rows;
  assert.ok(notifs.length >= 1);

  await asAnon();
  const cocody = await rpc('marketplace_list_salons(null, $1, null, null, 50)', ['Cocody']);
  assert.equal(cocody.length, 1);
  const abidjan = await rpc('marketplace_list_salons(null, null, $1, null, 50)', ['Abidjan']);
  assert.equal(abidjan.length, 1);
  const coupe = await rpc('marketplace_list_salons(null, null, null, $1, 50)', ['coupe']);
  assert.equal(coupe.length, 1);
  const none = await rpc('marketplace_list_salons($1, null, null, null, 50)', ['Inexistant']);
  assert.equal(none.length, 0);
});

test('anon has no direct table access; public reads go through RPC only', async () => {
  await asAnon();
  await expectCode(db.query('select * from public.salons'), '42501');
  await expectCode(db.query('select * from public.appointments'), '42501');
  await expectCode(db.query('select * from public.services'), '42501');
  await expectCode(db.query('select * from public.appointment_notifications'), '42501');
});

after(async () => {
  await db.close();
});
