import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const superAdminId = '99999999-9999-4999-8999-999999999999';
const barberA = '33333333-3333-4333-8333-333333333333';

const BOOK_DATE = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const BOOK_WEEKDAY = new Date(`${BOOK_DATE}T00:00:00Z`).getUTCDay();

let salonA;
let branchA;
let serviceCoupe;
let staffKouassi;
let bookingId;
let whatsappNotifId;

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
async function asService() {
  await db.exec('reset role');
  await db.exec('set role service_role');
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

after(async () => {
  await db.close();
});

test('all migrations apply, SaaS plans no longer promise SMS reminders, and salon seeds cleanly', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query(
    `insert into auth.users(id, email_confirmed_at, email)
     values ($1, now(), 'ownerA@test.ci'), ($2, now(), 'ownerB@test.ci'), ($3, now(), 'admin@test.ci'), ($4, now(), 'barberA@test.ci')`,
    [ownerA, ownerB, superAdminId, barberA],
  );

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  // Vérification de la mise à jour des forfaits SaaS : aucune promesse SMS prématurée.
  const proPlan = (await db.query(`select features from public.saas_plans where id = 'pro'`)).rows[0];
  assert.ok(Array.isArray(proPlan.features));
  assert.equal(
    proPlan.features.some((f) => f === 'Rappels SMS & WhatsApp anti-no-show'),
    false,
    'le forfait Pro ne doit plus promettre des rappels SMS indisponibles',
  );
  assert.equal(
    proPlan.features.some((f) => f.includes('SMS non disponible')),
    true,
    'le forfait Pro doit mentionner honnêtement l’indisponibilité du SMS',
  );

  await asAdmin();
  await db.query(`insert into public.platform_admins(user_id, role) values ($1, 'super_admin')`, [
    superAdminId,
  ]);

  await asUser(ownerA);
  const a = await db.query("select * from public.create_salon('Org A', 'Salon Observability', 'Principal')");
  salonA = a.rows[0].salon_id;
  branchA = a.rows[0].branch_id;

  await asUser(ownerB);
  await db.query("select * from public.create_salon('Org B', 'Salon B', 'Principal')");

  await asUser(ownerA);
  serviceCoupe = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Coupe Signature', 'coupe', 5000, 30) returning id`,
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
  await db.query('select public.update_salon_profile($1, $2::jsonb)', [
    salonA,
    JSON.stringify({
      slug: 'salon-observability',
      tagline: 'Net & précis',
      description: 'Salon A',
      commune: 'Cocody',
      address: 'Rue des Jardins',
      phone: '0700000001',
      whatsapp: '0700000001',
      cover_url: 'https://example.com/cover.jpg',
    }),
  ]);
  await db.query('select public.set_salon_publication($1, true)', [salonA]);

  await asAdmin();
  await db.query(
    `insert into public.memberships(salon_id, user_id, role, status) values ($1, $2, 'barber', 'active')`,
    [salonA, barberA],
  );

  await asAnon();
  const bookingRes = (
    await db.query('select public.marketplace_book_appointment($1, $2, $3, $4, $5, $6, $7, $8, $9) as b', [
      salonA,
      serviceCoupe,
      `${BOOK_DATE}T10:00:00Z`,
      'Awa Koné',
      '+2250700112233',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      staffKouassi,
      'awa@test.ci',
      '',
    ])
  ).rows[0].b;
  bookingId = bookingRes.id;

  await asAdmin();
  const notifs = (
    await db.query(
      `select id, channel from public.appointment_notifications where appointment_id = $1 order by channel`,
      [bookingId],
    )
  ).rows;
  assert.equal(notifs.length, 3, 'email booking_received + email reminder_24h + whatsapp booking_received');
  whatsappNotifId = notifs.find((n) => n.channel === 'whatsapp').id;
});

