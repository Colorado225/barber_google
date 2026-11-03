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
import { createSessionRunner } from '../server/session-runner.js';

const ORIGIN = 'https://example.test';
let db;
let app;

// Recueille le cookie de session renvoyé par la connexion.
function cookieOf(res) {
  const header = res.headers['set-cookie'];
  return Array.isArray(header) ? header[0].split(';')[0] : null;
}

async function signupAndLogin(email) {
  await request(app).post('/api/auth/signup').set('Origin', ORIGIN)
    .send({ name: 'QA User', email, password: 'motdepassefort' }).expect(201);
  const login = await request(app).post('/api/auth/login').set('Origin', ORIGIN)
    .send({ email, password: 'motdepassefort' }).expect(200);
  return cookieOf(login);
}

before(async () => {
  db = new PGlite();
  await db.exec(await readFile(new URL('../database/migrations/20261102230000_postgresql_identity.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/migrations/20261103020000_auth_accounts.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/migrations/20261103000000_tenant_foundation.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/migrations/20261103010000_operational_workflow.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/migrations/20261103020000_salon_resources.sql', import.meta.url), 'utf8'));

  const authRepository = createAuthRepository(db);
  const salonRepository = createSalonRepository(db);
  const sessionRunner = createSessionRunner(db);

  app = express();
  app.disable('x-powered-by');
  app.use(createAuthApp({ repository: authRepository, allowedOrigin: ORIGIN, secureCookie: true }));
  app.use(createResourceApp({ authRepository, salonRepository, sessionRunner, allowedOrigin: ORIGIN }).app);
});

let ownerCookie;
let salonId;

test('sans session, les ressources sont refusées', async () => {
  const res = await request(app).get('/api/salons/00000000-0000-4000-8000-000000000000/clients').expect(401);
  assert.equal(res.body.error, 'Authentification requise.');
});

test('un compte connecté crée son salon', async () => {
  ownerCookie = await signupAndLogin('owner@example.test');
  assert.ok(ownerCookie);

  // Le compte doit exister dans bc_users pour créer un salon.
  const account = await db.query("select user_id from public.bc_auth_accounts where email='owner@example.test'");
  assert.ok(account.rows[0].user_id);

  // On se place en tant que ce compte, puis on crée le salon (rôle owner).
  // Le repository sérialise ses transactions : on attend qu'elles soient finies.
  await new Promise((r) => setTimeout(r, 50));
  await db.exec('reset role');
  await db.query("select set_config('barber.user_id',$1,false)", [account.rows[0].user_id]);
  await db.exec('set role bc_app');
  const created = await db.query('select * from public.bc_create_salon($1,$2,$3)', ['Org QA', 'Salon QA', 'Cocody']);
  salonId = created.rows[0]?.salon_id;
  await db.exec('reset role');
  assert.ok(salonId, `salon non créé: ${JSON.stringify(created.rows)}`);
});

test('CRUD client complet via HTTP, persistant en base', async () => {
  const created = await request(app)
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ name: 'Awa Koné', phone: '+225 01020304', email: 'awa@test.ci', segment: 'new', notes: 'RAS' })
    .expect(200);
  assert.equal(created.body.name, 'Awa Koné');
  const id = created.body.id;

  const listed = await request(app)
    .get(`/api/salons/${salonId}/clients`)
    .set('Cookie', ownerCookie).expect(200);
  assert.equal(listed.body.length, 1);

  await request(app)
    .put(`/api/salons/${salonId}/clients/${id}`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ name: 'Awa K.', phone: '+225 01020304', segment: 'loyal', notes: '' })
    .expect(200);

  const afterUpdate = await request(app)
    .get(`/api/salons/${salonId}/clients`)
    .set('Cookie', ownerCookie).expect(200);
  assert.equal(afterUpdate.body[0].name, 'Awa K.');
  assert.equal(afterUpdate.body[0].segment, 'loyal');

  await request(app)
    .delete(`/api/salons/${salonId}/clients/${id}`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie).expect(200);

  const afterDelete = await request(app)
    .get(`/api/salons/${salonId}/clients`)
    .set('Cookie', ownerCookie).expect(200);
  assert.equal(afterDelete.body.length, 0);
});

test('validation serveur : corps invalide rejeté en 400', async () => {
  await request(app)
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ name: '', phone: '1' })
    .expect(400);

  await request(app)
    .post(`/api/salons/${salonId}/services`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ name: 'Coupe', category: 'coupe', price: -5, durationMinutes: 30 })
    .expect(400);
});

test('CRUD prestations, équipe, stocks, récompenses, avis', async () => {
  const svc = await request(app).post(`/api/salons/${salonId}/services`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ name: 'Dégradé', category: 'coupe', price: 4000, durationMinutes: 40, popular: true })
    .expect(200);
  assert.equal(svc.body.price, 4000);

  const staff = await request(app).post(`/api/salons/${salonId}/staff`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ name: 'Kevin', role: 'barber', commissionRate: 25, specialties: ['Coupe'] })
    .expect(200);
  assert.deepEqual(staff.body.specialties, ['Coupe']);

  await request(app).post(`/api/salons/${salonId}/stock`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ name: 'Shampoo', category: 'shampoing', quantity: 5, minThreshold: 2, unitCost: 3000 })
    .expect(200);

  await request(app).post(`/api/salons/${salonId}/rewards`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ name: 'Coupe offerte', pointsCost: 100, category: 'free_service', freeServiceName: 'Dégradé' })
    .expect(200);

  await request(app).post(`/api/salons/${salonId}/reviews`)
    .set('Origin', ORIGIN).set('Cookie', ownerCookie)
    .send({ author: 'Client', rating: 5, comment: 'Parfait' })
    .expect(200);

  const ws = await request(app).get(`/api/salons/${salonId}/workspace`)
    .set('Cookie', ownerCookie).expect(200);
  assert.equal(ws.body.services.length, 1);
  assert.equal(ws.body.staff.length, 1);
  assert.equal(ws.body.reviews[0].rating, 5);
});

test('isolation : un autre salon ne voit rien', async () => {
  const otherCookie = await signupAndLogin('intrus@example.test');
  const res = await request(app)
    .get(`/api/salons/${salonId}/workspace`)
    .set('Cookie', otherCookie)
    .expect(404);
  assert.ok(res.body.error);

  await request(app)
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', ORIGIN).set('Cookie', otherCookie)
    .send({ name: 'Intrus', phone: '+225 0000', segment: 'new' })
    .expect(403);
});

test('origine non autorisée refusée sur les écritures', async () => {
  await request(app)
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', 'https://evil.test').set('Cookie', ownerCookie)
    .send({ name: 'X', phone: '+225 0000' })
    .expect(403);
});

after(async () => { await db.close(); });
