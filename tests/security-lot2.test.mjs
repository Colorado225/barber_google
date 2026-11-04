// Lot 2 — tests de sécurité : authentification, autorisations et multi-tenant.
// Exécutés sur PGlite (PostgreSQL embarqué) avec les rôles SQL réels (bc_app,
// bc_auth) : les politiques RLS sont donc réellement évaluées.
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
import { createFinanceRepository } from '../server/finance-repository.js';
import { createSessionRunner } from '../server/session-runner.js';
import { validatePasswordPolicy } from '../server/password.js';

const ORIGIN = 'https://example.test';
const PASSWORD = 'UnMotDePasseSolide2026';

let db;
let app;
let authRepository;

const MIGRATIONS = [
  '20261102230000_postgresql_identity.sql',
  '20261103000000_tenant_foundation.sql',
  '20261103010000_operational_workflow.sql',
  '20261103020000_auth_accounts.sql',
  '20261103020000_salon_resources.sql',
  '20261103030000_lot2_account_security.sql',
  '20261103040000_lot3_operations.sql',
  '20261103050000_lot4_finance.sql',
  '20261103060000_lot3_fitions.sql'
];

const cookieOf = (res) => {
  const header = res.headers['set-cookie'];
  return Array.isArray(header) ? header[0].split(';')[0] : null;
};

const api = () => request(app);

/** Inscription + vérification e-mail + connexion ; renvoie { cookie, userId }. */
async function createVerifiedAccount(email, name = 'QA User') {
  const signup = await api()
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ name, email, password: PASSWORD })
    .expect(201);
  await api().post('/api/auth/verify-email').set('Origin', ORIGIN).send({ token: signup.body.token }).expect(200);
  const login = await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password: PASSWORD })
    .expect(200);
  const rows = await db.query('select user_id from public.bc_auth_accounts where email = $1', [email]);
  return { cookie: cookieOf(login), userId: rows.rows[0].user_id, login };
}

/** Crée un salon pour l'utilisateur via l'API (owner) ; renvoie l'id du salon. */
async function createSalon(cookie, salonName) {
  const res = await api()
    .post('/api/salons')
    .set('Origin', ORIGIN)
    .set('Cookie', cookie)
    .send({ organizationName: `Org ${salonName}`, salonName, branchName: 'Principal' })
    .expect(201);
  return res.body.salon_id;
}

/** Ajoute un membre avec un rôle donné (opération privilégiée, hors API). */
async function addMember(salonId, userId, role) {
  const r = await db.query(
    "insert into public.bc_memberships(salon_id,user_id,role) values ($1,$2,$3) returning id",
    [salonId, userId, role]
  );
  return r.rows[0].id;
}

before(async () => {
  db = new PGlite();
  for (const file of MIGRATIONS) {
    await db.exec(await readFile(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'));
  }

  authRepository = createAuthRepository(db);
  const salonRepository = createSalonRepository(db);
  const operationsRepository = createOperationsRepository(db);
    const financeRepository = createFinanceRepository(db);
  const sessionRunner = createSessionRunner(db);

  app = express();
  app.disable('x-powered-by');
  app.use(
    createAuthApp({
      repository: authRepository,
      allowedOrigin: ORIGIN,
      secureCookie: true,
      exposeTokens: true,
      // Les tests partagent une seule IP (localhost) : limites élargies pour
      // pouvoir vérifier le comportement métier. Le rate limiting dédié est
      // couvert par `tests/rate-limit.test.mjs`.
      rateLimits: { global: 10000, login: 10000, mail: 10000 }
    })
  );
  app.use(createResourceApp({ authRepository, salonRepository, operationsRepository, financeRepository, sessionRunner, allowedOrigin: ORIGIN }).app);
});

after(async () => { await db.close(); });

// ---------------------------------------------------------------------------
// 2.1 Authentification
// ---------------------------------------------------------------------------

test('politique de mot de passe : longueur, trivialité, mots de passe courants', () => {
  assert.ok(validatePasswordPolicy('court'));
  assert.ok(validatePasswordPolicy('aaaaaaaaaaaaaaaa'));
  assert.ok(validatePasswordPolicy('password123'));
  assert.equal(validatePasswordPolicy(PASSWORD), null);
});

test('un compte non vérifié ne peut pas se connecter et reçoit un nouveau lien', async () => {
  const signup = await api()
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ name: 'Non vérifié', email: 'pending@example.test', password: PASSWORD })
    .expect(201);
  assert.ok(signup.body.token, 'le jeton de vérification est exposé en développement');
  assert.ok(!JSON.stringify(signup.body).includes(PASSWORD));

  const login = await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'pending@example.test', password: PASSWORD })
    .expect(403);
  assert.equal(login.body.code, 'email_not_verified');
  assert.ok(login.body.token);
  assert.equal(login.headers['set-cookie'], undefined, 'aucune session ne doit être créée');
});

