import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';

const BOOK_DATE = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const BOOK_WEEKDAY = new Date(`${BOOK_DATE}T00:00:00Z`).getUTCDay();

let salonA;
let branchA;
let serviceCoupe;
let staffKouassi;
let booking1;
let booking2;
let rotatedToken;

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
async function rpc(signature, params = []) {
  const res = await db.query(`select public.${signature} as value`, params);
  return res.rows[0].value;
}

after(async () => {
  await db.close();
});

test('all migrations apply and seed published salon with two online bookings', async () => {
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
  await db.query('insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now())', [
    ownerA,
    ownerB,
  ]);
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  await asUser(ownerA);
  const a = await db.query("select * from public.create_salon('Org A', 'Salon A', 'Principal')");
  salonA = a.rows[0].salon_id;
  branchA = a.rows[0].branch_id;
  await asUser(ownerB);
  await db.query("select * from public.create_salon('Org B', 'Salon B', 'Principal')");

  await asUser(ownerA);
  serviceCoupe = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Coupe Prestige', 'coupe', 5000, 30) returning id`,
      [salonA],
    )
  ).rows[0].id;
  staffKouassi = (
    await db.query(
      `insert into public.staff(salon_id, name, role, branch_id, service_ids)
       values ($1, 'Kouassi', 'barber', $2, $3) returning id`,
      [salonA, branchA, [serviceCoupe]],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
     values ($1, $2, $3, true, '09:00', '18:00')`,
    [salonA, branchA, BOOK_WEEKDAY],
  );
  await rpc('update_salon_profile($1, $2::jsonb)', [
    salonA,
    JSON.stringify({
      slug: 'salon-a',
      tagline: 'Net & précis',
      description: 'Salon A',
      commune: 'Cocody',
      address: 'Rue des Jardins',
      phone: '0700000001',
      whatsapp: '0700000001',
      cover_url: 'https://example.com/cover.jpg',
    }),
  ]);
  await rpc('set_salon_publication($1, true)', [salonA]);

  await asAnon();
  booking1 = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
    salonA,
    serviceCoupe,
    `${BOOK_DATE}T10:00:00Z`,
    'Awa Koné',
    '0700000010',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    staffKouassi,
    'awa@example.com',
    '',
  ]);
  booking2 = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
    salonA,
    serviceCoupe,
    `${BOOK_DATE}T11:00:00Z`,
    'Moussa Traoré',
    '0700000011',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    staffKouassi,
    'moussa@example.com',
    '',
  ]);
  assert.ok(booking1.cancel_token && booking2.cancel_token);
  assert.notEqual(booking1.cancel_token, booking2.cancel_token);
});

test('rotating a booking token invalidates the previous token and updates unsent notifications', async () => {
  // Simuler un e-mail déjà envoyé (historique immuable) et laisser les autres pending.
  await asAdmin();
  const initialNotifs = (
    await db.query(
      'select id, status, kind, payload from public.appointment_notifications where appointment_id = $1 order by created_at',
      [booking1.id],
    )
  ).rows;
  assert.ok(initialNotifs.length >= 2);
  const alreadySentId = initialNotifs[0].id;
  await db.query(
    `update public.appointment_notifications set status = 'sent', sent_at = now() where id = $1`,
    [alreadySentId],
  );

  await asAnon();
  const rotated = await rpc('marketplace_rotate_booking_token($1)', [booking1.cancel_token]);
  assert.equal(rotated.appointment_id, booking1.id);
  assert.ok(rotated.token);
  assert.ok(rotated.rotated_at);
  assert.notEqual(rotated.token, booking1.cancel_token);
  rotatedToken = rotated.token;

  // L'ancien jeton est immédiatement refusé partout.
  await expectCode(
    db.query('select public.marketplace_booking_by_token($1)', [booking1.cancel_token]),
    '22023',
  );
  await expectCode(
    db.query('select public.marketplace_get_booking($1, $2, $3)', [
      salonA,
      booking1.id,
      booking1.cancel_token,
    ]),
    '22023',
  );
  await expectCode(
    db.query('select public.marketplace_cancel_booking($1, $2, $3, $4)', [
      salonA,
      booking1.id,
      booking1.cancel_token,
      'Ancien jeton',
    ]),
    '22023',
  );
  await expectCode(
    db.query('select public.marketplace_rotate_booking_token($1)', [booking1.cancel_token]),
    '22023',
  );
  await expectCode(
    db.query('select public.marketplace_revoke_booking_token($1)', [booking1.cancel_token]),
    '22023',
  );

  // Le nouveau jeton fonctionne et expose token_rotated_at + l'événement d'audit.
  const portal = await rpc('marketplace_booking_by_token($1)', [rotatedToken]);
  assert.equal(portal.booking.id, booking1.id);
  assert.ok(portal.booking.token_rotated_at);
  assert.ok(
    portal.timeline.some((e) => e.reason === 'Lien de suivi renouvelé par le client'),
    'la rotation doit être tracée dans le journal',
  );

  // L'autre réservation n'est pas affectée.
  const otherPortal = await rpc('marketplace_booking_by_token($1)', [booking2.cancel_token]);
  assert.equal(otherPortal.booking.id, booking2.id);

  // Les notifications non envoyées portent désormais le nouveau jeton ; celle déjà envoyée reste intacte.
  await asAdmin();
  const afterNotifs = (
    await db.query(
      'select id, status, payload from public.appointment_notifications where appointment_id = $1',
      [booking1.id],
    )
  ).rows;
  assert.equal(
    afterNotifs.length,
    initialNotifs.length,
    'aucune notification parasite créée par la rotation',
  );
  for (const n of afterNotifs) {
    if (n.id === alreadySentId) {
      assert.equal(n.payload.booking_token, booking1.cancel_token);
    } else {
      assert.equal(n.payload.booking_token, rotatedToken);
    }
  }
});

test('revoking a booking token disables all link access and strips queued tokens', async () => {
  await asAnon();
  await expectCode(db.query('select public.marketplace_rotate_booking_token(null)'), '22023');
  await expectCode(db.query('select public.marketplace_revoke_booking_token(null)'), '22023');

  const revoked = await rpc('marketplace_revoke_booking_token($1)', [rotatedToken]);
  assert.equal(revoked.appointment_id, booking1.id);
  assert.equal(revoked.revoked, true);
  assert.ok(revoked.revoked_at);

  // Tous les RPC par jeton sont bloqués après révocation.
  await expectCode(db.query('select public.marketplace_booking_by_token($1)', [rotatedToken]), '22023');
  await expectCode(
    db.query('select public.marketplace_get_booking($1, $2, $3)', [salonA, booking1.id, rotatedToken]),
    '22023',
  );
  await expectCode(
    db.query('select public.marketplace_cancel_booking($1, $2, $3, $4)', [
      salonA,
      booking1.id,
      rotatedToken,
      'Après révocation',
    ]),
    '22023',
  );
  await expectCode(
    db.query('select public.marketplace_submit_review($1, 5, $2)', [rotatedToken, 'Après révocation']),
    '22023',
  );
  await expectCode(db.query('select public.marketplace_rotate_booking_token($1)', [rotatedToken]), '22023');
  await expectCode(db.query('select public.marketplace_revoke_booking_token($1)', [rotatedToken]), '22023');

  // L'index unique partiel permet plusieurs rendez-vous avec public_cancel_token = NULL.
  const revoked2 = await rpc('marketplace_revoke_booking_token($1)', [booking2.cancel_token]);
  assert.equal(revoked2.revoked, true);

  await asAdmin();
  const rows = (
    await db.query(
      'select id, public_cancel_token, public_token_revoked_at from public.appointments where id in ($1, $2)',
      [booking1.id, booking2.id],
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.public_cancel_token === null && r.public_token_revoked_at !== null));

  const pendingAfterRevoke = (
    await db.query(
      `select payload from public.appointment_notifications
       where appointment_id = $1 and status in ('pending', 'failed', 'skipped')`,
      [booking1.id],
    )
  ).rows;
  assert.ok(pendingAfterRevoke.length >= 1);
  assert.ok(
    pendingAfterRevoke.every((n) => !('booking_token' in n.payload)),
    'les notifications en attente ne doivent plus contenir de jeton révoqué',
  );

  // Surface anon sur tables toujours verrouillée.
  await asAnon();
  await expectCode(db.query('select * from public.appointments'), '42501');
  await expectCode(db.query('select * from public.appointment_notifications'), '42501');
});
