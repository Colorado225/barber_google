import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Console SuperAdmin : vue d'ensemble, fiche 360, actions d'abonnement, journal filtrable.

const db = new PGlite();
const superAdmin = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const CLIENT_PHONE = '+225 07 11 22 33 44';
const CLIENT_NAME = 'Client Confidentiel Test';
let salonId;

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

async function one(sql, params = []) {
  return (await db.query(sql, params)).rows[0];
}

test('console SuperAdmin : contrôle d’accès, agrégats, fiche 360, actions d’abonnement et journal', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query(
    'insert into auth.users(id, email, email_confirmed_at) values ($1, $2, now()), ($3, $4, now())',
    [superAdmin, 'dominiquek051@gmail.com', owner, 'owner@example.com'],
  );

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }
  await db.query("insert into public.platform_admins (user_id, role) values ($1, 'super_admin')", [
    superAdmin,
  ]);

  // Salon du propriétaire, publié, avec personnel, client, rendez-vous et paiements.
  await asUser(owner);
  salonId = (await one("select * from public.create_salon('Org Console', 'Salon Console', 'Principal') "))
    .salon_id;
  await db.exec('reset role');
  await db.query('update public.salons set is_published = true, is_verified = true where id = $1', [salonId]);
  const branchId = (await one('select id from public.branches where salon_id = $1 limit 1', [salonId])).id;
  await db.query(
    `insert into public.staff (salon_id, branch_id, name, role, is_active) values ($1, $2, 'Coiffeur Test', 'barber', true)`,
    [salonId, branchId],
  );
  const clientId = (
    await one(`insert into public.clients (salon_id, name, phone) values ($1, $2, $3) returning id`, [
      salonId,
      CLIENT_NAME,
      CLIENT_PHONE,
    ])
  ).id;
  await db.query(
    `insert into public.services (salon_id, name, category, price, duration_minutes) values ($1, 'Coupe', 'coupe', 5000, 30)`,
    [salonId],
  );
  const apptId = (
    await one(
      `insert into public.appointments (salon_id, branch_id, client_id, client_name, client_phone, service_name,
         amount, starts_at, ends_at, status, source)
       values ($1, $2, $3, $4, $5, 'Coupe', 10000, now() - interval '2 days', now() - interval '2 days' + interval '30 minutes',
         'completed', 'direct') returning id`,
      [salonId, branchId, clientId, CLIENT_NAME, CLIENT_PHONE],
    )
  ).id;
  await db.query(
    `insert into public.payments (salon_id, branch_id, appointment_id, kind, status, amount, method, provider_reference,
       settlement_mode, settled_by, settled_at, settlement_note, idempotency_key, request_payload)
     values ($1, $2, $3, 'payment', 'confirmed', 10000, 'wave', 'WV-1', 'manual_confirmed', $4, now(), 'Confirmé par test',
       gen_random_uuid(), '{}'::jsonb)`,
    [salonId, branchId, apptId, owner],
  );
  const paymentId = (await one('select id from public.payments where salon_id = $1', [salonId])).id;
  await db.query(
    `insert into public.payments (salon_id, branch_id, appointment_id, kind, status, amount, method, provider_reference,
       settlement_mode, settled_by, settled_at, settlement_note, idempotency_key, request_payload, original_entry_id, reason)
     values ($1, $2, $3, 'refund', 'confirmed', 3000, 'wave', 'WV-2', 'manual_confirmed', $5, now(), 'Confirmé par test',
       gen_random_uuid(), '{}'::jsonb, $4, 'Retour client')`,
    [salonId, branchId, apptId, paymentId, owner],
  );

  // 1. Contrôle d'accès : propriétaire et anonyme refusés sur toutes les nouvelles fonctions.
  await asUser(owner);
  await assert.rejects(db.query('select public.platform_dashboard_overview()'), /super administrateur/);
  await assert.rejects(
    db.query('select public.platform_get_salon_360($1)', [salonId]),
    /super administrateur/,
  );
  await assert.rejects(db.query('select public.platform_audit_actions()'), /super administrateur/);
  await assert.rejects(
    db.query("select public.platform_cancel_salon_subscription($1, 'Motif valide')", [salonId]),
    /super administrateur/,
  );
  await assert.rejects(
    db.query("select public.platform_extend_salon_subscription($1, 5, 'Motif valide')", [salonId]),
    /super administrateur/,
  );
  await asAnon();
  await assert.rejects(db.query('select public.platform_dashboard_overview()'), /permission denied/);

  // 2. Abonnement : Pro mensuel (35 000 XOF).
  await asUser(superAdmin);
  await db.query("select public.platform_assign_salon_plan($1, 'pro', 'Virement confirmé')", [salonId]);

  // 3. Vue d'ensemble : MRR mensuel, revenu net (remboursement déduit), compteurs réels.
  let overview = (await one('select public.platform_dashboard_overview() as r')).r;
  assert.equal(overview.salons.total, 1);
  assert.equal(overview.salons.published, 1);
  assert.equal(overview.subscriptions.active, 1);
  assert.equal(overview.subscriptions.mrr_xof, 35000, 'Abonnement mensuel : MRR = prix');
  assert.equal(overview.activity_30d.net_revenue_xof, 7000, 'Revenu net = 10 000 − 3 000 de remboursement');
  assert.equal(overview.activity_30d.appointments, 1);
  assert.equal(overview.activity_30d.appointments_completed, 1);
  assert.equal(overview.quota_overages, 0);

  // 4. Métriques existantes corrigées : même MRR et revenu net.
  const metrics = (await one('select public.get_platform_metrics() as r')).r;
  assert.equal(metrics.estimated_mrr_xof, 35000);
  assert.equal(metrics.total_revenue_xof, 7000);

  // 5. MRR d'un abonnement annuel : prix divisé par 12 (arrondi entier).
  await db.exec('reset role');
  await db.query(
    "update public.saas_subscriptions set billing_period = 'yearly' where salon_id = $1 and status = 'active'",
    [salonId],
  );
  await asUser(superAdmin);
  overview = (await one('select public.platform_dashboard_overview() as r')).r;
  assert.equal(overview.subscriptions.mrr_xof, 2917, '35 000 / 12 arrondi à l’entier');
  await db.exec('reset role');
  await db.query(
    "update public.saas_subscriptions set billing_period = 'monthly' where salon_id = $1 and status = 'active'",
    [salonId],
  );
  await asUser(superAdmin);

  // 6. Fiche 360 : propriétaire, compteurs, quotas, historique, aucune donnée de client final.
  const s360 = (await one('select public.platform_get_salon_360($1) as r', [salonId])).r;
  assert.equal(s360.salon.name, 'Salon Console');
  assert.equal(s360.owners.length, 1);
  assert.equal(s360.owners[0].email, 'owner@example.com');
  assert.equal(s360.owners[0].role, 'owner');
  assert.equal(s360.counts.staff_active, 1);
  assert.equal(s360.counts.clients, 1);
  assert.equal(s360.subscription.plan_name, 'Pro Équipe');
  assert.equal(s360.subscription.max_staff, 5);
  assert.equal(s360.activity_30d.net_revenue_xof, 7000);
  assert.equal(s360.activity_30d.appointments_by_status.completed, 1);
  assert.equal(s360.subscription_history.length >= 1, true);
  assert.equal(
    s360.audit.some((a) => a.action === 'salon.published' || a.action === 'subscription.assigned_by_admin'),
    true,
  );
  const serialized360 = JSON.stringify(s360);
  assert.equal(
    serialized360.includes(CLIENT_PHONE),
    false,
    'Le téléphone d’un client final ne doit jamais sortir',
  );
  assert.equal(serialized360.includes(CLIENT_NAME), false, 'Le nom d’un client final ne doit jamais sortir');
  await assert.rejects(
    db.query('select public.platform_get_salon_360($1)', ['00000000-0000-4000-8000-000000000000']),
    /introuvable/,
  );

  // 7. Prolongation : bornes, motif, puis décalage exact de la fin de période.
  await db.exec('reset role'); // lectures de vérification directes (RLS contournée)
  const before = (
    await one(
      "select current_period_end as e from public.saas_subscriptions where salon_id = $1 and status = 'active'",
      [salonId],
    )
  ).e;
  await assert.rejects(
    db.query("select public.platform_extend_salon_subscription($1, 0, 'Motif valide')", [salonId]),
    /entre 1 et 90/,
  );
  await assert.rejects(
    db.query("select public.platform_extend_salon_subscription($1, 91, 'Motif valide')", [salonId]),
    /entre 1 et 90/,
  );
  await assert.rejects(
    db.query("select public.platform_extend_salon_subscription($1, 5, ' ')", [salonId]),
    /motif/,
  );
  const ext = (
    await one("select public.platform_extend_salon_subscription($1, 15, 'Geste commercial') as r", [salonId])
  ).r;
  await db.exec('reset role');
  const after = (
    await one(
      "select current_period_end as e from public.saas_subscriptions where salon_id = $1 and status = 'active'",
      [salonId],
    )
  ).e;
  assert.equal(
    Math.round((new Date(after) - new Date(before)) / 86400000),
    15,
    'Prolongation de 15 jours exacts',
  );
  assert.ok(ext.subscription_id);

  // 8. Annulation : motif obligatoire, abonnement annulé, formule retirée du salon, données conservées.
  await assert.rejects(
    db.query('select public.platform_cancel_salon_subscription($1, $2)', [salonId, 'ab']),
    /motif/,
  );
  await db.query("select public.platform_cancel_salon_subscription($1, 'Demande du gérant')", [salonId]);
  await db.exec('reset role');
  const sub = await one(
    'select status, cancelled_at from public.saas_subscriptions where salon_id = $1 order by created_at desc limit 1',
    [salonId],
  );
  assert.equal(sub.status, 'cancelled');
  assert.notEqual(sub.cancelled_at, null);
  const salon = await one('select subscription_plan_id from public.salons where id = $1', [salonId]);
  assert.equal(salon.subscription_plan_id, null);
  await db.exec('reset role');
  const stillThere = await one('select count(*)::int as n from public.clients where salon_id = $1', [
    salonId,
  ]);
  assert.equal(stillThere.n, 1, 'Annuler un abonnement ne supprime aucune donnée du salon');
  await assert.rejects(
    db.query("select public.platform_cancel_salon_subscription($1, 'Encore une fois')", [salonId]),
    /Aucun abonnement en cours/,
  );
  await assert.rejects(
    db.query("select public.platform_extend_salon_subscription($1, 5, 'Motif valide')", [salonId]),
    /Aucun abonnement actif/,
  );

  // 9. Journal : traces des actions, filtre par action et par salon, liste des actions.
  const actions = (await one('select public.platform_audit_actions() as r')).r;
  for (const expected of [
    'subscription.extended_by_admin',
    'subscription.cancelled_by_admin',
    'subscription.assigned_by_admin',
  ]) {
    assert.ok(actions.includes(expected), `Action absente : ${expected}`);
  }
  const extended = (
    await one(
      "select public.platform_search_audit_logs('subscription.extended_by_admin', null, null, 50) as r",
    )
  ).r;
  assert.equal(extended.length, 1);
  assert.equal(extended[0].details.days, 15);
  assert.equal(extended[0].details.reason, 'Geste commercial');
  assert.equal(extended[0].actor_email, 'dominiquek051@gmail.com');
  const bySalon = (await one('select public.platform_search_audit_logs(null, $1, null, 100) as r', [salonId]))
    .r;
  assert.ok(bySalon.length >= 3, 'Le journal filtré par salon contient les décisions du salon');
  assert.ok(bySalon.every((l) => l.target_id === salonId || l.details.salon_id === salonId));
  const since = (
    await one("select public.platform_search_audit_logs(null, null, now() + interval '1 day', 100) as r")
  ).r;
  assert.equal(since.length, 0, 'Filtre par date : aucune entrée future');
  const limited = (await one('select public.platform_search_audit_logs(null, null, null, 1) as r')).r;
  assert.equal(limited.length, 1);
});

after(async () => {
  await db.close();
});
