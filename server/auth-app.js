import express from 'express';
import { z } from 'zod';
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  hashSessionToken,
  hashOpaqueToken,
  validatePasswordPolicy,
} from './password.js';
import { createRateLimiter, hashIp } from './rate-limit.js';

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const password = z.string().min(1).max(128);
const loginSchema = z.object({ email, password }).strict();
const signupSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email,
    password: z.string().min(12).max(128),
  })
  .strict();
const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const forgotSchema = z.object({ email }).strict();
const resetSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(12).max(128) })
  .strict();

const cookieName = 'bc_session';
const sessionAge = 7 * 24 * 60 * 60 * 1000;
export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function readToken(req) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

/**
 * Application Express d'authentification.
 *
 * Responsabilités :
 *  - inscription / connexion / déconnexion et session persistante ;
 *  - vérification d'adresse e-mail et réinitialisation de mot de passe ;
 *  - limitation des tentatives répétées et messages non révélateurs.
 *
 * Les jetons envoyés par e-mail ne sont jamais stockés en clair : seul leur hash
 * SHA-256 est conservé. Le mode `exposeTokens` est réservé aux tests et au
 * développement local (pas de fournisseur SMTP branché) : en production, les
 * jetons doivent être transmis par `sendEmail` et jamais renvoyés au client.
 */
