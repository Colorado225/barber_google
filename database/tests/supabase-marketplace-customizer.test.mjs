import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const managerA = '22222222-2222-4222-8222-222222222222';
const ownerB = '33333333-3333-4333-8333-333333333333';

let salonA;
let salonB;
let branchA;
let serviceCoupeA;
let serviceBarbeA;
let serviceCoupeB;
let staffKouassiA;
let staffAliA;
let staffMoussaB;

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
async function asAdmin() {
  await db.exec('reset role');
}

const readMigration = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('migrations apply cleanly and seed tenants with services and staff', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query('insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now())', [ownerA, managerA, ownerB]);

  const migrations = [
    '20261103160000_supabase_core.sql',
    '20261103170000_branch_hours.sql',
    '20261104090000_staff_schedules.sql',
    '20261104090100_appointment_operations.sql',
    '20261104090200_review_moderation.sql',
    '20261104100000_finance_foundation.sql',
    '20261104100100_payment_journal.sql',
    '20261104100200_finance_reporting.sql',
    '20261104100300_finance_permissions_fix.sql',
    '20261104110000_marketplace_profile.sql',
    '20261104110100_marketplace_booking.sql',
    '20261104110200_appointment_notifications.sql',
    '20261104140000_marketplace_customizer.sql',
    '20261104140100_marketplace_customizer_hardening.sql',
  ];

  for (const m of migrations) {
    await db.exec(await readMigration(m));
  }

  // Create Salon A and Salon B
  await asUser(ownerA);
  const a = await db.query("select * from public.create_salon('Organisation A', 'Barbershop Elite', 'Plateau')");
  salonA = a.rows[0].salon_id;
  branchA = a.rows[0].branch_id;

  await asUser(ownerB);
  const b = await db.query("select * from public.create_salon('Organisation B', 'Salon Cocody', 'Principal')");
  salonB = b.rows[0].salon_id;

  // Insert services
  await asAdmin();
  const scA = await db.query(
    "insert into public.services(salon_id, name, category, price, duration_minutes, is_active, popular) values ($1, 'Dégradé Laser', 'coupe', 5000, 30, true, true) returning id",
    [salonA]
  );
  serviceCoupeA = scA.rows[0].id;

  const sbA = await db.query(
    "insert into public.services(salon_id, name, category, price, duration_minutes, is_active) values ($1, 'Barbe Royale', 'barbe', 3500, 20, true) returning id",
    [salonA]
  );
  serviceBarbeA = sbA.rows[0].id;

  const scB = await db.query(
    "insert into public.services(salon_id, name, category, price, duration_minutes, is_active) values ($1, 'Coupe B', 'coupe', 4000, 30, true) returning id",
    [salonB]
  );
  serviceCoupeB = scB.rows[0].id;

  // Insert staff
  const stA1 = await db.query(
    "insert into public.staff(salon_id, branch_id, name, role, specialties, is_active, is_available) values ($1, $2, 'Kouassi Yves', 'master_barber', '{dégradé,barbe}', true, true) returning id",
    [salonA, branchA]
  );
  staffKouassiA = stA1.rows[0].id;

  const stA2 = await db.query(
    "insert into public.staff(salon_id, branch_id, name, role, specialties, is_active, is_available) values ($1, $2, 'Ali Traoré', 'barber', '{tresses}', true, true) returning id",
    [salonA, branchA]
  );
  staffAliA = stA2.rows[0].id;

  const stB = await db.query(
    "insert into public.staff(salon_id, name, role, is_active, is_available) values ($1, 'Moussa B', 'barber', true, true) returning id",
    [salonB]
  );
  staffMoussaB = stB.rows[0].id;

  // Setup basic public profile for Salon A so it can publish
  await db.query(`
    update public.salons set
      slug = 'barbershop-elite',
      address = 'Boulevard lagunaire, Plateau',
      city = 'Abidjan',
      commune = 'Plateau',
      phone = '+225 07 00 00 01',
      cover_url = 'https://example.com/cover.jpg',
      tagline = 'Le temple du dégradé premium'
    where id = $1
  `, [salonA]);
});

test('première configuration : un salon sans personnalisation reçoit le modèle par défaut', async () => {
  await asUser(ownerA);
  const res = await db.query('select public.get_marketplace_customizer_config($1) as config', [salonA]);
  const config = res.rows[0].config;

  assert.equal(config.salon_id, salonA);
  assert.equal(config.layout, 'classic');
  assert.equal(config.accent_color, '#C9A45C');
  assert.equal(config.card_style, 'rounded-3xl');
  assert.equal(config.is_published, false);
  assert.ok(config.draft_config);
  assert.equal(config.draft_config.layout, 'classic');
  assert.ok(Array.isArray(config.draft_config.sections));
  assert.equal(config.draft_config.sections.length, 7);
});

