// Lot 4 — tests financiers : caisse, encaissements, remboursements, dépenses, rapports.
// Exécutés sur PGlite avec les rôles SQL réels : RLS, journal immuable et
// fonctions SECURITY DEFINER sont réellement exercés.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';

import { createAuthApp } from '../server/auth-app.js';
import { createAuthRepository } from '../server/auth-repository.js';
import { createResourceApp } from '../server/resource-app.js';
import { createSalonRepository } from '../server/salon-repository.js';
import { createOperationsRepository } from '../server/operations-repository.js';
import { createFinanceRepository } from '../server/finance-repository.js';
import { createSessionRunner } from '../server/session-runner.js';

const ORIGIN = 'https://example.test';
const PASSWORD = 'UnMotDePasseSolide2026';

const MIGRATIONS = [
  '20261102230000_postgresql_identity.sql',
  '20261103020000_auth_accounts.sql',
  '20261103000000_tenant_foundation.sql',
  '20261103010000_operational_workflow.sql',
  '20261103020000_salon_resources.sql',
  '20261103030000_lot2_account_security.sql',
  '20261103040000_lot3_operations.sql',
  '20261103060000_lot3_fitions.sql',
  '20261103050000_lot4_finance.sql',
];

let db;
let app;

const cookieOf = (res) => res.headers['set-cookie'][0].split(';')[0];
const slot = (date, hhmm) => new Date(`${date}T${hhmm}:00.000Z`).toISOString();
const addMinutes = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60000).toISOString();

async function createAccount(email, name = 'QA User') {
  const signup = await request(app)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ name, email, password: PASSWORD })
    .expect(201);
  await request(app)
    .post('/api/auth/verify-email')
    .set('Origin', ORIGIN)
    .send({ token: signup.body.token })
    .expect(200);
  const login = await request(app)
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password: PASSWORD })
    .expect(200);
  const rows = await db.query('select user_id from public.bc_auth_accounts where email = $1', [email]);
  return { cookie: cookieOf(login), userId: rows.rows[0].user_id };
}

/** Salon prêt à encaisser : service 10 000, employé, client, RDV confirmé. */
async function createShop(label, { price = 10000 } = {}) {
  const owner = await createAccount(`owner-${label}@example.test`, `Owner ${label}`);
  const salon = await request(app)
    .post('/api/salons')
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ organizationName: `Org ${label}`, salonName: `Salon ${label}`, branchName: 'Principal' })
    .expect(201);
  const salonId = salon.body.salon_id;
  const branchId = salon.body.branch_id;
  const service = await request(app)
    .post(`/api/salons/${salonId}/services`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ name: 'Formule', category: 'combo', price, durationMinutes: 60 })
    .expect(200);
  const staff = await request(app)
    .post(`/api/salons/${salonId}/staff`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ name: 'Kevin', role: 'barber', commissionRate: 25, branchId, serviceIds: [service.body.id] })
    .expect(200);
  const client = await request(app)
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ name: 'Awa Koné', phone: '+225 01020304' })
    .expect(200);
  const date = '2031-05-05';
  const appointment = await request(app)
    .post(`/api/salons/${salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({
      branchId,
      clientId: client.body.id,
      staffId: staff.body.id,
      serviceId: service.body.id,
      startsAt: slot(date, '10:00'),
      endsAt: addMinutes(slot(date, '10:00'), 60),
    })
    .expect(200);
  return {
    owner,
    salonId,
    branchId,
    service: service.body,
    staff: staff.body,
    client: client.body,
    appointment: appointment.body,
    date,
  };
}

const pay = (shop, body) =>
  request(app)
    .post(`/api/salons/${shop.salonId}/payments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ appointmentId: shop.appointment.id, ...body });

