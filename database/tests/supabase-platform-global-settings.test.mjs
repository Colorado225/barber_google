import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const superAdmin = '11111111-1111-4111-8111-111111111111';
const supportLead = '22222222-2222-4222-8222-222222222222';
const ownerA = '33333333-3333-4333-8333-333333333333';
const ownerB = '44444444-4444-4444-8444-444444444444';
const newApplicant = '55555555-5555-4555-8555-555555555555';

let salonA;
let salonB;

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

async function setupCompleteSalonProfile(salonId, slug, coverUrl) {
  await db.query('select public.update_salon_profile($1, $2::jsonb)', [
    salonId,
    JSON.stringify({
      slug,
      commune: 'Cocody',
      city: 'Abidjan',
      address: 'Boulevard Latrille',
      phone: '+22507000111',
      email: `${slug}@example.com`,
      cover_url: coverUrl,
    }),
  ]);
  await db.query(
    `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Coupe Signature', 'coupe', 5000, 30)`,
    [salonId],
  );
  await db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [
    salonId,
    JSON.stringify({ layout: 'classic', accentColor: '#C9A45C' }),
  ]);
}

test('seed : migrations complètes et création initiale des salons A et B', async () => {
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
    [superAdmin, supportLead, ownerA, ownerB, newApplicant],
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
  salonA = (await db.query("select * from public.create_salon('Org A', 'Salon A', 'Principal')")).rows[0]
    .salon_id;
  await setupCompleteSalonProfile(salonA, 'salon-a-global', 'https://example.com/a.jpg');
  // Salon A est publié tant que auto_approve_salons = true par défaut
  await db.query('select public.set_salon_publication($1, true)', [salonA]);

  await asUser(ownerB, 'ownerb@example.com');
  salonB = (await db.query("select * from public.create_salon('Org B', 'Salon B', 'Principal')")).rows[0]
    .salon_id;
  await setupCompleteSalonProfile(salonB, 'salon-b-global', 'https://example.com/b.jpg');
});

test('1. Contrôle d’accès : seuls super_admin lisent/écrivent platform_settings ; aucun accès direct anon/support_lead/owner', async () => {
  await asAnon();
  await expectCode(db.query('select * from public.platform_settings'), '42501');
  await expectCode(db.query('select public.admin_get_platform_settings()'), '42501');
  await expectCode(
    db.query("select public.admin_update_platform_settings(true, false, 'tentative anon')"),
    '42501',
  );

  const anonStatus = (await db.query('select public.get_public_platform_status() as s')).rows[0].s;
  assert.equal(anonStatus.default_currency, 'XOF');
  assert.equal(anonStatus.maintenance_mode, false);
  assert.equal(anonStatus.auto_approve_salons, true);

  await asUser(supportLead, 'support@barbercuts.ci');
  assert.equal((await db.query('select * from public.platform_settings')).rowCount, 0);
  await expectCode(db.query('select public.admin_get_platform_settings()'), '42501');
  await expectCode(
    db.query("select public.admin_update_platform_settings(true, false, 'tentative support')"),
    '42501',
  );

  await asUser(ownerA, 'ownera@example.com');
  assert.equal((await db.query('select * from public.platform_settings')).rowCount, 0);
  await expectCode(db.query('select public.admin_get_platform_settings()'), '42501');
  await expectCode(
    db.query("update public.platform_settings set maintenance_mode = true where id = 'global'"),
    '42501',
  );
});

