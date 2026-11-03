import 'dotenv/config';
import pg from 'pg';
import express from 'express';
import { createAuthApp } from './auth-app.js';
import { createAuthRepository } from './auth-repository.js';
import { createResourceApp } from './resource-app.js';
import { createSalonRepository } from './salon-repository.js';
import { createSessionRunner } from './session-runner.js';

if (process.env.NODE_ENV === 'production') {
  console.error("Cette API est une fondation de développement, pas encore autorisée en production.");
  process.exit(1);
}
if (!process.env.AUTH_DATABASE_URL || !process.env.APP_ORIGIN) {
  console.error('AUTH_DATABASE_URL et APP_ORIGIN sont nécessaires. Voir docs/authentification.md.');
  process.exit(1);
}

const allowedOrigin = process.env.APP_ORIGIN;
const secureCookie = allowedOrigin.startsWith('https://');
const pool = new pg.Pool({
  connectionString: process.env.AUTH_DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10000,
});

const authRepository = createAuthRepository(pool);
const salonRepository = createSalonRepository(pool);
const sessionRunner = createSessionRunner(pool);

// Un seul processus : les routes /api/auth et les routes de ressources partagent
// la même connexion et donc la même session.
const app = express();
app.disable('x-powered-by');
app.use(createAuthApp({ repository: authRepository, allowedOrigin, secureCookie }));
app.use(createResourceApp({ authRepository, salonRepository, sessionRunner, allowedOrigin }).app);

const port = Number(process.env.AUTH_PORT || 3001);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`API Barber Cuts prête sur http://127.0.0.1:${port}`)
);
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
}
