// Lot 2 — limitation des tentatives répétées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createAuthApp } from '../server/auth-app.js';
import { createRateLimiter, hashIp } from '../server/rate-limit.js';

const ORIGIN = 'https://example.test';

/** Repository minimal : aucun compte réel n'est nécessaire pour ce test. */
const repository = {
  async createAccount(data) {
    return { id: 'u1', ...data };
  },
  async findAccount() {
    return null;
  },
  async createSession() {},
  async getSession() {
    return null;
  },
  async deleteSession() {},
  async deleteAllSessions() {
    return 0;
  },
  async issueToken() {},
  async consumeToken() {
    return null;
  },
  async updatePassword() {},
  async markEmailVerified() {},
  async setOnboarding() {},
};

test('connexions répétées : 429 après la limite, en-têtes Retry-After', async () => {
  const app = express();
  app.use(
    createAuthApp({
      repository,
      allowedOrigin: ORIGIN,
      secureCookie: true,
      rateLimits: { login: 3, global: 1000, mail: 1000 },
    }),
  );

  for (let i = 0; i < 3; i++) {
    await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'nobody@example.test', password: 'QuelqueChoseDeLong2026' })
      .expect(401);
  }
  const blocked = await request(app)
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: 'nobody@example.test', password: 'QuelqueChoseDeLong2026' })
    .expect(429);
  assert.match(blocked.headers['retry-after'], /^\d+$/);
  assert.equal(blocked.headers['ratelimit-remaining'], '0');
});

test('le limiteur générique compte par clé et expose les en-têtes', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, key: (req) => req.ip });
  const headers = {};
  const res = {
    set: (k, v) => {
      headers[k] = v;
    },
    status: (code) => ({ json: () => code }),
  };
  let calls = 0;
  const next = () => {
    calls += 1;
  };
  limiter({ ip: '10.0.0.1' }, res, next);
  limiter({ ip: '10.0.0.2' }, res, next);
  assert.equal(calls, 2);
  assert.equal(headers['RateLimit-Remaining'], '1');
});

test('les adresses IP sont hachées avant stockage (audit)', () => {
  const a = hashIp('192.168.1.10');
  assert.equal(a.length, 64);
  assert.notEqual(a, hashIp('192.168.1.11'));
  assert.equal(hashIp(null), null);
});