before(async () => {
  db = new PGlite();
  for (const file of MIGRATIONS) {
    await db.exec(await readFile(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'));
  }
  const authRepository = createAuthRepository(db);
  app = express();
  app.disable('x-powered-by');
  app.use(
    createAuthApp({
      repository: authRepository,
      allowedOrigin: ORIGIN,
      secureCookie: true,
      exposeTokens: true,
      rateLimits: { global: 100000, login: 100000, mail: 100000 },
    }),
  );
  app.use(
    createResourceApp({
      authRepository,
      salonRepository: createSalonRepository(db),
      operationsRepository: createOperationsRepository(db),
      financeRepository: createFinanceRepository(db),
      sessionRunner: createSessionRunner(db),
      allowedOrigin: ORIGIN,
    }).app,
  );
});

after(async () => {
  await db.close();
});

// ---------------------------------------------------------------------------
// 4.1 Caisse
// ---------------------------------------------------------------------------

test('caisse : ouverture unique par caisse, clôture avec écart, rapprochement', async () => {
  const shop = await createShop('cash');

  const opened = await request(app)
    .post(`/api/salons/${shop.salonId}/cash-sessions`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ branchId: shop.branchId, openingBalance: 20000 })
    .expect(200);
  assert.equal(opened.body.status, 'open');
  assert.equal(opened.body.openingBalance, 20000);
  assert.ok(opened.body.registerName.length > 0, 'une caisse par défaut est créée');

  // Deuxième ouverture sur la même caisse : refusée par la base.
  const second = await request(app)
    .post(`/api/salons/${shop.salonId}/cash-sessions`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ branchId: shop.branchId, openingBalance: 5000 });
  assert.equal(second.status, 400);

  // Encaissement espèces → alimente le solde attendu.
  await pay(shop, { amount: 6000, method: 'cash', idempotencyKey: randomUUID() }).expect(200);
  // Encaissement mobile : n'entre pas dans le solde espèces.
  await pay(shop, { amount: 2000, method: 'manual_mobile', idempotencyKey: randomUUID() }).expect(200);

  const closed = await request(app)
    .post(`/api/salons/${shop.salonId}/cash-sessions/${opened.body.id}/close`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ countedCash: 25500, notes: 'Fin de journée' })
    .expect(200);
  assert.equal(closed.body.status, 'closed');
  assert.equal(closed.body.expectedBalance, 26000, '20000 de fond + 6000 espèces');
  assert.equal(closed.body.closingBalance, 25500);
  assert.equal(closed.body.difference, -500);

  // Une session clôturée ne se clôture pas deux fois.
  await request(app)
    .post(`/api/salons/${shop.salonId}/cash-sessions/${opened.body.id}/close`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ countedCash: 1000 })
    .expect(400);

  // Rapprochement : clôture d'abord, réservé à l'action de contrôle.
  const reconciled = await request(app)
    .post(`/api/salons/${shop.salonId}/cash-sessions/${opened.body.id}/reconcile`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ notes: 'Écart justifié : monnaie rendue' })
    .expect(200);
  assert.equal(reconciled.body.status, 'reconciled');

  // Une nouvelle session peut alors être ouverte.
  await request(app)
    .post(`/api/salons/${shop.salonId}/cash-sessions`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ branchId: shop.branchId, openingBalance: 0 })
    .expect(200);
});

test('caisse : une seule ouverture réussit en cas de concurrence', async () => {
  const shop = await createShop('cash-race');
  const send = () =>
    request(app)
      .post(`/api/salons/${shop.salonId}/cash-sessions`)
      .set('Origin', ORIGIN)
      .set('Cookie', shop.owner.cookie)
      .send({ branchId: shop.branchId, openingBalance: 1000 });
  const results = await Promise.all([send(), send(), send()]);
  const ok = results.filter((r) => r.status === 200).length;
  assert.equal(ok, 1, `statuts: ${results.map((r) => r.status).join(',')}`);

  const count = await db.query(
    "select count(*)::int as n from public.bc_cash_sessions where salon_id = $1 and status = 'open'",
    [shop.salonId],
  );
  assert.equal(count.rows[0].n, 1);
});