test('failure_count and last_error track repeated failures across retries and trigger health alerts', async () => {
  await asAdmin();
  await db.query(
    `update public.appointment_notifications
        set scheduled_at = now() - interval '25 minutes'
      where salon_id = $1`,
    [salonA],
  );

  // Échec 1 sur le message WhatsApp
  await asService();
  const batch1 = (await db.query('select * from public.claim_due_notifications(10, $1)', [salonA])).rows;
  assert.ok(batch1.some((n) => n.id === whatsappNotifId));
  const fail1 = (
    await db.query(
      `select * from public.mark_notification_result($1, 'failed', null, 'whatsapp 400 (code 131047 / template_required_24h): outside 24h window')`,
      [whatsappNotifId],
    )
  ).rows[0];
  assert.equal(fail1.status, 'failed');
  assert.equal(fail1.failure_count, 1);

  // Relance manuelle (remet attempts à 0 et error à null, mais conserve failure_count = 1 et last_error)
  await asUser(ownerA);
  const retried = (
    await db.query('select * from public.retry_notification($1, $2)', [salonA, whatsappNotifId])
  ).rows[0];
  assert.equal(retried.status, 'pending');
  assert.equal(retried.attempts, 0);
  assert.equal(retried.error, null);
  assert.equal(retried.failure_count, 1);

  // Échec 2 après relance : failure_count passe à 2 -> échec répété observable !
  await asService();
  await db.query('select * from public.claim_due_notifications(10, $1)', [salonA]);
  const fail2 = (
    await db.query(
      `select * from public.mark_notification_result($1, 'failed', null, 'whatsapp 401 (code 190 / token_invalid_or_expired): expired token')`,
      [whatsappNotifId],
    )
  ).rows[0];
  assert.equal(fail2.status, 'failed');
  assert.equal(fail2.attempts, 1);
  assert.equal(fail2.failure_count, 2);
  assert.match(fail2.last_error, /190/);

  // L'une des notifications reste en attente échue depuis > 15 min (faute de fournisseur).
  await asAdmin();
  await db.query(
    `update public.appointment_notifications
        set status = 'pending', locked_at = null, scheduled_at = now() - interval '30 minutes'
      where salon_id = $1 and channel = 'email' and kind = 'reminder_24h'`,
    [salonA],
  );

  // Enregistrement d'une exécution du dispatcher (réservé à service_role)
  await asUser(ownerA);
  await expectCode(
    db.query(
      `select public.record_notification_dispatch_run($1, 'manual', true, true, true, false, 1, 0, 1, 0, 'failed', '{}'::jsonb)`,
      [salonA],
    ),
    '42501',
  );

  await asService();
  await db.query(
    `select public.record_notification_dispatch_run($1, 'manual', true, true, true, false, 1, 0, 1, 0, '1 notification(s) en échec', '{}'::jsonb)`,
    [salonA],
  );

  await asUser(ownerA);
  const salonHealth = (await db.query('select public.get_salon_notification_health($1) as h', [salonA]))
    .rows[0].h;
  assert.equal(salonHealth.repeatedFailures, 1);
  assert.equal(salonHealth.repeatedFailureItems.length, 1);
  assert.equal(salonHealth.repeatedFailureItems[0].id, whatsappNotifId);
  assert.equal(salonHealth.repeatedFailureItems[0].failureCount, 2);
  assert.equal(salonHealth.byChannel.sms.supported, false);
  assert.match(salonHealth.smsUnavailableReason, /SMS.*pas disponible/i);
  assert.ok(salonHealth.overduePending >= 1, 'des messages échus non expédiés restent observables');
  assert.equal(salonHealth.lastRun.triggerSource, 'manual');
  assert.equal(salonHealth.lastRun.whatsappTemplateMode, false);
});

test('observability RPCs enforce tenant and superadmin boundaries strictly', async () => {
  await asAnon();
  await expectCode(db.query('select public.get_salon_notification_health($1)', [salonA]), '42501');
  await expectCode(db.query('select public.platform_get_notification_health()'), '42501');

  await asUser(ownerB);
  await expectCode(db.query('select public.get_salon_notification_health($1)', [salonA]), '42501');
  await expectCode(db.query('select public.platform_get_notification_health()'), '42501');
  assert.equal((await db.query('select public.can_administer_notifications() as ok')).rows[0].ok, false);

  // Le barbier n'est pas autorisé à voir les notifications ou l'observabilité si appointments.read est limité,
  // mais même s'il lit appointments.read, il ne peut jamais accéder au SuperAdmin.
  await asUser(barberA);
  await expectCode(db.query('select public.platform_get_notification_health()'), '42501');

  await asUser(superAdminId);
  assert.equal((await db.query('select public.can_administer_notifications() as ok')).rows[0].ok, true);
  const platformHealth = (await db.query('select public.platform_get_notification_health() as h')).rows[0].h;
  assert.equal(platformHealth.repeatedFailures, 1);
  assert.equal(platformHealth.byChannel.sms.supported, false);
  assert.equal(platformHealth.salonsWithIssues.length, 1);
  assert.equal(platformHealth.salonsWithIssues[0].salonId, salonA);
  assert.equal(platformHealth.salonsWithIssues[0].repeatedFailures, 1);
  assert.match(platformHealth.salonsWithIssues[0].latestError, /190/);
});
