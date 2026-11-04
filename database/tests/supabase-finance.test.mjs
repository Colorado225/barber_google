import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerA = '11111111-1111-4111-8111-111111111111';
const managerA = '22222222-2222-4222-8222-222222222222';
const cashierA = '44444444-4444-4444-8444-444444444444';
const accountantA = '88888888-8888-4888-8888-888888888888';
const receptionistA = '55555555-5555-4555-8555-555555555555';
const ownerB = '33333333-3333-4333-8333-333333333333';

const MON = '2026-11-09';
const PERIOD_FROM = '2026-11-01';
const PERIOD_TO = '2026-11-30';

let salonA;
let branchA;
let serviceCoupe;
let serviceLong;
let staffKouassi;
let apptA; // 4000 XOF
let apptB; // 15000 XOF
let apptC; // 2000 XOF
let registerA;
let session1;
let session2;
let session3;
let apptACash1;
let apptACash2;
let apptBWave;
let apptBRefund;
let apptCCash;

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

const readMigration = (name) =>
  readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

const rpc = async (name, params) => {
  const row = (await db.query(`select * from public.${name}`, params)).rows[0];
  const base = name.split('(')[0];
  // Les RPC scalaires/jsonb reviennent dans une colonne au nom de la fonction ;
  // les RPC composites (returns public.payments) reviennent en objet ligne.
  if (row && Object.keys(row).length === 1 && base in row) return row[base];
  return row;
};

test('lot 6 migrations apply and seed two isolated tenants', async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  await db.query(
    'insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now()), ($3, now()), ($4, now()), ($5, now()), ($6, now())',
    [ownerA, managerA, cashierA, accountantA, receptionistA, ownerB],
  );
  for (const name of [
    '20261103160000_supabase_core.sql',
    '20261103170000_branch_hours.sql',
    '20261104090000_staff_schedules.sql',
    '20261104090100_appointment_operations.sql',
    '20261104090200_review_moderation.sql',
    '20261104100000_finance_foundation.sql',
    '20261104100100_payment_journal.sql',
    '20261104100200_finance_reporting.sql',
    '20261104100300_finance_permissions_fix.sql',
  ]) {
    await db.exec(await readMigration(name));
  }

  await asUser(ownerA);
  const createdA = await db.query("select * from public.create_salon('Organisation A', 'Salon A', 'Principal')");
  salonA = createdA.rows[0].salon_id;
  branchA = createdA.rows[0].branch_id;

  await asUser(ownerB);
  await db.query("select * from public.create_salon('Organisation B', 'Salon B', 'Principal')");

  await asAdmin();
  await db.query(
    `insert into public.memberships(salon_id, user_id, role)
     values ($1, $2, 'manager'), ($1, $3, 'cashier'), ($1, $4, 'accountant'), ($1, $5, 'receptionist')`,
    [salonA, managerA, cashierA, accountantA, receptionistA],
  );

  await asUser(managerA);
  serviceCoupe = (await db.query(
    `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Coupe', 'coupe', 4000, 30) returning id`, [salonA],
  )).rows[0].id;
  serviceLong = (await db.query(
    `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Soin long', 'soins', 15000, 60) returning id`, [salonA],
  )).rows[0].id;
  const serviceShort = (await db.query(
    `insert into public.services(salon_id, name, category, price, duration_minutes)
     values ($1, 'Barbe', 'barbe', 2000, 20) returning id`, [salonA],
  )).rows[0].id;
  staffKouassi = (await db.query(
    `insert into public.staff(salon_id, name, role, branch_id, service_ids)
     values ($1, 'Kouassi', 'barber', $2, $3) returning id`,
    [salonA, branchA, [serviceCoupe, serviceLong, serviceShort]],
  )).rows[0].id;
  await db.query(
    `insert into public.branch_hours(salon_id, branch_id, weekday, is_open, opens_at, closes_at)
     values ($1, $2, 1, true, '09:00', '18:00')`, [salonA, branchA],
  );

  await asUser(receptionistA);
  apptA = (await db.query(
    `select * from public.create_appointment($1, $2, $3, 'Client A', '0700000001', $4, null, null, 'phone', '')`,
    [salonA, serviceCoupe, `${MON}T09:00:00Z`, staffKouassi],
  )).rows[0].id;
  apptB = (await db.query(
    `select * from public.create_appointment($1, $2, $3, 'Client B', '0700000002', $4, null, null, 'phone', '')`,
    [salonA, serviceLong, `${MON}T10:00:00Z`, staffKouassi],
  )).rows[0].id;
  apptC = (await db.query(
    `select * from public.create_appointment($1, $2, $3, 'Client C', '0700000003', $4, null, null, 'phone', '')`,
    [salonA, serviceShort, `${MON}T11:00:00Z`, staffKouassi],
  )).rows[0].id;
  assert.ok(salonA && branchA && apptA && apptB && apptC);
});