// ---------------------------------------------------------------------------
// 4.2 Encaissements
// ---------------------------------------------------------------------------

test('encaissements partiels : solde restant calculé depuis les opérations réelles', async () => {
  const shop = await createShop('partial');

  const first = await pay(shop, { amount: 4000, method: 'cash', idempotencyKey: randomUUID() }).expect(200);
  assert.equal(first.body.amount, 4000);
  assert.equal(first.body.currency, 'XOF');
  assert.equal(first.body.paymentStatus, 'confirmed');

  let balance = await request(app)
    .get(`/api/salons/${shop.salonId}/appointments/${shop.appointment.id}/balance`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.deepEqual(balance.body, { billed: 10000, collected: 4000, outstanding: 6000 });

  await pay(shop, { amount: 6000, method: 'manual_card', idempotencyKey: randomUUID() }).expect(200);
  balance = await request(app)
    .get(`/api/salons/${shop.salonId}/appointments/${shop.appointment.id}/balance`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.deepEqual(balance.body, { billed: 10000, collected: 10000, outstanding: 0 });

  // Dépassement du montant facturé refusé.
  await pay(shop, { amount: 1, method: 'cash', idempotencyKey: randomUUID() }).expect(400);
});

test('idempotence : un rejeu avec la même clé ne crée pas de doublon', async () => {
  const shop = await createShop('idempotent');
  const key = randomUUID();
  const results = await Promise.all([
    pay(shop, { amount: 3000, method: 'cash', idempotencyKey: key }),
    pay(shop, { amount: 3000, method: 'cash', idempotencyKey: key }),
  ]);
  const ok = results.filter((r) => r.status === 200).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  assert.equal(ok, 1);
  assert.equal(conflicts, 1);

  const rows = await db.query(
    'select count(*)::int as n from public.bc_payment_entries where idempotency_key = $1',
    [key],
  );
  assert.equal(rows.rows[0].n, 1);
});

test('encaissements concurrents : le solde restant ne peut pas être dépassé', async () => {
  const shop = await createShop('race-pay', { price: 5000 });
  // 6 paiements simultanés de 1000 : au plus 5 peuvent passer (5000 facturés).
  const sends = Array.from({ length: 6 }, () =>
    pay(shop, { amount: 1000, method: 'cash', idempotencyKey: randomUUID() }),
  );
  const results = await Promise.all(sends);
  const ok = results.filter((r) => r.status === 200).length;
  assert.equal(ok, 5, `statuts: ${results.map((r) => r.status).join(',')}`);

  const sum = await db.query(
    "select coalesce(sum(amount),0)::int as total from public.bc_payment_entries where appointment_id = $1 and payment_status = 'confirmed'",
    [shop.appointment.id],
  );
  assert.equal(sum.rows[0].total, 5000);
});

// ---------------------------------------------------------------------------
// 4.3 Paiements électroniques
// ---------------------------------------------------------------------------

test('paiement électronique : reste en attente sans preuve fournisseur', async () => {
  const shop = await createShop('pending');

  const pending = await pay(shop, {
    amount: 5000,
    method: 'manual_mobile',
    paymentStatus: 'pending',
    idempotencyKey: randomUUID(),
  }).expect(200);
  assert.equal(pending.body.paymentStatus, 'pending');

  // Un paiement en attente ne compte pas comme encaissé.
  const balance = await request(app)
    .get(`/api/salons/${shop.salonId}/appointments/${shop.appointment.id}/balance`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.deepEqual(balance.body, { billed: 10000, collected: 0, outstanding: 10000 });

  // Confirmation sans référence fournisseur : refusée.
  await request(app)
    .post(`/api/salons/${shop.salonId}/payments/${pending.body.id}/confirm`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ providerReference: 'ab' })
    .expect(400);

  const confirmed = await request(app)
    .post(`/api/salons/${shop.salonId}/payments/${pending.body.id}/confirm`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ providerReference: 'WAVE-TX-884213' })
    .expect(200);
  assert.equal(confirmed.body.paymentStatus, 'confirmed');
  assert.equal(confirmed.body.providerReference, 'WAVE-TX-884213');

  const after = await request(app)
    .get(`/api/salons/${shop.salonId}/appointments/${shop.appointment.id}/balance`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.deepEqual(after.body, { billed: 10000, collected: 5000, outstanding: 5000 });
});

// ---------------------------------------------------------------------------
// 4.4 Remboursements et immuabilité
// ---------------------------------------------------------------------------

test('remboursements partiels traçables, journal immuable', async () => {
  const shop = await createShop('refund');
  const payment = await pay(shop, { amount: 10000, method: 'cash', idempotencyKey: randomUUID() }).expect(
    200,
  );

  // Motif obligatoire.
  await request(app)
    .post(`/api/salons/${shop.salonId}/refunds`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      appointmentId: shop.appointment.id,
      amount: 2000,
      method: 'cash',
      reason: 'x',
      idempotencyKey: randomUUID(),
    })
    .expect(400);

  const refund = await request(app)
    .post(`/api/salons/${shop.salonId}/refunds`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      appointmentId: shop.appointment.id,
      amount: 2500,
      method: 'cash',
      reason: 'Prestation interrompue',
      originalEntryId: payment.body.id,
      idempotencyKey: randomUUID(),
    })
    .expect(200);
  assert.equal(refund.body.kind, 'refund');
  assert.equal(refund.body.reason, 'Prestation interrompue');
  assert.equal(refund.body.actorId, shop.owner.userId, 'l’auteur est enregistré');

  const balance = await request(app)
    .get(`/api/salons/${shop.salonId}/appointments/${shop.appointment.id}/balance`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.deepEqual(balance.body, { billed: 10000, collected: 7500, outstanding: 2500 });

  // Remboursement supérieur au montant encaissé refusé.
  await request(app)
    .post(`/api/salons/${shop.salonId}/refunds`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      appointmentId: shop.appointment.id,
      amount: 9999,
      method: 'cash',
      reason: 'Trop',
      idempotencyKey: randomUUID(),
    })
    .expect(400);

  // Le journal refuse toute modification ou suppression, même en SQL direct.
  await assert.rejects(
    db.query('update public.bc_payment_entries set amount = 1 where id = $1', [payment.body.id]),
    /immutable/i,
  );
  await assert.rejects(
    db.query('delete from public.bc_payment_entries where id = $1', [payment.body.id]),
    /immutable/i,
  );

  // L'historique reste lisible et complet.
  const entries = await request(app)
    .get(`/api/salons/${shop.salonId}/payments?appointmentId=${shop.appointment.id}`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.deepEqual(entries.body.map((e) => e.kind).sort(), ['payment', 'refund']);
});

// ---------------------------------------------------------------------------
// 4.5 Dépenses
// ---------------------------------------------------------------------------

test('dépenses : succursale, justificatif, responsable, période', async () => {
  const shop = await createShop('expenses');
  const created = await request(app)
    .post(`/api/salons/${shop.salonId}/expenses`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      title: 'Produits de rasage',
      category: 'products',
      amount: 12000,
      date: shop.date,
      notes: 'Facture fournisseur',
      branchId: shop.branchId,
      receiptRef: 'FAC-2026-0142',
    })
    .expect(200);
  assert.equal(created.body.amount, 12000);
  assert.equal(created.body.branchId, shop.branchId);
  assert.equal(created.body.receiptRef, 'FAC-2026-0142');
  assert.equal(created.body.createdBy, shop.owner.userId);

  // Succursale inconnue refusée.
  await request(app)
    .post(`/api/salons/${shop.salonId}/expenses`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ title: 'X', category: 'other', amount: 100, date: shop.date, branchId: randomUUID() })
    .expect(400);

  const list = await request(app)
    .get(`/api/salons/${shop.salonId}/expenses?from=${shop.date}&to=${shop.date}`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.equal(list.body.length, 1);
});

