import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Lot 1 (P0) : décisions SuperAdmin persistées en base avec contrôle de rôle et trace d'audit.

const db = new PGlite();
const superAdmin = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
let salonId;
let reviewId;

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

test('Opérations SuperAdmin : contrôle de rôle, suspension, publication, formule, avis, audit, administrateurs', async () => {
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
    'insert into auth.users(id, email, email_confirmed_at) values ($1, $2, now()), ($3, $4, now()), ($5, $6, now())',
    [superAdmin, 'dominiquek051@gmail.com', owner, 'owner@example.com', other, 'other@example.com'],
  );

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }
  await db.query("insert into public.platform_admins (user_id, role) values ($1, 'super_admin')", [
    superAdmin,
  ]);

  await asUser(owner);
  salonId = (await db.query("select * from public.create_salon('Org Test', 'Salon Test', 'Principal')"))
    .rows[0].salon_id;
  // Le salon est publié (état réaliste) : mise en place en superutilisateur.
  await db.exec('reset role');
  await db.query('update public.salons set is_published = true where id = $1', [salonId]);

  // 1. Un propriétaire ordinaire ne peut appeler aucune RPC d'administration.
  await asUser(owner);
  for (const call of [
    'select public.platform_list_salons()',
    "select public.platform_set_salon_status($1, 'suspended', 'Test')",
    'select public.platform_set_salon_verification($1, true)',
    "select public.platform_assign_salon_plan($1, 'pro', 'Test')",
    'select public.platform_list_reviews()',
    'select public.platform_list_audit_logs(10)',
    'select public.platform_list_admins()',
    "select public.platform_grant_admin('owner@example.com', 'support_lead')",
  ]) {
    const params = call.includes('$1') ? [salonId] : [];
    await expectRejection(db.query(call, params), /super administrateur/);
  }

  // 2. Anonyme : aucune exécution.
  await asAnon();
  await expectRejection(db.query('select public.platform_list_salons()'), /permission denied/);

  // 3. Liste admin : le salon apparaît, sans formule.
  await asUser(superAdmin);
  let list = (await db.query('select public.platform_list_salons() as res')).rows[0].res;
  const row = list.find((s) => s.id === salonId);
  assert.ok(row, 'Le salon doit figurer dans la liste admin');
  assert.equal(row.plan_id, null, 'Aucune formule fabriquée');
  assert.equal(row.platform_status, 'active');
  assert.equal(row.is_published, true);

  // 4. Suspension : motif obligatoire, puis masquage effectif.
  await expectRejection(
    db.query("select public.platform_set_salon_status($1, 'suspended', ' ')", [salonId]),
    /motif de suspension est obligatoire/,
  );
  const suspended = (
    await db.query("select public.platform_set_salon_status($1, 'suspended', 'Plainte client') as res", [
      salonId,
    ])
  ).rows[0].res;
  assert.equal(suspended.platform_status, 'suspended');
  assert.equal(suspended.is_published, false);

  // 5. Un salon suspendu ne peut pas être republié, même par une mise à jour directe (garde-fou trigger).
  await expectRejection(
    db.query('select public.platform_set_salon_publication($1, true)', [salonId]),
    /réactivez-le avant de le publier/,
  );
  await db.exec('reset role');
  await db.query('update public.salons set is_published = true where id = $1', [salonId]);
  const stillHidden = (await db.query('select is_published from public.salons where id = $1', [salonId]))
    .rows[0];
  assert.equal(stillHidden.is_published, false, 'Le trigger doit maintenir le salon suspendu hors ligne');

  // 6. Réactivation puis publication.
  await asUser(superAdmin);
  await db.query("select public.platform_set_salon_status($1, 'active', null)", [salonId]);
  const published = (
    await db.query('select public.platform_set_salon_publication($1, true) as res', [salonId])
  ).rows[0].res;
  assert.equal(published.is_published, true);

  // 7. Certification.
  const verified = (
    await db.query('select public.platform_set_salon_verification($1, true) as res', [salonId])
  ).rows[0].res;
  assert.equal(verified.is_verified, true);

  // 8. Attribution d'une formule : motif obligatoire, une seule formule active, période mensuelle de ~30 jours.
  await expectRejection(
    db.query("select public.platform_assign_salon_plan($1, 'pro', '')", [salonId]),
    /motif de validation administrative/,
  );
  const sub1 = (
    await db.query("select public.platform_assign_salon_plan($1, 'starter', 'Virement reçu') as res", [
      salonId,
    ])
  ).rows[0].res;
  assert.equal(sub1.status, 'active');
  const sub2 = (
    await db.query("select public.platform_assign_salon_plan($1, 'pro', 'Virement reçu 2') as res", [salonId])
  ).rows[0].res;
  assert.equal(Number(sub2.price_at_subscription), 35000);
  const days = (new Date(sub2.current_period_end) - Date.now()) / 86400000;
  assert.ok(days > 29 && days < 31, `Période mensuelle attendue ~30 jours, obtenu ${days.toFixed(1)}`);
  const activeCount = (
    await db.query(
      "select count(*)::int as n from public.saas_subscriptions where salon_id = $1 and status = 'active'",
      [salonId],
    )
  ).rows[0].n;
  assert.equal(activeCount, 1);
  const listed = (await db.query('select public.platform_list_salons() as res')).rows[0].res.find(
    (s) => s.id === salonId,
  );
  assert.equal(listed.plan_id, 'pro', 'La liste admin lit la formule depuis la base');
  assert.equal(listed.plan_name, 'Pro Équipe');

  // 9. Avis : masquage avec motif, puis restauration.
  await db.exec('reset role');
  reviewId = (
    await db.query(
      "insert into public.reviews (salon_id, author, rating, comment, verified) values ($1, 'Client', 2, 'Attente longue', true) returning id",
      [salonId],
    )
  ).rows[0].id;
  await asUser(superAdmin);
  await expectRejection(
    db.query('select public.platform_set_review_hidden($1, true, null)', [reviewId]),
    /motif de masquage est obligatoire/,
  );
  const hidden = (
    await db.query("select public.platform_set_review_hidden($1, true, 'Propos injurieux') as res", [
      reviewId,
    ])
  ).rows[0].res;
  assert.equal(hidden.platform_hidden, true);
  const reviews = (await db.query('select public.platform_list_reviews() as res')).rows[0].res;
  assert.equal(reviews.find((r) => r.id === reviewId).platform_hidden, true);
  await db.query('select public.platform_set_review_hidden($1, false, null)', [reviewId]);

  // 10. Administrateurs : règle de l'adresse super administrateur, rôle inconnu, comptes inconnus.
  await expectRejection(
    db.query("select public.platform_grant_admin('owner@example.com', 'super_admin')"),
    /réservé à l’adresse autorisée/,
  );
  await expectRejection(
    db.query("select public.platform_grant_admin('inconnu@example.com', 'support_lead')"),
    /Aucun compte/,
  );
  await expectRejection(
    db.query("select public.platform_grant_admin('owner@example.com', 'root')"),
    /Rôle invalide/,
  );
  const granted = (
    await db.query("select public.platform_grant_admin('owner@example.com', 'support_lead') as res")
  ).rows[0].res;
  assert.equal(granted.role, 'support_lead');
  await expectRejection(db.query('select public.platform_revoke_admin($1)', [superAdmin]), /propre accès/);
  await db.query('select public.platform_revoke_admin($1)', [owner]);
  const admins = (await db.query('select public.platform_list_admins() as res')).rows[0].res;
  assert.equal(admins.length, 1);
  assert.equal(admins[0].email, 'dominiquek051@gmail.com');

  // 11. Journal d'audit : chaque décision est tracée, du plus récent au plus ancien.
  const logs = (await db.query('select public.platform_list_audit_logs(100) as res')).rows[0].res;
  const actions = new Set(logs.map((l) => l.action));
  for (const expected of [
    'salon.suspended',
    'salon.reactivated',
    'salon.published',
    'salon.verified',
    'subscription.assigned_by_admin',
    'review.hidden',
    'review.restored',
    'platform_admin.granted',
    'platform_admin.revoked',
  ]) {
    assert.ok(actions.has(expected), `Action absente du journal : ${expected}`);
  }
  const assignment = logs.find((l) => l.action === 'subscription.assigned_by_admin');
  assert.equal(assignment.details.reason, 'Virement reçu 2');
  assert.equal(assignment.actor_email, 'dominiquek051@gmail.com');
});

after(async () => {
  await db.close();
});
