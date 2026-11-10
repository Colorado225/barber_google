import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();

const superAdmin = '11111111-1111-4111-8111-111111111111';
const supportLead = '22222222-2222-4222-8222-222222222222';
const ownerA = '33333333-3333-4333-8333-333333333333';
const ownerB = '44444444-4444-4444-8444-444444444444';
const ownerC = '55555555-5555-4555-8555-555555555555';
const ownerD = '66666666-6666-4666-8666-666666666666';
const outsider = '77777777-7777-4777-8777-777777777777';

function abidjanDateOffset(daysOffset) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

const TODAY = abidjanDateOffset(0);
const CURRENT_FROM = `${TODAY.slice(0, 8)}01`;
const CURRENT_TO = (() => {
  const [y, m] = TODAY.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
})();
const PREV_MONTH_LAST = (() => {
  const [y, m] = TODAY.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
})();
const PREV_FROM = `${PREV_MONTH_LAST.slice(0, 8)}01`;
const PREV_TO = PREV_MONTH_LAST;
const PREV_DAY = `${PREV_MONTH_LAST.slice(0, 8)}15`;

let salonA;
let salonB;
let salonC;
let salonD;
let branchA;
let serviceA;
let staffA;
let cashSessionA;

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

test('seed migrations, salons et autorisations sur get_platform_metrics', async () => {
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
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now()), ($5, now()), ($6, now()), ($7, now())',
    [superAdmin, supportLead, ownerA, ownerB, ownerC, ownerD, outsider],
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
  const a = (await db.query("select * from public.create_salon('Org A', 'Salon A', 'Principal')")).rows[0];
  salonA = a.salon_id;
  branchA = a.branch_id;

  await asUser(ownerB, 'ownerb@example.com');
  salonB = (await db.query("select * from public.create_salon('Org B', 'Salon B', 'Principal')")).rows[0]
    .salon_id;

  await asUser(ownerC, 'ownerc@example.com');
  salonC = (await db.query("select * from public.create_salon('Org C', 'Salon C', 'Principal')")).rows[0]
    .salon_id;

  await asUser(ownerD, 'ownerd@example.com');
  salonD = (await db.query("select * from public.create_salon('Org D', 'Salon D', 'Principal')")).rows[0]
    .salon_id;

  // Autorisations : seuls les super_admin peuvent lire les métriques, et p_from <= p_to est exigé
  await asAnon();
  await expectCode(db.query('select public.get_platform_metrics()'), '42501');

  for (const uid of [outsider, ownerA, supportLead]) {
    await asUser(uid, 'nonadmin@example.com');
    await expectCode(db.query('select public.get_platform_metrics()'), '42501');
  }

  await asUser(superAdmin, 'dominiquek051@gmail.com');
  await expectCode(
    db.query('select public.get_platform_metrics($1::date, $2::date)', ['2026-11-30', '2026-11-01']),
    '22023',
  );
});

