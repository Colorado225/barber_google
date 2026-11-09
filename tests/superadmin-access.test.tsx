import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPERADMIN_EMAIL,
  getSuperAdminSession,
  loginSuperAdmin,
  verifySuperAdminAccess,
} from '../src/lib/superadmin';

// Environnement sans DOM : stockage et window en mémoire.
function installBrowserShims() {
  const createStorage = () => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    };
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: createStorage(),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: createStorage(),
    configurable: true,
    writable: true,
  });
  const fakeWindow = Object.assign(new EventTarget(), {
    location: { pathname: '/admin', search: '', hash: '' },
  });
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true, writable: true });
}

const FORGED_ADMIN = {
  id: 'forged',
  email: 'admin@barbercuts.com',
  name: 'Faux admin',
  role: 'super_admin',
  lastLogin: new Date().toISOString(),
};

test('compte unique : seule dominiquek051@gmail.com est le super administrateur', () => {
  assert.equal(SUPERADMIN_EMAIL, 'dominiquek051@gmail.com');
});

test('connexion : l’ancien compte et le mot de passe maître ne donnent plus accès', async () => {
  installBrowserShims();
  await assert.rejects(loginSuperAdmin('admin@barbercuts.com', 'SuperAdmin2026!'), /non autorisé/);
  await assert.rejects(loginSuperAdmin('superadmin@barbercuts.com', 'nimporte-quoi'), /non autorisé/);
  await assert.rejects(loginSuperAdmin('quelquun.admin@example.com', 'mot-de-passe-long'), /non autorisé/);
});

test('connexion : le bon e-mail sans Supabase configuré est refusé (aucun repli local)', async () => {
  installBrowserShims();
  await assert.rejects(
    loginSuperAdmin(SUPERADMIN_EMAIL, 'mot-de-passe-quelconque'),
    /Authentification serveur non configurée/,
  );
  assert.equal(getSuperAdminSession(), null, 'Aucune session créée');
});

test('session forgée dans le navigateur : rejetée pour tout autre e-mail', () => {
  installBrowserShims();
  sessionStorage.setItem('barbercuts_superadmin_session', JSON.stringify(FORGED_ADMIN));
  assert.equal(getSuperAdminSession(), null);
});

test('vérification serveur : sans Supabase, aucun accès et le cache est purgé', async () => {
  installBrowserShims();
  sessionStorage.setItem(
    'barbercuts_superadmin_session',
    JSON.stringify({ ...FORGED_ADMIN, email: SUPERADMIN_EMAIL }),
  );
  assert.equal(await verifySuperAdminAccess(), null);
  assert.equal(sessionStorage.getItem('barbercuts_superadmin_session'), null, 'Le cache est supprimé');
});