test('cash permissions, default register, one open session and tenant isolation', async () => {
  await asUser(receptionistA);
  await expectCode(db.query('select public.open_cash_session($1, $2, 10000)', [salonA, branchA]), '42501');
  assert.equal((await db.query('select * from public.cash_sessions')).rows.length, 0);

  await asUser(cashierA);
  registerA = (await db.query('select public.ensure_default_register($1, $2) as id', [salonA, branchA])).rows[0].id;
  session1 = (await db.query('select public.open_cash_session($1, $2, 10000, $3, $4) as id',
    [salonA, branchA, registerA, 'Fond de caisse initial'])).rows[0].id;
  await expectCode(db.query('select public.open_cash_session($1, $2, 500, $3)', [salonA, branchA, registerA]), '22023');
  await expectCode(db.query('select public.open_cash_session($1, $2, -1, $3)', [salonA, branchA, registerA]), '22023');
  await expectCode(db.query('insert into public.cash_registers(salon_id, branch_id, name) values ($1, $2, $3)',
    [salonA, branchA, 'Pirate']), '42501');

  const snapshot = await rpc('get_cash_session($1, $2)', [salonA, session1]);
  assert.equal(snapshot.status, 'open');
  assert.equal(Number(snapshot.opening_balance), 10000);
  assert.equal(Number(snapshot.theoretical_balance), 10000);
  assert.equal(snapshot.register_name, 'Caisse principale');

  await asUser(accountantA);
  assert.equal((await db.query('select * from public.cash_sessions')).rows.length, 1);
  await asUser(ownerB);
  assert.equal((await db.query('select * from public.cash_sessions')).rows.length, 0);
  assert.equal((await db.query('select * from public.payments')).rows.length, 0);
  await expectCode(db.query('select public.get_cash_session($1, $2)', [salonA, session1]), '42501');
});

test('cash payments update appointment status atomically and are idempotent', async () => {
  await asUser(cashierA);
  const key1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  apptACash1 = await rpc('record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptA, 1500, 'cash', key1, 'Acompte espèces']);
  assert.equal(apptACash1.status, 'confirmed');
  assert.equal(apptACash1.settlement_mode, 'cash_drawer');
  assert.equal(apptACash1.cash_session_id, session1);
  let apt = (await db.query('select payment_status from public.appointments where id = $1', [apptA])).rows[0];
  assert.equal(apt.payment_status, 'deposit_paid');

  const replay = await rpc('record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptA, 1500, 'cash', key1, 'Acompte espèces']);
  assert.equal(replay.id, apptACash1.id);
  await expectCode(db.query('select public.record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptA, 1600, 'cash', key1, 'Acompte espèces']), '23505');
  await expectCode(db.query('select public.record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptA, 3000, 'cash', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Trop']), '22023');

  apptACash2 = await rpc('record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptA, 2500, 'cash', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Solde']);
  apt = (await db.query('select payment_status from public.appointments where id = $1', [apptA])).rows[0];
  assert.equal(apt.payment_status, 'paid');
  const snapshot = await rpc('get_cash_session($1, $2)', [salonA, session1]);
  assert.equal(Number(snapshot.theoretical_balance), 14000);
  assert.equal(Number(snapshot.total_cash_in), 4000);
});

test('mobile money stays pending until manual confirmation with matching reference and note', async () => {
  await asUser(cashierA);
  await expectCode(db.query('select public.record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptB, 5000, 'wave', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Sans référence']), '22023');
  apptBWave = await rpc('record_payment($1, $2, $3, $4, $5, $6, $7)',
    [salonA, apptB, 5000, 'wave', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'WAVE-123456', 'Paiement Wave']);
  assert.equal(apptBWave.status, 'pending');
  assert.equal(apptBWave.settlement_mode, null);
  let apt = (await db.query('select payment_status from public.appointments where id = $1', [apptB])).rows[0];
  assert.equal(apt.payment_status, 'unpaid');

  await asUser(managerA);
  await expectCode(db.query('select public.confirm_pending_payment($1, $2, $3, $4)',
    [salonA, apptBWave.id, 'WRONG-REF', 'Reçu dans le relevé marchand']), '22023');
  await expectCode(db.query('select public.confirm_pending_payment($1, $2, $3, $4)',
    [salonA, apptBWave.id, 'WAVE-123456', 'court']), '22023');
  const confirmed = await rpc('confirm_pending_payment($1, $2, $3, $4)',
    [salonA, apptBWave.id, 'WAVE-123456', 'Reçu vérifié dans le relevé marchand Wave']);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.settlement_mode, 'manual_confirmed');
  assert.equal(confirmed.cash_session_id, session1);
  apt = (await db.query('select payment_status from public.appointments where id = $1', [apptB])).rows[0];
  assert.equal(apt.payment_status, 'deposit_paid');

  await asUser(cashierA);
  const orange = await rpc('record_payment($1, $2, $3, $4, $5, $6, $7)',
    [salonA, apptB, 2000, 'orange_money', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'OM-987654', 'Tentative Orange']);
  await asUser(managerA);
  const rejected = await rpc('reject_pending_payment($1, $2, $3)', [salonA, orange.id, 'Référence introuvable']);
  assert.equal(rejected.status, 'failed');
  await expectCode(db.query('select public.confirm_pending_payment($1, $2, $3, $4)',
    [salonA, orange.id, 'OM-987654', 'Reçu vérifié dans le relevé marchand']), '22023');

  await asUser(cashierA);
  const tooMuch = await rpc('record_payment($1, $2, $3, $4, $5, $6, $7)',
    [salonA, apptB, 20000, 'wave', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'WAVE-OVER', 'En attente trop élevé']);
  await asUser(managerA);
  await expectCode(db.query('select public.confirm_pending_payment($1, $2, $3, $4)',
    [salonA, tooMuch.id, 'WAVE-OVER', 'Reçu vérifié dans le relevé marchand Wave']), '22023');
});