test('changement de modèle et sauvegarde brouillon : les données métier restent intactes', async () => {
  await asUser(ownerA);
  const newDraft = {
    layout: 'elegant',
    accentColor: '#D97706',
    cardStyle: 'rounded-2xl',
    sections: [
      { id: 'hero', enabled: true, position: 0 },
      { id: 'gallery', enabled: true, position: 1 },
      { id: 'featured_services', enabled: true, position: 2 },
      { id: 'team', enabled: true, position: 3 },
      { id: 'trust', enabled: true, position: 4 },
      { id: 'location_hours', enabled: true, position: 5 },
      { id: 'reviews', enabled: false, position: 6 }, // section avis désactivée
    ],
    featuredServiceIds: [serviceCoupeA, serviceBarbeA],
    visibleStaffIds: [staffKouassiA], // Ali exclu de la vitrine
    featuredGalleryImageIds: [],
    showAddress: true,
    showPhone: true,
    showWhatsapp: false,
    customTagline: 'Excellence et tradition',
    customDescription: 'Une expérience de coiffure inégalée',
  };

  const saveRes = await db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb) as res', [salonA, JSON.stringify(newDraft)]);
  const saved = saveRes.rows[0].res;

  assert.equal(saved.layout, 'elegant');
  assert.equal(saved.accent_color, '#D97706');
  assert.equal(saved.is_published, false); // draft non publié
  assert.equal(saved.published_config, null);

  // Vérification que les services et prix n'ont pas été modifiés
  const srv = await db.query('select price from public.services where id = $1', [serviceCoupeA]);
  assert.equal(Number(srv.rows[0].price), 5000);
});

test('isolation multi-tenant : le propriétaire B ne peut ni lire ni modifier la vitrine de A', async () => {
  await asUser(ownerB);

  await assert.rejects(
    async () => db.query('select public.get_marketplace_customizer_config($1)', [salonA]),
    (err) => err.code === '42501'
  );

  await assert.rejects(
    async () => db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [salonA, JSON.stringify({ layout: 'classic' })]),
    (err) => err.code === '42501'
  );
});

test('données invalides : rejet strict si un service ou un membre appartient à un autre salon', async () => {
  await asUser(ownerA);

  // Tentative d'inclure une prestation du salon B
  await assert.rejects(
    async () => db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [
      salonA,
      JSON.stringify({
        layout: 'classic',
        featuredServiceIds: [serviceCoupeB], // service de salon B
      }),
    ]),
    (err) => err.code === '22023'
  );

  // Tentative d'inclure un employé du salon B
  await assert.rejects(
    async () => db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [
      salonA,
      JSON.stringify({
        layout: 'classic',
        visibleStaffIds: [staffMoussaB], // staff de salon B
      }),
    ]),
    (err) => err.code === '22023'
  );
});

test('publication : rend la vitrine publique et synchronise les prestations vedettes', async () => {
  await asUser(ownerA);
  const pubRes = await db.query('select public.publish_marketplace_customizer($1) as res', [salonA]);
  const published = pubRes.rows[0].res;

  assert.equal(published.is_published, true);
  assert.ok(published.published_at);
  assert.ok(published.published_config);
  assert.equal(published.published_config.layout, 'elegant');

  // Vérifier la table salons
  const s = await db.query('select is_published, featured_service_ids from public.salons where id = $1', [salonA]);
  assert.equal(s.rows[0].is_published, true);
  assert.deepEqual(s.rows[0].featured_service_ids, [serviceCoupeA, serviceBarbeA]);
});

test('vitrine publique (anon) : retourne les données réelles et filtre le personnel selon la config', async () => {
  await asAnon();
  const detailRes = await db.query('select public.marketplace_salon_detail($1) as detail', ['barbershop-elite']);
  const detail = detailRes.rows[0].detail;

  assert.ok(detail);
  assert.equal(detail.salon.name, 'Barbershop Elite');
  assert.ok(detail.customizer);
  assert.equal(detail.customizer.layout, 'elegant');
  assert.equal(detail.customizer.accentColor, '#D97706');

  // Seul Kouassi est visible selon visibleStaffIds: [staffKouassiA]
  assert.equal(detail.staff.length, 1);
  assert.ok(!detail.staff.some((m) => m.id === staffAliA));
  assert.equal(detail.staff[0].name, 'Kouassi Yves');
  // Les champs privés (téléphone, commissions) ne sont pas exposés
  assert.equal(detail.staff[0].phone, undefined);
  assert.equal(detail.staff[0].commission_rate, undefined);
});

