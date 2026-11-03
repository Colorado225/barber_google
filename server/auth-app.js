import express from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword, newSessionToken, hashSessionToken } from './password.js';

const loginSchema = z.object({ email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).max(128) }).strict();
const signupSchema = loginSchema.extend({ name: z.string().trim().min(1).max(120), password: z.string().min(12).max(128) }).strict();
const cookieName = 'bc_session';
const sessionAge = 7 * 24 * 60 * 60 * 1000;
function readToken(req) {
  const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function createAuthApp({ repository, allowedOrigin, secureCookie = true }) {
  if (!allowedOrigin) throw new Error('APP_ORIGIN is required');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // Refus par défaut : endpoints mutables uniquement depuis l'origine définie côté serveur.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.headers.origin !== allowedOrigin) return res.status(403).json({ error: 'Origine non autorisée.' });
    next();
  });
  app.use(express.json({ limit: '8kb', strict: true }));
  const attempts = new Map();
  app.use('/api/auth', (req, res, next) => {
    // Limitation locale temporaire ; un stockage partagé est nécessaire en production.
    const now = Date.now();
    for (const [key, value] of attempts) if (value.reset <= now) attempts.delete(key);
    const key = req.ip;
    if (!attempts.has(key) && attempts.size >= 10000) return res.status(503).json({ error: 'Service temporairement indisponible.' });
    const bucket = attempts.get(key) || { count: 0, reset: now + 15 * 60 * 1000 };
    bucket.count++;
    attempts.set(key, bucket);
    if (bucket.count > 100) return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
    next();
  });
  const cookieOptions = { httpOnly: true, secure: secureCookie, sameSite: 'strict', path: '/', maxAge: sessionAge };
  // Un hash aléatoire fixe au démarrage évite un retour immédiat pour un compte inconnu.
  const dummyHash = hashPassword(newSessionToken());
  app.post('/api/auth/signup', async (req, res, next) => {
    const data = signupSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ error: 'Vérifiez votre nom, votre e-mail et votre mot de passe (12 caractères minimum).' });
    try {
      await repository.createAccount({ email: data.data.email, name: data.data.name, passwordHash: await hashPassword(data.data.password) });
      // Pas de connexion automatique : vérification email non encore disponible.
      return res.status(201).json({ message: 'Compte créé. La vérification e-mail reste à configurer.' });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Impossible de créer ce compte. Essayez de vous connecter.' });
      next(error);
    }
  });
  app.post('/api/auth/login', async (req, res, next) => {
    const data = loginSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ error: 'Vérifiez les champs saisis.' });
    try {
      const account = await repository.findAccount(data.data.email);
      const valid = await verifyPassword(data.data.password, account?.passwordHash || await dummyHash);
      if (!account || !valid) return res.status(401).json({ error: 'Identifiants incorrects.' });
      const token = newSessionToken();
      await repository.createSession(account.id, hashSessionToken(token), new Date(Date.now() + sessionAge));
      res.cookie(cookieName, token, cookieOptions);
      return res.json({ user: { id: account.id, name: account.name, email: account.email } });
    } catch (error) { next(error); }
  });
  app.get('/api/auth/session', async (req, res, next) => {
    try {
      const token = readToken(req);
      const user = token ? await repository.getSession(hashSessionToken(token)) : null;
      return res.json({ user });
    } catch (error) { next(error); }
  });
  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      const token = readToken(req);
      if (token) await repository.deleteSession(hashSessionToken(token));
      res.clearCookie(cookieName, { httpOnly: true, secure: secureCookie, sameSite: 'strict', path: '/' });
      return res.status(204).end();
    } catch (error) { next(error); }
  });
  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'Requête invalide.' });
    console.error('Auth request failed:', error.code || error.name);
    return res.status(500).json({ error: 'Service temporairement indisponible.' });
  });
  return app;
}
