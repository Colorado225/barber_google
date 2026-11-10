import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

/**
 * Garde-fou du jeu de données E2E (supabase/e2e-seed.sql).
 *
 * Le seed est appliqué par `supabase db reset` avant les scénarios navigateur
 * Playwright (workflow e2e.yml). Cette suite rejoue TOUTES les migrations puis
 * le seed dans PGlite pour garantir que :
 *   1. le seed reste applicable après chaque nouvelle migration ;
 *   2. les invariants dont dépendent les scénarios E2E restent vrais
 *      (salon publié, créneaux disponibles, avis vérifié possible,
 *      paiement Wave en attente, file de notifications alimentée).
 */
const db = new PGlite();

const E2E = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  salonId: '33333333-3333-4333-8333-333333333333',
  salonSlug: 'e2e-barber-abidjan',
  branchId: '44444444-4444-4444-8444-444444444444',
  serviceExpress: '55555555-5555-4555-8555-555555555555',
  staffKoffi: '66666666-6666-4666-8666-666666666666',
  clientAwa: '88888888-8888-4888-8888-888888888888',
  apptCompleted: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  apptTomorrow: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  reviewToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

function tomorrowInAbidjan() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' });
  return fmt.format(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

async function asAnon() {
  await db.exec('reset role');
  await db.exec('set role anon');
}

async function rpcJson(sql, params = []) {
  const res = await db.query(`select ${sql} as value`, params);
  return res.rows[0].value;
}

after(async () => {
  await db.close();
});

test('le seed E2E s’applique après toutes les migrations et alimente les parcours', async () => {
  // Squelette auth/extensions équivalent à la stack Supabase locale.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      aud text,
      role text,
      email text,
      encrypted_password text,
      email_confirmed_at timestamptz,
      raw_app_meta_data jsonb not null default '{}'::jsonb,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table auth.identities (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      identity_data jsonb not null,
      provider text not null,
      provider_id text not null,
      last_sign_in_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema extensions;
    create function extensions.crypt(p_text text, p_salt text)
      returns text language sql immutable as $$ select 'md5' || md5(coalesce(p_text, '') || p_salt) $$;
    create function extensions.gen_salt(p_type text, p_iter integer default 10)
      returns text language sql immutable as $$ select 'x' || repeat('a', 29) $$;
  `);

  const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const name of files) {
    await db.exec(await readFile(new URL(name, migrationsDir), 'utf8'));
  }

  // Le seed doit rester applicable sans erreur (contraintes, triggers, grants).
  await db.exec(await readFile(new URL('../../supabase/e2e-seed.sql', import.meta.url), 'utf8'));

  // --- Salon publié + catalogue + staff + horaires ---------------------------
  const salon = (
    await db.query('select name, is_published from public.salons where slug = $1', [E2E.salonSlug])
  ).rows[0];
  assert.equal(salon.name, 'E2E Barber Abidjan');
  assert.equal(salon.is_published, true);

  assert.equal(
    (await db.query('select count(*)::int as n from public.services where salon_id = $1', [E2E.salonId]))
      .rows[0].n,
    2,
  );
  const staff = (
    await db.query('select service_ids, branch_id, is_active from public.staff where id = $1', [
      E2E.staffKoffi,
    ])
  ).rows[0];
  assert.ok(staff.service_ids.includes(E2E.serviceExpress));
  assert.equal(staff.branch_id, E2E.branchId);
  assert.equal(staff.is_active, true);
  assert.equal(
    (
      await db.query(
        'select count(*)::int as n from public.branch_hours where salon_id = $1 and is_open and opens_at = $2 and closes_at = $3',
        [E2E.salonId, '08:00:00', '20:00:00'],
      )
    ).rows[0].n,
    7,
  );

  // --- Appartenance propriétaire active (connexion ERP des scénarios) --------
  const membership = (
    await db.query('select role, status from public.memberships where user_id = $1', [E2E.ownerId])
  ).rows[0];
  assert.deepEqual(membership, { role: 'owner', status: 'active' });

  // --- Rendez-vous terminé + payé : éligible à l’avis vérifié ----------------
  const apptDone = (
    await db.query(
      'select status, payment_status, public_cancel_token, client_id from public.appointments where id = $1',
      [E2E.apptCompleted],
    )
  ).rows[0];
  assert.equal(apptDone.status, 'completed');
  assert.equal(apptDone.payment_status, 'paid');
  assert.equal(apptDone.public_cancel_token, E2E.reviewToken);

  // Fidélité déclenchée par le trigger (RDV completed + payé, client identifié).
  const loyalty = (
    await db.query('select t.points, t.kind from public.loyalty_transactions t where t.appointment_id = $1', [
      E2E.apptCompleted,
    ])
  ).rows[0];
  assert.deepEqual(loyalty, { points: 30, kind: 'earned_service' });

  // --- Paiement Wave en attente + encaissement confirmé ----------------------
  const payments = (
    await db.query(
      'select provider_reference, kind, status, amount::text as amount from public.payments where salon_id = $1 order by provider_reference',
      [E2E.salonId],
    )
  ).rows;
  assert.deepEqual(payments, [
    { provider_reference: 'WAVE-E2E-CONFIRMED-0001', kind: 'payment', status: 'confirmed', amount: '3000' },
    { provider_reference: 'WAVE-E2E-PENDING-0001', kind: 'payment', status: 'pending', amount: '5000' },
  ]);

  // --- File de notifications alimentée à l’insert des deux rendez-vous -------
  const kinds = (
    await db.query(
      'select kind from public.appointment_notifications where appointment_id = any($1::uuid[]) order by kind',
      [[E2E.apptCompleted, E2E.apptTomorrow]],
    )
  ).rows.map((r) => r.kind);
  assert.deepEqual(kinds, ['booking_received', 'booking_received']);

  // --- Vitrine publique (anon) : salon détaillé avec horaires ----------------
  await asAnon();
  const detail = await rpcJson('public.marketplace_salon_detail($1)', [E2E.salonSlug]);
  assert.equal(detail.salon.name, 'E2E Barber Abidjan');
  assert.equal(detail.services.length, 2);
  assert.equal(detail.staff.length, 1);
  assert.equal(detail.branches[0].hours.length, 7);
  assert.deepEqual(detail.reviews, []);

  // --- Portail (anon) : can_review exposé sur le RDV terminé -----------------
  const portal = await rpcJson('public.marketplace_booking_by_token($1)', [E2E.reviewToken]);
  assert.equal(portal.booking.status, 'completed');
  assert.equal(portal.can_review, true);
  assert.equal(portal.can_cancel, false);
  assert.ok(portal.loyalty, 'le portail doit exposer la carte de fidélité du client seedé');
  assert.equal(portal.loyalty.points_earned, 30);

  // --- Avis vérifié (anon) : soumission serveur puis statut ------------------
  const review = await rpcJson('public.marketplace_submit_review($1, $2, $3, $4)', [
    E2E.reviewToken,
    5,
    'Prestation impeccable, barbier très professionnel (contrôle automatique du seed).',
    null,
  ]);
  assert.equal(review.verified, true);
  const portalAfter = await rpcJson('public.marketplace_booking_by_token($1)', [E2E.reviewToken]);
  assert.equal(portalAfter.can_review, false);
  assert.equal(portalAfter.review.verified, true);
  const detailAfter = await rpcJson('public.marketplace_salon_detail($1)', [E2E.salonSlug]);
  assert.equal(detailAfter.reviews.length, 1);
  assert.equal(detailAfter.reviews[0].verified, true);
  assert.equal(detailAfter.review_count, 1);

  // --- Disponibilité de demain (anon) : créneaux proposés, 09:00 occupé ------
  const slots = (
    await db.query('select * from public.marketplace_day_availability($1, $2::date, $3, null)', [
      E2E.salonId,
      tomorrowInAbidjan(),
      E2E.serviceExpress,
    ])
  ).rows;
  assert.equal(slots.length, 12, 'les créneaux 08:00 → 19:00 doivent être générés');
  assert.ok(
    slots.some((s) => s.available),
    'au moins un créneau de demain doit être disponible',
  );
  const nineAm = slots.find((s) => new Date(s.starts_at).toISOString().slice(11, 16) === '09:00');
  assert.ok(nineAm, 'le créneau de 09:00 doit être listé');
  assert.equal(nineAm.available, false, 'le créneau 09:00 est occupé par le RDV seedé');
});
