import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createAuthApp } from '../server/auth-app.js';
import { createAuthRepository } from '../server/auth-repository.js';
import { hashPassword, verifyPassword } from '../server/password.js';

function fixture() {
  const accounts = new Map(); const sessions = new Map(); let count = 0;
  const repo = {
    async createAccount(data) { if (accounts.has(data.email)) throw Object.assign(new Error(), { code:'23505' }); const user = { ...data, id: String(++count) }; accounts.set(data.email, user); return user; },
    async findAccount(email) { return accounts.get(email) || null; },
    async createSession(id, hash, expiresAt) { sessions.set(hash, { id, expiresAt }); },
    async getSession(hash) { const session = sessions.get(hash); if (!session || session.expiresAt < new Date()) return null; const { id, email, name } = [...accounts.values()].find(a => a.id === session.id); return { id, email, name }; },
    async deleteSession(hash) { sessions.delete(hash); },
    async deleteAllSessions() { return 0; },
    async issueToken() {},
    async consumeToken() { return null; },
    async updatePassword() {},
    async markEmailVerified() {},
    async setOnboarding() {},
  };
  const app = createAuthApp({ repository: repo, allowedOrigin: 'https://example.test', secureCookie: true, exposeTokens: true, rateLimits: { global: 1000, login: 1000, mail: 1000 } });
  return { app, accounts, sessions };
}

test('mots de passe salés, vérification et format invalide', async () => {
 const a = await hashPassword('Un mot de passe sûr'); const b = await hashPassword('Un mot de passe sûr');
 assert.notEqual(a, b); assert.ok(await verifyPassword('Un mot de passe sûr', a)); assert.equal(await verifyPassword('incorrect', a), false); assert.equal(await verifyPassword('incorrect', 'bad'), false);
});

test('création, connexion, session, déconnexion et protection origine', async () => {
 const { app, accounts } = fixture();
 await request(app).post('/api/auth/signup').send({ name:'Awa',email:'awa@example.test',password:'motdepassefort' }).expect(403);
 await request(app).post('/api/auth/signup').set('Origin','https://example.test').send({ name:'Awa',email:'AWA@example.test',password:'court' }).expect(400);
 await request(app).post('/api/auth/signup').set('Origin','https://example.test').send({ name:'Awa',email:'AWA@example.test',password:'motdepassefort' }).expect(201);
 assert.ok(!accounts.get('awa@example.test').passwordHash.includes('motdepassefort'));
 await request(app).post('/api/auth/signup').set('Origin','https://example.test').send({ name:'Awa',email:'AWA@example.test',password:'motdepassefort' }).expect(409);
 await request(app).post('/api/auth/login').set('Origin','https://example.test').send({ email:'awa@example.test',password:'incorrect' }).expect(401);
 const login = await request(app).post('/api/auth/login').set('Origin','https://example.test').send({ email:'awa@example.test',password:'motdepassefort' }).expect(403);
 assert.equal(login.body.code, 'email_not_verified');
 await request(app).post('/api/auth/verify-email').set('Origin','https://example.test').send({ token:'z'.repeat(64) }).expect(400);
});

test('migration auth et privilèges sur PostgreSQL embarqué', async () => {
 const db = new PGlite();
 try {
   for (const file of ['20261102230000_postgresql_identity.sql', '20261103020000_auth_accounts.sql', '20261103000000_tenant_foundation.sql', '20261103010000_operational_workflow.sql', '20261103020000_salon_resources.sql', '20261103030000_lot2_account_security.sql']) await db.exec(await readFile(new URL('../database/migrations/' + file, import.meta.url),'utf8'));
   await db.exec('set role bc_app');
   await assert.rejects(db.query('select * from public.bc_auth_accounts'));
   await db.exec('reset role; set role bc_auth');
   const id = (await db.query('insert into public.bc_users default values returning id')).rows[0].id;
   await db.query("insert into public.bc_auth_accounts(user_id,email,display_name,password_hash) values ($1,'a@example.test','Awa','hash')",[id]);
   await assert.rejects(db.query('select * from public.bc_salons'));
   await db.exec('reset role');
   const repository = createAuthRepository({ connect: async () => ({ query: (...args) => db.query(...args), release: () => {} }) });
   const account = await repository.createAccount({ email:'b@example.test', name:'B', passwordHash:'hash' });
   assert.equal((await repository.findAccount('b@example.test')).id, account.id);
   await repository.createSession(account.id, 'a'.repeat(64), new Date(Date.now() + 60000));
   assert.equal((await repository.getSession('a'.repeat(64))).name, 'B');
   await repository.deleteSession('a'.repeat(64));
   assert.equal(await repository.getSession('a'.repeat(64)), null);
   await assert.rejects(repository.createAccount({ email:'b@example.test', name:'B', passwordHash:'hash' }));
   assert.equal((await db.query('select count(*)::int as count from public.bc_users')).rows[0].count, 2);
 } finally { await db.close(); }
});