test('vérification e-mail : jeton à usage unique et expiration', async () => {
  const signup = await api()
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ name: 'Vérif', email: 'verify@example.test', password: PASSWORD })
    .expect(201);

  await api().post('/api/auth/verify-email').set('Origin', ORIGIN).send({ token: 'a'.repeat(64) }).expect(400);
  await api().post('/api/auth/verify-email').set('Origin', ORIGIN).send({ token: signup.body.token }).expect(200);
  // Rejeu : le jeton est déjà consommé.
  await api().post('/api/auth/verify-email').set('Origin', ORIGIN).send({ token: signup.body.token }).expect(400);

  await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'verify@example.test', password: PASSWORD })
    .expect(200);

  // Jeton expiré : refusé.
  const account = await db.query("select user_id from public.bc_auth_accounts where email = 'verify@example.test'");
  await db.query(
    "insert into public.bc_auth_tokens(token_hash,user_id,purpose,expires_at) values ($1,$2,'reset_password', now() - interval '1 minute')",
    ['b'.repeat(64), account.rows[0].user_id]
  );
  await api()
    .post('/api/auth/reset-password')
    .set('Origin', ORIGIN)
    .send({ token: 'b'.repeat(64), password: PASSWORD })
    .expect(400);
});

test('réinitialisation : réponse neutre, jeton unique et révocation des sessions', async () => {
  const account = await createVerifiedAccount('reset@example.test');

  const unknown = await api()
    .post('/api/auth/forgot-password')
    .set('Origin', ORIGIN)
    .send({ email: 'inconnu@example.test' })
    .expect(200);
  const known = await api()
    .post('/api/auth/forgot-password')
    .set('Origin', ORIGIN)
    .send({ email: 'reset@example.test' })
    .expect(200);
  // Message identique : aucune fuite sur l'existence du compte.
  assert.equal(unknown.body.message, known.body.message);
  assert.ok(known.body.token);

  const newPassword = 'NouveauMotDePasseSolide2026';
  await api()
    .post('/api/auth/reset-password')
    .set('Origin', ORIGIN)
    .send({ token: known.body.token, password: newPassword })
    .expect(200);
  // Le jeton ne peut pas être réutilisé.
  await api()
    .post('/api/auth/reset-password')
    .set('Origin', ORIGIN)
    .send({ token: known.body.token, password: newPassword })
    .expect(400);
  // Toutes les sessions existantes sont révoquées.
  await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', account.cookie).expect(401);
  // Ancien mot de passe refusé, nouveau accepté.
  await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'reset@example.test', password: PASSWORD })
    .expect(401);
  await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'reset@example.test', password: newPassword })
    .expect(200);
});

test('messages non révélateurs et origine obligatoire sur les écritures', async () => {
  await createVerifiedAccount('neutral@example.test');
  const wrongPassword = await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'neutral@example.test', password: 'MauvaisMotDePasse2026' })
    .expect(401);
  const unknownAccount = await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'ghost@example.test', password: 'MauvaisMotDePasse2026' })
    .expect(401);
  assert.equal(wrongPassword.body.error, unknownAccount.body.error);

  await api()
    .post('/api/auth/login')
    .set('Origin', 'https://evil.test')
    .send({ email: 'neutral@example.test', password: PASSWORD })
    .expect(403);
});

