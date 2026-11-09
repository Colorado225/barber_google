import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
let salonA;
let salonB;

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

// Le propriétaire déclare le virement ; le super administrateur (ownerA dans ce scénario) le valide.
async function declareAndConfirm(ownerId, salonId, reference) {
  await asUser(ownerId);
  const payment = (
    await db.query("select public.declare_saas_payment($1, 'mobile_money', $2) as res", [salonId, reference])
  ).rows[0].res;
  await asUser(ownerA);
  const queue = (await db.query('select public.list_saas_payments_for_review() as res')).rows[0].res;
  assert.ok(
    queue.some((p) => p.id === payment.id),
    'Le paiement doit apparaître dans la file de validation',
  );
  const decision = (
    await db.query("select public.review_saas_payment($1, 'confirm', null) as res", [payment.id])
  ).rows[0].res;
  assert.equal(decision.decision, 'confirmed');
  return payment;
}

test('SaaS Pricing & Subscriptions : migration, modification des prix/avantages, et prise en compte pour souscripteurs ultérieurs', async () => {
  // 1. Initialisation Auth standard
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

  // 2. Application de toutes les migrations
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  // Compte super administrateur de la plateforme (rôle requis pour gérer les forfaits et les métriques).
  await db.query("insert into public.platform_admins (user_id, role) values ($1, 'super_admin')", [ownerA]);

  // 3. Création de deux salons
  await asUser(ownerA);
  const resA = await db.query(
    "select * from public.create_salon('Organisation A', 'Barber Palace A', 'Principal')",
  );
  salonA = resA.rows[0].salon_id;

  await asUser(ownerB);
  const resB = await db.query(
    "select * from public.create_salon('Organisation B', 'Barber Palace B', 'Principal')",
  );
  salonB = resB.rows[0].salon_id;

  // Un propriétaire de salon ordinaire ne peut ni modifier le catalogue ni lire les métriques plateforme.
  await asUser(ownerB);
  await assert.rejects(
    db.query("select public.save_saas_plan('pro', 'Pro détourné', 'pro', 1, 'monthly', '', '[]'::jsonb)"),
    /super administrateur/,
  );
  await assert.rejects(db.query('select public.get_platform_metrics()'), /super administrateur/);

  // 4. Test RPC publique get_saas_plans (accessible par un visiteur non connecté / marketplace)
  await asAnon();
  const publicPlans = (await db.query('select * from public.get_saas_plans()')).rows;
  assert.equal(publicPlans.length, 3);
  assert.equal(publicPlans[0].id, 'starter');
  assert.equal(Number(publicPlans[0].price_xof), 15000);
  assert.equal(publicPlans[1].id, 'pro');
  assert.equal(Number(publicPlans[1].price_xof), 35000);

  // 5. Salon A souscrit au plan Starter à 15 000 FCFA
  await asUser(ownerA);
  const subA = (await db.query('select public.subscribe_salon_to_plan($1, $2) as res', [salonA, 'starter']))
    .rows[0].res;

  assert.equal(subA.plan_id, 'starter');
  assert.equal(Number(subA.price_at_subscription), 15000);
  // Tant que le paiement n'est pas validé, rien n'est activé
  assert.equal(subA.status, 'pending_payment');
  const beforeValidation = (await db.query('select public.get_salon_subscription($1) as res', [salonA]))
    .rows[0].res;
  assert.equal(beforeValidation, null);

  await declareAndConfirm(ownerA, salonA, 'VIR-A-0001');

  // Vérification de la lecture de l'abonnement actif du salon A
  const salonASub = (await db.query('select public.get_salon_subscription($1) as res', [salonA])).rows[0].res;
  assert.equal(salonASub.plan_id, 'starter');
  assert.equal(Number(salonASub.price_at_subscription), 15000);

  // 6. La console Super Admin modifie le prix et les avantages du plan Starter
  // Nouveau prix : 18 500 FCFA, nouveaux avantages ajoutés
  const newFeatures = JSON.stringify([
    '1 barbier / 1 fauteuil',
    'Planning et réservations illimités',
    'Caisse & encaissements (Espèces + Mobile Money)',
    'Fichier clients CRM & historique',
    'Fiche de présence sur la Marketplace',
    'Lien & QR code de réservation',
    'NOUVEAU : Support WhatsApp réactif 6j/7',
  ]);

  const updatedPlan = (
    await db.query(
      `select public.save_saas_plan(
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13
      ) as res`,
      [
        'starter',
        'Starter Solo Plus',
        'starter',
        18500,
        'monthly',
        'Idéal pour barbier solo ou débutant avec assistance WhatsApp.',
        newFeatures,
        1,
        1,
        false,
        true,
        'Nouveau Tarif',
        1,
      ],
    )
  ).rows[0].res;

  assert.equal(Number(updatedPlan.price_xof), 18500);
  assert.equal(updatedPlan.name, 'Starter Solo Plus');

  // 7. Vérification que la Marketplace voit immédiatement le nouveau prix (18 500 FCFA)
  await asAnon();
  const refreshedPublicPlans = (await db.query('select * from public.get_saas_plans()')).rows;
  const starterPublic = refreshedPublicPlans.find((p) => p.id === 'starter');
  assert.equal(Number(starterPublic.price_xof), 18500);
  assert.equal(starterPublic.name, 'Starter Solo Plus');
  assert.equal(starterPublic.features.length, 7);

  // 8. L'abonné historique (Salon A) CONSERVE son tarif souscrit (15 000 FCFA)
  await asUser(ownerA);
  const salonASubAfter = (await db.query('select public.get_salon_subscription($1) as res', [salonA])).rows[0]
    .res;
  assert.equal(Number(salonASubAfter.price_at_subscription), 15000);
  // Mais son objet plan indique bien le tarif public actuel du catalogue
  assert.equal(Number(salonASubAfter.plan.current_price_xof), 18500);

  // 9. Le souscripteur ultérieur (Salon B) souscrit au plan Starter et obtient le NOUVEAU prix (18 500 FCFA)
  await asUser(ownerB);
  const subB = (await db.query('select public.subscribe_salon_to_plan($1, $2) as res', [salonB, 'starter']))
    .rows[0].res;
  assert.equal(subB.plan_id, 'starter');
  assert.equal(Number(subB.price_at_subscription), 18500);
  assert.equal(subB.features_snapshot.length, 7);
  assert.equal(subB.status, 'pending_payment');
  await declareAndConfirm(ownerB, salonB, 'VIR-B-0002');

  // 10. Métriques Super Admin (lues par le compte super administrateur)
  await asUser(ownerA);
  const metrics = (await db.query('select public.get_platform_metrics() as res')).rows[0].res;
  assert.equal(Number(metrics.total_salons), 2);
  assert.equal(Number(metrics.active_subscriptions), 2);
  // MRR calculé = 15 000 (A) + 18 500 (B) = 33 500 FCFA
  assert.equal(Number(metrics.estimated_mrr_xof), 33500);
});

after(async () => {
  await db.close();
});