test('2. SuperAdmin met à jour maintenance_mode et auto_approve_salons avec motif obligatoire et journal d’audit', async () => {
  await asUser(superAdmin, 'superadmin@barbercuts.ci');

  const initial = (await db.query('select public.admin_get_platform_settings() as s')).rows[0].s;
  assert.equal(initial.default_currency, 'XOF');
  assert.equal(initial.maintenance_mode, false);
  assert.equal(initial.auto_approve_salons, true);
  assert.equal(initial.commission_rate_available, false);

  // Motif trop court refusé
  await expectCode(db.query("select public.admin_update_platform_settings(true, false, 'ab')"), '22023');

  const updated = (
    await db.query(
      "select public.admin_update_platform_settings(true, false, 'Maintenance nocturne et validation manuelle') as s",
    )
  ).rows[0].s;
  assert.equal(updated.maintenance_mode, true);
  assert.equal(updated.auto_approve_salons, false);
  assert.ok(updated.updated_at);
  assert.equal(updated.updated_by, superAdmin);

  // Relecture côté DB + statut public
  const reloaded = (await db.query('select public.admin_get_platform_settings() as s')).rows[0].s;
  assert.equal(reloaded.maintenance_mode, true);
  assert.equal(reloaded.auto_approve_salons, false);

  await asAnon();
  const publicStatus = (await db.query('select public.get_public_platform_status() as s')).rows[0].s;
  assert.equal(publicStatus.maintenance_mode, true);
  assert.equal(publicStatus.auto_approve_salons, false);

  // Vérification de l’entrée d’audit structurée
  await asDbAdmin();
  const auditRows = (
    await db.query(
      `select action, target_type, target_id, actor_email, reason, before_values, after_values
       from public.platform_audit_logs
       where action = 'platform.settings_updated'
       order by created_at desc limit 1`,
    )
  ).rows;
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].target_type, 'platform_settings');
  assert.equal(auditRows[0].target_id, 'global');
  assert.equal(auditRows[0].actor_email, 'superadmin@barbercuts.ci');
  assert.equal(auditRows[0].reason, 'Maintenance nocturne et validation manuelle');
  assert.deepEqual(auditRows[0].before_values, {
    maintenance_mode: false,
    auto_approve_salons: true,
  });
  assert.deepEqual(auditRows[0].after_values, {
    maintenance_mode: true,
    auto_approve_salons: false,
  });
});

test('3. Application réelle de maintenance_mode=true sur public.create_salon()', async () => {
  await asUser(newApplicant, 'applicant@example.com');
  await expectCode(
    db.query("select * from public.create_salon('Org Bloquée', 'Salon Bloqué', 'Principal')"),
    '55000',
  );

  // Le SuperAdmin désactive la maintenance mais laisse auto_approve_salons = false
  await asUser(superAdmin, 'superadmin@barbercuts.ci');
  await db.query(
    "select public.admin_update_platform_settings(false, false, 'Fin de maintenance, validation manuelle maintenue')",
  );

  await asUser(newApplicant, 'applicant@example.com');
  const created = (
    await db.query("select * from public.create_salon('Org Débloquée', 'Salon Débloqué', 'Principal')")
  ).rows[0];
  assert.ok(created.salon_id);
});

test('4. Application réelle de auto_approve_salons=false sur set_salon_publication et publish_marketplace_customizer', async () => {
  // Salon B n’est ni certifié ni encore publié : son propriétaire est bloqué côté serveur
  await asUser(ownerB, 'ownerb@example.com');
  await expectCode(db.query('select public.set_salon_publication($1, true)', [salonB]), '42501');
  await expectCode(db.query('select public.publish_marketplace_customizer($1)', [salonB]), '42501');

  // Salon A (déjà publié) peut continuer de republier ses ajustements de vitrine
  await asUser(ownerA, 'ownera@example.com');
  const repub = (await db.query('select public.publish_marketplace_customizer($1) as p', [salonA])).rows[0].p;
  assert.equal(repub.is_published, true);

  // Le SuperAdmin certifie Salon B : son propriétaire peut désormais le publier
  await asUser(superAdmin, 'superadmin@barbercuts.ci');
  await db.query(
    "select public.admin_set_salon_verification($1, true, 'Dossier vérifié par l’administration')",
    [salonB],
  );

  await asUser(ownerB, 'ownerb@example.com');
  const pubB = (await db.query('select public.publish_marketplace_customizer($1) as p', [salonB])).rows[0].p;
  assert.equal(pubB.is_published, true);
});

after(async () => {
  await db.close();
});
