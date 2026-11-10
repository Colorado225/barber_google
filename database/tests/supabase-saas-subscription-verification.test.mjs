import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Lot 1 (P0) : une souscription ne s'active jamais sans paiement validé par un super administrateur,
// le montant est fixé côté serveur, la période annuelle dure 12 mois, les quotas sont appliqués
// par la base et chaque décision SuperAdmin laisse une trace d'audit.

const db = new PGlite();
const superAdmin = '11111111-1111-4111-8111-111111111111';
const ownerA = '22222222-2222-4222-8222-222222222222';
const intruder = '33333333-3333-4333-8333-333333333333';
let salonA;

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

async function expectRejection(promise, pattern) {
  await assert.rejects(promise, pattern);
}

test('Cycle de vie des abonnements : validation SuperAdmin, audit, annualité, quotas, droits', async () => {
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
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now())',
    [superAdmin, ownerA, intruder],
  );

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }
  await db.query("insert into public.platform_admins (user_id, role) values ($1, 'super_admin')", [
    superAdmin,
  ]);

  await asUser(ownerA);
  salonA = (await db.query("select * from public.create_salon('Org A', 'Salon A', 'Principal')")).rows[0]
    .salon_id;

  // 1. Seul le propriétaire peut souscrire ; un tiers est refusé.
  await asUser(intruder);
  await expectRejection(
    db.query("select public.subscribe_salon_to_plan($1, 'starter')", [salonA]),
    /Seul le propriétaire/,
  );

  // 2. Le propriétaire souscrit : demande en attente, rien d'actif.
  await asUser(ownerA);
  const pending = (await db.query("select public.subscribe_salon_to_plan($1, 'starter') as res", [salonA]))
    .rows[0].res;
  assert.equal(pending.status, 'pending_payment');
  assert.equal(Number(pending.price_at_subscription), 15000);
  assert.equal(
    (await db.query('select public.get_salon_subscription($1) as res', [salonA])).rows[0].res,
    null,
  );

  const awaiting = (await db.query('select public.get_pending_salon_subscription($1) as res', [salonA]))
    .rows[0].res;
  assert.equal(awaiting.id, pending.id);
  assert.equal(awaiting.payment, null);

  // 3. Déclaration de paiement : le montant est celui du serveur, un second envoi est refusé.
  await expectRejection(
    db.query("select public.declare_saas_payment($1, 'mobile_money', '  ')", [salonA]),
    /référence de paiement est obligatoire/,
  );
  const declared = (
    await db.query("select public.declare_saas_payment($1, 'mobile_money', 'MM-REF-001') as res", [salonA])
  ).rows[0].res;
  assert.equal(Number(declared.amount_xof), 15000);
  assert.equal(declared.status, 'pending');
  await expectRejection(
    db.query("select public.declare_saas_payment($1, 'mobile_money', 'MM-REF-002')", [salonA]),
    /déjà en attente/,
  );

  // 4. Un propriétaire ne voit pas la file de validation et ne peut pas décider.
  await expectRejection(db.query('select public.list_saas_payments_for_review()'), /super administrateur/);
  await expectRejection(
    db.query("select public.review_saas_payment($1, 'confirm', null)", [declared.id]),
    /super administrateur/,
  );
  const ownerView = (await db.query('select count(*)::int as n from public.platform_audit_logs')).rows[0].n;
  assert.equal(ownerView, 0, 'Le journal d’audit reste invisible au propriétaire');

  // 5. SuperAdmin : rejet sans motif refusé, rejet avec motif accepté et tracé.
  await asUser(superAdmin);
  await expectRejection(
    db.query("select public.review_saas_payment($1, 'reject', ' ')", [declared.id]),
    /motif du rejet est obligatoire/,
  );
  const queue = (await db.query('select public.list_saas_payments_for_review() as res')).rows[0].res;
  assert.equal(queue.length, 1);
  assert.equal(queue[0].salon_name, 'Salon A');
  assert.equal(Number(queue[0].amount_xof), 15000);

  const rejected = (
    await db.query("select public.review_saas_payment($1, 'reject', 'Référence introuvable') as res", [
      declared.id,
    ])
  ).rows[0].res;
  assert.equal(rejected.decision, 'rejected');
  await expectRejection(
    db.query("select public.review_saas_payment($1, 'confirm', null)", [declared.id]),
    /déjà été traité/,
  );
  await asUser(ownerA);
  const afterReject = (await db.query('select public.get_pending_salon_subscription($1) as res', [salonA]))
    .rows[0].res;
  assert.equal(afterReject, null, 'Le rejet annule la demande en attente');

  // 6. Nouvelle demande annuelle, validée : période de 12 mois (et non 30 jours).
  // Le catalogue (géré par le SuperAdmin) passe le forfait Pro en facturation annuelle.
  await db.exec('reset role');
  await db.query("update public.saas_plans set billing_period = 'yearly' where id = 'pro'");
  await asUser(ownerA);
  const yearlyPending = (await db.query("select public.subscribe_salon_to_plan($1, 'pro') as res", [salonA]))
    .rows[0].res;
  assert.equal(yearlyPending.status, 'pending_payment');
  assert.equal(yearlyPending.billing_period, 'yearly');

  const yearlyPayment = (
    await db.query("select public.declare_saas_payment($1, 'bank_transfer', 'VIR-PRO-2026') as res", [salonA])
  ).rows[0].res;
  await asUser(superAdmin);
  await db.query("select public.review_saas_payment($1, 'confirm', null)", [yearlyPayment.id]);

  await asUser(ownerA);
  const active = (await db.query('select public.get_salon_subscription($1) as res', [salonA])).rows[0].res;
  assert.equal(active.plan_id, 'pro');
  assert.equal(active.status, 'active');
  assert.equal(Number(active.price_at_subscription), 35000);
  const days = (new Date(active.current_period_end) - new Date(active.started_at)) / 86400000;
  assert.ok(days > 360 && days < 370, `Période annuelle attendue ~365 jours, obtenu ${days.toFixed(1)}`);

  // 7. Journal d'audit : les deux décisions sont tracées.
  await asUser(superAdmin);
  const audit = (
    await db.query(
      "select action from public.platform_audit_logs where target_type = 'saas_subscription_payment' order by created_at",
    )
  ).rows.map((r) => r.action);
  assert.deepEqual(audit, ['saas_payment.rejected', 'saas_payment.confirmed']);

  // 8. Une seule souscription active par salon (invariant d'index).
  const liveCount = (
    await db.query(
      "select count(*)::int as n from public.saas_subscriptions where salon_id = $1 and status = 'active'",
      [salonA],
    )
  ).rows[0].n;
  assert.equal(liveCount, 1);

  // 9. Quotas serveur selon le forfait actif. Le plafond du forfait est abaissé à 1 pour le test,
  // puis rétabli. Les insertions se font hors RLS : le déclencheur doit tout de même s'appliquer.
  const quota = (await db.query("select max_staff, max_branches from public.saas_plans where id = 'pro'"))
    .rows[0];
  await db.exec('reset role');
  await db.query("update public.saas_plans set max_staff = 1, max_branches = 1 where id = 'pro'");
  await db.query("insert into public.staff (salon_id, name, role) values ($1, 'Barbier 1', 'barber')", [
    salonA,
  ]);
  await expectRejection(
    db.query("insert into public.staff (salon_id, name, role) values ($1, 'Barbier en trop', 'barber')", [
      salonA,
    ]),
    /Quota de personnel atteint/,
  );
  // Un membre inactif ne consomme pas de place.
  await db.query(
    "insert into public.staff (salon_id, name, role, is_active) values ($1, 'Archivé', 'barber', false)",
    [salonA],
  );
  await expectRejection(
    db.query("insert into public.branches (salon_id, name) values ($1, 'Annexe')", [salonA]),
    /Quota d.établissements atteint/,
  );
  await db.query("update public.saas_plans set max_staff = $1, max_branches = $2 where id = 'pro'", [
    quota.max_staff,
    quota.max_branches,
  ]);

  // 10. Permissions : anon ne peut ni souscrire, ni lire l'abonnement, ni modifier un forfait.
  await asAnon();
  await expectRejection(
    db.query("select public.subscribe_salon_to_plan($1, 'starter')", [salonA]),
    /permission denied/,
  );
  await expectRejection(db.query('select public.get_salon_subscription($1)', [salonA]), /permission denied/);
  await expectRejection(
    db.query("select public.save_saas_plan('x','x','x',1,'monthly','', '[]'::jsonb)"),
    /permission denied/,
  );

  // 11. Tarification annuelle choisie à la souscription (-15 % côté serveur, paiement et durée 12 mois).
  // Quand `pro` est encore en facturation annuelle native ('yearly'), la demande mensuelle est rejetée
  // et une demande annuelle ne double-multiplie ni ne double-remise le tarif.
  await asUser(ownerA);
  await expectRejection(
    db.query("select public.subscribe_salon_to_plan($1, 'pro', 'monthly')", [salonA]),
    /uniquement disponible en facturation annuelle/,
  );
  const nativeYearlySub = (
    await db.query("select public.subscribe_salon_to_plan($1, 'pro', 'yearly') as res", [salonA])
  ).rows[0].res;
  assert.equal(nativeYearlySub.billing_period, 'yearly');
  assert.equal(Number(nativeYearlySub.price_at_subscription), 35000);

  // Rétablissement du forfait `pro` mensuel à 35 000 FCFA, puis souscription annuelle explicite (-15 % -> 357 000 FCFA).
  await db.exec('reset role');
  await db.query("update public.saas_plans set billing_period = 'monthly' where id = 'pro'");

  await asUser(ownerA);
  await expectRejection(
    db.query("select public.subscribe_salon_to_plan($1, 'pro', 'weekly')", [salonA]),
    /Période de facturation invalide/,
  );

  const annualProPending = (
    await db.query("select public.subscribe_salon_to_plan($1, 'pro', 'yearly') as res", [salonA])
  ).rows[0].res;
  assert.equal(annualProPending.status, 'pending_payment');
  assert.equal(annualProPending.billing_period, 'yearly');
  assert.equal(Number(annualProPending.price_at_subscription), 357000);

  const annualPayment = (
    await db.query("select public.declare_saas_payment($1, 'mobile_money', 'MM-PRO-YEARLY-1') as res", [
      salonA,
    ])
  ).rows[0].res;
  assert.equal(Number(annualPayment.amount_xof), 357000);

  await asUser(superAdmin);
  const reviewQueue = (await db.query('select public.list_saas_payments_for_review() as res')).rows[0].res;
  const queuedItem = reviewQueue.find((row) => row.id === annualPayment.id);
  assert.ok(queuedItem, 'Le paiement annuel doit figurer dans la file SuperAdmin');
  assert.equal(queuedItem.billing_period, 'yearly');
  assert.equal(Number(queuedItem.amount_xof), 357000);

  await db.query("select public.review_saas_payment($1, 'confirm', null)", [annualPayment.id]);

  await asUser(ownerA);
  const activeAnnual = (await db.query('select public.get_salon_subscription($1) as res', [salonA])).rows[0]
    .res;
  assert.equal(activeAnnual.plan_id, 'pro');
  assert.equal(activeAnnual.status, 'active');
  assert.equal(activeAnnual.billing_period, 'yearly');
  assert.equal(Number(activeAnnual.price_at_subscription), 357000);
  const annualDays =
    (new Date(activeAnnual.current_period_end) - new Date(activeAnnual.started_at)) / 86400000;
  assert.ok(
    annualDays > 360 && annualDays < 370,
    `Période annuelle attendue ~365 jours, obtenu ${annualDays.toFixed(1)}`,
  );

  await asUser(superAdmin);
  const platformMetrics = (await db.query('select public.get_platform_metrics() as res')).rows[0].res;
  assert.equal(Number(platformMetrics.subscriptions_by_billing_period.yearly), 1);
  assert.equal(Number(platformMetrics.yearly_mrr_xof), 29750);
  assert.equal(Number(platformMetrics.annual_run_rate_xof), 357000);
});

after(async () => {
  await db.close();
});
