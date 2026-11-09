import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

/**
 * Lot 2 — Suite de sécurité Supabase dédiée.
 *
 * Comble les angles non couverts par les suites métier
 * (supabase-core/operations/finance/marketplace/journey/customizer) :
 * surface `anon` minimale au niveau des grants, isolation RLS en accès
 * direct aux tables, moindre privilège des rôles internes sur les RPC
 * sensibles, membership suspendue, jeton client forgé, prestation
 * inactive et salon non publié en appel RPC direct.
 */

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const barberMemberA = '33333333-3333-4333-8333-333333333333';
const accountantA = '44444444-4444-4444-8444-444444444444';
const suspendedManagerA = '55555555-5555-4555-8555-555555555555';
const outsider = '66666666-6666-4666-8666-666666666666';

const BOOK_DATE = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const BOOK_WEEKDAY = new Date(`${BOOK_DATE}T00:00:00Z`).getUTCDay();
const STARTS = `${BOOK_DATE}T09:00:00Z`;

let salonA;
let salonB;
let branchA;
let serviceCoupe;
let serviceInactive;
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
const rpc = async (name, params) => {
  const row = (await db.query(`select * from public.${name}`, params)).rows[0];
  const base = name.split('(')[0];
  if (row && Object.keys(row).length === 1 && base in row) return row[base];
  return row;
};

test('seed : migrations complètes, deux salons, rôles variés, salon A publié', async () => {
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
  for (const id of [ownerA, ownerB, barberMemberA, accountantA, suspendedManagerA, outsider]) {
    await db.query('insert into auth.users(id, email_confirmed_at) values ($1, now())', [id]);
  }
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  await asUser(ownerA);
  const a = await db.query("select * from public.create_salon('Organisation A', 'Salon A', 'Principal')");
  salonA = a.rows[0].salon_id;
  branchA = a.rows[0].branch_id;
  await asUser(ownerB);
  const b = await db.query("select * from public.create_salon('Organisation B', 'Salon B', 'Principal')");
  salonB = b.rows[0].salon_id;

  await asAdmin();
  await db.query("insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'barber')", [
    salonA,
    barberMemberA,
  ]);
  await db.query("insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'accountant')", [
    salonA,
    accountantA,
  ]);
  await db.query(
    "insert into public.memberships(salon_id, user_id, role, status) values ($1, $2, 'manager', 'suspended')",
    [salonA, suspendedManagerA],
  );

  await asUser(ownerA);
  serviceCoupe = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Coupe', 'coupe', 4000, 30) returning id`,
      [salonA],
    )
  ).rows[0].id;
  serviceInactive = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes, is_active)
       values ($1, 'Ancienne coupe', 'coupe', 3000, 30, false) returning id`,
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
  await db.query(
    `insert into public.clients(salon_id, name, phone) values ($1, 'Client Confidentiel A', '0700000001')`,
    [salonA],
  );

  await rpc('update_salon_profile($1, $2::jsonb)', [
    salonA,
    JSON.stringify({
      slug: 'salon-a',
      tagline: 'Dégradés nets',
      description: 'Barbershop à Cocody',
      type: 'barbershop',
      commune: 'Cocody',
      quarter: 'Riviera',
      address: 'Rue des Jardins',
      phone: '0700000001',
      whatsapp: '0700000001',
      cover_url: 'https://example.com/cover.jpg',
      city: 'Abidjan',
      featured_service_ids: [serviceCoupe],
    }),
  ]);
  await rpc('set_salon_publication($1, true)', [salonA]);
  assert.ok(salonA && salonB && serviceCoupe && serviceInactive && staffKouassi);
});

test('régression Lot 2 : un membre authentifié peut créer/modifier un client en direct (index normalize_phone)', async () => {
  await asUser(ownerA);
  const created = await db.query(
    `insert into public.clients(salon_id, name, phone) values ($1, 'Cliente Directe', '+225 07 00 00 02') returning id`,
    [salonA],
  );
  assert.ok(created.rows[0].id);
  const updated = await db.query(
    `update public.clients set phone = '0700000003' where id = $1 returning phone`,
    [created.rows[0].id],
  );
  assert.equal(updated.rows[0].phone, '0700000003');
});

test('surface anon : aucune lecture directe des tables métier, aucune RPC ERP', async () => {
  await asAnon();
  for (const table of ['clients', 'appointments', 'payments', 'expenses', 'staff', 'memberships']) {
    await expectCode(db.query(`select * from public.${table} limit 1`), '42501');
  }
  await expectCode(db.query('select public.get_marketplace_customizer_config($1)', [salonA]), '42501');
  await expectCode(
    db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [salonA, '{}']),
    '42501',
  );
  await expectCode(
    db.query('select public.record_expense($1, $2, $3, $4, $5)', [
      salonA,
      'Test',
      'products',
      1000,
      BOOK_DATE,
    ]),
    '42501',
  );
  // Ce qui doit rester possible en anon : découvrir les salons publiés.
  const list = await rpc('marketplace_list_salons(null, null, null, null, 50)', []);
  assert.equal(list.length, 1);
  assert.equal(list[0].slug, 'salon-a');
});

test('isolation RLS en accès direct : le salon B ne voit ni ne modifie les données du salon A', async () => {
  await asUser(ownerB);
  const clients = await db.query('select name from public.clients');
  assert.deepEqual(clients.rows, []);
  const services = await db.query('select id from public.services where id = $1', [serviceCoupe]);
  assert.deepEqual(services.rows, []);
  await expectCode(
    db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Intrusion', 'coupe', 1000, 15)`,
      [salonA],
    ),
    '42501',
  );
  const updated = await db.query('update public.services set price = 1 where id = $1 returning id', [
    serviceCoupe,
  ]);
  assert.equal(updated.rows.length, 0);

  // Un authentifié sans aucune membership ne voit aucun salon.
  await asUser(outsider);
  assert.deepEqual((await db.query('select id from public.salons')).rows, []);

  // Contrôle positif : le prix du salon A est inchangé.
  await asUser(ownerA);
  const check = await db.query('select price from public.services where id = $1', [serviceCoupe]);
  assert.equal(Number(check.rows[0].price), 4000);
});

