import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const options = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, options);
  return `scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  if (
    parts.length !== 6 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== '16384' ||
    parts[2] !== '8' ||
    parts[3] !== '1' ||
    !/^[a-f0-9]{32}$/.test(parts[4]) ||
    !/^[a-f0-9]{128}$/.test(parts[5])
  )
    return false;
  const expected = Buffer.from(parts[5], 'hex');
  const actual = await scrypt(password, Buffer.from(parts[4], 'hex'), expected.length, options);
  return timingSafeEqual(actual, expected);
}

export const newSessionToken = () => randomBytes(32).toString('hex');
export const hashSessionToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * Jetons à usage unique (vérification e-mail, réinitialisation) : on conserve
 * uniquement le hash côté base, jamais le jeton en clair.
 */
export const hashOpaqueToken = hashSessionToken;

/** Mot de passe compromis ? Liste courte des plus courants (complétée par la longueur minimale). */
const commonPasswords = new Set([
  'motdepasse',
  'motdepasse1',
  'password',
  'password1',
  'password123',
  'passw0rd',
  'azertyuiop',
  'azerty123456',
  'qwertyuiop12',
  '123456789012',
  'administrateur',
  'barbercuts2026',
]);

/** Politique de mot de passe : 12 caractères minimum, pas uniquement un caractère répété, pas trivial. */
export function validatePasswordPolicy(password) {
  if (typeof password !== 'string') return 'Le mot de passe est requis.';
  if (password.length < 12) return 'Le mot de passe doit contenir au moins 12 caractères.';
  if (password.length > 128) return 'Le mot de passe ne peut pas dépasser 128 caractères.';
  if (/^(.)\1+$/.test(password)) return 'Le mot de passe est trop simple.';
  if (commonPasswords.has(password.toLowerCase())) return 'Ce mot de passe est trop courant.';
  return null;
}