test('session expirée ou révoquée rejetée, cookie HttpOnly/Secure/SameSite', async () => {
  const account = await createVerifiedAccount('session@example.test');
  const setCookie = account.login.headers['set-cookie'][0];
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\//);

  await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', account.cookie).expect(200);

  // Révocation côté serveur.
  const token = account.cookie.split('=')[1];
  const { hashSessionToken } = await import('../server/password.js');
  await db.query('delete from public.bc_auth_sessions where token_hash = $1', [hashSessionToken(token)]);
  await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', account.cookie).expect(401);

  // Expiration.
  const again = await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'session@example.test', password: PASSWORD })
    .expect(200);
  const cookie2 = cookieOf(again);
  await db.query('update public.bc_auth_sessions set expires_at = now() - interval \'1 minute\' where token_hash = $1', [
    hashSessionToken(cookie2.split('=')[1])
  ]);
  await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', cookie2).expect(401);
  // GET /api/auth/session renvoie `user: null` et efface le cookie.
  const session = await api().get('/api/auth/session').set('Cookie', cookie2).expect(200);
  assert.equal(session.body.user, null);
});

test('déconnexion globale révoque toutes les sessions', async () => {
  const account = await createVerifiedAccount('multi@example.test');
  const second = await api()
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'multi@example.test', password: PASSWORD })
    .expect(200);
  const secondCookie = cookieOf(second);

  await api().post('/api/auth/logout-all').set('Origin', ORIGIN).set('Cookie', account.cookie).expect(200);
  await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', account.cookie).expect(401);
  await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', secondCookie).expect(401);
});

// ---------------------------------------------------------------------------
// 2.2 / 2.3 Multi-tenant et permissions
// ---------------------------------------------------------------------------

test('onboarding : pas d’ERP sans membership, progression persistée', async () => {
  const account = await createVerifiedAccount('newbie@example.test');
  const me = await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', account.cookie).expect(200);
  assert.deepEqual(me.body.memberships, []);
  assert.equal(me.body.onboarding?.currentStep, 'salon_creation');
  assert.equal(me.body.onboarding?.setupCompleted, false);

  const salonId = await createSalon(account.cookie, 'Salon Newbie');
  const afterCreate = await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', account.cookie).expect(200);
  assert.equal(afterCreate.body.memberships.length, 1);
  assert.equal(afterCreate.body.memberships[0].role, 'owner');
  assert.ok(afterCreate.body.memberships[0].permissions.includes('members.manage'));
  assert.equal(afterCreate.body.onboarding.currentStep, 'setup');
  assert.equal(afterCreate.body.memberships[0].salonId, salonId);

  await api()
    .post('/api/onboarding/progress')
    .set('Origin', ORIGIN)
    .set('Cookie', account.cookie)
    .send({ step: 'completed' })
    .expect(200);
  const done = await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', account.cookie).expect(200);
  assert.equal(done.body.onboarding.currentStep, 'completed');
  assert.equal(done.body.onboarding.setupCompleted, true);
  assert.equal(done.body.memberships.length, 1);
});

test('un utilisateur non authentifié ne peut consulter aucune donnée privée', async () => {
  const owner = await createVerifiedAccount('owner-a@example.test');
  const salonA = await createSalon(owner.cookie, 'Salon A');

  await api().get(`/api/salons/${salonA}/workspace`).expect(401);
  await api().get(`/api/salons/${salonA}/clients`).expect(401);
  await api().get('/api/me').expect(401);
  await api().post('/api/salons').set('Origin', ORIGIN).send({ organizationName: 'x', salonName: 'y', branchName: 'z' }).expect(401);
});