test('MRR normalisé (mensuels + annuels / 12) et séparation des revenus récurrents, encaissés et en attente SaaS', async () => {
  await asUser(superAdmin, 'dominiquek051@gmail.com');

  // Création d'un plan annuel à 120 000 XOF/an (10 000 XOF/mois) et d'un plan annuel non divisible (100 000 XOF/an)
  await db.query("select public.save_saas_plan_workflow('pro-yearly', $1::jsonb, true)", [
    JSON.stringify({
      name: 'Pro Annuel',
      slug: 'pro-yearly',
      price_xof: 120000,
      billing_period: 'yearly',
      description: 'Forfait annuel 120 000 FCFA',
      features: ['Tout Pro sur 12 mois'],
      max_staff: 5,
      max_branches: 1,
      is_popular: true,
      is_active: true,
      display_order: 4,
    }),
  ]);
  await db.query("select public.save_saas_plan_workflow('prestige-yearly', $1::jsonb, true)", [
    JSON.stringify({
      name: 'Prestige Annuel',
      slug: 'prestige-yearly',
      price_xof: 100000,
      billing_period: 'yearly',
      description: 'Forfait annuel 100 000 FCFA',
      features: ['Tout Prestige sur 12 mois'],
      max_staff: null,
      max_branches: 5,
      is_popular: false,
      is_active: true,
      display_order: 5,
    }),
  ]);

  // Salon A : forfait mensuel actif à 15 000 XOF/mois (confirmé)
  await asUser(ownerA);
  await db.query("select public.subscribe_salon_to_plan($1, 'starter')", [salonA]);
  const payA = (
    await db.query("select public.declare_saas_payment($1, 'mobile_money', 'SAAS-A-15K') as res", [salonA])
  ).rows[0].res;
  await asUser(superAdmin);
  await db.query("select public.review_saas_payment($1, 'confirm', 'Vérifié')", [payA.id]);

  // Salon B : forfait annuel actif à 120 000 XOF/an (= 10 000 XOF/mois normalisé)
  await asUser(ownerB);
  await db.query("select public.subscribe_salon_to_plan($1, 'pro-yearly')", [salonB]);
  const payB = (
    await db.query("select public.declare_saas_payment($1, 'bank_transfer', 'SAAS-B-120K') as res", [salonB])
  ).rows[0].res;
  await asUser(superAdmin);
  await db.query("select public.review_saas_payment($1, 'confirm', 'Virement annuel vérifié')", [payB.id]);

  // Salon C : souscription en attente de validation (35 000 XOF) -> hors MRR, dans saas_pending_payments_xof
  await asUser(ownerC);
  await db.query("select public.subscribe_salon_to_plan($1, 'pro')", [salonC]);
  await db.query("select public.declare_saas_payment($1, 'mobile_money', 'SAAS-C-PEND')", [salonC]);

  // Salon D : paiement rejeté (75 000 XOF) -> hors MRR et hors encaissé, dans saas_rejected_payments_xof
  await asUser(ownerD);
  await db.query("select public.subscribe_salon_to_plan($1, 'prestige')", [salonD]);
  const payD = (
    await db.query("select public.declare_saas_payment($1, 'cash', 'SAAS-D-REJ') as res", [salonD])
  ).rows[0].res;
  await asUser(superAdmin);
  await db.query("select public.review_saas_payment($1, 'reject', 'Référence non reçue')", [payD.id]);

  // Vérification : MRR normalisé = 15 000 + (120 000 / 12) = 25 000 ; Encaissé SaaS = 135 000 ; Attente = 35 000
  const m1 = (
    await db.query('select public.get_platform_metrics($1::date, $2::date) as res', [
      CURRENT_FROM,
      CURRENT_TO,
    ])
  ).rows[0].res;

  assert.equal(Number(m1.active_subscriptions), 2);
  assert.equal(Number(m1.subscriptions_by_billing_period.monthly), 1);
  assert.equal(Number(m1.subscriptions_by_billing_period.yearly), 1);
  assert.equal(Number(m1.monthly_mrr_xof), 15000);
  assert.equal(Number(m1.yearly_mrr_xof), 10000);
  assert.equal(Number(m1.estimated_mrr_xof), 25000);
  assert.equal(Number(m1.annual_run_rate_xof), 300000);

  assert.equal(Number(m1.subscriptions_by_status.active), 2);
  assert.equal(Number(m1.subscriptions_by_status.pending_payment), 1);
  assert.equal(Number(m1.subscriptions_by_status.cancelled), 1);

  assert.equal(Number(m1.saas_collected_revenue_xof), 135000);
  assert.equal(Number(m1.saas_confirmed_payments_count), 2);
  assert.equal(Number(m1.saas_pending_payments_xof), 35000);
  assert.equal(Number(m1.saas_pending_payments_count), 1);
  assert.equal(Number(m1.saas_rejected_payments_xof), 75000);
  assert.equal(Number(m1.saas_rejected_payments_count), 1);

  // Ajout d'un 2e abonnement annuel non divisible (100 000 XOF/an -> 8 333,33 XOF/mois) + un abonnement en essai (hors MRR)
  await asUser(ownerD);
  await db.query("select public.subscribe_salon_to_plan($1, 'prestige-yearly')", [salonD]);
  const payD2 = (
    await db.query("select public.declare_saas_payment($1, 'bank_transfer', 'SAAS-D-100K') as res", [salonD])
  ).rows[0].res;
  await asUser(superAdmin);
  await db.query("select public.review_saas_payment($1, 'confirm', 'Virement Prestige annuel')", [payD2.id]);

  // Insertion d'un essai gratuit ('trialing') sur Salon C : ne doit pas gonfler le MRR actif
  await asDbAdmin();
  await db.query(
    `insert into public.saas_subscriptions (
       salon_id, plan_id, status, price_at_subscription, billing_period, started_at, current_period_end
     ) values ($1, 'pro', 'trialing', 35000, 'monthly', now(), now() + interval '14 days')`,
    [salonC],
  );

  await asUser(superAdmin);
  const m2 = (await db.query('select public.get_platform_metrics() as res')).rows[0].res;
  assert.equal(Number(m2.active_subscriptions), 3);
  assert.equal(Number(m2.subscriptions_by_status.trialing), 1);
  assert.equal(Number(m2.monthly_mrr_xof), 15000);
  // 120 000 / 12 + 100 000 / 12 = 10 000 + 8 333.333... = 18 333
  assert.equal(Number(m2.yearly_mrr_xof), 18333);
  assert.equal(Number(m2.estimated_mrr_xof), 33333);
  assert.equal(Number(m2.annual_run_rate_xof), 400000); // 15000*12 + 120000 + 100000
});

