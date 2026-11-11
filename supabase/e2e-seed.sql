-- ============================================================================
-- Jeu de données E2E (scénarios navigateur Playwright).
--
-- Chargé automatiquement par `supabase db reset` ([db.seed] dans config.toml).
-- Toutes les lignes sont étiquetées « E2E » et utilisent des UUID fixes pour
-- que les tests navigateur restent déterministes. Le dataset ne sert qu'aux
-- tests : il est recréé à l'identique à chaque reset local/CI et n'est jamais
-- poussé vers un projet distant (les seeds ne font pas partie des migrations).
--
-- Contenu :
--   1. Un compte propriétaire (auth) + organisation/salon/succursale publiés.
--   2. Horaires d'ouverture 7j/7 (08:00–20:00) pour des créneaux stables.
--   3. Deux prestations (dont une de 15 min) + un barbier qui les pratique.
--   4. Un rendez-vous terminé et réglé (parcours « avis vérifié »).
--   5. Un rendez-vous confirmé avec un paiement Wave en attente (caisse).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Compte propriétaire (connexion ERP des tests E2E)
-- ----------------------------------------------------------------------------
insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
values (
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'e2e-owner@barbercuts.test',
    extensions.crypt('E2E-Proprietaire-2026!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Propriétaire E2E"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Organisation, salon publié, succursale, appartenance
-- ----------------------------------------------------------------------------
insert into public.organizations (id, name)
values ('22222222-2222-4222-8222-222222222222', 'E2E Coiffure CI')
on conflict (id) do nothing;

insert into public.salons (
    id, organization_id, name, is_published, slug, tagline, description, type,
    city, commune, quarter, address, phone, whatsapp, email, publication_date,
    is_verified
  )
values (
    '33333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222',
    'E2E Barber Abidjan',
    true,
    'e2e-barber-abidjan',
    'Barbier de précision — données de test E2E',
    'Salon de démonstration réservé aux tests navigateur (Playwright).',
    'barbershop',
    'Abidjan',
    'Cocody',
    'Riviera',
    '12 Boulevard Lagunaire, Riviera Palmeraie',
    '+225 07 46 00 00 00',
    '+2250746000000',
    'e2e-salon@barbercuts.test',
    now(),
    true
  )
on conflict (id) do nothing;

insert into public.branches (id, salon_id, name)
values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'Principal')
on conflict (id) do nothing;

insert into public.memberships (id, salon_id, user_id, role, status)
values (
    '77777777-7777-4777-8777-777777777777',
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'owner',
    'active'
  )
on conflict (id) do nothing;

insert into public.branch_memberships (salon_id, branch_id, membership_id)
values (
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    '77777777-7777-4777-8777-777777777777'
  )
on conflict (branch_id, membership_id) do nothing;

-- Horaires : 7j/7, 08:00–20:00, pour que les créneaux des 7 prochains jours
-- (boutons « Auj. » … « Demain » de la vitrine) soient toujours proposés.
insert into public.branch_hours (salon_id, branch_id, weekday, is_open, opens_at, closes_at)
select
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  wd,
  true,
  time '08:00',
  time '20:00'
from generate_series(0, 6) as g(wd)
on conflict (salon_id, branch_id, weekday) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Prestations + barbier
-- ----------------------------------------------------------------------------
insert into public.services (id, salon_id, name, category, description, price, duration_minutes, popular)
values
  (
    '55555555-5555-4555-8555-555555555555',
    '33333333-3333-4333-8333-333333333333',
    'Coupe E2E Express',
    'coupe',
    'Coupe classique 15 minutes (jeu de test).',
    3000,
    15,
    true
  ),
  (
    '55555555-5555-4555-8555-555555555556',
    '33333333-3333-4333-8333-333333333333',
    'Coupe + Barbe E2E',
    'combo',
    'Coupe et contourage de barbe (jeu de test).',
    5000,
    30,
    false
  )
on conflict (id) do nothing;

insert into public.staff (id, salon_id, branch_id, name, role, phone, specialties, service_ids)
values (
    '66666666-6666-4666-8666-666666666666',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'Koffi E2E',
    'master_barber',
    '+225 07 46 00 00 01',
    array['coupe', 'barbe'],
    array[
      '55555555-5555-4555-8555-555555555555'::uuid,
      '55555555-5555-4555-8555-555555555556'::uuid
    ]
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Client fidèle + rendez-vous TERMINÉ et réglé (éligible à l'avis vérifié)
-- ----------------------------------------------------------------------------
insert into public.clients (id, salon_id, name, phone, email, segment)
values (
    '88888888-8888-4888-8888-888888888888',
    '33333333-3333-4333-8333-333333333333',
    'Awa Koné',
    '+225 01 02 03 04 05',
    'awa-kone@clients.test',
    'loyal'
  )
on conflict (id) do nothing;

insert into public.appointments (
    id, salon_id, branch_id, client_id, staff_id, service_id,
    client_name, client_phone, service_name, staff_name, amount, currency,
    starts_at, ends_at, status, payment_status, source, notes,
    public_cancel_token
  )
values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    '88888888-8888-4888-8888-888888888888',
    '66666666-6666-4666-8666-666666666666',
    '55555555-5555-4555-8555-555555555555',
    'Awa Koné',
    '+225 01 02 03 04 05',
    'Coupe E2E Express',
    'Koffi E2E',
    3000,
    'XOF',
    (((now() at time zone 'Africa/Abidjan')::date - 3 + time '10:00')
      at time zone 'Africa/Abidjan'),
    (((now() at time zone 'Africa/Abidjan')::date - 3 + time '10:15')
      at time zone 'Africa/Abidjan'),
    'completed',
    'paid',
    'marketplace',
    'Rendez-vous de test E2E (terminé et réglé).',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )
on conflict (id) do nothing;

-- Paiement Wave de ce rendez-vous : confirmé manuellement (preuve opérateur).
insert into public.payments (
    id, salon_id, branch_id, appointment_id, kind, status, amount, currency,
    method, provider_reference, reason, settlement_mode, settlement_note,
    actor_id, settled_by, settled_at, idempotency_key, request_payload
  )
values (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'payment',
    'confirmed',
    3000,
    'XOF',
    'wave',
    'WAVE-E2E-CONFIRMED-0001',
    'Paiement Wave du rendez-vous E2E terminé.',
    'manual_confirmed',
    'Preuve de règlement wave vérifiée manuellement (jeu E2E).',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    now(),
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '{"origin":"e2e-seed"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.appointment_events (salon_id, branch_id, appointment_id, new_status, reason)
values (
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'completed',
    'Prestation réalisée et réglée (E2E).'
  );

-- ----------------------------------------------------------------------------
-- 5. Rendez-vous confirmé à venir + paiement Wave EN ATTENTE (parcours caisse)
-- ----------------------------------------------------------------------------
insert into public.appointments (
    id, salon_id, branch_id, staff_id, service_id,
    client_name, client_phone, service_name, staff_name, amount, currency,
    starts_at, ends_at, status, payment_status, source, notes,
    public_cancel_token
  )
values (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    '66666666-6666-4666-8666-666666666666',
    '55555555-5555-4555-8555-555555555556',
    'Mariam Traoré',
    '+225 07 08 09 10 11',
    'Coupe + Barbe E2E',
    'Koffi E2E',
    5000,
    'XOF',
    (((now() at time zone 'Africa/Abidjan')::date + 1 + time '09:00')
      at time zone 'Africa/Abidjan'),
    (((now() at time zone 'Africa/Abidjan')::date + 1 + time '09:30')
      at time zone 'Africa/Abidjan'),
    'confirmed',
    'unpaid',
    'direct',
    'Rendez-vous de test E2E avec paiement mobile en attente.',
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  )
on conflict (id) do nothing;

insert into public.payments (
    id, salon_id, branch_id, appointment_id, kind, status, amount, currency,
    method, provider_reference, reason, idempotency_key, request_payload
  )
values (
    '99999999-9999-4999-8999-999999999999',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'payment',
    'pending',
    5000,
    'XOF',
    'wave',
    'WAVE-E2E-PENDING-0001',
    'Déclaration Wave en attente de vérification par le salon (E2E).',
    '99999999-9999-4999-8999-999999999998',
    '{"origin":"e2e-seed"}'::jsonb
  )
on conflict (id) do nothing;

commit;
