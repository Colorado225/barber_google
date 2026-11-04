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
let booking1;
let booking2;
let rewardId;
let paymentId;

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
async function rpc(signature, params = []) {
  const res = await db.query(`select public.${signature} as value`, params);
  return res.rows[0].value;
}
const readMigration = (name) =>
  readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const key = (n) => `ffffffff-ffff-4fff-8fff-${String(n).padStart(12, '0')}`;
const inDays = (days, hour) => {
  const d = new Date(Date.now() + days * 86400000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

after(async () => {
  await db.close();
});

test('the client-journey stack applies on top of all previous migrations', async () => {
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
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now()), ($5, now())',
    [ownerA, receptionistA, barberA, cashierA, ownerB],
  );
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
    '20261104130000_crm_auto_link.sql',
    '20261104130100_loyalty_ledger.sql',
    '20261104130200_notification_dispatch.sql',
    '20261104130300_booking_portal.sql',
    '20261104130400_client_email_check_fix.sql',
    '20261104130500_notification_scheduler.sql',
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
  serviceCoupe = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Coupe', 'coupe', 4000, 30) returning id`,
      [salonA],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.staff(salon_id, name, role, branch_id, service_ids)
     values ($1, 'Kouassi', 'barber', $2, $3)`,
    [salonA, branchA, [serviceCoupe]],
  );
  await rpc('update_salon_profile($1, $2::jsonb)', [
    salonA,
    JSON.stringify({
      slug: 'salon-a',
      tagline: 'Dégradés nets',
      description: 'Barbershop à Cocody',
      commune: 'Cocody',
      address: 'Rue des Jardins',
      phone: '0700000001',
      whatsapp: '0700000001',
      cover_url: 'https://example.com/cover.jpg',
      logo_url: 'https://example.com/logo.png',
    }),
  ]);
  await rpc('set_salon_publication($1, true)', [salonA]);
  assert.ok(salonA && branchA && serviceCoupe);
});

test('online booking creates or reuses the CRM client from the phone number, without duplicates', async () => {
  await asAnon();
  booking1 = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, null, $7, $8)', [
    salonA,
    serviceCoupe,
    inDays(2, 10),
    'Awa Diallo',
    '+225 07 00 00 00 02',
    key(1),
    'awa@example.com',
    'Première visite',
  ]);
  assert.equal(booking1.status, 'pending');
  assert.ok(booking1.cancel_token);

  await asUser(ownerA);
  const linked = (await db.query('select client_id from public.appointments where id = $1', [booking1.id]))
    .rows[0];
  assert.ok(linked.client_id, 'la réservation en ligne doit être rattachée à une fiche client');
  const clients = (await db.query('select * from public.clients where salon_id = $1', [salonA])).rows;
  assert.equal(clients.length, 1);
  assert.equal(clients[0].email, 'awa@example.com');

  // Même numéro, format différent, sans e-mail : on réutilise la fiche.
  await asAnon();
  booking2 = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, null, null, $7)', [
    salonA,
    serviceCoupe,
    inDays(3, 12),
    'Awa D.',
    '0700000002',
    key(2),
    '',
  ]);
  await asUser(ownerA);
  const linked2 = (await db.query('select client_id from public.appointments where id = $1', [booking2.id]))
    .rows[0];
  assert.equal(linked2.client_id, linked.client_id);
  const after = (
    await db.query('select count(*)::int as n from public.clients where salon_id = $1', [salonA])
  ).rows[0];
  assert.equal(after.n, 1);

  // Un passage avec téléphone exploitable alimente le même CRM.
  await asUser(receptionistA);
  const walkIn = (
    await db.query(
      `select * from public.register_walk_in($1, $2, $3, 'Awa Diallo', '07 00 00 00 02', null, null, null, false, '')`,
      [salonA, serviceCoupe, key(3)],
    )
  ).rows[0];
  assert.equal(walkIn.client_id, linked.client_id);
  // Un anonyme sans téléphone ne crée pas de fiche fourre-tout.
  const anonymous = (
    await db.query(`select * from public.register_walk_in($1, $2, $3)`, [salonA, serviceCoupe, key(4)])
  ).rows[0];
  assert.equal(anonymous.client_id, null);
});

test('the client portal follows and cancels a booking with only its secret token', async () => {
  await asAnon();
  const portal = await rpc('marketplace_booking_by_token($1)', [booking1.cancel_token]);
  assert.equal(portal.booking.id, booking1.id);
  assert.equal(portal.salon.name, 'Salon A');
  assert.equal(portal.salon.slug, 'salon-a');
  assert.equal(portal.can_cancel, true);
  assert.equal(portal.can_review, false);
  assert.equal(portal.review, null);
  assert.ok(portal.timeline.length >= 1);
  assert.equal(portal.salon.organization_id, undefined, 'aucune donnée interne du salon ne doit fuir');

  await expectCode(
    db.query('select public.marketplace_booking_by_token($1)', ['00000000-0000-4000-8000-000000000000']),
    '22023',
  );

  const cancelled = await rpc('marketplace_cancel_booking($1, $2, $3, $4)', [
    salonA,
    booking2.id,
    booking2.cancel_token,
    'Empêchement de dernière minute',
  ]);
  assert.equal(cancelled.status, 'cancelled');
  const portal2 = await rpc('marketplace_booking_by_token($1)', [booking2.cancel_token]);
  assert.equal(portal2.can_cancel, false);
  await expectCode(
    db.query('select public.marketplace_submit_review($1, 5, $2)', [
      booking2.cancel_token,
      'Prestation jamais réalisée',
    ]),
    '22023',
  );
});

test('a verified review can only be left once, after the service is completed', async () => {
  await asAnon();
  await expectCode(
    db.query('select public.marketplace_submit_review($1, 5, $2)', [booking1.cancel_token, 'Trop tôt']),
    '22023',
  );

  await asUser(receptionistA);
  for (const status of ['confirmed', 'checked_in', 'in_progress', 'completed']) {
    await rpc('transition_appointment($1, $2, $3)', [salonA, booking1.id, status]);
  }

  await asAdmin();
  const invites = (
    await db.query(
      `select * from public.appointment_notifications where appointment_id = $1 and kind = 'review_request'`,
      [booking1.id],
    )
  ).rows;
  assert.equal(invites.length, 2, 'invitation e-mail + WhatsApp');
  assert.equal(invites[0].payload.booking_token, booking1.cancel_token);
  assert.ok(new Date(invites[0].scheduled_at) > new Date(), 'invitation différée après la prestation');

  await asAnon();
  await expectCode(
    db.query('select public.marketplace_submit_review($1, 6, $2)', [booking1.cancel_token, 'Note invalide']),
    '22023',
  );
  const review = await rpc('marketplace_submit_review($1, $2, $3, $4)', [
    booking1.cancel_token,
    5,
    'Dégradé impeccable, service ponctuel.',
    null,
  ]);
  assert.equal(review.verified, true);
  assert.equal(review.author, 'Awa Diallo');
  await expectCode(
    db.query('select public.marketplace_submit_review($1, 4, $2)', [
      booking1.cancel_token,
      'Deuxième avis interdit',
    ]),
    '22023',
  );

  const portal = await rpc('marketplace_booking_by_token($1)', [booking1.cancel_token]);
  assert.equal(portal.can_review, false);
  assert.equal(portal.review.rating, 5);
  const detail = await rpc('marketplace_salon_detail($1)', ['salon-a']);
  assert.equal(detail.review_count, 1);
  assert.equal(detail.rating, 5);
});

test('loyalty points are earned once, only when the appointment is completed AND paid', async () => {
  await asUser(ownerA);
  const before = (
    await db.query('select count(*)::int as n from public.loyalty_transactions where appointment_id = $1', [
      booking1.id,
    ])
  ).rows[0];
  assert.equal(before.n, 0, 'pas de points sur une prestation non réglée');

  await asUser(cashierA);
  paymentId = (
    await db.query(
      `select * from public.record_payment($1, $2, 4000, 'wave', $3, 'WAVE-2026-0001', 'Coupe en ligne')`,
      [salonA, booking1.id, key(10)],
    )
  ).rows[0].id;

  // Un mobile money non encore rapproché reste « pending » : aucun point.
  await asUser(ownerA);
  const pending = (
    await db.query('select count(*)::int as n from public.loyalty_accounts where salon_id = $1', [salonA])
  ).rows[0];
  assert.equal(pending.n, 0, 'un paiement en attente de rapprochement ne crédite rien');
  await rpc('confirm_pending_payment($1, $2, $3, $4)', [
    salonA,
    paymentId,
    'WAVE-2026-0001',
    'Relevé Wave vérifié en caisse',
  ]);

  const account = (await db.query('select * from public.loyalty_accounts where salon_id = $1', [salonA]))
    .rows[0];
  assert.equal(account.points_balance, 40, '4 000 XOF à 1 point / 100 XOF');
  assert.equal(account.total_earned, 40);
  assert.equal(account.tier, 'bronze');

  // Rejeu du déclencheur : aucun double crédit.
  await asAdmin();
  await db.query(`update public.appointments set status = 'completed' where id = $1`, [booking1.id]);
  await asUser(ownerA);
  const again = (
    await db.query('select points_balance from public.loyalty_accounts where salon_id = $1', [salonA])
  ).rows[0];
  assert.equal(again.points_balance, 40);
  const tx = (
    await db.query('select count(*)::int as n from public.loyalty_transactions where appointment_id = $1', [
      booking1.id,
    ])
  ).rows[0];
  assert.equal(tx.n, 1);
  await expectCode(
    db.query('update public.loyalty_transactions set points = 999 where appointment_id = $1', [booking1.id]),
    '42501',
  );

  await asAnon();
  const portal = await rpc('marketplace_booking_by_token($1)', [booking1.cancel_token]);
  assert.equal(portal.loyalty.points_earned, 40);
  assert.equal(portal.loyalty.points_balance, 40);
});

test('rewards are consumed atomically and adjustments stay traceable and permissioned', async () => {
  await asUser(ownerA);
  rewardId = (
    await db.query(
      `insert into public.rewards(salon_id, name, points_cost, category, discount_percentage)
     values ($1, 'Réduction 10%', 30, 'discount', 10) returning id`,
      [salonA],
    )
  ).rows[0].id;
  const clientId = (await db.query('select client_id from public.appointments where id = $1', [booking1.id]))
    .rows[0].client_id;

  await asUser(barberA);
  await expectCode(
    db.query('select public.redeem_loyalty_reward($1, $2, $3)', [salonA, clientId, rewardId]),
    '42501',
  );

  await asUser(ownerA);
  const redeemed = await rpc('redeem_loyalty_reward($1, $2, $3)', [salonA, clientId, rewardId]);
  assert.equal(redeemed.points_balance, 10);
  const reward = (await db.query('select times_redeemed from public.rewards where id = $1', [rewardId]))
    .rows[0];
  assert.equal(reward.times_redeemed, 1);
  await expectCode(
    db.query('select public.redeem_loyalty_reward($1, $2, $3)', [salonA, clientId, rewardId]),
    '22023',
  );

  const adjusted = await rpc('adjust_loyalty_points($1, $2, $3, $4)', [
    salonA,
    clientId,
    100,
    'Geste commercial',
  ]);
  assert.equal(adjusted.points_balance, 110);
  assert.equal(adjusted.tier, 'silver');
  await expectCode(
    db.query('select public.adjust_loyalty_points($1, $2, $3, $4)', [
      salonA,
      clientId,
      -500,
      'Solde négatif interdit',
    ]),
    '22023',
  );

  const program = (
    await db.query('select * from public.set_loyalty_program($1, $2::jsonb)', [
      salonA,
      JSON.stringify({ points_per_100_xof: 2, welcome_bonus: 20 }),
    ])
  ).rows[0];
  assert.equal(program.points_per_100_xof, 2);

  await asAnon();
  const third = await rpc('marketplace_book_appointment($1, $2, $3, $4, $5, $6, null, null, $7)', [
    salonA,
    serviceCoupe,
    inDays(4, 9),
    'Yao Kouadio',
    '0700000003',
    key(5),
    '',
  ]);
  await asUser(ownerA);
  const newClient = (await db.query('select client_id from public.appointments where id = $1', [third.id]))
    .rows[0].client_id;
  const welcome = (
    await db.query('select points_balance from public.loyalty_accounts where client_id = $1', [newClient])
  ).rows[0];
  assert.equal(welcome.points_balance, 20, 'bonus de bienvenue appliqué à la création de la fiche');
});

test('a refund takes back the points earned, without ever going negative', async () => {
  await asUser(ownerA);
  const clientId = (await db.query('select client_id from public.appointments where id = $1', [booking1.id]))
    .rows[0].client_id;
  await rpc('record_payment_correction($1, $2, $3, $4, $5, $6, $7, $8)', [
    salonA,
    paymentId,
    'refund',
    4000,
    'Client mécontent, geste intégral',
    key(11),
    'WAVE-RFND-0001',
    'Remboursement Wave intégral validé par le gérant',
  ]);
  const account = (await db.query('select * from public.loyalty_accounts where client_id = $1', [clientId]))
    .rows[0];
  assert.equal(account.points_balance, 70, '110 - 40 repris');
  const reversal = (
    await db.query(
      `select points from public.loyalty_transactions where appointment_id = $1 and kind = 'reversal'`,
      [booking1.id],
    )
  ).rows[0];
  assert.equal(reversal.points, -40);

  // Rejeu : pas de seconde reprise.
  await asAdmin();
  await db.query(`update public.appointments set payment_status = 'refunded' where id = $1`, [booking1.id]);
  await asUser(ownerA);
  const stable = (
    await db.query('select points_balance from public.loyalty_accounts where client_id = $1', [clientId])
  ).rows[0];
  assert.equal(stable.points_balance, 70);
});

test('the outbox is claimed by the sender only, and results are recorded honestly', async () => {
  await asAnon();
  await expectCode(db.query('select * from public.claim_due_notifications(10, $1)', [salonA]), '42501');
  await asUser(receptionistA);
  await expectCode(db.query('select * from public.claim_due_notifications(10, $1)', [salonA]), '42501');
  assert.equal(await rpc('can_manage_notifications($1)', [salonA]), true);
  await asUser(barberA);
  assert.equal(await rpc('can_manage_notifications($1)', [salonA]), false);

  await asAdmin();
  await db.query(`update public.appointment_notifications set scheduled_at = now() where salon_id = $1`, [
    salonA,
  ]);

  await asService();
  const batch = (await db.query('select * from public.claim_due_notifications(50, $1)', [salonA])).rows;
  assert.ok(batch.length >= 3);
  assert.ok(batch.every((n) => n.status === 'sending' && n.attempts === 1 && n.locked_at));

  const first = batch[0];
  const sent = (
    await db.query(`select * from public.mark_notification_result($1, 'sent', $2, null)`, [
      first.id,
      'provider-msg-1',
    ])
  ).rows[0];
  assert.equal(sent.status, 'sent');
  assert.ok(sent.sent_at);
  assert.equal(sent.provider_message_id, 'provider-msg-1');
  assert.equal(sent.locked_at, null);

  const skipped = (
    await db.query(
      `select * from public.mark_notification_result($1, 'skipped', null, 'provider_not_configured')`,
      [batch[1].id],
    )
  ).rows[0];
  assert.equal(skipped.status, 'skipped');
  assert.equal(skipped.error, 'provider_not_configured');
  const failed = (
    await db.query(`select * from public.mark_notification_result($1, 'failed', null, 'SMTP 550')`, [
      batch[2].id,
    ])
  ).rows[0];
  assert.equal(failed.status, 'failed');

  const second = (await db.query('select * from public.claim_due_notifications(50, $1)', [salonA])).rows;
  assert.equal(
    second.some((n) => n.id === first.id),
    false,
    'un message envoyé ne repart pas',
  );

  await asUser(receptionistA);
  const retried = (await db.query('select * from public.retry_notification($1, $2)', [salonA, failed.id]))
    .rows[0];
  assert.equal(retried.status, 'pending');
  assert.equal(retried.attempts, 0);
  assert.equal(retried.error, null);
  await expectCode(db.query('select public.retry_notification($1, $2)', [salonA, sent.id]), '22023');
  await asUser(barberA);
  await expectCode(db.query('select public.retry_notification($1, $2)', [salonA, skipped.id]), '42501');
});

test('the automatic dispatcher stays inert until an operator configures it', async () => {
  await asAdmin();
  const config = (await db.query('select count(*)::int as n from private.notification_dispatch_config'))
    .rows[0];
  assert.equal(config.n, 0, 'aucun secret ni endpoint livré dans le dépôt');
  const invoked = (await db.query('select private.invoke_notification_dispatcher() as id')).rows[0];
  assert.equal(invoked.id, null, 'sans configuration, aucune requête sortante');

  await asAnon();
  await expectCode(db.query('select private.invoke_notification_dispatcher()'), '42501');
  await expectCode(db.query('select * from private.notification_dispatch_config'), '42501');
});
