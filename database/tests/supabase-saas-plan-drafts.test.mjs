import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const superAdmin = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';

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

function starterPayload(overrides = {}) {
  return {
    name: 'Starter Solo',
    slug: 'starter',
    price_xof: 15000,
    billing_period: 'monthly',
    description: 'Idéal pour barbier solo.',
    features: ['1 barbier / 1 fauteuil'],
    max_staff: 1,
    max_branches: 1,
    is_popular: false,
    is_active: true,
    badge_text: null,
    display_order: 1,
    ...overrides,
  };
}

async function publicPrice(planId) {
  await asAnon();
  const rows = (await db.query('select * from public.get_saas_plans()')).rows;
  return Number(rows.find((p) => p.id === planId).price_xof);
}

test('Brouillons de forfaits : droits, invisibilité publique, publication, annulation et validation', async () => {
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
    superAdmin,
    ownerB,
  ]);

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }
  await db.query("insert into public.platform_admins (user_id, role) values ($1, 'super_admin')", [
    superAdmin,
  ]);

  // 1. Un propriétaire ordinaire ne peut ni écrire, ni lire, ni publier de brouillon.
  await asUser(ownerB);
  await assert.rejects(
    db.query('select public.save_saas_plan_workflow($1, $2::jsonb, false)', [
      'starter',
      JSON.stringify(starterPayload()),
    ]),
    /super administrateur/,
  );
  await assert.rejects(db.query('select * from public.get_saas_plan_drafts()'), /super administrateur/);
  await assert.rejects(
    db.query("insert into public.saas_plan_drafts (plan_id, payload) values ('starter', '{}'::jsonb)"),
    /row-level security|permission denied/,
  );

  // 2. Un visiteur ne voit pas la table des brouillons.
  await asAnon();
  await assert.rejects(db.query('select * from public.saas_plan_drafts'), /permission denied/);

  // 3. Le super administrateur enregistre un brouillon : le prix public ne change pas.
  await asUser(superAdmin);
  const draft = (
    await db.query('select public.save_saas_plan_workflow($1, $2::jsonb, false) as res', [
      'starter',
      JSON.stringify(starterPayload({ price_xof: 18500, name: 'Starter Solo Plus' })),
    ])
  ).rows[0].res;
  assert.equal(draft.status, 'draft');
  assert.equal(await publicPrice('starter'), 15000);

  // 4. Le brouillon est visible du super administrateur seul.
  await asUser(superAdmin);
  const drafts = (await db.query('select * from public.get_saas_plan_drafts()')).rows;
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].plan_id, 'starter');
  assert.equal(Number(drafts[0].payload.price_xof), 18500);

  // 5. Publication du brouillon : le visiteur voit le nouveau prix et le brouillon disparaît.
  const published = (await db.query('select public.publish_saas_plan_draft($1) as res', ['starter'])).rows[0]
    .res;
  assert.equal(published.status, 'published');
  assert.equal(await publicPrice('starter'), 18500);
  await asUser(superAdmin);
  assert.equal((await db.query('select * from public.get_saas_plan_drafts()')).rows.length, 0);

  // 6. Publication immédiate : elle remplace et supprime un brouillon existant du même forfait.
  await asUser(superAdmin);
  await db.query('select public.save_saas_plan_workflow($1, $2::jsonb, false)', [
    'pro',
    JSON.stringify(starterPayload({ id: 'pro', name: 'Pro Équipe', slug: 'pro', price_xof: 40000 })),
  ]);
  assert.equal((await db.query('select * from public.get_saas_plan_drafts()')).rows.length, 1);
  const immediate = (
    await db.query('select public.save_saas_plan_workflow($1, $2::jsonb, true) as res', [
      'pro',
      JSON.stringify(starterPayload({ name: 'Pro Équipe', slug: 'pro', price_xof: 36000 })),
    ])
  ).rows[0].res;
  assert.equal(immediate.status, 'published');
  assert.equal(await publicPrice('pro'), 36000);
  await asUser(superAdmin);
  assert.equal((await db.query('select * from public.get_saas_plan_drafts()')).rows.length, 0);

  // 7. Annulation d'un brouillon : la version publiée reste inchangée.
  await db.query('select public.save_saas_plan_workflow($1, $2::jsonb, false)', [
    'prestige',
    JSON.stringify(starterPayload({ name: 'Prestige', slug: 'prestige', price_xof: 90000 })),
  ]);
  const discarded = (await db.query('select public.discard_saas_plan_draft($1) as res', ['prestige'])).rows[0]
    .res;
  assert.equal(discarded.status, 'discarded');
  assert.equal((await db.query('select * from public.get_saas_plan_drafts()')).rows.length, 0);
  assert.equal(await publicPrice('prestige'), 75000);

  // 8. Publier un brouillon inexistant est refusé.
  await asUser(superAdmin);
  await assert.rejects(db.query('select public.publish_saas_plan_draft($1)', ['inconnu']), /Aucun brouillon/);

  // 9. Données invalides refusées, en brouillon comme en publication.
  await asUser(superAdmin);
  const invalid = [
    [{ price_xof: -1 }, /supérieur ou égal à zéro/],
    [{ name: '   ' }, /nom du forfait/],
    [{ billing_period: 'weekly' }, /Période de facturation/],
    [{ max_branches: 0 }, /au moins 1/],
    [{ features: 'pas une liste' }, /liste/],
  ];
  for (const publish of [false, true]) {
    for (const [overrides, message] of invalid) {
      await assert.rejects(
        db.query('select public.save_saas_plan_workflow($1, $2::jsonb, $3)', [
          'starter',
          JSON.stringify(starterPayload(overrides)),
          publish,
        ]),
        message,
      );
    }
  }
  assert.equal(await publicPrice('starter'), 18500);
});

after(async () => {
  await db.close();
});