export function createAuthApp({
  repository,
  allowedOrigin,
  secureCookie = true,
  sessionAgeMs = sessionAge,
  exposeTokens = false,
  sendEmail = null,
  rateLimits = {},
}) {
  if (!allowedOrigin) throw new Error('APP_ORIGIN is required');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // Refus par défaut : endpoints mutables uniquement depuis l'origine définie côté serveur.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.headers.origin !== allowedOrigin)
      return res.status(403).json({ error: 'Origine non autorisée.' });
    next();
  });
  app.use(express.json({ limit: '8kb', strict: true }));

  const globalLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: rateLimits.global ?? 100 });
  // 10 tentatives de connexion / inscription par IP et par quart d'heure.
  const loginLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: rateLimits.login ?? 10,
    key: (req) => `auth:${req.ip}`,
  });
  // Demandes de réinitialisation / vérification : anti-harcèlement d'adresses.
  const mailLimit = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: rateLimits.mail ?? 5,
    key: (req) => `mail:${req.ip}`,
  });
  app.use('/api/auth', globalLimit);

  const cookieOptions = {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'strict',
    path: '/',
    maxAge: sessionAgeMs,
  };
  // Un hash aléatoire fixe au démarrage évite un retour immédiat pour un compte inconnu.
  const dummyHash = hashPassword(newSessionToken());

  const sessionMetadata = (req) => ({
    userAgent: (req.get('user-agent') || '').slice(0, 300),
    ipHash: hashIp(req.ip),
  });

  async function deliverToken(kind, email, token) {
    if (sendEmail) {
      await sendEmail(kind, email, token);
      return {};
    }
    // Pas de fournisseur d'e-mail : en développement/test le jeton est renvoyé
    // pour permettre le parcours. Jamais en production.
    return exposeTokens ? { token } : {};
  }

  async function startSession(req, res, account) {
    const token = newSessionToken();
    await repository.createSession(
      account.id,
      hashSessionToken(token),
      new Date(Date.now() + sessionAgeMs),
      sessionMetadata(req),
    );
    res.cookie(cookieName, token, cookieOptions);
    return token;
  }

  const publicUser = (account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    emailVerified: Boolean(account.emailVerifiedAt),
  });

  app.post('/api/auth/signup', loginLimit, async (req, res, next) => {
    const data = signupSchema.safeParse(req.body);
    if (!data.success)
      return res
        .status(400)
        .json({ error: 'Vérifiez votre nom, votre e-mail et votre mot de passe (12 caractères minimum).' });
    const policyError = validatePasswordPolicy(data.data.password);
    if (policyError) return res.status(400).json({ error: policyError });
    try {
      const account = await repository.createAccount({
        email: data.data.email,
        name: data.data.name,
        passwordHash: await hashPassword(data.data.password),
      });
      // Pas de connexion automatique : l'adresse doit être vérifiée.
      const token = newSessionToken();
      await repository.issueToken(
        account.id,
        hashOpaqueToken(token),
        'verify_email',
        new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      );
      await repository.setOnboarding(account.id, { currentStep: 'email_verification' });
      const extra = await deliverToken('verify_email', account.email, token);
      return res.status(201).json({
        message: 'Compte créé. Vérifiez votre adresse e-mail pour activer votre espace.',
        ...extra,
      });
    } catch (error) {
      if (error.code === '23505')
        return res.status(409).json({ error: 'Impossible de créer ce compte. Essayez de vous connecter.' });
      next(error);
    }
  });

  app.post('/api/auth/verify-email', mailLimit, async (req, res, next) => {
    const data = tokenSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ error: 'Lien de vérification invalide ou expiré.' });
    try {
      const userId = await repository.consumeToken(hashOpaqueToken(data.data.token), 'verify_email');
      if (!userId) return res.status(400).json({ error: 'Lien de vérification invalide ou expiré.' });
      await repository.markEmailVerified(userId);
      await repository.setOnboarding(userId, { emailVerified: true, currentStep: 'salon_creation' });
      return res.json({ message: 'Adresse e-mail vérifiée. Vous pouvez vous connecter.' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', loginLimit, async (req, res, next) => {
    const data = loginSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ error: 'Vérifiez les champs saisis.' });
    try {
      const account = await repository.findAccount(data.data.email);
      const valid = await verifyPassword(data.data.password, account?.passwordHash || (await dummyHash));
      // Message identique pour un compte inconnu et un mot de passe faux.
      if (!account || !valid) return res.status(401).json({ error: 'Identifiants incorrects.' });
      if (!account.emailVerifiedAt) {
        const token = newSessionToken();
        await repository.issueToken(
          account.id,
          hashOpaqueToken(token),
          'verify_email',
          new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
        );
        const extra = await deliverToken('verify_email', account.email, token);
        return res.status(403).json({
          error: 'Vérifiez votre adresse e-mail avant de vous connecter.',
          code: 'email_not_verified',
          ...extra,
        });
      }
      await startSession(req, res, account);
      return res.json({ user: publicUser(account) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/session', async (req, res, next) => {
    try {
      const token = readToken(req);
      const user = token
        ? await repository.getSession(hashSessionToken(token), { touch: true, extendMs: sessionAgeMs })
        : null;
      if (token && !user)
        res.clearCookie(cookieName, { httpOnly: true, secure: secureCookie, sameSite: 'strict', path: '/' });
      return res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      const token = readToken(req);
      if (token) await repository.deleteSession(hashSessionToken(token));
      res.clearCookie(cookieName, { httpOnly: true, secure: secureCookie, sameSite: 'strict', path: '/' });
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout-all', async (req, res, next) => {
    try {
      const token = readToken(req);
      const user = token ? await repository.getSession(hashSessionToken(token), { touch: false }) : null;
      if (!user) return res.status(401).json({ error: 'Authentification requise.' });
      await repository.deleteAllSessions(user.id);
      res.clearCookie(cookieName, { httpOnly: true, secure: secureCookie, sameSite: 'strict', path: '/' });
      return res.json({ message: 'Toutes les sessions ont été révoquées.' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/forgot-password', mailLimit, async (req, res, next) => {
    const data = forgotSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    // Réponse volontairement identique, que le compte existe ou non.
    const generic = {
      message: 'Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.',
    };
    try {
      const account = await repository.findAccount(data.data.email);
      if (!account) return res.json(generic);
      const token = newSessionToken();
      await repository.issueToken(
        account.id,
        hashOpaqueToken(token),
        'reset_password',
        new Date(Date.now() + RESET_TOKEN_TTL_MS),
      );
      const extra = await deliverToken('reset_password', account.email, token);
      return res.json({ ...generic, ...extra });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/reset-password', mailLimit, async (req, res, next) => {
    const data = resetSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré.' });
    const policyError = validatePasswordPolicy(data.data.password);
    if (policyError) return res.status(400).json({ error: policyError });
    try {
      const userId = await repository.consumeToken(hashOpaqueToken(data.data.token), 'reset_password');
      if (!userId) return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré.' });
      await repository.updatePassword(userId, await hashPassword(data.data.password));
      // Un changement de mot de passe révoque toutes les sessions existantes.
      await repository.deleteAllSessions(userId);
      res.clearCookie(cookieName, { httpOnly: true, secure: secureCookie, sameSite: 'strict', path: '/' });
      return res.json({
        message: 'Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de passe.',
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/resend-verification', mailLimit, async (req, res, next) => {
    const data = forgotSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    const generic = {
      message: 'Si un compte non vérifié existe pour cette adresse, un nouvel e-mail a été envoyé.',
    };
    try {
      const account = await repository.findAccount(data.data.email);
      if (!account || account.emailVerifiedAt) return res.json(generic);
      const token = newSessionToken();
      await repository.issueToken(
        account.id,
        hashOpaqueToken(token),
        'verify_email',
        new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      );
      const extra = await deliverToken('verify_email', account.email, token);
      return res.json({ ...generic, ...extra });
    } catch (error) {
      next(error);
    }
  });

  // Middleware d'erreur Express : la signature à 4 arguments est obligatoire.
  app.use((error, req, res, _next) => {
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'Requête trop volumineuse.' });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: 'Requête invalide.' });
    console.error('Auth request failed:', error.code || error.name, error.message);
    return res.status(500).json({ error: 'Service temporairement indisponible.' });
  });
  return app;
}

// Invitations (added)
