import 'dotenv/config';
import pg from 'pg';
import { createAuthApp } from './auth-app.js';
import { createAuthRepository } from './auth-repository.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Cette API est une fondation de développement, pas encore autorisée en production.');
  process.exit(1);
}
if (!process.env.AUTH_DATABASE_URL || !process.env.APP_ORIGIN) {
  console.error('AUTH_DATABASE_URL et APP_ORIGIN sont nécessaires. Voir docs/authentification.md.');
  process.exit(1);
}
const secureCookie = process.env.APP_ORIGIN.startsWith('https://');
if (!secureCookie && process.env.NODE_ENV === 'production') throw new Error('HTTPS requis en production');
const pool = new pg.Pool({ connectionString: process.env.AUTH_DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 });
const app = createAuthApp({ repository: createAuthRepository(pool), allowedOrigin: process.env.APP_ORIGIN, secureCookie });
const port = Number(process.env.AUTH_PORT || 3001);
const server = app.listen(port, '127.0.0.1', () => console.log(`API auth locale prête sur le port ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