test('synchronisation tarifaire en temps réel : une mise à jour ERP est immédiatement reflétée sur la vitrine', async () => {
  await asAdmin();
  // Mise à jour du tarif de la coupe dans l'ERP : passe de 5 000 à 6 000 XOF
  await db.query('update public.services set price = 6000 where id = $1', [serviceCoupeA]);

  // Consultation publique immédiate sans re-sauvegarder le customizer
  await asAnon();
  const detailRes = await db.query('select public.marketplace_salon_detail($1) as detail', ['barbershop-elite']);
  const detail = detailRes.rows[0].detail;

  const coupe = detail.services.find((s) => s.id === serviceCoupeA);
  assert.ok(coupe);
  assert.equal(Number(coupe.price), 6000); // 6000 XOF direct !
});

test('durcissement : validation stricte et normalisation de la configuration', async () => {
  await asUser(ownerA);
  const base = {
    layout: 'editorial',
    accentColor: '#10B981',
    sections: [
      { id: 'reviews', enabled: true, position: 0 },
      { id: 'hero', enabled: true, position: 1 },
      { id: 'section_inconnue', enabled: true, position: 2 },
      { id: 'hero', enabled: false, position: 3 }
    ],
    featuredServiceIds: [serviceCoupeA],
    visibleStaffIds: [staffKouassiA],
    featuredGalleryImageIds: ['https://example.com/cover.jpg'],
    featuredBranchId: branchA,
    customTagline: 'Nouveau brouillon non publié'
  };
  const saveRes = await db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb) as res', [salonA, JSON.stringify(base)]);
  const draft = saveRes.rows[0].res.draft_config;
  // Sections canoniques : 7, inconnue écartée, doublon supprimé, positions 0..6
  assert.equal(draft.sections.length, 7);
  assert.deepEqual(draft.sections.map((x) => x.position), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(draft.sections[0].id, 'reviews');
  assert.equal(draft.sections.filter((x) => x.id === 'hero').length, 1);
  assert.equal(draft.featuredBranchId, branchA);

  // Couleur invalide (injection CSS) rejetée
  await assert.rejects(
    async () => db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [salonA, JSON.stringify({ ...base, accentColor: 'red; } body{display:none' })]),
    (err) => err.code === '22023'
  );
  // Image ne appartenant pas au salon rejetée
  await assert.rejects(
    async () => db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [salonA, JSON.stringify({ ...base, featuredGalleryImageIds: ['https://evil.example/x.jpg'] })]),
    (err) => err.code === '22023'
  );
  // Slogan trop long rejeté
  await assert.rejects(
    async () => db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [salonA, JSON.stringify({ ...base, customTagline: 'x'.repeat(161) })]),
    (err) => err.code === '22023'
  );
});

test('brouillon non public : la vitrine continue d\'afficher la configuration publiée', async () => {
  await asAnon();
  const detailRes = await db.query('select public.marketplace_salon_detail($1) as detail', ['barbershop-elite']);
  const detail = detailRes.rows[0].detail;
  // Le brouillon 'editorial' enregistré ci-dessus ne doit pas fuiter.
  assert.equal(detail.customizer.layout, 'elegant');
  assert.equal(detail.customizer.accentColor, '#D97706');
});

test('revert et dépublication : réinitialise le draft et désactive la vitrine', async () => {
  await asUser(ownerA);

  // 1. Dépublication
  const unpub = await db.query('select public.unpublish_marketplace_customizer($1) as res', [salonA]);
  assert.equal(unpub.rows[0].res.is_published, false);

  // La vitrine publique n'est plus accessible
  await asAnon();
  await assert.rejects(
    async () => db.query('select public.marketplace_salon_detail($1)', ['barbershop-elite']),
    (err) => err.code === '22023'
  );

  // 2. Revert draft
  await asUser(ownerA);
  const rev = await db.query('select public.revert_marketplace_customizer_draft($1) as res', [salonA]);
  assert.ok(rev.rows[0].res.draft_config);
  assert.equal(rev.rows[0].res.draft_config.layout, 'elegant'); // restauré depuis published_config
});

test('personnel : une sélection publiée vide masque toute l\'équipe de la vitrine', async () => {
  await asUser(ownerA);
  const cfg = {
    layout: 'classic',
    accentColor: '#C9A45C',
    sections: [{ id: 'hero', enabled: true, position: 0 }],
    featuredServiceIds: [serviceCoupeA],
    visibleStaffIds: [],
    featuredGalleryImageIds: []
  };
  await db.query('select public.save_marketplace_customizer_draft($1, $2::jsonb)', [salonA, JSON.stringify(cfg)]);
  await db.query('select public.publish_marketplace_customizer($1)', [salonA]);

  await asAnon();
  const detailRes = await db.query('select public.marketplace_salon_detail($1) as detail', ['barbershop-elite']);
  assert.equal(detailRes.rows[0].detail.staff.length, 0);
  assert.equal(detailRes.rows[0].detail.customizer.layout, 'classic');
});

after(async () => {
  await db.close();
});