test('refunds, reversals and refund reversals are bounded, reasoned and netted', async () => {
  await asUser(cashierA);
  await expectCode(db.query('select public.record_payment_correction($1, $2, $3, $4, $5, $6, null, $7)',
    [salonA, apptACash1.id, 'refund', 500, 'Remboursement partiel', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '']), '42501');

  await asUser(managerA);
  await expectCode(db.query('select public.record_payment_correction($1, $2, $3, $4, $5, $6, null, $7)',
    [salonA, apptACash1.id, 'refund', 500, 'OK', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '']), '22023');
  const refund1 = await rpc('record_payment_correction($1, $2, $3, $4, $5, $6, null, $7)',
    [salonA, apptACash1.id, 'refund', 1000, 'Geste commercial client', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '']);
  assert.equal(refund1.kind, 'refund');
  assert.equal(refund1.method, 'cash');
  assert.equal(refund1.status, 'confirmed');
  let apt = (await db.query('select payment_status from public.appointments where id = $1', [apptA])).rows[0];
  assert.equal(apt.payment_status, 'deposit_paid');

  const refund2 = await rpc('record_payment_correction($1, $2, $3, $4, $5, $6, null, $7)',
    [salonA, apptACash2.id, 'refund', 2500, 'Annulation prestation payée', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '']);
  assert.equal(refund2.status, 'confirmed');
  await rpc('record_payment_correction($1, $2, $3, $4, $5, $6, null, $7)',
    [salonA, apptACash1.id, 'refund', 500, 'Solde du geste commercial', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc8', '']);
  apt = (await db.query('select payment_status from public.appointments where id = $1', [apptA])).rows[0];
  assert.equal(apt.payment_status, 'refunded');
  await expectCode(db.query('select public.record_payment_correction($1, $2, $3, $4, $5, $6, null, $7)',
    [salonA, apptACash2.id, 'refund', 1, 'Trop remboursé', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '']), '22023');
  await expectCode(db.query('select public.record_payment_correction($1, $2, $3, $4, $5, $6, null, $7)',
    [salonA, apptACash2.id, 'payment_reversal', 1, 'Déjà remboursé', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4', '']), '22023');

  apptBRefund = await rpc('record_payment_correction($1, $2, $3, $4, $5, $6, $7, $8)',
    [salonA, apptBWave.id, 'refund', 2000, 'Remboursement partiel Wave', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5', 'WAVE-REFUND-1', 'Remboursement constaté sur le relevé marchand Wave']);
  assert.equal(apptBRefund.method, 'wave');
  assert.equal(apptBRefund.settlement_mode, 'manual_confirmed');
  const reversal = await rpc('record_payment_correction($1, $2, $3, $4, $5, $6, $7, $8)',
    [salonA, apptBRefund.id, 'refund_reversal', 500, 'Remboursement annulé par le client', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc6', 'WAVE-REFUND-1-REVERSE', 'Annulation du remboursement vérifiée en agence']);
  assert.equal(reversal.kind, 'refund_reversal');
  await expectCode(db.query('select public.record_payment_correction($1, $2, $3, $4, $5, $6, $7, $8)',
    [salonA, apptBRefund.id, 'refund_reversal', 2000, 'Trop restauré', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc7', 'WAVE-REFUND-1-REVERSE-2', 'Annulation du remboursement vérifiée en agence']), '22023');
  const balance = await rpc('get_appointment_balance($1, $2)', [salonA, apptB]);
  assert.equal(Number(balance.collected), 3500);
  assert.equal(Number(balance.outstanding), 11500);
});

test('close, reconcile and cash drawer guards', async () => {
  await asUser(cashierA);
  const before = await rpc('get_cash_session($1, $2)', [salonA, session1]);
  assert.equal(Number(before.theoretical_balance), 10000); // 10000 + 4000 - 4000
  await db.query('select public.close_cash_session($1, $2, $3, $4)', [salonA, session1, 9500, 'Écart constaté au comptage']);
  const closed = await rpc('get_cash_session($1, $2)', [salonA, session1]);
  assert.equal(closed.status, 'closed');
  assert.equal(Number(closed.expected_balance), 10000);
  assert.equal(Number(closed.counted_balance), 9500);
  assert.equal(Number(closed.difference), -500);
  await expectCode(db.query('select public.record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptC, 2000, 'cash', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'Après clôture']), '22023');
  await expectCode(db.query('select public.reconcile_cash_session($1, $2, $3)', [salonA, session1, 'Écart justifié par le responsable']), '42501');

  await asUser(ownerA);
  await db.query('select public.reconcile_cash_session($1, $2, $3)', [salonA, session1, 'Écart justifié par le responsable']);
  const reconciled = await rpc('get_cash_session($1, $2)', [salonA, session1]);
  assert.equal(reconciled.status, 'reconciled');
  await expectCode(db.query('select public.close_cash_session($1, $2, $3, $4)', [salonA, session1, 9500, '']), '22023');

  // Nouvelle session : un encaissement espèces puis clôture, sans remboursement.
  await asUser(cashierA);
  session2 = (await db.query('select public.open_cash_session($1, $2, 0, $3) as id', [salonA, branchA, registerA])).rows[0].id;
  apptCCash = await rpc('record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptC, 2000, 'cash', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'Paiement complet']);
  await db.query('select public.close_cash_session($1, $2, $3, $4)', [salonA, session2, 2000, 'Comptage conforme']);

  // Session vide : impossible de rembourser en espèces au-delà du tiroir.
  session3 = (await db.query('select public.open_cash_session($1, $2, 0, $3) as id', [salonA, branchA, registerA])).rows[0].id;
  await asUser(managerA);
  await expectCode(db.query('select public.record_payment_correction($1, $2, $3, $4, $5, $6, null, $7)',
    [salonA, apptCCash.id, 'refund', 1000, 'Remboursement sans fond', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3', '']), '22023');
  const empty = await rpc('get_cash_session($1, $2)', [salonA, session3]);
  assert.equal(empty.status, 'open');
  assert.equal(Number(empty.theoretical_balance), 0);
});

test('journal and sessions are immutable, direct writes are denied', async () => {
  await asUser(cashierA);
  await expectCode(db.query('update public.payments set amount = 1 where id = $1', [apptACash1.id]), '42501');
  await expectCode(db.query('delete from public.payments where id = $1', [apptACash1.id]), '42501');
  await expectCode(db.query('update public.cash_sessions set opening_balance = 0 where id = $1', [session1]), '42501');

  await asAdmin();
  await expectCode(db.query('update public.payments set amount = 1 where id = $1', [apptACash1.id]), '23514');
  await expectCode(db.query('delete from public.payments where id = $1', [apptACash1.id]), '23514');
  await expectCode(db.query('delete from public.payment_events where payment_id = $1', [apptACash1.id]), '23514');
  await expectCode(db.query('delete from public.cash_sessions where id = $1', [session1]), '23514');
  await expectCode(db.query('update public.cash_sessions set opening_balance = 0 where id = $1', [session1]), '23514');
  const events = (await db.query('select event_type from public.payment_events where payment_id = $1 order by created_at', [apptACash1.id])).rows;
  assert.ok(events.some((e) => e.event_type === 'recorded'));
  assert.ok(events.some((e) => e.event_type === 'corrected'));
});

test('financial summary nets refunds, excludes pending and keeps period semantics', async () => {
  await asUser(managerA);
  const expense = await rpc('record_expense($1, $2, $3, $4, $5, $6, $7, $8)',
    [salonA, 'Produits coiffure', 'products', 1500, MON, branchA, 'Achat boutique', 'REC-001']);
  assert.equal(expense.created_by, managerA);
  assert.equal(expense.branch_id, branchA);
  assert.equal(expense.receipt_ref, 'REC-001');
  await expectCode(db.query('select public.record_expense($1, $2, $3, $4, $5, $6, $7, $8)',
    [salonA, 'Branche invalide', 'other', 100, MON, '00000000-0000-4000-8000-000000000000', '', '']), '22023');

  await asUser(receptionistA);
  await expectCode(db.query('select public.record_expense($1, $2, $3, $4, $5, $6, $7, $8)',
    [salonA, 'Interdit', 'other', 100, MON, branchA, '', '']), '42501');
  await expectCode(db.query('select * from public.financial_summary($1, $2, $3)', [salonA, PERIOD_FROM, PERIOD_TO]), '42501');

  await asUser(accountantA);
  const summary = await rpc('financial_summary($1, $2, $3)', [salonA, PERIOD_FROM, PERIOD_TO]);
  assert.equal(Number(summary.revenue_billed), 21000);
  assert.equal(Number(summary.revenue_collected), 5500);
  assert.equal(Number(summary.outstanding), 15500);
  assert.equal(Number(summary.refunds), 6000);
  assert.equal(Number(summary.expenses), 1500);
  assert.equal(Number(summary.net_balance), 4000);
  assert.equal(Number(summary.pending_amount), 20000);
  assert.equal(Number(summary.payment_count), 4);
  assert.equal(Number(summary.by_method.cash), 2000);
  assert.equal(Number(summary.by_method.wave), 3500);
  assert.equal(summary.by_method.orange_money, undefined);
  await expectCode(db.query('select * from public.financial_summary($1, $2, $3)', [salonA, PERIOD_TO, PERIOD_FROM]), '22023');
});

test('payment listing, appointment balance and cross-tenant RPC guards', async () => {
  await asUser(accountantA);
  const list = await rpc('list_payments($1, $2, $3, null, null, null, 500)', [salonA, PERIOD_FROM, PERIOD_TO]);
  assert.ok(Array.isArray(list));
  assert.equal(list.length, 11); // A: 2 encaissements + 3 remboursements ; B: wave + refund + reversal + failed + pending ; C: 1 cash
  const pending = await rpc('list_payments($1, null, null, null, null, $2, 100)', [salonA, 'pending']);
  assert.equal(pending.length, 1);
  const balance = await rpc('get_appointment_balance($1, $2)', [salonA, apptB]);
  assert.equal(Number(balance.billed), 15000);
  assert.equal(Number(balance.collected), 3500);
  assert.equal(Number(balance.pending), 20000);
  assert.equal(Number(balance.refunded), 2000);

  await asUser(ownerB);
  await expectCode(db.query('select public.record_payment($1, $2, $3, $4, $5, null, $6)',
    [salonA, apptA, 100, 'cash', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'Pirate']), '42501');
  await expectCode(db.query('select public.list_payments($1, null, null, null, null, null, 10)', [salonA]), '42501');
  await expectCode(db.query('select public.get_appointment_balance($1, $2)', [salonA, apptB]), '42501');
  assert.equal((await db.query('select * from public.payments')).rows.length, 0);
});

test('finance permission rewrite preserves Lot 5 review moderation', async () => {
  await asUser(managerA);
  const ok = (await db.query("select private.has_salon_permission($1, 'reviews.moderate') as ok", [salonA])).rows[0].ok;
  assert.equal(ok, true);
  await asUser(cashierA);
  const denied = (await db.query("select private.has_salon_permission($1, 'reviews.moderate') as ok", [salonA])).rows[0].ok;
  assert.equal(denied, false);
});

after(async () => {
  await db.close();
});