test('paiements remboursés, contrepassations, en attente et rendez-vous annulés par période et statut', async () => {
  await asUser(ownerA);
  serviceA = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Coupe Signature', 'coupe', 10000, 30) returning id`,
      [salonA],
    )
  ).rows[0].id;
  staffA = (
    await db.query(
      `insert into public.staff(salon_id, name, role, branch_id, service_ids)
       values ($1, 'Issa', 'barber', $2, $3) returning id`,
      [salonA, branchA, [serviceA]],
    )
  ).rows[0].id;

  // Ouverture d'une session de caisse pour enregistrer des mouvements réels en base
  const regA = (await db.query('select public.ensure_default_register($1, $2) as id', [salonA, branchA]))
    .rows[0].id;
  cashSessionA = (
    await db.query('select public.open_cash_session($1, $2, 50000, $3, $4) as id', [
      salonA,
      branchA,
      regA,
      'Caisse journée',
    ])
  ).rows[0].id;

  // Période courante : création de 6 rendez-vous à statuts variés + 1 pending inséré
  const appts = [];
  for (let i = 0; i < 6; i++) {
    const hour = String(9 + i).padStart(2, '0');
    const row = (
      await db.query(
        `select * from public.create_appointment($1, $2, $3::timestamptz, $4, $5, $6, null, null, 'direct', '')`,
        [salonA, serviceA, `${TODAY}T${hour}:00:00Z`, `Client ${i + 1}`, `+2250700000${i}`, staffA],
      )
    ).rows[0];
    appts.push(row.id);
  }
  const [apptDone1, apptDone2, apptCancelled, apptNoShow, apptConfirmed, apptInProgress] = appts;

  // Transitions réelles des statuts
  for (const doneId of [apptDone1, apptDone2]) {
    await db.query("select public.transition_appointment($1, $2, 'checked_in', null)", [salonA, doneId]);
    await db.query("select public.transition_appointment($1, $2, 'in_progress', null)", [salonA, doneId]);
    await db.query("select public.transition_appointment($1, $2, 'completed', null)", [salonA, doneId]);
  }
  await db.query("select public.cancel_appointment($1, $2, 'Client a annulé par téléphone')", [
    salonA,
    apptCancelled,
  ]);
  await db.query("select public.transition_appointment($1, $2, 'no_show', 'Client non présenté')", [
    salonA,
    apptNoShow,
  ]);
  await db.query("select public.transition_appointment($1, $2, 'checked_in', null)", [
    salonA,
    apptInProgress,
  ]);
  await db.query("select public.transition_appointment($1, $2, 'in_progress', null)", [
    salonA,
    apptInProgress,
  ]);

  // 1 RDV en attente (pending) sur la période courante
  await asDbAdmin();
  await db.query(
    `insert into public.appointments(
       salon_id, branch_id, staff_id, service_id, client_name, client_phone,
       service_name, staff_name, starts_at, ends_at, amount, source, status, payment_status
     ) values (
       $1, $2, $3, $4, 'Client En Attente', '+22507000090',
       'Coupe Signature', 'Issa', $5::timestamptz, $6::timestamptz, 10000, 'marketplace', 'pending', 'unpaid'
     )`,
    [salonA, branchA, staffA, serviceA, `${TODAY}T16:00:00Z`, `${TODAY}T16:30:00Z`],
  );

  // Paiements période courante :
  // - 10 000 cash confirmé sur apptDone1, puis remboursement de 4 000 + refund_reversal de 500
  // - 6 000 Wave confirmé sur apptDone2, puis payment_reversal de 1 000
  // - 8 000 Wave en attente sur apptConfirmed
  // - 3 000 Orange Money rejeté (failed) sur apptInProgress
  await asUser(ownerA);
  const pCash = (
    await db.query(
      "select * from public.record_payment($1, $2, 10000, 'cash', '10000000-0000-4000-8000-000000000001', null, 'Paiement coupe')",
      [salonA, apptDone1],
    )
  ).rows[0];
  const pRefund = (
    await db.query(
      "select * from public.record_payment_correction($1, $2, 'refund', 4000, 'Geste commercial retard', '10000000-0000-4000-8000-000000000002', null, '')",
      [salonA, pCash.id],
    )
  ).rows[0];
  await db.query(
    "select * from public.record_payment_correction($1, $2, 'refund_reversal', 500, 'Correction partielle remboursement', '10000000-0000-4000-8000-000000000003', null, '')",
    [salonA, pRefund.id],
  );

  const pWavePend = (
    await db.query(
      "select * from public.record_payment($1, $2, 6000, 'wave', '10000000-0000-4000-8000-000000000004', 'WAVE-CONF-01', 'Acompte Wave')",
      [salonA, apptDone2],
    )
  ).rows[0];
  await db.query("select public.confirm_pending_payment($1, $2, 'WAVE-CONF-01', 'Vérifié sur relevé Wave')", [
    salonA,
    pWavePend.id,
  ]);
  await db.query(
    "select * from public.record_payment_correction($1, $2, 'payment_reversal', 1000, 'Erreur de saisie 1000', '10000000-0000-4000-8000-000000000005', 'WAVE-REV-01', 'Correction constatée sur relevé Wave')",
    [salonA, pWavePend.id],
  );

  await db.query(
    "select * from public.record_payment($1, $2, 8000, 'wave', '10000000-0000-4000-8000-000000000006', 'WAVE-WAIT-01', 'En attente de validation')",
    [salonA, apptConfirmed],
  );
  const pFailed = (
    await db.query(
      "select * from public.record_payment($1, $2, 3000, 'orange_money', '10000000-0000-4000-8000-000000000007', 'OM-FAIL-01', 'OM rejeté')",
      [salonA, apptInProgress],
    )
  ).rows[0];
  await db.query("select public.reject_pending_payment($1, $2, 'Transfert introuvable')", [
    salonA,
    pFailed.id,
  ]);

  // Données du mois précédent (PREV_DAY) pour prouver le filtrage temporel strict :
  // - 3 RDV completed + 1 RDV cancelled
  // - 1 paiement confirmé de 20 000 + 1 remboursement de 5 000 (= 15 000 net)
  await asDbAdmin();
  const prevDoneAppt = (
    await db.query(
      `insert into public.appointments(
         salon_id, branch_id, staff_id, service_id, client_name, client_phone,
         service_name, staff_name, starts_at, ends_at, amount, source, status, payment_status
       ) values
         ($1, $2, $3, $4, 'Ancien 1', '+22507000101', 'Coupe Signature', 'Issa', $5::timestamptz, $6::timestamptz, 20000, 'direct', 'completed', 'paid')
       returning id`,
      [salonA, branchA, staffA, serviceA, `${PREV_DAY}T09:00:00Z`, `${PREV_DAY}T09:30:00Z`],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.appointments(
       salon_id, branch_id, staff_id, service_id, client_name, client_phone,
       service_name, staff_name, starts_at, ends_at, amount, source, status, payment_status
     ) values
       ($1, $2, $3, $4, 'Ancien 2', '+22507000102', 'Coupe Signature', 'Issa', $5::timestamptz, $6::timestamptz, 10000, 'direct', 'completed', 'paid'),
       ($1, $2, $3, $4, 'Ancien 3', '+22507000103', 'Coupe Signature', 'Issa', $7::timestamptz, $8::timestamptz, 10000, 'direct', 'completed', 'paid'),
       ($1, $2, $3, $4, 'Ancien Annulé', '+22507000104', 'Coupe Signature', 'Issa', $9::timestamptz, $10::timestamptz, 10000, 'direct', 'cancelled', 'unpaid')`,
    [
      salonA,
      branchA,
      staffA,
      serviceA,
      `${PREV_DAY}T10:00:00Z`,
      `${PREV_DAY}T10:30:00Z`,
      `${PREV_DAY}T11:00:00Z`,
      `${PREV_DAY}T11:30:00Z`,
      `${PREV_DAY}T12:00:00Z`,
      `${PREV_DAY}T12:30:00Z`,
    ],
  );
  const prevPayId = (
    await db.query(
      `insert into public.payments(
         salon_id, branch_id, appointment_id, cash_session_id, kind, status, amount, currency,
         method, reason, settlement_mode, settlement_note, actor_id, settled_by, settled_at,
         idempotency_key, request_payload, created_at
       ) values (
         $1, $2, $3, $4, 'payment', 'confirmed', 20000, 'XOF',
         'cash', 'Ancien paiement', 'cash_drawer', '', $5, $5, $6::timestamptz,
         '20000000-0000-4000-8000-000000000001', '{}'::jsonb, $6::timestamptz
       ) returning id`,
      [salonA, branchA, prevDoneAppt, cashSessionA, ownerA, `${PREV_DAY}T12:00:00Z`],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.payments(
       salon_id, branch_id, appointment_id, cash_session_id, original_entry_id, kind, status, amount, currency,
       method, reason, settlement_mode, settlement_note, actor_id, settled_by, settled_at,
       idempotency_key, request_payload, created_at
     ) values (
       $1, $2, $3, $4, $5, 'refund', 'confirmed', 5000, 'XOF',
       'cash', 'Ancien remboursement', 'cash_drawer', '', $6, $6, $7::timestamptz,
       '20000000-0000-4000-8000-000000000002', '{}'::jsonb, $7::timestamptz
     )`,
    [salonA, branchA, prevDoneAppt, cashSessionA, prevPayId, ownerA, `${PREV_DAY}T13:00:00Z`],
  );

  // 1. Période courante : ne mélange ni les données du mois précédent, ni les en attente/remboursements, ni les annulés
  await asUser(superAdmin);
  const cur = (
    await db.query('select public.get_platform_metrics($1::date, $2::date) as res', [
      CURRENT_FROM,
      CURRENT_TO,
    ])
  ).rows[0].res;

  assert.equal(cur.period_from, CURRENT_FROM);
  assert.equal(cur.period_to, CURRENT_TO);

  // Paiements salons période courante :
  // Brut = 10000 + 6000 = 16000 ; Remboursements = 4000 ; Annul. paiement = 1000 ; Annul. remb = 500
  // Net = 16000 - 4000 - 1000 + 500 = 11500
  assert.equal(Number(cur.collected_gross_revenue_xof), 16000);
  assert.equal(Number(cur.refunds_xof), 4000);
  assert.equal(Number(cur.payment_reversals_xof), 1000);
  assert.equal(Number(cur.refund_reversals_xof), 500);
  assert.equal(Number(cur.collected_net_revenue_xof), 11500);
  assert.equal(Number(cur.total_revenue_xof), 11500);
  assert.equal(Number(cur.pending_payments_xof), 8000);
  assert.equal(Number(cur.pending_payments_count), 1);
  assert.equal(Number(cur.failed_payments_xof), 3000);
  assert.equal(Number(cur.failed_payments_count), 1);
  assert.equal(Number(cur.confirmed_payments_count), 2);
  assert.equal(Number(cur.refunds_count), 1);

  // Rendez-vous période courante : seuls 2 `completed` sont qualifiés de « réalisés »
  assert.equal(Number(cur.completed_appointments), 2);
  assert.equal(Number(cur.cancelled_appointments), 1);
  assert.equal(Number(cur.no_show_appointments), 1);
  assert.equal(Number(cur.total_appointments), 7);
  assert.equal(Number(cur.appointments_by_status.completed), 2);
  assert.equal(Number(cur.appointments_by_status.cancelled), 1);
  assert.equal(Number(cur.appointments_by_status.no_show), 1);
  assert.equal(Number(cur.appointments_by_status.confirmed), 1);
  assert.equal(Number(cur.appointments_by_status.pending), 1);
  assert.equal(Number(cur.appointments_by_status.in_progress), 1);
  assert.equal(Number(cur.appointments_by_status.checked_in), 0);

  // 2. Mois précédent uniquement
  const prev = (
    await db.query('select public.get_platform_metrics($1::date, $2::date) as res', [PREV_FROM, PREV_TO])
  ).rows[0].res;

  assert.equal(Number(prev.collected_gross_revenue_xof), 20000);
  assert.equal(Number(prev.refunds_xof), 5000);
  assert.equal(Number(prev.collected_net_revenue_xof), 15000);
  assert.equal(Number(prev.pending_payments_xof), 0);
  assert.equal(Number(prev.completed_appointments), 3);
  assert.equal(Number(prev.cancelled_appointments), 1);
  assert.equal(Number(prev.total_appointments), 4);
  assert.equal(Number(prev.saas_collected_revenue_xof), 0);

  // 3. Tout l'historique (p_from = null, p_to = null)
  const all = (await db.query('select public.get_platform_metrics() as res')).rows[0].res;
  assert.equal(all.period_from, null);
  assert.equal(all.period_to, null);
  assert.equal(Number(all.collected_gross_revenue_xof), 36000);
  assert.equal(Number(all.refunds_xof), 9000);
  assert.equal(Number(all.collected_net_revenue_xof), 26500);
  assert.equal(Number(all.pending_payments_xof), 8000);
  assert.equal(Number(all.completed_appointments), 5);
  assert.equal(Number(all.cancelled_appointments), 2);
  assert.equal(Number(all.total_appointments), 11);

  // 4. Cohérence avec admin_list_salons (compteurs par salon)
  const salonsAdmin = (await db.query('select public.admin_list_salons() as res')).rows[0].res;
  const adminSalonA = salonsAdmin.find((s) => s.id === salonA);
  assert.equal(Number(adminSalonA.appointments_completed_count), 5);
  assert.equal(Number(adminSalonA.appointments_cancelled_count), 2);
  assert.equal(Number(adminSalonA.appointments_count), 11);
  assert.equal(Number(adminSalonA.collected_gross_xof), 36000);
  assert.equal(Number(adminSalonA.refunds_xof), 9000);
  assert.equal(Number(adminSalonA.revenue_xof), 26500);
  assert.equal(Number(adminSalonA.pending_payments_xof), 8000);
});

after(async () => {
  await db.close();
});
