import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();

const LEGACY_UNSHIPPED_CLAIMS = [
  "Calcul automatique des commissions d'équipe",
  'Calcul automatique des commissions d’équipe',
  'Rappels SMS & WhatsApp anti-no-show',
  'Export comptable et réconciliation des caisses',
  'Mise en avant prioritaire sur la Marketplace',
  'Support technique VIP prioritaire 7j/7',
  'Multi-succursales & gestion de réseau centralisée',
  'Rapports financiers et bilans comptables consolidés',
];

test('les migrations remplacent les promesses non livrées dans saas_plans et saas_plan_drafts', async () => {
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

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const targetIdx = files.indexOf('20261111120000_saas_honest_plan_features.sql');
  assert.ok(targetIdx > 0, 'migration 20261111120000_saas_honest_plan_features.sql doit exister');

  for (let i = 0; i < targetIdx; i++) {
    await db.exec(await readFile(new URL(files[i], dir), 'utf8'));
  }

  // Simuler un brouillon antérieur contenant d'anciennes promesses non livrées
  await db.query(
    `insert into public.saas_plan_drafts (plan_id, payload)
     values (
       'pro',
       $1::jsonb
     )`,
    [
      JSON.stringify({
        name: 'Pro Équipe',
        slug: 'pro',
        price_xof: 35000,
        billing_period: 'monthly',
        description: 'Brouillon existant',
        features: [
          "Jusqu'à 5 barbiers",
          "Calcul automatique des commissions d'équipe",
          'Rappels SMS & WhatsApp anti-no-show',
        ],
      }),
    ],
  );

  // Appliquer la migration d'alignement (et toute migration éventuelle suivante)
  for (let i = targetIdx; i < files.length; i++) {
    await db.exec(await readFile(new URL(files[i], dir), 'utf8'));
  }

  const plans = (await db.query('select id, features from public.get_saas_plans() order by display_order'))
    .rows;
  assert.equal(plans.length, 3);

  for (const plan of plans) {
    for (const legacy of LEGACY_UNSHIPPED_CLAIMS) {
      assert.equal(
        plan.features.includes(legacy),
        false,
        `le forfait ${plan.id} ne doit plus contenir la promesse « ${legacy} »`,
      );
    }
  }

  const pro = plans.find((p) => p.id === 'pro');
  assert.ok(pro);
  assert.ok(
    pro.features.some(
      (f) => f.includes('taux de commission') && f.includes('calcul automatique des montants dus à venir'),
    ),
    'Pro doit préciser que seuls les taux de commission sont suivis sans calcul des montants dus',
  );
  assert.ok(
    pro.features.some((f) => f.includes('selon activation opérateur') && f.includes('SMS non disponible')),
    'Pro doit maintenir la mention explicite de dépendance opérateur et d’indisponibilité SMS',
  );

  const prestige = plans.find((p) => p.id === 'prestige');
  assert.ok(prestige);
  assert.ok(
    prestige.features.some((f) => f.includes('export comptable non disponible')),
    'Prestige doit préciser que l’export comptable n’est pas disponible',
  );
  assert.ok(
    prestige.features.some((f) => f.includes('mise en avant non automatisée')),
    'Prestige doit préciser que la mise en avant prioritaire n’est pas automatisée',
  );

  // Vérifier également la mise à jour du brouillon préexistant
  const draft = (
    await db.query(
      "select payload -> 'features' as features from public.saas_plan_drafts where plan_id = 'pro'",
    )
  ).rows[0];
  for (const legacy of LEGACY_UNSHIPPED_CLAIMS) {
    assert.equal(draft.features.includes(legacy), false);
  }
  assert.ok(draft.features.some((f) => f.includes('taux de commission')));
  assert.ok(draft.features.some((f) => f.includes('SMS non disponible')));
});

after(async () => {
  await db.close();
});
