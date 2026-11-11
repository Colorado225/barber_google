import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const superAdmin = '11111111-1111-4111-8111-111111111111';
const supportLead = '22222222-2222-4222-8222-222222222222';
const ownerA = '33333333-3333-4333-8333-333333333333';

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

async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

test('seed : migrations complètes et comptes de plateforme', async () => {
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
    [superAdmin, supportLead, ownerA],
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
});

test('1. Contrôle d’accès : écriture/lecture admin réservées au super_admin, table inaccessible directement', async () => {
  await asAnon();
  await expectCode(db.query('select * from public.platform_marketplace_content'), '42501');
  await expectCode(db.query('select public.admin_get_marketplace_content()'), '42501');
  await expectCode(
    db.query("select public.admin_update_marketplace_content('{}'::jsonb, 'tentative anon')"),
    '42501',
  );

  await asUser(ownerA, 'ownera@example.com');
  await expectCode(db.query('select public.admin_get_marketplace_content()'), '42501');
  await expectCode(
    db.query("select public.admin_update_marketplace_content('{}'::jsonb, 'tentative propriétaire')"),
    '42501',
  );

  await asUser(supportLead, 'support@barbercuts.ci');
  await expectCode(db.query('select public.admin_get_marketplace_content()'), '42501');
});

test('2. Lecture publique : objet vide avant publication, contenu publié ensuite visible par tous', async () => {
  await asAnon();
  const before = (await db.query('select public.get_public_marketplace_content() as c')).rows[0].c;
  assert.deepEqual(before, {}, 'Aucune ligne publiée : objet vide, aucune valeur inventée');

  await asUser(superAdmin, 'superadmin@barbercuts.ci');
  const updated = (
    await db.query('select public.admin_update_marketplace_content($1::jsonb, $2) as row', [
      JSON.stringify({
        announcement: { enabled: true, text: 'Maintenance programmée dimanche', linkLabel: 'En savoir plus' },
        siteMetadata: { siteName: 'BarberCuts CI' },
        updatedAt: '2020-01-01T00:00:00.000Z',
      }),
      'Bandeau de maintenance programmée',
    ])
  ).rows[0].row;
  assert.ok(updated.updated_at, 'La date de publication est posée par le serveur');

  await asAnon();
  const published = (await db.query('select public.get_public_marketplace_content() as c')).rows[0].c;
  assert.equal(published.content.announcement.text, 'Maintenance programmée dimanche');
  assert.equal(published.content.siteMetadata.siteName, 'BarberCuts CI');
  // L'horodatage n'appartient pas au client : il est retiré du contenu stocké.
  assert.equal(published.content.updatedAt, undefined);
  assert.ok(published.updated_at, 'La lecture publique expose la date de publication serveur');

  await asUser(superAdmin, 'superadmin@barbercuts.ci');
  const adminView = (await db.query('select public.admin_get_marketplace_content() as c')).rows[0].c;
  assert.equal(adminView.updated_by, superAdmin);
});

test('3. Validation : motif obligatoire, objet JSON requis, plafond de taille', async () => {
  await asUser(superAdmin, 'superadmin@barbercuts.ci');
  await expectCode(
    db.query("select public.admin_update_marketplace_content('{}'::jsonb, '  ')"),
    '22023',
    'Motif vide rejeté',
  );
  await expectCode(
    db.query("select public.admin_update_marketplace_content('[]'::jsonb, 'motif valide')"),
    '22023',
    'Tableau JSON rejeté',
  );
  const huge = JSON.stringify({ blob: 'x'.repeat(300 * 1024) });
  await expectCode(
    db.query('select public.admin_update_marketplace_content($1::jsonb, $2)', [huge, 'motif valide']),
    '22023',
    'Contenu > 256 Ko rejeté',
  );
});

test('4. Audit : chaque publication est tracée avec motif et acteur', async () => {
  await db.exec('reset role');
  const auditRows = (
    await db.query(`
      select action, target_type, target_id, actor_email, reason, after_values
      from public.platform_audit_logs
      where action = 'platform.marketplace_content_updated'
      order by created_at desc limit 1`)
  ).rows;
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].target_type, 'platform_marketplace_content');
  assert.equal(auditRows[0].target_id, 'global');
  assert.equal(auditRows[0].actor_email, 'superadmin@barbercuts.ci');
  assert.equal(auditRows[0].reason, 'Bandeau de maintenance programmée');
  assert.ok(auditRows[0].after_values.content_bytes > 0);
});

after(async () => {
  await db.close();
});