// ---------------------------------------------------------------------------
// 4.6 Rapports
// ---------------------------------------------------------------------------

test('rapports : CA facturé, encaissé, restant, dépenses et solde net distingués', async () => {
  const shop = await createShop('report', { price: 10000 });
  await pay(shop, { amount: 7000, method: 'cash', idempotencyKey: randomUUID() }).expect(200);
  await pay(shop, { amount: 1000, method: 'manual_mobile', idempotencyKey: randomUUID() }).expect(200);
  await request(app)
    .post(`/api/salons/${shop.salonId}/expenses`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ title: 'Électricité', category: 'electricity', amount: 1500, date: shop.date })
    .expect(200);

  const summary = await request(app)
    .get(`/api/salons/${shop.salonId}/finance/summary?from=${shop.date}&to=${shop.date}`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.deepEqual(summary.body, {
    revenueBilled: 10000,
    revenueCollected: 8000,
    outstanding: 2000,
    refunds: 0,
    expenses: 1500,
    netBalance: 6500,
  });

  const report = await request(app)
    .get(`/api/salons/${shop.salonId}/finance/report?from=${shop.date}&to=${shop.date}`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.equal(report.body.summary.revenueCollected, 8000);
  const cash = report.body.methods.find((m) => m.method === 'cash');
  const mobile = report.body.methods.find((m) => m.method === 'manual_mobile');
  assert.equal(cash.total, 7000);
  assert.equal(mobile.total, 1000);
  assert.equal(report.body.services[0].name, 'Formule');
  assert.equal(report.body.staff[0].appointments, 1);
  assert.deepEqual(report.body.daily, [{ date: shop.date, collected: 8000, expenses: 1500 }]);
});

// ---------------------------------------------------------------------------
// Isolation
// ---------------------------------------------------------------------------

test('isolation : aucun accès financier à un autre salon', async () => {
  const shopA = await createShop('fin-a');
  const shopB = await createShop('fin-b');
  await pay(shopA, { amount: 1000, method: 'cash', idempotencyKey: randomUUID() }).expect(200);

  await request(app)
    .get(`/api/salons/${shopA.salonId}/payments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shopB.owner.cookie)
    .expect(403);
  await request(app)
    .get(`/api/salons/${shopA.salonId}/finance/summary`)
    .set('Origin', ORIGIN)
    .set('Cookie', shopB.owner.cookie)
    .expect(403);
  await request(app)
    .post(`/api/salons/${shopA.salonId}/payments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shopB.owner.cookie)
    .send({ appointmentId: shopA.appointment.id, amount: 100, method: 'cash', idempotencyKey: randomUUID() })
    .expect(403);
});

test('permissions : un barbier ne peut ni encaisser ni rembourser', async () => {
  const shop = await createShop('perm-fin');
  const barber = await createAccount('barber-fin@example.test', 'Barbier');
  await db.query("insert into public.bc_memberships(salon_id,user_id,role) values ($1,$2,'barber')", [
    shop.salonId,
    barber.userId,
  ]);
  await request(app)
    .post(`/api/salons/${shop.salonId}/payments`)
    .set('Origin', ORIGIN)
    .set('Cookie', barber.cookie)
    .send({ appointmentId: shop.appointment.id, amount: 1000, method: 'cash', idempotencyKey: randomUUID() })
    .expect(403);
  await request(app)
    .post(`/api/salons/${shop.salonId}/refunds`)
    .set('Origin', ORIGIN)
    .set('Cookie', barber.cookie)
    .send({
      appointmentId: shop.appointment.id,
      amount: 100,
      method: 'cash',
      reason: 'Test',
      idempotencyKey: randomUUID(),
    })
    .expect(403);
});
