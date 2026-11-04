// Lot 3 — tests opérationnels : prestations, personnel, rendez-vous,
// disponibilités et anti-chevauchement. Exécutés sur PGlite avec les rôles
// SQL réels (bc_app / bc_auth) : les politiques RLS et les fonctions
// SECURITY DEFINER sont donc réellement exercées.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';

import { createAuthApp } from '../server/auth-app.js';
import { createAuthRepository } from '../server/auth-repository.js';
import { createResourceApp } from '../server/resource-app.js';
import { createSalonRepository } from '../server/salon-repository.js';
import { createOperationsRepository } from '../server/operations-repository.js';
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
  '20261103050000_lot4_finance.sql'
];

let db;
let app;

const cookieOf = (res) => {
  const header = res.headers['set-cookie'];
  return Array.isArray(header) ? header[0].split(';')[0] : null;
};

async function createVerifiedAccount(email, name = 'QA User') {
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

/** Contexte de test : salon + personnel + prestation + client prêts à réserver. */
async function createShop(label) {
  const owner = await createVerifiedAccount(`owner-${label}@example.test`, `Owner ${label}`);
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
    .send({ name: 'Dégradé', category: 'coupe', price: 4000, durationMinutes: 40 })
    .expect(200);

  const staff = await request(app)
    .post(`/api/salons/${salonId}/staff`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({
      name: 'Kevin',
      role: 'barber',
      phone: '+225 0700000001',
      commissionRate: 25,
      branchId,
      serviceIds: [service.body.id]
    })
    .expect(200);

  const client = await request(app)
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ name: 'Awa Koné', phone: '+225 01020304', segment: 'new' })
    .expect(200);

  return {
    owner,
    salonId,
    branchId,
    service: service.body,
    staff: staff.body,
    client: client.body
  };
}

/** Créneau ISO dans le fuseau d'Abidjan (UTC+0, pas d'heure d'été). */
const slot = (date, hhmm) => new Date(`${date}T${hhmm}:00.000Z`).toISOString();
const addMinutes = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60000).toISOString();

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
      rateLimits: { global: 100000, login: 100000, mail: 100000 }
    })
  );
  app.use(
    createResourceApp({
      authRepository,
      salonRepository: createSalonRepository(db),
      operationsRepository: createOperationsRepository(db),
      sessionRunner: createSessionRunner(db),
      allowedOrigin: ORIGIN
    }).app
  );
});

after(async () => {
  await db.close();
});

// ---------------------------------------------------------------------------
// 3.1 Prestations
// ---------------------------------------------------------------------------

test('prestations : prix entiers en XOF, activation et filtrage du catalogue', async () => {
  const shop = await createShop('catalog');
  const services = await request(app)
    .get(`/api/salons/${shop.salonId}/services`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.equal(services.body.length, 1);
  assert.equal(services.body[0].price, 4000);
  assert.ok(Number.isInteger(services.body[0].price), 'le prix doit être un entier (XOF)');
  assert.equal(services.body[0].isActive, true);

  // Prix décimal refusé : aucune arithmétique flottante en base.
  await request(app)
    .post(`/api/salons/${shop.salonId}/services`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ name: 'Flottant', category: 'coupe', price: 4000.5, durationMinutes: 30 })
    .expect(400);

  // Désactivation : la prestation sort du catalogue actif mais reste lisible.
  await request(app)
    .put(`/api/salons/${shop.salonId}/services/${shop.service.id}/activation`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ isActive: false })
    .expect(200);

  const active = await request(app)
    .get(`/api/salons/${shop.salonId}/services`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.equal(active.body.length, 0);

  const all = await request(app)
    .get(`/api/salons/${shop.salonId}/services?all=1`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.equal(all.body.length, 1);
  assert.equal(all.body[0].isActive, false);
});

// ---------------------------------------------------------------------------
// 3.2 Personnel
// ---------------------------------------------------------------------------

test('personnel : profil métier sans compte, horaires et absences', async () => {
  const shop = await createShop('team');

  // Le profil existe sans identité de connexion (userId null).
  assert.equal(shop.staff.userId, null);
  assert.equal(shop.staff.email, '');
  assert.deepEqual(shop.staff.serviceIds, [shop.service.id]);
  assert.equal(shop.staff.branchId, shop.branchId);

  const schedule = await request(app)
    .post(`/api/salons/${shop.salonId}/staff/${shop.staff.id}/schedule`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ weekday: 1, startsAt: '09:00', endsAt: '18:00' })
    .expect(200);
  assert.equal(schedule.body.startsAt, '09:00');

  // Plage invalide refusée.
  await request(app)
    .post(`/api/salons/${shop.salonId}/staff/${shop.staff.id}/schedule`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ weekday: 1, startsAt: '18:00', endsAt: '09:00' })
    .expect(400);

  const absence = await request(app)
    .post(`/api/salons/${shop.salonId}/staff/${shop.staff.id}/absences`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ startsOn: '2030-01-10', endsOn: '2030-01-12', reason: 'Congés' })
    .expect(200);
  assert.equal(absence.body.reason, 'Congés');

  const absences = await request(app)
    .get(`/api/salons/${shop.salonId}/staff/${shop.staff.id}/absences`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.equal(absences.body.length, 1);

  // Un réceptionniste ne gère pas l'équipe.
  const reception = await createVerifiedAccount('reception-team@example.test', 'Réception');
  await db.query("insert into public.bc_memberships(salon_id,user_id,role) values ($1,$2,'receptionist')", [
    shop.salonId,
    reception.userId
  ]);
  await request(app)
    .post(`/api/salons/${shop.salonId}/staff`)
    .set('Origin', ORIGIN)
    .set('Cookie', reception.cookie)
    .send({ name: 'Intrus', role: 'barber', commissionRate: 10 })
    .expect(403);
});

