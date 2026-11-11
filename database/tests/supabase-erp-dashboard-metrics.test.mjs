import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const managerA = '22222222-2222-4222-8222-222222222222';
const barberA = '44444444-4444-4444-8444-444444444444';
const ownerB = '55555555-5555-4555-8555-555555555555';

let salonA;
let branchA;
let salonB;
let serviceCoupe;
let serviceBarbe;
let staffMoussa;
let staffAicha;
let apptCompleted;
let apptConfirmed;
let apptCancelled;
let apptNoShow;
let apptMidnightParis;
let payCompleted;

async function asUser(userId) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}

async function asAdmin() {
  await db.exec('reset role');
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

async function rpcJson(sql, params = []) {
  const res = await db.query(`select public.${sql} as value`, params);
  return res.rows[0].value;
}

after(async () => {
  await db.close();
});

test('migration erp_dashboard_metrics et fuseau horaire appliquée avec données multi-statuts', async () => {
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
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now())',
    [ownerA, managerA, barberA, ownerB],
  );

  const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const name of files) {
    await db.exec(await readFile(new URL(name, migrationsDir), 'utf8'));
  }

  await asUser(ownerA);
  const resA = await db.query("select * from public.create_salon('Org Paris', 'Salon Paris', 'Marais')");
  salonA = resA.rows[0].salon_id;
  branchA = resA.rows[0].branch_id;

  await asUser(ownerB);
  const resB = await db.query("select * from public.create_salon('Org Abidjan', 'Salon Abidjan', 'Plateau')");
  salonB = resB.rows[0].salon_id;

  await asAdmin();
  await db.query("update public.branches set timezone = 'Europe/Paris' where id = $1", [branchA]);
  await db.query(
    `insert into public.memberships(salon_id, user_id, role)
     values ($1, $2, 'manager'), ($1, $3, 'barber')`,
    [salonA, managerA, barberA],
  );

  // Horaires mardi (weekday=2) : 08:00 -> 12:00 (240 min), vendredi (weekday=5) : 08:00 -> 12:00
  await db.query(
    `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
     values
       ($1, $2, 0, false, null, null),
       ($1, $2, 1, true, '08:00', '12:00'),
       ($1, $2, 2, true, '08:00', '12:00'),
       ($1, $2, 3, true, '08:00', '12:00'),
       ($1, $2, 4, true, '08:00', '12:00'),
       ($1, $2, 5, true, '08:00', '12:00'),
       ($1, $2, 6, true, '08:00', '12:00')`,
    [salonA, branchA],
  );

  // Prestations : Coupe (5000, 60 min) et Barbe (3000, 30 min)
  serviceCoupe = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Coupe Classique', 'coupe', 5000, 60) returning id`,
      [salonA],
    )
  ).rows[0].id;
  serviceBarbe = (
    await db.query(
      `insert into public.services(salon_id, name, category, price, duration_minutes)
       values ($1, 'Taille Barbe', 'barbe', 3000, 30) returning id`,
      [salonA],
    )
  ).rows[0].id;

  // Équipe : 2 coiffeurs actifs, dont Aïcha absente le 2026-11-10
  staffMoussa = (
    await db.query(
      `insert into public.staff(salon_id, branch_id, name, role, commission_rate, is_active, is_available, service_ids)
       values ($1, $2, 'Moussa', 'master_barber', 40, true, true, array[$3::uuid, $4::uuid]) returning id`,
      [salonA, branchA, serviceCoupe, serviceBarbe],
    )
  ).rows[0].id;
  staffAicha = (
    await db.query(
      `insert into public.staff(salon_id, branch_id, name, role, commission_rate, is_active, is_available, service_ids)
       values ($1, $2, 'Aïcha', 'barber', 35, true, true, array[$3::uuid, $4::uuid]) returning id`,
      [salonA, branchA, serviceCoupe, serviceBarbe],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.staff_absences(salon_id, staff_id, starts_on, ends_on, reason)
     values ($1, $2, '2026-11-10', '2026-11-10', 'Congé')`,
    [salonA, staffAicha],
  );

  // Mardi 2026-11-10 (Europe/Paris = UTC+1) :
  // - completed : 10:00..11:00 Paris = 09:00..10:00Z (5000, 60 min)
  // - confirmed : 11:00..11:30 Paris = 10:00..10:30Z (3000, 30 min)
  // - cancelled : 09:00..10:00 Paris = 08:00..09:00Z (5000, 60 min) -> doit être exclu
  // - no_show   : 08:30..09:00 Paris = 07:30..08:00Z (3000, 30 min) -> doit être exclu
  // Vendredi 2026-11-13 à 00:30 Paris (= 2026-11-12T23:30:00Z) :
  // - completed : test frontière minuit + filtre weekday (Lun-Jeu) vs friday
  apptCompleted = (
    await db.query(
      `insert into public.appointments(
        salon_id, branch_id, client_name, client_phone, service_id, service_name, amount,
        staff_id, staff_name, starts_at, ends_at, status, payment_status, source
      ) values ($1, $2, 'Client 1', '+33600000001', $3, 'Coupe Classique', 5000, $4, 'Moussa',
        '2026-11-10T09:00:00Z', '2026-11-10T10:00:00Z', 'completed', 'deposit_paid', 'direct')
      returning id`,
      [salonA, branchA, serviceCoupe, staffMoussa],
    )
  ).rows[0].id;

  apptConfirmed = (
    await db.query(
      `insert into public.appointments(
        salon_id, branch_id, client_name, client_phone, service_id, service_name, amount,
        staff_id, staff_name, starts_at, ends_at, status, payment_status, source
      ) values ($1, $2, 'Client 2', '+33600000002', $3, 'Taille Barbe', 3000, $4, 'Moussa',
        '2026-11-10T10:00:00Z', '2026-11-10T10:30:00Z', 'confirmed', 'paid', 'direct')
      returning id`,
      [salonA, branchA, serviceBarbe, staffMoussa],
    )
  ).rows[0].id;

  apptCancelled = (
    await db.query(
      `insert into public.appointments(
        salon_id, branch_id, client_name, client_phone, service_id, service_name, amount,
        staff_id, staff_name, starts_at, ends_at, status, payment_status, source, notes
      ) values ($1, $2, 'Client Annulé', '+33600000003', $3, 'Coupe Classique', 5000, $4, 'Moussa',
        '2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z', 'cancelled', 'unpaid', 'direct', 'Empêchement')
      returning id`,
      [salonA, branchA, serviceCoupe, staffMoussa],
    )
  ).rows[0].id;

  apptNoShow = (
    await db.query(
      `insert into public.appointments(
        salon_id, branch_id, client_name, client_phone, service_id, service_name, amount,
        staff_id, staff_name, starts_at, ends_at, status, payment_status, source, notes
      ) values ($1, $2, 'Client Absent', '+33600000004', $3, 'Taille Barbe', 3000, $4, 'Moussa',
        '2026-11-10T07:30:00Z', '2026-11-10T08:00:00Z', 'no_show', 'unpaid', 'direct', 'Non présenté')
      returning id`,
      [salonA, branchA, serviceBarbe, staffMoussa],
    )
  ).rows[0].id;

  // RDV à 2026-11-12T23:30:00Z -> 2026-11-13 00:30 heure de Paris (vendredi)
  apptMidnightParis = (
    await db.query(
      `insert into public.appointments(
        salon_id, branch_id, client_name, client_phone, service_id, service_name, amount,
        staff_id, staff_name, starts_at, ends_at, status, payment_status, source
      ) values ($1, $2, 'Client Minuit Paris', '+33600000005', $3, 'Taille Barbe', 3000, $4, 'Moussa',
        '2026-11-12T23:30:00Z', '2026-11-13T00:00:00Z', 'completed', 'paid', 'direct')
      returning id`,
      [salonA, branchA, serviceBarbe, staffMoussa],
    )
  ).rows[0].id;

  // Paiements du 2026-11-10 (Paris) : 5000 cash - 1000 refund + 3000 wave confirmé + 1500 wave en attente
  // + un paiement à 2026-11-12T23:30:00Z (= 2026-11-13 00:30 Paris)
  const regId = (
    await db.query(
      `insert into public.cash_registers(salon_id, branch_id, name)
       values ($1, $2, 'Caisse Principale')
       on conflict (branch_id) do update set name = excluded.name
       returning id`,
      [salonA, branchA],
    )
  ).rows[0].id;
  const sessId = (
    await db.query(
      `insert into public.cash_sessions(salon_id, branch_id, register_id, opened_by, opening_balance)
       values ($1, $2, $3, $4, 0) returning id`,
      [salonA, branchA, regId, ownerA],
    )
  ).rows[0].id;

  payCompleted = (
    await db.query(
      `insert into public.payments(
        salon_id, branch_id, appointment_id, cash_session_id, amount, method, kind, status,
        settlement_mode, settled_by, settled_at, idempotency_key, request_payload, actor_id, created_at
      ) values ($1, $2, $3, $4, 5000, 'cash', 'payment', 'confirmed', 'cash_drawer', $5, '2026-11-10T10:15:00Z', gen_random_uuid(), '{}'::jsonb, $5, '2026-11-10T10:15:00Z')
      returning id`,
      [salonA, branchA, apptCompleted, sessId, ownerA],
    )
  ).rows[0].id;

  await db.query(
    `insert into public.payments(
      salon_id, branch_id, appointment_id, cash_session_id, amount, method, kind, status,
      settlement_mode, settled_by, settled_at, original_entry_id, reason, idempotency_key, request_payload, actor_id, created_at
    ) values ($1, $2, $3, $4, 1000, 'cash', 'refund', 'confirmed', 'cash_drawer', $6, '2026-11-10T10:30:00Z', $5, 'Geste commercial', gen_random_uuid(), '{}'::jsonb, $6, '2026-11-10T10:30:00Z')`,
    [salonA, branchA, apptCompleted, sessId, payCompleted, ownerA],
  );

  await db.query(
    `insert into public.payments(
      salon_id, branch_id, appointment_id, amount, method, kind, status,
      settlement_mode, settled_by, settled_at, provider_reference, settlement_note, idempotency_key, request_payload, actor_id, created_at
    ) values
      ($1, $2, $3, 3000, 'wave', 'payment', 'confirmed', 'manual_confirmed', $4, '2026-11-10T10:45:00Z', 'WV-OK-2026', 'Paiement vérifié en caisse', gen_random_uuid(), '{}'::jsonb, $4, '2026-11-10T10:45:00Z'),
      ($1, $2, $3, 1500, 'wave', 'payment', 'pending', null, null, null, 'WV-PEND-01', '', gen_random_uuid(), '{}'::jsonb, $4, '2026-11-10T10:50:00Z'),
      ($1, $2, $5, 3000, 'card', 'payment', 'confirmed', 'manual_confirmed', $4, '2026-11-12T23:30:00Z', 'CB-MIDNIGHT', 'Paiement carte vérifié', gen_random_uuid(), '{}'::jsonb, $4, '2026-11-12T23:30:00Z')`,
    [salonA, branchA, apptConfirmed, ownerA, apptMidnightParis],
  );

  // Dépenses du 2026-11-10 : 2000 - 500 contrepassation = 1500 net
  const expId = (
    await db.query(
      `insert into public.expenses(salon_id, branch_id, title, category, amount, spent_on, created_by)
       values ($1, $2, 'Lames & serviettes', 'products', 2000, '2026-11-10', $3) returning id`,
      [salonA, branchA, ownerA],
    )
  ).rows[0].id;
  await db.query(
    `insert into public.expenses(salon_id, branch_id, title, category, amount, spent_on, entry_kind, original_expense_id, reason, created_by)
     values ($1, $2, 'Avoir fournisseur', 'products', 500, '2026-11-10', 'expense_reversal', $3, 'Remise obtenue', $4)`,
    [salonA, branchA, expId, ownerA],
  );

  assert.ok(salonA && salonB && apptCancelled && apptNoShow);
});

test('erp_dashboard_metrics, list_payments et financial_summary respectent le fuseau horaire du salon et la frontière de minuit', async () => {
  await asUser(managerA);

  // Le paiement à 2026-11-12T23:30:00Z (= 2026-11-13 00:30 Europe/Paris) est EXCLU du 2026-11-12 et INCLUS le 2026-11-13
  const listNov12 = await rpcJson("list_payments($1, '2026-11-12', '2026-11-12')", [salonA]);
  assert.equal(listNov12.length, 0);

  const listNov13 = await rpcJson("list_payments($1, '2026-11-13', '2026-11-13')", [salonA]);
  assert.equal(listNov13.length, 1);
  assert.equal(listNov13[0].provider_reference, 'CB-MIDNIGHT');

  const sumNov12 = (
    await db.query("select * from public.financial_summary($1, '2026-11-12', '2026-11-12')", [salonA])
  ).rows[0];
  assert.equal(Number(sumNov12.revenue_collected), 0);
  assert.equal(Number(sumNov12.revenue_billed), 0);

  const sumNov13 = (
    await db.query("select * from public.financial_summary($1, '2026-11-13', '2026-11-13')", [salonA])
  ).rows[0];
  assert.equal(Number(sumNov13.revenue_collected), 3000);
  assert.equal(Number(sumNov13.revenue_billed), 3000);

  const metricsNov13 = await rpcJson("erp_dashboard_metrics($1, '2026-11-13', '2026-11-13', 'all')", [
    salonA,
  ]);
  assert.equal(metricsNov13.timezone, 'Europe/Paris');
  assert.equal(metricsNov13.kpis.revenue_collected_net, 3000);
  assert.equal(metricsNov13.kpis.appointments_completed, 1);
});

test('erp_dashboard_metrics sépare encaissé/facturé/réalisé, exclut annulés/no_show et calcule l’occupation réelle durée/capacité', async () => {
  await asUser(managerA);
  const m = await rpcJson("erp_dashboard_metrics($1, '2026-11-10', '2026-11-10', 'all')", [salonA]);

  assert.equal(m.timezone, 'Europe/Paris');
  assert.equal(m.kpis.revenue_collected_net, 7000); // 5000 - 1000 + 3000
  assert.equal(m.kpis.revenue_collected_gross, 8000);
  assert.equal(m.kpis.refunds, 1000);
  assert.equal(m.kpis.pending_payments_amount, 1500);
  assert.equal(m.kpis.confirmed_payment_count, 2); // seuls les paiements confirmés, pas le remboursement
  assert.equal(m.kpis.average_basket, 3500); // round(7000 / 2)
  assert.equal(m.kpis.revenue_billed, 8000); // 5000 + 3000 (annulé + absent exclus)
  assert.equal(m.kpis.revenue_realized, 5000); // completed uniquement
  assert.equal(m.kpis.outstanding, 1000); // (5000 - 4000) + (3000 - 3000)
  assert.equal(m.kpis.expenses_net, 1500); // 2000 - 500
  assert.equal(m.kpis.net_margin, 5500); // 7000 - 1500

  assert.equal(m.kpis.appointments_total, 4);
  assert.equal(m.kpis.appointments_active, 2);
  assert.equal(m.kpis.appointments_completed, 1);
  assert.equal(m.kpis.appointments_cancelled, 1);
  assert.equal(m.kpis.appointments_no_show, 1);

  assert.equal(m.by_method.cash, 4000);
  assert.equal(m.by_method.wave, 3000);

  // Palmarès : annulés et absents exclus des volumes/CA réalisés et facturés
  const coupe = m.service_performance.find((s) => s.service_id === serviceCoupe);
  const barbe = m.service_performance.find((s) => s.service_id === serviceBarbe);
  assert.equal(coupe.completed_volume, 1);
  assert.equal(coupe.completed_revenue, 5000);
  assert.equal(coupe.billed_volume, 1);
  assert.equal(coupe.cancelled_volume, 1);
  assert.equal(barbe.completed_volume, 0);
  assert.equal(barbe.billed_volume, 1);
  assert.equal(barbe.billed_revenue, 3000);
  assert.equal(barbe.no_show_volume, 1);

  // Activité équipe : Moussa a 1 réalisée, 2 actives, 1 annulé, 1 absent
  const moussa = m.staff_activity.find((s) => s.staff_id === staffMoussa);
  assert.equal(moussa.completed_appointments, 1);
  assert.equal(moussa.billed_appointments, 2);
  assert.equal(moussa.cancelled_appointments, 1);
  assert.equal(moussa.no_show_appointments, 1);

  // Occupation horaire : Aïcha est absente le 2026-11-10 -> capacité = 30 min par créneau (Moussa uniquement).
  // Les créneaux annulé (09:00-10:00) et no_show (08:30) doivent être à 0%.
  // La coupe de 60 min (10:00-11:00) doit occuper 10:00 ET 10:30 à 100% (30/30 min chacun).
  const slot = (hhmm) => m.hourly_occupancy.find((h) => h.hour === hhmm);
  assert.equal(slot('08:30').occupancy_rate, 0);
  assert.equal(slot('09:00').occupancy_rate, 0);
  assert.equal(slot('09:30').occupancy_rate, 0);
  assert.equal(slot('10:00').occupied_minutes, 30);
  assert.equal(slot('10:00').available_minutes, 30);
  assert.equal(slot('10:00').occupancy_rate, 100);
  assert.equal(slot('10:30').occupied_minutes, 30);
  assert.equal(slot('10:30').available_minutes, 30);
  assert.equal(slot('10:30').occupancy_rate, 100);
  assert.equal(slot('11:00').occupancy_rate, 100);
  assert.equal(slot('11:30').occupancy_rate, 0);
});

test('filtre jour weekday (Lun-Jeu) vs friday et contrôle RBAC / isolation tenant', async () => {
  await asUser(managerA);
  // Sur [2026-11-10..2026-11-13] : le mardi 10 (weekday) a des RDV, le vendredi 13 (00:30) uniquement le vendredi
  const weekdayOnly = await rpcJson("erp_dashboard_metrics($1, '2026-11-10', '2026-11-13', 'weekday')", [
    salonA,
  ]);
  const slot0030Weekday = weekdayOnly.hourly_occupancy.find((h) => h.hour === '00:30');
  assert.equal(slot0030Weekday?.active_appointments ?? 0, 0);

  const fridayOnly = await rpcJson("erp_dashboard_metrics($1, '2026-11-10', '2026-11-13', 'friday')", [
    salonA,
  ]);
  const slot0030Friday = fridayOnly.hourly_occupancy.find((h) => h.hour === '00:30');
  assert.equal(slot0030Friday.active_appointments, 1);

  // Barber : voit le planning (appointments.read), mais finance et dépenses restent null (RBAC)
  await asUser(barberA);
  const barberMetrics = await rpcJson("erp_dashboard_metrics($1, '2026-11-10', '2026-11-10', 'all')", [
    salonA,
  ]);
  assert.equal(barberMetrics.permissions.can_view_finance, false);
  assert.equal(barberMetrics.permissions.can_view_expenses, false);
  assert.equal(barberMetrics.permissions.can_view_appointments, true);
  assert.equal(barberMetrics.kpis.revenue_collected_net, null);
  assert.equal(barberMetrics.kpis.expenses_net, null);
  assert.equal(barberMetrics.kpis.appointments_completed, 1);

  // Cross-tenant : refus strict SQLSTATE 42501
  await asUser(ownerB);
  await expectCode(
    rpcJson("erp_dashboard_metrics($1, '2026-11-10', '2026-11-10', 'all')", [salonA]),
    '42501',
  );
});
