import { createHash } from 'node:crypto';

/**
 * Limitation de débit en mémoire (Lot 2).
 *
 * Implémentation volontairement simple et partagée entre les routes
 * d'authentification et les routes métier sensibles. En production multi-instances,
 * remplacer le store par Redis (ou équivalent) : la dette est documentée dans
 * `docs/LOT-2-RAPPORT.md`.
 *
 * @param {object} options
 * @param {number} options.windowMs fenêtre glissante
 * @param {number} options.max requêtes autorisées par fenêtre et par clé
 * @param {number} [options.maxKeys] borne mémoire
 * @param {(req: import('express').Request) => string} [options.key] identifiant la clé
 */
export function createRateLimiter({ windowMs, max, maxKeys = 20000, key }) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const id = key ? key(req) : req.ip;

    // Nettoyage opportuniste pour borner la mémoire.
    if (buckets.size > maxKeys) {
      for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
      if (buckets.size > maxKeys) buckets.clear();
    }

    const bucket = buckets.get(id);
    if (!bucket || bucket.reset <= now) {
      buckets.set(id, { count: 1, reset: now + windowMs });
      res.set('RateLimit-Remaining', String(max - 1));
      return next();
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.set('RateLimit-Remaining', String(remaining));
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.reset - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
    }
    return next();
  };
}

/** Hash non réversible d'une adresse IP (audit), jamais l'adresse brute. */
export function hashIp(ip) {
  if (!ip) return null;
  return createHash('sha256').update(String(ip)).digest('hex').slice(0, 64);
}