// ---------------------------------------------------------------------------
// 3.3 / 3.4 Rendez-vous et disponibilités
// ---------------------------------------------------------------------------

test('réservation : persistance, disponibilité et refus du chevauchement', async () => {
  const shop = await createShop('booking');
  const date = '2030-02-04'; // lundi
  const start = slot(date, '10:00');
  const end = addMinutes(start, 40);

  const created = await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: start,
      endsAt: end,
      source: 'direct'
    })
    .expect(200);
  assert.equal(created.body.status, 'confirmed');
  assert.equal(created.body.price, 4000);
  assert.equal(created.body.date, date);
  assert.equal(created.body.time, '10:00');
  assert.equal(created.body.clientName, 'Awa Koné');

  // Le rendez-vous est bien persisté.
  const listed = await request(app)
    .get(`/api/salons/${shop.salonId}/appointments?from=${date}&to=${date}`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.equal(listed.body.length, 1);

  // Second rendez-vous qui chevauche : 409 explicite.
  const conflict = await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: addMinutes(start, 20),
      endsAt: addMinutes(end, 20)
    })
    .expect(409);
  assert.equal(conflict.body.code, 'slot_conflict');

  // Un créneau contigu reste possible (aucun chevauchement).
  await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: end,
      endsAt: addMinutes(end, 40)
    })
    .expect(200);
});

test('réservation : deux requêtes concurrentes ne peuvent pas prendre le même créneau', async () => {
  const shop = await createShop('race');
  const date = '2030-02-05';
  const start = slot(date, '11:00');
  const end = addMinutes(start, 40);

  const payload = {
    branchId: shop.branchId,
    clientId: shop.client.id,
    staffId: shop.staff.id,
    serviceId: shop.service.id,
    startsAt: start,
    endsAt: end
  };
  const send = () =>
    request(app)
      .post(`/api/salons/${shop.salonId}/appointments`)
      .set('Origin', ORIGIN)
      .set('Cookie', shop.owner.cookie)
      .send(payload);

  // Les requêtes sont émises simultanément : une seule doit réussir.
  const results = await Promise.all([send(), send(), send()]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 409, 409]);

  const rows = await db.query(
    "select count(*)::int as count from public.bc_appointments where salon_id = $1 and status <> 'cancelled'",
    [shop.salonId]
  );
  assert.equal(rows.rows[0].count, 1, 'un seul rendez-vous doit être enregistré');
});

