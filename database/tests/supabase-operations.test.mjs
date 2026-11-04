import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const managerA = '22222222-2222-4222-8222-222222222222';
const receptionistA = '55555555-5555-4555-8555-555555555555';
const barberA = '66666666-6666-4666-8666-666666666666';
const ownerB = '33333333-3333-4333-8333-333333333333';
const reviewer = '77777777-7777-4777-8777-777777777777';

// 2026-11-09 est un lundi (weekday 1), 2026-11-10 un mardi (weekday 2).
const MON = '2026-11-09';
const TUE = '2026-11-10';

let salonA;
let branchA;
let serviceCoupe;
let serviceLong;
let serviceInactive;
let staffKouassi;
let clientA;
let apptNine; // 09:00, walk-in, sera terminé
let apptTen; // 10:00, sera déplacé à 11:00

async function asUser(userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
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

const readMigration = (name) =>
  readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('lot 5 migrations apply and seed a tenant with staff, services and hours', async () => {
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
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now()), ($5, now()), ($6, now())',
    [ownerA, managerA, receptionistA, barberA, ownerB, reviewer],
  );
  for (const name of [
    '20261103160000_supabase_core.sql',
    '20261103170000_branch_hours.sql',
    '20261104090000_staff_schedules.sql',
    '20261104090100_appointment_operations.sql',
    '20261104090200_review_moderation.sql',
  ]) {
    await db.exec(await readMigration(name));
  }

  await asUser(ownerA);
  const createdA = await db.query(
    "select * from public.create_salon('Organisation A', 'Salon A', 'Principal')",
  );
  salonA = createdA.rows[0].salon_id;
  branchA = createdA.rows[0].branch_id;

  await asUser(ownerB);
  await db.query("select * from public.create_salon('Organisation B', 'Salon B', 'Principal')");

  // Memberships : insérés en superuser (aucune écriture directe accordée au client).
  await asAdmin();
  await db.query(
    `insert into public.memberships(salon_id, user_id, role)
     values ($1, $2, 'manager'), ($1, $3, 'receptionist'), ($1, $4, 'barber')`,
    [salonA, managerA, receptionistA, barberA],
  );

  await asUser(managerA);
  serviceCoupe = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Coupe classique', 'coupe', 4000, 30) returning id`,
      [salonA],
    )
  ).rows[0].id;
  serviceLong = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes, prep_minutes)
     values ($1, 'Coloration', 'coloration', 15000, 90, 15) returning id`,
      [salonA],
    )
  ).rows[0].id;
  serviceInactive = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes, is_active)
     values ($1, 'Ancienne prestation', 'coupe', 2000, 20, false) returning id`,
      [salonA],
    )
  ).rows[0].id;
  staffKouassi = (
    await db.query(
      `insert into public.staff(salon_id, name, role, branch_id, service_ids)
     values ($1, 'Kouassi', 'barber', $2, $3) returning id`,
      [salonA, branchA, [serviceCoupe, serviceLong]],
    )
  ).rows[0].id;

  await asUser(receptionistA);
  clientA = (
    await db.query(
      `insert into public.clients(salon_id, name, phone) values ($1, 'Client A', '0700000001') returning id`,
      [salonA],
    )
  ).rows[0].id;

  await asUser(managerA);
  await db.query(
    `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
     values ($1, $2, 1, true, '09:00', '18:00'),
            ($1, $2, 2, true, '09:00', '18:00'),
            ($1, $2, 0, false, null, null)`,
    [salonA, branchA],
  );
  assert.ok(salonA && branchA && serviceCoupe && staffKouassi);
});

test('staff schedules and absences: manager writes, receptionist reads only, tenants isolated', async () => {
  await asUser(managerA);
  await db.query(
    `insert into public.staff_schedules(salon_id, staff_id, weekday, starts_at, ends_at)
     values ($1, $2, 1, '09:00', '18:00'), ($1, $2, 2, '09:00', '18:00')`,
    [salonA, staffKouassi],
  );
  await db.query(
    `insert into public.staff_absences(salon_id, staff_id, starts_on, ends_on, reason)
     values ($1, $2, $3, $3, 'Congé')`,
    [salonA, staffKouassi, TUE],
  );

  await asUser(receptionistA);
  assert.equal((await db.query('select * from public.staff_schedules')).rows.length, 2);
  await expectCode(
    db.query(
      `insert into public.staff_schedules(salon_id, staff_id, weekday, starts_at, ends_at)
       values ($1, $2, 3, '09:00', '18:00')`,
      [salonA, staffKouassi],
    ),
    '42501',
  );

  await asUser(ownerB);
  assert.equal((await db.query('select * from public.staff_schedules')).rows.length, 0);
  assert.equal((await db.query('select * from public.staff_absences')).rows.length, 0);
});

