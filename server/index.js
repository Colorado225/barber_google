import 'dotenv/config';
import pg from 'pg';
import express from 'express';
import { createAuthApp } from './auth-app.js';
import { createAuthRepository } from './auth-repository.js';
import { createResourceApp } from './resource-app.js';
import { createSalonRepository } from './salon-repository.js';
import { createOperationsRepository } from './operations-repository.js';
import { createFinanceRepository } from './finance-repository.js';
import { createSessionRunner } from './session-runner.js';

if (process.env.NODE_ENV === 'production') {
  console.error("Cette API est une fondation de développement, pas encore autorisée en production.");
  process.exit(1);
}
if (!process.env.DATABASE_URL || !process.env.APP_ORIGIN) {
  console.error('DATABASE_URL et APP_ORIGIN sont nécessaires. Voir docs/LOT-2-RAPPORT.md.');
  process.exit(1);
}

const allowedOrigin = process.env.APP_ORIGIN;
const secureCookie = allowedOrigin.startsWith('https://');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10000,
});

const authRepository = createAuthRepository(pool);
const salonRepository = createSalonRepository(pool);
const operationsRepository = createOperationsRepository(pool);
const financeRepository = createFinanceRepository(pool);
const sessionRunner = createSessionRunner(pool);

// Un seul processus : les routes /api/auth et les routes de ressources partagent
// la même connexion et donc la même session.
const app = express();
app.disable('x-powered-by');
app.use(
  createAuthApp({
    repository: authRepository,
    allowedOrigin,
    secureCookie,
    // En développement uniquement, faute de fournisseur SMTP : les jetons de
    // vérification / réinitialisation sont renvoyés pour permettre le parcours.
    exposeTokens: process.env.AUTH_EXPOSE_TOKENS === 'true',
    sessionAgeMs: Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000)
  })
);
app.use(createResourceApp({ authRepository, salonRepository, operationsRepository, financeRepository, sessionRunner, allowedOrigin }).app);

const port = Number(process.env.AUTH_PORT || 3001);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`API Barber Cuts prête sur http://127.0.0.1:${port}`)
);

// Purge périodique des sessions expirées (toutes les heures).
const purge = setInterval(() => {
  authRepository.purgeExpiredSessions().catch((error) =>
    console.error('Purge des sessions impossible:', error?.code || error?.name)
  );
}, 60 * 60 * 1000);
purge.unref();

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    clearInterval(purge);
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