test('isolation multi-tenant : A ne voit jamais les clients de B, même en changeant l’URL', async () => {
  const ownerA = await createVerifiedAccount('tenant-a@example.test', 'Owner A');
  const ownerB = await createVerifiedAccount('tenant-b@example.test', 'Owner B');
  const salonA = await createSalon(ownerA.cookie, 'Tenant A');
  const salonB = await createSalon(ownerB.cookie, 'Tenant B');

  await api()
    .post(`/api/salons/${salonB}/clients`)
    .set('Origin', ORIGIN)
    .set('Cookie', ownerB.cookie)
    .send({ name: 'Client B', phone: '+225 0700000001', segment: 'new' })
    .expect(200);

  // A tente d'accéder au salon de B avec l'identifiant transmis librement.
  const forbidden = await api().get(`/api/salons/${salonB}/clients`).set('Origin', ORIGIN).set('Cookie', ownerA.cookie).expect(403);
  assert.equal(forbidden.body.error, 'Action non autorisée pour ce salon.');
  await api().get(`/api/salons/${salonB}/workspace`).set('Origin', ORIGIN).set('Cookie', ownerA.cookie).expect(403);
  await api()
    .post(`/api/salons/${salonB}/clients`)
    .set('Origin', ORIGIN)
    .set('Cookie', ownerA.cookie)
    .send({ name: 'Intrus', phone: '+225 0700000002' })
    .expect(403);

  // Et B ne voit pas les données de A.
  const listA = await api().get(`/api/salons/${salonA}/clients`).set('Origin', ORIGIN).set('Cookie', ownerB.cookie).expect(403);
  assert.ok(listA.body.error);

  // Chacun voit ses propres données.
  const own = await api().get(`/api/salons/${salonB}/clients`).set('Origin', ORIGIN).set('Cookie', ownerB.cookie).expect(200);
  assert.equal(own.body.length, 1);

  // Un identifiant inexistant ne révèle rien de plus qu'un salon existant.
  const ghost = await api()
    .get('/api/salons/00000000-0000-4000-8000-000000000000/clients')
    .set('Origin', ORIGIN)
    .set('Cookie', ownerA.cookie)
    .expect(403);
  assert.deepEqual(ghost.body, forbidden.body);
});

test('permissions vérifiées côté serveur : un réceptionniste ne gère ni catalogue ni rôles', async () => {
  const owner = await createVerifiedAccount('perm-owner@example.test', 'Owner');
  const salonId = await createSalon(owner.cookie, 'Salon Perm');

  const receptionist = await createVerifiedAccount('perm-reception@example.test', 'Réception');
  const barber = await createVerifiedAccount('perm-barber@example.test', 'Barbier');
  await addMember(salonId, receptionist.userId, 'receptionist');
  await addMember(salonId, barber.userId, 'barber');

  const meReception = await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', receptionist.cookie).expect(200);
  const perms = meReception.body.memberships[0].permissions;
  assert.ok(perms.includes('clients.write'));
  assert.ok(!perms.includes('catalog.write'));
  assert.ok(!perms.includes('members.manage'));

  // Réception : peut créer un client, pas une prestation.
  await api()
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', ORIGIN)
    .set('Cookie', receptionist.cookie)
    .send({ name: 'Client Accueil', phone: '+225 0700000010', segment: 'new' })
    .expect(200);
  await api()
    .post(`/api/salons/${salonId}/services`)
    .set('Origin', ORIGIN)
    .set('Cookie', receptionist.cookie)
    .send({ name: 'Dégradé', category: 'coupe', price: 4000, durationMinutes: 40 })
    .expect(403);

  // Barbier : lecture clients uniquement, aucune écriture.
  await api().get(`/api/salons/${salonId}/clients`).set('Origin', ORIGIN).set('Cookie', barber.cookie).expect(200);
  await api()
    .post(`/api/salons/${salonId}/clients`)
    .set('Origin', ORIGIN)
    .set('Cookie', barber.cookie)
    .send({ name: 'Interdit', phone: '+225 0700000011' })
    .expect(403);

  // Le propriétaire, lui, peut tout.
  await api()
    .post(`/api/salons/${salonId}/services`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ name: 'Dégradé', category: 'coupe', price: 4000, durationMinutes: 40 })
    .expect(200);
});

