import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const superAdmin = '11111111-1111-4111-8111-111111111111';
const supportLead = '22222222-2222-4222-8222-222222222222';
const ownerA = '33333333-3333-4333-8333-333333333333';
const managerA = '44444444-4444-4444-8444-444444444444';
const ownerB = '55555555-5555-4555-8555-555555555555';
const outsider = '66666666-6666-4666-8666-666666666666';

const BOOK_DATE = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const BOOK_WEEKDAY = new Date(`${BOOK_DATE}T00:00:00Z`).getUTCDay();
const STARTS = `${BOOK_DATE}T09:00:00Z`;

let salonA;
let salonB;
let branchA;
let serviceCoupeA;
let staffA;
let reviewId;

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

async function asDbAdmin() {
  await db.exec('reset role');
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

test('seed : migrations complètes et création de deux salons, staff, prestations et avis vérifié', async () => {
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
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now()), ($5, now()), ($6, now())',
    [superAdmin, supportLead, ownerA, managerA, ownerB, outsider],
  );

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  await db.query(
    "insert into public.platform_admins (user_id, role) values ($1, 'super_admin'), ($2, 'support_lead')",
    [superAdmin, supportLead],
  );

  await asUser(ownerA, 'ownera@example.com');
  const a = (await db.query("select * from public.create_salon('Org Alpha', 'Salon Alpha', 'Principal')"))
    .rows[0];
  salonA = a.salon_id;
  branchA = a.branch_id;

  await asUser(ownerB, 'ownerb@example.com');
  const b = (await db.query("select * from public.create_salon('Org Beta', 'Salon Beta', 'Principal')"))
    .rows[0];
  salonB = b.salon_id;

  await asDbAdmin();
  await db.query("insert into public.memberships(salon_id, user_id, role) values ($1, $2, 'manager')", [
    salonA,
    managerA,
  ]);

  await asUser(ownerA, 'ownera@example.com');
  await db.query('select public.update_salon_profile($1, $2::jsonb)', [
    salonA,
    JSON.stringify({
      slug: 'salon-alpha',
      commune: 'Cocody',
      city: 'Abidjan',
      address: 'Rue des Jardins',
      phone: '+22507000001',
      email: 'alpha@example.com',
      cover_url: 'https://example.com/alpha-cover.jpg',
    }),
  ]);

  serviceCoupeA = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Coupe Prestige', 'coupe', 5000, 30) returning id`,
      [salonA],
    )
  ).rows[0].id;
  staffA = (
    await db.query(
      `insert into public.staff(salon_id, name, role, branch_id, service_ids)
       values ($1, 'Kouassi', 'barber', $2, $3) returning id`,
      [salonA, branchA, [serviceCoupeA]],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
     values ($1, $2, $3, true, '08:00', '20:00')`,
    [salonA, branchA, BOOK_WEEKDAY],
  );
  await db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [
    salonA,
    JSON.stringify({ layout: 'classic', accentColor: '#C9A45C', visibleStaffIds: [staffA] }),
  ]);

  // Avis vérifié créé via un rendez-vous terminé
  await asDbAdmin();
  const apptId = (
    await db.query(
      `insert into public.appointments(
         salon_id, branch_id, staff_id, service_id, client_name, client_phone,
         service_name, staff_name, starts_at, ends_at, amount, source, status, payment_status
       ) values (
         $1, $2, $3, $4, 'Client Vérifié', '+22507000099',
         'Coupe Prestige', 'Kouassi', now() - interval '2 hours', now() - interval '1 hour', 5000,
         'direct', 'completed', 'paid'
       ) returning id`,
      [salonA, branchA, staffA, serviceCoupeA],
    )
  ).rows[0].id;

  await asUser(ownerA, 'ownera@example.com');
  reviewId = (
    await db.query(
      "select id from public.create_review($1, 'Client Vérifié', 5, 'Service impeccable !', $2)",
      [salonA, apptId],
    )
  ).rows[0].id;

  assert.ok(salonA && salonB && reviewId);
});

test('autorisation : anon, tiers, propriétaire, manager et support_lead bloqués sur toutes les RPC SuperAdmin et l’audit', async () => {
  await asAnon();
  await expectCode(db.query('select public.admin_list_salons()'), '42501');
  await expectCode(
    db.query("select public.admin_set_salon_publication($1, true, 'Motif')", [salonA]),
    '42501',
  );
  await expectCode(
    db.query("select public.admin_set_salon_verification($1, true, 'Motif')", [salonA]),
    '42501',
  );
  await expectCode(
    db.query("select public.admin_set_salon_status($1, 'suspended', 'Motif')", [salonA]),
    '42501',
  );
  await expectCode(
    db.query("select public.admin_update_salon_details($1, '{}'::jsonb, 'Motif')", [salonA]),
    '42501',
  );
  await expectCode(db.query('select public.admin_list_reviews()'), '42501');
  await expectCode(db.query("select public.admin_moderate_review($1, 'hide', 'Motif')", [reviewId]), '42501');
  await expectCode(db.query('select public.admin_list_audit_logs()'), '42501');
  await expectCode(db.query('select * from public.platform_audit_logs'), '42501');

  for (const unauthorized of [outsider, ownerA, managerA, supportLead]) {
    await asUser(unauthorized, 'unauthorized@example.com');
    await expectCode(db.query('select public.admin_list_salons()'), '42501');
    await expectCode(
      db.query("select public.admin_set_salon_publication($1, true, 'Motif')", [salonA]),
      '42501',
    );
    await expectCode(
      db.query("select public.admin_set_salon_verification($1, true, 'Motif')", [salonA]),
      '42501',
    );
    await expectCode(
      db.query("select public.admin_set_salon_status($1, 'suspended', 'Motif')", [salonA]),
      '42501',
    );
    await expectCode(
      db.query("select public.admin_update_salon_details($1, '{}'::jsonb, 'Motif')", [salonA]),
      '42501',
    );
    await expectCode(db.query('select public.admin_list_reviews()'), '42501');
    await expectCode(
      db.query("select public.admin_moderate_review($1, 'hide', 'Motif')", [reviewId]),
      '42501',
    );
    await expectCode(db.query('select public.admin_list_audit_logs()'), '42501');

    const auditRows = (await db.query('select id from public.platform_audit_logs')).rows;
    assert.equal(auditRows.length, 0, 'RLS doit masquer platform_audit_logs aux non-superadmins');
  }
});

test('motif obligatoire : aucune mutation admin ne réussit sans motif valide (>= 3 caractères)', async () => {
  await asUser(superAdmin, 'dominiquek051@gmail.com');

  await expectCode(db.query("select public.admin_set_salon_publication($1, true, '  ')", [salonA]), '22023');
  await expectCode(db.query("select public.admin_set_salon_verification($1, true, 'ab')", [salonA]), '22023');
  await expectCode(db.query("select public.admin_set_salon_status($1, 'suspended', '')", [salonA]), '22023');
  await expectCode(
    db.query("select public.admin_update_salon_details($1, '{}'::jsonb, null)", [salonA]),
    '22023',
  );
  await expectCode(db.query("select public.admin_moderate_review($1, 'hide', 'x')", [reviewId]), '22023');
});

test('publication & certification : persistées côté serveur, reflétées sur la marketplace et auditées', async () => {
  await asUser(superAdmin, 'dominiquek051@gmail.com');

  const initialList = (await db.query('select public.admin_list_salons() as res')).rows[0].res;
  assert.equal(initialList.length, 2, 'La console admin voit tous les salons (même non publiés)');

  // Publication de Salon Alpha
  const pubRes = (
    await db.query("select public.admin_set_salon_publication($1, true, 'Dossier complet validé') as res", [
      salonA,
    ])
  ).rows[0].res;
  assert.equal(pubRes.is_published, true);
  assert.equal(pubRes.status, 'active');

  // Certification de Salon Alpha
  const certRes = (
    await db.query("select public.admin_set_salon_verification($1, true, 'Audit qualité réussi') as res", [
      salonA,
    ])
  ).rows[0].res;
  assert.equal(certRes.is_verified, true);
  assert.ok(certRes.verified_at);

  // Visible côté anonyme avec badge certifié
  await asAnon();
  const publicList = (
    await db.query('select public.marketplace_list_salons(null, null, null, null, 50) as res')
  ).rows[0].res;
  assert.equal(publicList.length, 1);
  assert.equal(publicList[0].id, salonA);
  assert.equal(publicList[0].is_verified, true);

  const detail = (await db.query("select public.marketplace_salon_detail('salon-alpha') as res")).rows[0].res;
  assert.equal(detail.salon.is_verified, true);
  assert.equal(Number(detail.review_count), 1);
  assert.equal(Number(detail.rating), 5);
});

test('suspension & réactivation : coupe immédiatement marketplace, créneaux, réservations et republication propriétaire', async () => {
  await asUser(superAdmin, 'dominiquek051@gmail.com');
  const suspended = (
    await db.query(
      "select public.admin_set_salon_status($1, 'suspended', 'Impayé critique 60 jours') as res",
      [salonA],
    )
  ).rows[0].res;

  assert.equal(suspended.status, 'suspended');
  assert.equal(suspended.is_published, false);
  assert.equal(suspended.suspension_reason, 'Impayé critique 60 jours');
  assert.ok(suspended.suspended_at);

  // Marketplace publique ne voit plus Salon Alpha et refuse toute disponibilité/réservation
  await asAnon();
  const publicList = (
    await db.query('select public.marketplace_list_salons(null, null, null, null, 50) as res')
  ).rows[0].res;
  assert.equal(publicList.length, 0);
  await expectCode(db.query("select public.marketplace_salon_detail('salon-alpha')"), '22023');
  await expectCode(
    db.query('select * from public.marketplace_day_availability($1, $2, $3, $4)', [
      salonA,
      BOOK_DATE,
      serviceCoupeA,
      staffA,
    ]),
    '22023',
  );
  await expectCode(
    db.query(
      "select public.marketplace_book_appointment($1, $2, $3::timestamptz, 'Client Test', '+22507010101', '77777777-7777-4777-8777-777777777777', $4)",
      [salonA, serviceCoupeA, STARTS, staffA],
    ),
    '22023',
  );

  // Le propriétaire NE PEUT PAS republier un salon suspendu (ni via set_salon_publication ni via customizer)
  await asUser(ownerA, 'ownera@example.com');
  await expectCode(db.query('select public.set_salon_publication($1, true)', [salonA]), '22023');
  await expectCode(db.query('select public.publish_marketplace_customizer($1)', [salonA]), '22023');

  // Le SuperAdmin lui-même ne peut pas publier tant que le salon est suspendu
  await asUser(superAdmin, 'dominiquek051@gmail.com');
  await expectCode(
    db.query("select public.admin_set_salon_publication($1, true, 'Tentative avant réactivation')", [salonA]),
    '22023',
  );

  // Réactivation : le salon redevient actif mais reste non publié jusqu'à republication explicite
  const reactivated = (
    await db.query("select public.admin_set_salon_status($1, 'active', 'Régularisation reçue') as res", [
      salonA,
    ])
  ).rows[0].res;
  assert.equal(reactivated.status, 'active');
  assert.equal(reactivated.is_published, false);
  assert.equal(reactivated.suspension_reason, null);

  await asAnon();
  assert.equal(
    (await db.query('select public.marketplace_list_salons(null, null, null, null, 50) as res')).rows[0].res
      .length,
    0,
  );

  // Republication après réactivation
  await asUser(superAdmin, 'dominiquek051@gmail.com');
  await db.query("select public.admin_set_salon_publication($1, true, 'Remise en ligne validée')", [salonA]);
  await asAnon();
  assert.equal(
    (await db.query('select public.marketplace_list_salons(null, null, null, null, 50) as res')).rows[0].res
      .length,
    1,
  );
});

test('détails salon & abonnements construits uniquement depuis saas_subscriptions + paiements', async () => {
  await asUser(superAdmin, 'dominiquek051@gmail.com');

  const updated = (
    await db.query('select public.admin_update_salon_details($1, $2::jsonb, $3) as res', [
      salonA,
      JSON.stringify({
        name: 'Salon Alpha Gold',
        organization_name: 'Org Alpha Holding',
        commune: 'Marcory',
        phone: '+22507999999',
        email: 'contact@alphagold.ci',
      }),
      'Mise à jour fiche commerciale',
    ])
  ).rows[0].res;
  assert.equal(updated.name, 'Salon Alpha Gold');
  assert.equal(updated.organization_name, 'Org Alpha Holding');
  assert.equal(updated.commune, 'Marcory');

  // Sans ligne dans saas_subscriptions (même si salons.subscription_plan_id était renseigné),
  // aucune donnée d'abonnement ni prix par défaut n'est fabriqué.
  await db.exec('reset role');
  await db.query("update public.salons set subscription_plan_id = 'starter' where id = $1", [salonA]);
  await asUser(superAdmin, 'dominiquek051@gmail.com');
  const beforeSub = (await db.query('select public.admin_list_salons() as res')).rows[0].res.find(
    (s) => s.id === salonA,
  );
  assert.equal(beforeSub.subscription_plan_id, null);
  assert.equal(beforeSub.subscription_plan_name, null);
  assert.equal(beforeSub.subscription_price_xof, null);
  assert.equal(beforeSub.subscription_billing_period, null);
  assert.equal(beforeSub.subscription_status, null);
  assert.equal(beforeSub.subscription_current_period_end, null);
  assert.equal(beforeSub.subscription_payment_id, null);
  await db.exec('reset role');
  await db.query('update public.salons set subscription_plan_id = null where id = $1', [salonA]);

  // Aucune RPC de contournement admin_assign_salon_subscription ne doit exister
  await asUser(superAdmin, 'dominiquek051@gmail.com');
  await expectCode(
    db.query("select public.admin_assign_salon_subscription($1, 'pro', 'Bypass')", [salonA]),
    '42883',
  );

  // Flux serveur officiel : souscription propriétaire -> déclaration paiement -> rejet -> nouvelle validation
  await asUser(ownerA, 'ownera@example.com');
  await db.query("select public.subscribe_salon_to_plan($1, 'starter')", [salonA]);
  const badPayment = (
    await db.query("select public.declare_saas_payment($1, 'cash', 'REF-BAD-01') as res", [salonA])
  ).rows[0].res;

  await asUser(superAdmin, 'dominiquek051@gmail.com');
  const whilePending = (await db.query('select public.admin_list_salons() as res')).rows[0].res.find(
    (s) => s.id === salonA,
  );
  assert.equal(whilePending.subscription_status, 'pending_payment');
  assert.equal(whilePending.subscription_plan_name, 'Starter Solo');
  assert.equal(Number(whilePending.subscription_price_xof), 15000);
  assert.equal(whilePending.subscription_current_period_end, null);
  assert.equal(whilePending.subscription_payment_status, 'pending');
  assert.equal(whilePending.subscription_payment_reference, 'REF-BAD-01');

  await db.query("select public.review_saas_payment($1, 'reject', 'Paiement non reçu')", [badPayment.id]);
  const afterReject = (await db.query('select public.admin_list_salons() as res')).rows[0].res.find(
    (s) => s.id === salonA,
  );
  assert.equal(afterReject.subscription_status, 'cancelled');
  assert.equal(afterReject.subscription_current_period_end, null);
  assert.equal(afterReject.subscription_payment_status, 'rejected');
  assert.equal(afterReject.subscription_payment_decision_reason, 'Paiement non reçu');

  // Nouvelle demande sur le forfait Pro et validation SuperAdmin
  await asUser(ownerA, 'ownera@example.com');
  await db.query("select public.subscribe_salon_to_plan($1, 'pro')", [salonA]);
  const validPayment = (
    await db.query("select public.declare_saas_payment($1, 'bank_transfer', 'VIR-PRO-2026') as res", [salonA])
  ).rows[0].res;

  await asUser(superAdmin, 'dominiquek051@gmail.com');
  await db.query("select public.review_saas_payment($1, 'confirm', 'Virement vérifié en banque')", [
    validPayment.id,
  ]);

  // Même si le tarif catalogue du forfait Pro change ensuite, la liste admin conserve
  // le tarif réel souscrit et payé (price_at_subscription = 35000).
  await db.query(
    "select public.save_saas_plan('pro', 'Pro Équipe', 'pro', 45000, 'monthly', '', '[]'::jsonb, 5, 1, true, true, 'Populaire', 2)",
  );

  const afterConfirm = (await db.query('select public.admin_list_salons() as res')).rows[0].res.find(
    (s) => s.id === salonA,
  );
  assert.equal(afterConfirm.subscription_plan_id, 'pro');
  assert.equal(afterConfirm.subscription_plan_name, 'Pro Équipe');
  assert.equal(afterConfirm.subscription_status, 'active');
  assert.equal(Number(afterConfirm.subscription_price_xof), 35000);
  assert.equal(afterConfirm.subscription_billing_period, 'monthly');
  assert.ok(afterConfirm.subscription_current_period_end);
  assert.equal(afterConfirm.subscription_payment_status, 'confirmed');
  assert.equal(Number(afterConfirm.subscription_payment_amount_xof), 35000);
  assert.equal(afterConfirm.subscription_payment_reference, 'VIR-PRO-2026');

  // Cohérence côté propriétaire et métriques plateforme
  await asUser(ownerA, 'ownera@example.com');
  const ownerSub = (await db.query('select public.get_salon_subscription($1) as res', [salonA])).rows[0].res;
  assert.equal(ownerSub.plan_id, 'pro');
  assert.equal(ownerSub.status, 'active');

  await asUser(superAdmin, 'dominiquek051@gmail.com');
  const metrics = (await db.query('select public.get_platform_metrics() as res')).rows[0].res;
  assert.equal(Number(metrics.active_subscriptions), 1);
  assert.equal(Number(metrics.estimated_mrr_xof), 35000);
});

test('modération des avis (hide, restore, delete) : impact public immédiat et journalisation complète', async () => {
  await asUser(superAdmin, 'dominiquek051@gmail.com');

  const allReviews = (await db.query('select public.admin_list_reviews() as res')).rows[0].res;
  assert.equal(allReviews.length, 1);
  assert.equal(allReviews[0].is_hidden, false);

  // Masquer l'avis
  const hidden = (
    await db.query("select public.admin_moderate_review($1, 'hide', 'Contenu signalé hors charte') as res", [
      reviewId,
    ])
  ).rows[0].res;
  assert.equal(hidden.is_hidden, true);
  assert.equal(hidden.deleted, false);

  // Côté public : 0 avis visible, note null
  await asAnon();
  const detailHidden = (await db.query("select public.marketplace_salon_detail('salon-alpha') as res"))
    .rows[0].res;
  assert.equal(Number(detailHidden.review_count), 0);
  assert.equal(detailHidden.rating, null);
  assert.deepEqual(detailHidden.reviews, []);

  // Rétablir l'avis
  await asUser(superAdmin, 'dominiquek051@gmail.com');
  const restored = (
    await db.query("select public.admin_moderate_review($1, 'restore', 'Fausse alerte levée') as res", [
      reviewId,
    ])
  ).rows[0].res;
  assert.equal(restored.is_hidden, false);

  await asAnon();
  const detailRestored = (await db.query("select public.marketplace_salon_detail('salon-alpha') as res"))
    .rows[0].res;
  assert.equal(Number(detailRestored.review_count), 1);
  assert.equal(Number(detailRestored.rating), 5);

  // Supprimer l'avis
  await asUser(superAdmin, 'dominiquek051@gmail.com');
  const deleted = (
    await db.query("select public.admin_moderate_review($1, 'delete', 'Doublon confirmé') as res", [reviewId])
  ).rows[0].res;
  assert.equal(deleted.deleted, true);
  assert.equal((await db.query('select public.admin_list_reviews() as res')).rows[0].res.length, 0);
});

test('journal d’audit serveur : acteur, rôle, e-mail, date, cible, avant/après et motif complets', async () => {
  await asUser(superAdmin, 'dominiquek051@gmail.com');
  const logs = (await db.query('select public.admin_list_audit_logs(100, null) as res')).rows[0].res;

  const actions = logs.map((l) => l.action);
  for (const expected of [
    'salon.published',
    'salon.certified',
    'salon.suspended',
    'salon.reactivated',
    'salon.updated',
    'saas_payment.rejected',
    'saas_payment.confirmed',
    'review.hidden',
    'review.restored',
    'review.deleted',
  ]) {
    assert.ok(actions.includes(expected), `action manquante dans l’audit : ${expected}`);
  }

  for (const entry of logs) {
    assert.equal(entry.actor_user_id, superAdmin);
    assert.equal(entry.actor_role, 'super_admin');
    assert.equal(entry.actor_email, 'dominiquek051@gmail.com');
    assert.ok(entry.created_at);
    assert.ok(entry.target_type);
    assert.ok(entry.target_id);
    assert.ok(entry.reason && entry.reason.length >= 3, 'chaque entrée doit porter un motif');
    assert.ok(entry.before_values, 'chaque entrée doit conserver before_values');
    assert.ok(entry.after_values, 'chaque entrée doit conserver after_values');
  }
});

after(async () => {
  await db.close();
});