test('moindre privilège : rôles internes sans la permission métier rejetés par les RPC', async () => {
  // Un barbier (membre) ne peut pas enregistrer une dépense.
  await asUser(barberMemberA);
  await expectCode(
    db.query('select public.record_expense($1, $2, $3, $4, $5)', [
      salonA,
      'Lames',
      'products',
      5000,
      BOOK_DATE,
    ]),
    '42501',
  );

  // Une membership suspendue ne confère plus aucun droit, même manager.
  await asUser(suspendedManagerA);
  await expectCode(
    db.query('select public.record_expense($1, $2, $3, $4, $5)', [
      salonA,
      'Lames',
      'products',
      5000,
      BOOK_DATE,
    ]),
    '42501',
  );

  // Contrôle positif : le propriétaire peut enregistrer la dépense.
  await asUser(ownerA);
  const expense = await rpc('record_expense($1, $2, $3, $4, $5)', [
    salonA,
    'Lames',
    'products',
    5000,
    BOOK_DATE,
  ]);
  assert.ok(expense.id);
});

test('réservation publique : prestation inactive et salon non publié refusés en appel RPC direct', async () => {
  await asAnon();
  await expectCode(
    db.query('select public.marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
      salonA,
      serviceInactive,
      STARTS,
      'Client Test',
      '0700000097',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      staffKouassi,
      null,
      '',
    ]),
    '22023',
  );
  await expectCode(
    db.query('select public.marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
      salonB,
      serviceCoupe,
      STARTS,
      'Client Test',
      '0700000097',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
      staffKouassi,
      null,
      '',
    ]),
    '22023',
  );
});

test('jeton client forgé : annulation impossible, la vraie annulation fonctionne', async () => {
  await asAnon();
  booking = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
    salonA,
    serviceCoupe,
    STARTS,
    'Client Jeton',
    '0700000096',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
    staffKouassi,
    null,
    '',
  ]);
  assert.equal(booking.status, 'pending');

  await expectCode(
    db.query('select public.marketplace_cancel_booking($1, $2, $3, $4)', [
      salonA,
      booking.id,
      '00000000-0000-4000-8000-000000000000',
      'Jeton forgé',
    ]),
    '22023',
  );

  // Un comptable (pas de appointments.write) ne peut pas confirmer le RDV ;
  // le propriétaire le peut : moindre privilège sur le workflow réel.
  await asUser(accountantA);
  await expectCode(
    db.query('select public.transition_appointment($1, $2, $3)', [salonA, booking.id, 'confirmed']),
    '42501',
  );
  await asUser(ownerA);
  const confirmed = await rpc('transition_appointment($1, $2, $3)', [salonA, booking.id, 'confirmed']);
  assert.equal(confirmed.status, 'confirmed');

  // Après confirmation ERP, le client peut encore annuler avec son vrai jeton.
  await asAnon();
  const cancelled = await rpc('marketplace_cancel_booking($1, $2, $3, $4)', [
    salonA,
    booking.id,
    booking.cancel_token,
    'Empêché',
  ]);
  assert.equal(cancelled.status, 'cancelled');
});

after(async () => {
  await db.close();
});
