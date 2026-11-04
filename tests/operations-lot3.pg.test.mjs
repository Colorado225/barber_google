// Exécute la suite Lot 3 sur un vrai PostgreSQL local (constraint d'exclusion active).
// Usage : PG_URL=postgres://user@127.0.0.1:5432/barber_lot3_verify node --test tests/operations-lot3.pg.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import pg from 'pg';

import { createAuthApp } from '../server/auth-app.js';
import { createAuthRepository } from '../server/auth-repository.js';
import { createResourceApp } from '../server/resource-app.js';
import { createSalonRepository } from '../server/salon-repository.js';
import { createOperationsRepository } from '../server/operations-repository.js';
import { createSessionRunner } from '../server/session-runner.js';

const PG_URL = process.env.PG_URL;
const ORIGIN = 'https://example.test';
const PASSWORD = 'UnMotDePasseSolide2026';

let pool;
let app;
let enabled = false;

before(async () => {
  if (!PG_URL) return;
  pool = new pg.Pool({ connectionString: PG_URL, max: 8 });
  const authRepository = createAuthRepository(pool);
  app = express();
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
      salonRepository: createSalonRepository(pool),
      operationsRepository: createOperationsRepository(pool),
      sessionRunner: createSessionRunner(pool),
      allowedOrigin: ORIGIN
    }).app
  );
  enabled = true;
});

after(async () => {
  if (pool) await pool.end();
});

const cookieOf = (res) => res.headers['set-cookie'][0].split(';')[0];
const slot = (date, hhmm) => new Date(`${date}T${hhmm}:00.000Z`).toISOString();
const addMinutes = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60000).toISOString();

async function createShop(label) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const signup = await request(app)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ name: `Owner ${label}`, email, password: PASSWORD })
    .expect(201);
  await request(app).post('/api/auth/verify-email').set('Origin', ORIGIN).send({ token: signup.body.token }).expect(200);
  const login = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password: PASSWORD }).expect(200);
  const cookie = cookieOf(login);
  const salon = await request(app)
    .post('/api/salons')
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .send({ organizationName: `Org ${label}`, salonName: `Salon ${label}`, branchName: 'Principal' })
    .expect(201);
  const salonId = salon.body.salon_id;
  const service = await request(app)
    .post(`/api/salons/${salonId}/services`)
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .send({ name: 'Dégradé', category: 'coupe', price: 4000, durationMinutes: 40 })
    .expect(200);
  const staff = await request(app)
    .post(`/api/salons/${salonId}/staff`)
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .send({ name: 'Kevin', role: 'barber', commissionRate: 25, branchId: salon.body.branch_id, serviceIds: [service.body.id] })
    .expect(200);
  const client = await request(app)
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .send({ name: 'Awa Koné', phone: '+225 01020304' })
    .expect(200);
  return { cookie, salonId, branchId: salon.body.branch_id, service: service.body, staff: staff.body, client: client.body };
}

test('PostgreSQL réel : contrainte d’exclusion anti-chevauchement présente', async (t) => {
  if (!enabled) return t.skip('PG_URL non défini');
  const r = await pool.query("select conname from pg_constraint where conname = 'bc_appointments_no_overlap'");
  assert.equal(r.rows.length, 1);
});

test('PostgreSQL réel : deux réservations simultanées, une seule gagne', async (t) => {
  if (!enabled) return t.skip('PG_URL non défini');
  const shop = await createShop('race');
  const start = slot('2031-03-04', '10:00');
  const payload = {
    branchId: shop.branchId,
    clientId: shop.client.id,
    staffId: shop.staff.id,
    serviceId: shop.service.id,
    startsAt: start,
    endsAt: addMinutes(start, 40)
  };
  const send = () =>
    request(app)
      .post(`/api/salons/${shop.salonId}/appointments`)
      .set('Origin', ORIGIN)
      .set('Cookie', shop.cookie)
      .send(payload);

  // 6 requêtes concurrentes sur des connexions distinctes du pool.
  const results = await Promise.all([send(), send(), send(), send(), send(), send()]);
  const ok = results.filter((r) => r.status === 200).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  assert.equal(ok, 1, `réponses: ${results.map((r) => r.status).join(',')}`);
  assert.equal(conflicts, 5);

  const count = await pool.query(
    "select count(*)::int as count from public.bc_appointments where salon_id = $1 and status <> 'cancelled'",
    [shop.salonId]
  );
  assert.equal(count.rows[0].count, 1);
});