test('create_appointment books a walk-in, computes end/amount and logs the first event', async () => {
  await asUser(receptionistA);
  apptNine = (
    await db.query(
      `select * from public.create_appointment($1, $2, $3, $4, $5, $6, null, null, 'phone', 'Contours fins')`,
      [salonA, serviceCoupe, `${MON}T09:00:00Z`, 'Client Un', '0700000001', staffKouassi],
    )
  ).rows[0].id;

  const row = (
    await db.query(
      `select status, amount, client_name, staff_name,
            extract(epoch from (ends_at - starts_at))::int / 60 as minutes
     from public.appointments where id = $1`,
      [apptNine],
    )
  ).rows[0];
  assert.equal(row.status, 'confirmed');
  assert.equal(row.amount, 4000);
  assert.equal(row.minutes, 30);
  assert.equal(row.staff_name, 'Kouassi');

  const events = (
    await db.query(
      'select new_status, previous_status from public.appointment_events where appointment_id = $1',
      [apptNine],
    )
  ).rows;
  assert.deepEqual(events, [{ new_status: 'confirmed', previous_status: null }]);
});

test('create_appointment rejects overlaps, closed hours, absences and inactive services', async () => {
  await asUser(receptionistA);
  // Chevauchement exact du créneau de 09:00.
  await expectCode(
    db.query(`select public.create_appointment($1, $2, $3, $4, $5, $6)`, [
      salonA,
      serviceCoupe,
      `${MON}T09:00:00Z`,
      'Autre',
      '0700000002',
      staffKouassi,
    ]),
    '23P01',
  );
  // Avant l'ouverture (08:00 < 09:00).
  await expectCode(
    db.query(`select public.create_appointment($1, $2, $3, $4, $5, $6)`, [
      salonA,
      serviceCoupe,
      `${MON}T08:00:00Z`,
      'Autre',
      '0700000002',
      staffKouassi,
    ]),
    '23P01',
  );
  // Mardi : jour d'absence du collaborateur.
  await expectCode(
    db.query(`select public.create_appointment($1, $2, $3, $4, $5, $6)`, [
      salonA,
      serviceCoupe,
      `${TUE}T09:00:00Z`,
      'Autre',
      '0700000002',
      staffKouassi,
    ]),
    '23P01',
  );
  // Prestation désactivée.
  await expectCode(
    db.query(`select public.create_appointment($1, $2, $3, $4, $5, $6)`, [
      salonA,
      serviceInactive,
      `${MON}T14:00:00Z`,
      'Autre',
      '0700000002',
      staffKouassi,
    ]),
    '22023',
  );
});

test('create_appointment auto-assigns a competent staff and enforces permissions', async () => {
  await asUser(receptionistA);
  apptTen = (
    await db.query(`select * from public.create_appointment($1, $2, $3, $4, $5, null, $6)`, [
      salonA,
      serviceCoupe,
      `${MON}T10:00:00Z`,
      'Client Deux',
      '0700000003',
      clientA,
    ])
  ).rows[0].id;
  const assigned = (
    await db.query('select staff_id, client_id from public.appointments where id = $1', [apptTen])
  ).rows[0];
  assert.equal(assigned.staff_id, staffKouassi);
  assert.equal(assigned.client_id, clientA);

  // Un barbier n'a pas appointments.write.
  await asUser(barberA);
  await expectCode(
    db.query(`select public.create_appointment($1, $2, $3, $4, $5, $6)`, [
      salonA,
      serviceCoupe,
      `${MON}T15:00:00Z`,
      'Autre',
      '0700000004',
      staffKouassi,
    ]),
    '42501',
  );
  // Un autre salon ne peut pas écrire chez nous.
  await asUser(ownerB);
  await expectCode(
    db.query(`select public.create_appointment($1, $2, $3, $4, $5, $6)`, [
      salonA,
      serviceCoupe,
      `${MON}T15:00:00Z`,
      'Autre',
      '0700000004',
      staffKouassi,
    ]),
    '42501',
  );
});

test('transition_appointment enforces the state machine, reasons and append-only audit', async () => {
  await asUser(receptionistA);
  // confirmed -> completed est interdit.
  await expectCode(
    db.query(`select public.transition_appointment($1, $2, 'completed')`, [salonA, apptNine]),
    '22023',
  );
  // Parcours valide.
  await db.query(`select public.transition_appointment($1, $2, 'checked_in')`, [salonA, apptNine]);
  await db.query(`select public.transition_appointment($1, $2, 'in_progress')`, [salonA, apptNine]);
  await db.query(`select public.transition_appointment($1, $2, 'completed')`, [salonA, apptNine]);
  assert.equal(
    (await db.query('select status from public.appointments where id = $1', [apptNine])).rows[0].status,
    'completed',
  );
  assert.equal(
    (
      await db.query('select count(*)::int as n from public.appointment_events where appointment_id = $1', [
        apptNine,
      ])
    ).rows[0].n,
    4,
  );

  // Annulation sans motif refusée, avec motif acceptée.
  await expectCode(db.query(`select public.cancel_appointment($1, $2, '  ')`, [salonA, apptTen]), '22023');
  await db.query(`select public.cancel_appointment($1, $2, 'Client absent')`, [salonA, apptTen]);
  assert.equal(
    (await db.query('select status from public.appointments where id = $1', [apptTen])).rows[0].status,
    'cancelled',
  );

  // Aucune écriture directe dans le journal.
  await expectCode(
    db.query(
      `insert into public.appointment_events(salon_id, branch_id, appointment_id, new_status, actor_id)
       values ($1, $2, $3, 'confirmed', $4)`,
      [salonA, branchA, apptNine, receptionistA],
    ),
    '42501',
  );
});