test('un employé ne peut pas modifier ses propres permissions ni changer son rôle', async () => {
  const owner = await createVerifiedAccount('role-owner@example.test', 'Owner');
  const salonId = await createSalon(owner.cookie, 'Salon Roles');
  const manager = await createVerifiedAccount('role-manager@example.test', 'Manager');
  const managerMembership = await addMember(salonId, manager.userId, 'manager');

  // Un manager peut lister les membres mais pas changer les rôles (owner seulement).
  await api().get(`/api/salons/${salonId}/members`).set('Origin', ORIGIN).set('Cookie', manager.cookie).expect(200);
  await api()
    .put(`/api/salons/${salonId}/members/${managerMembership}/role`)
    .set('Origin', ORIGIN)
    .set('Cookie', manager.cookie)
    .send({ role: 'owner' })
    .expect(403);

  // Le propriétaire non plus ne peut pas modifier son propre rôle.
  const members = await api().get(`/api/salons/${salonId}/members`).set('Origin', ORIGIN).set('Cookie', owner.cookie).expect(200);
  const ownerMembership = members.body.find((m) => m.userId === owner.userId);
  await api()
    .put(`/api/salons/${salonId}/members/${ownerMembership.id}/role`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ role: 'barber' })
    .expect(403);

  // Le propriétaire peut changer le rôle d'un autre membre (audité).
  await api()
    .put(`/api/salons/${salonId}/members/${managerMembership}/role`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ role: 'cashier', reason: 'Rotation des équipes' })
    .expect(200);
  const audit = await db.query(
    "select action, actor_id, target_user_id from public.bc_admin_audit where salon_id = $1 and action = 'membership.role_change'",
    [salonId]
  );
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].actor_id, owner.userId);
  assert.equal(audit.rows[0].target_user_id, manager.userId);
});

test('un membre suspendu perd immédiatement l’accès aux opérations métier', async () => {
  const owner = await createVerifiedAccount('susp-owner@example.test', 'Owner');
  const salonId = await createSalon(owner.cookie, 'Salon Susp');
  const cashier = await createVerifiedAccount('susp-cashier@example.test', 'Caissier');
  const membership = await addMember(salonId, cashier.userId, 'cashier');

  await api().get(`/api/salons/${salonId}/clients`).set('Origin', ORIGIN).set('Cookie', cashier.cookie).expect(200);

  await api()
    .put(`/api/salons/${salonId}/members/${membership}/status`)
    .set('Origin', ORIGIN)
    .set('Cookie', owner.cookie)
    .send({ status: 'suspended', reason: 'Fin de contrat' })
    .expect(200);

  await api().get(`/api/salons/${salonId}/clients`).set('Origin', ORIGIN).set('Cookie', cashier.cookie).expect(403);
  const me = await api().get('/api/me').set('Origin', ORIGIN).set('Cookie', cashier.cookie).expect(200);
  assert.deepEqual(me.body.memberships, [], 'un membership suspendu n’apparaît pas dans le contexte');
});

test('les routes d’administration SaaS sont refusées même à un propriétaire', async () => {
  const owner = await createVerifiedAccount('admin-check@example.test', 'Owner');
  await createSalon(owner.cookie, 'Salon Admin Check');
  const res = await api().get('/api/admin/salons').set('Origin', ORIGIN).set('Cookie', owner.cookie).expect(403);
  assert.equal(res.body.error, 'Action non autorisée.');
});

test('RLS : lecture directe en bc_app limitée au salon autorisé', async () => {
  const owner = await createVerifiedAccount('rls@example.test', 'Owner');
  const salonId = await createSalon(owner.cookie, 'Salon RLS');

  // Lecture avec l'identité de l'utilisateur : il voit son salon.
  await db.exec('reset role');
  await db.query("select set_config('barber.user_id', $1, false)", [owner.userId]);
  await db.exec('set role bc_app');
  const own = await db.query('select id from public.bc_salons where id = $1', [salonId]);
  assert.equal(own.rows.length, 1);

  // Avec l'identité d'un autre utilisateur : aucune ligne.
  await db.exec('reset role');
  await db.query("select set_config('barber.user_id', $1, false)", ['99999999-9999-4999-8999-999999999999']);
  await db.exec('set role bc_app');
  const foreign = await db.query('select id from public.bc_salons where id = $1', [salonId]);
  assert.equal(foreign.rows.length, 0);

  // Sans identité : aucune ligne non plus.
  await db.exec('reset role');
  await db.query("select set_config('barber.user_id', '', false)");
  await db.exec('set role bc_app');
  assert.equal((await db.query('select id from public.bc_salons')).rows.length, 0);
  await db.exec('reset role');
});