test('disponibilités : absences, horaires et prestation non maîtrisée', async () => {
  const shop = await createShop('availability');
  const date = '2030-02-06';

  // Horaires de l'employé : 09:00 → 12:00 le mercredi (weekday 3).
  await request(app)
    .post(`/api/salons/${shop.salonId}/staff/${shop.staff.id}/schedule`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ weekday: 3, startsAt: '09:00', endsAt: '12:00' })
    .expect(200);

  // 08:00 est hors horaires → refusé.
  await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: slot(date, '08:00'),
      endsAt: slot(date, '08:40')
    })
    .expect(409);

  // Dans les horaires → accepté.
  await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: slot(date, '09:00'),
      endsAt: slot(date, '09:40')
    })
    .expect(200);

  // Le lendemain, en absence → refusé.
  await request(app)
    .post(`/api/salons/${shop.salonId}/staff/${shop.staff.id}/absences`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ startsOn: '2030-02-07', endsOn: '2030-02-07', reason: 'Formation' })
    .expect(200);
  await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: slot('2030-02-07', '10:00'),
      endsAt: slot('2030-02-07', '10:40')
    })
    .expect(409);

  // Une prestation non maîtrisée par l'employé → refusée.
  const otherService = await request(app)
    .post(`/api/salons/${shop.salonId}/services`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ name: 'Coloration', category: 'coloration', price: 9000, durationMinutes: 60 })
    .expect(200);
  await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: otherService.body.id,
      startsAt: slot('2030-02-13', '10:00'),
      endsAt: slot('2030-02-13', '11:00')
    })
    .expect(400);

  // La grille de disponibilités reflète les horaires.
  const grid = await request(app)
    .get(`/api/salons/${shop.salonId}/availability?date=${date}`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  const slots = grid.body[shop.staff.id];
  assert.ok(Array.isArray(slots) && slots.length > 0);
  const at8 = slots.find((s) => s.startsAt.startsWith(`${date}T08:00`));
  const at10 = slots.find((s) => s.startsAt.startsWith(`${date}T10:00`));
  assert.equal(at8.available, false);
  assert.equal(at10.available, true);
});

// ---------------------------------------------------------------------------
// 3.5 Workflow et historique
// ---------------------------------------------------------------------------

test('workflow : transitions contrôlées, historique conservé, annulation motivée', async () => {
  const shop = await createShop('workflow');
  const date = '2030-02-08';
  const created = await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: slot(date, '14:00'),
      endsAt: slot(date, '14:40')
    })
    .expect(200);
  const id = created.body.id;

  // Transition invalide (confirmed → completed direct) refusée.
  await request(app)
    .post(`/api/salons/${shop.salonId}/appointments/${id}/transition`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ status: 'completed' })
    .expect(400);

  for (const status of ['checked_in', 'in_progress', 'completed']) {
    await request(app)
      .post(`/api/salons/${shop.salonId}/appointments/${id}/transition`)
      .set('Origin', ORIGIN)
      .set('Cookie', shop.owner.cookie)
      .send({ status })
      .expect(200);
  }

  const events = await request(app)
    .get(`/api/salons/${shop.salonId}/appointments/${id}/events`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .expect(200);
  assert.deepEqual(
    events.body.map((e) => e.newStatus),
    ['confirmed', 'checked_in', 'in_progress', 'completed']
  );

  // Annulation sans motif refusée ; avec motif acceptée.
  const second = await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: slot(date, '15:00'),
      endsAt: slot(date, '15:40')
    })
    .expect(200);
  await request(app)
    .post(`/api/salons/${shop.salonId}/appointments/${second.body.id}/cancel`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ reason: 'x' })
    .expect(400);
  const cancelled = await request(app)
    .post(`/api/salons/${shop.salonId}/appointments/${second.body.id}/cancel`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({ reason: 'Client absent' })
    .expect(200);
  assert.equal(cancelled.body.status, 'cancelled');

  // Le créneau libéré redevient réservable.
  await request(app)
    .post(`/api/salons/${shop.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shop.owner.cookie)
    .send({
      branchId: shop.branchId,
      clientId: shop.client.id,
      staffId: shop.staff.id,
      serviceId: shop.service.id,
      startsAt: slot(date, '15:00'),
      endsAt: slot(date, '15:40')
    })
    .expect(200);

  // Un rendez-vous terminé n'est pas automatiquement payé (distinction 3.5).
  assert.equal(cancelled.body.paymentStatus, 'unpaid');
});

test('isolation : aucun accès aux rendez-vous d’un autre salon', async () => {
  const shopA = await createShop('iso-a');
  const shopB = await createShop('iso-b');
  const created = await request(app)
    .post(`/api/salons/${shopA.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shopA.owner.cookie)
    .send({
      branchId: shopA.branchId,
      clientId: shopA.client.id,
      staffId: shopA.staff.id,
      serviceId: shopA.service.id,
      startsAt: slot('2030-02-11', '10:00'),
      endsAt: slot('2030-02-11', '10:40')
    })
    .expect(200);

  await request(app)
    .get(`/api/salons/${shopA.salonId}/appointments`)
    .set('Origin', ORIGIN)
    .set('Cookie', shopB.owner.cookie)
    .expect(403);

  // Même en connaissant l'identifiant du rendez-vous.
  await request(app)
    .get(`/api/salons/${shopA.salonId}/appointments/${created.body.id}/events`)
    .set('Origin', ORIGIN)
    .set('Cookie', shopB.owner.cookie)
    .expect(403);
});