test('reschedule_appointment rechecks availability, recomputes end and refuses closed rows', async () => {
  await asUser(receptionistA);
  // Nouveau RDV à 11:00 pour disposer d'une ligne ouverte.
  const apptEleven = (
    await db.query(`select * from public.create_appointment($1, $2, $3, $4, $5, $6)`, [
      salonA,
      serviceCoupe,
      `${MON}T11:00:00Z`,
      'Client Trois',
      '0700000005',
      staffKouassi,
    ])
  ).rows[0].id;

  // Déplacer 11:00 -> 12:00 avec une prestation plus longue : fin recalculée (105 min).
  const moved = (
    await db.query(`select * from public.reschedule_appointment($1, $2, $3, $4, $5, 'Déplacé')`, [
      salonA,
      apptEleven,
      staffKouassi,
      serviceLong,
      `${MON}T12:00:00Z`,
    ])
  ).rows[0];
  const minutes = (
    await db.query(
      'select extract(epoch from (ends_at - starts_at))::int / 60 as m from public.appointments where id = $1',
      [apptEleven],
    )
  ).rows[0].m;
  assert.equal(minutes, 105);
  assert.equal(moved.amount, 15000);

  // Chevauchement avec le RDV terminé de 09:00 (occupe encore le créneau).
  await expectCode(
    db.query(`select public.reschedule_appointment($1, $2, $3, $4, $5)`, [
      salonA,
      apptEleven,
      staffKouassi,
      serviceCoupe,
      `${MON}T09:00:00Z`,
    ]),
    '23P01',
  );
  // Un RDV terminé ne se déplace plus.
  await expectCode(
    db.query(`select public.reschedule_appointment($1, $2, null, null, $3)`, [
      salonA,
      apptNine,
      `${MON}T13:00:00Z`,
    ]),
    '22023',
  );
});

test('day_availability reflects hours, bookings and service duration, and is access-controlled', async () => {
  await asUser(receptionistA);
  const slots = (
    await db.query(
      `select starts_at::text as starts_at, available from public.day_availability($1, $2, $3)
     where staff_id = $4 order by starts_at`,
      [salonA, MON, serviceCoupe, staffKouassi],
    )
  ).rows;
  assert.equal(slots.length, 12); // 08:00 -> 19:00
  const at = (hhmm) => slots.find((s) => s.starts_at.slice(11, 16) === hhmm);
  assert.equal(at('08:00').available, false); // avant ouverture
  assert.equal(at('09:00').available, false); // RDV terminé
  assert.equal(at('12:00').available, false); // RDV coloration 12:00-13:45
  assert.equal(at('15:00').available, true);

  await asUser(ownerB);
  await expectCode(db.query(`select public.day_availability($1, $2)`, [salonA, MON]), '42501');
});

test('create_review verifies against completed appointments and prevents duplicates', async () => {
  await asUser(reviewer);
  const unverified = (
    await db.query(`select * from public.create_review($1, 'Visiteur', 5, 'Très propre', null)`, [salonA])
  ).rows[0];
  assert.equal(unverified.verified, false);

  const verified = (
    await db.query(`select * from public.create_review($1, 'Client Un', 4, 'Bien', $2)`, [salonA, apptNine])
  ).rows[0];
  assert.equal(verified.verified, true);
  assert.equal(verified.appointment_id, apptNine);

  // Un seul avis par rendez-vous.
  await expectCode(
    db.query(`select public.create_review($1, 'Client Un', 2, 'Doublon', $2)`, [salonA, apptNine]),
    '23505',
  );
  // Rendez-vous non terminé : pas d'avis vérifié possible.
  await expectCode(
    db.query(`select public.create_review($1, 'X', 3, 'Trop tôt', $2)`, [salonA, apptTen]),
    '22023',
  );
});

test('delete_review is reserved to moderators and stays tenant-scoped', async () => {
  await asUser(managerA);
  const reviewId = (await db.query('select id from public.reviews where salon_id = $1 limit 1', [salonA]))
    .rows[0].id;

  await asUser(receptionistA);
  await expectCode(db.query(`select public.delete_review($1, $2)`, [salonA, reviewId]), '42501');

  await asUser(ownerB);
  await expectCode(db.query(`select public.delete_review($1, $2)`, [salonA, reviewId]), '42501');

  await asUser(managerA);
  await db.query(`select public.delete_review($1, $2)`, [salonA, reviewId]);
  assert.equal((await db.query('select * from public.reviews where id = $1', [reviewId])).rows.length, 0);
});

after(async () => {
  await db.close();
});
