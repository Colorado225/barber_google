import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { getRolePermissions } from '../src/lib/permissions';

/**
 * Parité front/serveur des permissions (Lot 2).
 *
 * La vérité est `private.has_salon_permission` (dernière définition
 * appliquée des migrations). Ce test :
 *  1. applique toutes les migrations Supabase sur PGlite ;
 *  2. extrait la matrice serveur depuis le corps réel de la fonction
 *     (pg_proc.prosrc) — aucun duplicata maintenu à la main ;
 *  3. vérifie que le miroir frontend (src/lib/permissions.ts) accorde
 *     exactement les mêmes rôles pour chaque permission qu'il déclare ;
 *  4. vérifie que les permissions serveur absentes du miroir sont
 *     exactement l'ensemble documenté (alias hérités + reviews.moderate) ;
 *  5. exécute réellement la fonction pour chaque rôle × permission et
 *     compare au résultat attendu (memberships seedées).
 */

const ROLES = ['owner', 'manager', 'receptionist', 'barber', 'cashier', 'accountant'] as const;

// Permissions présentes côté serveur mais volontairement absentes du
// miroir frontend (voir docs/roadmap/MATRICE-PERMISSIONS.md). Toute
// nouvelle permission serveur doit soit rejoindre le miroir, soit être
// ajoutée ici avec justification.
const SERVER_ONLY = [
  'cashier.read',
  'cashier.write',
  'payments.create',
  'payments.refund.read',
  'payments.refund.write',
  'payments.write',
  'reviews.moderate',
].sort();

const USERS: Record<(typeof ROLES)[number], string> = {
  owner: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  receptionist: '33333333-3333-4333-8333-333333333333',
  barber: '44444444-4444-4444-8444-444444444444',
  cashier: '55555555-5555-4555-8555-555555555555',
  accountant: '66666666-6666-4666-8666-666666666666',
};
const SUSPENDED = '77777777-7777-4777-8777-777777777777';
const OUTSIDER = '88888888-8888-4888-8888-888888888888';

const db = new PGlite();
let salonId: string;

async function asUser(userId: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}

async function seed() {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);
  const allUsers = [...Object.values(USERS), SUSPENDED, OUTSIDER];
  for (const id of allUsers) {
    await db.query('insert into auth.users(id, email_confirmed_at) values ($1, now())', [id]);
  }
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }

  await asUser(USERS.owner);
  const created = await db.query(
    "select * from public.create_salon('Organisation Parité', 'Salon Parité', 'Principal')",
  );
  salonId = (created.rows[0] as { salon_id: string }).salon_id;

  await db.exec('reset role');
  for (const role of ROLES.filter((r) => r !== 'owner')) {
    await db.query('insert into public.memberships(salon_id, user_id, role) values ($1, $2, $3)', [
      salonId,
      USERS[role],
      role,
    ]);
  }
  await db.query(
    "insert into public.memberships(salon_id, user_id, role, status) values ($1, $2, 'manager', 'suspended')",
    [salonId, SUSPENDED],
  );
}

function parseServerMatrix(prosrc: string): Map<string, Set<string>> {
  const matrix = new Map<string, Set<string>>();
  const re = /when '([a-z.]+)' then (true|m\.role in \(([^)]+)\)|m\.role = '(\w+)')/g;
  for (const m of prosrc.matchAll(re)) {
    const [, perm, expr, inList, single] = m;
    const roles =
      expr === 'true'
        ? new Set<string>(ROLES)
        : inList
          ? new Set([...inList.matchAll(/'(\w+)'/g)].map((x) => x[1]))
          : new Set([single]);
    matrix.set(perm, roles);
  }
  return matrix;
}

test('parité des permissions : miroir frontend = fonction serveur, vérifiée à l’exécution', async () => {
  await seed();

  const { rows } = await db.query(
    "select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'has_salon_permission'",
  );
  const server = parseServerMatrix((rows[0] as { prosrc: string }).prosrc);
  assert.ok(server.size >= 30, `matrice serveur trop petite (${server.size}) : parsing à revoir`);

  // (3) Chaque permission du miroir frontend accorde exactement les mêmes rôles côté serveur.
  const frontPerms = new Set<string>();
  for (const role of ROLES) {
    for (const perm of getRolePermissions(role)) {
      frontPerms.add(perm);
      assert.ok(
        server.get(perm)?.has(role),
        `divergence : le frontend accorde ${perm} à ${role}, pas le serveur`,
      );
    }
  }
  for (const [perm, roles] of server) {
    if (!frontPerms.has(perm)) continue;
    for (const role of roles) {
      assert.ok(
        getRolePermissions(role).includes(perm),
        `divergence : le serveur accorde ${perm} à ${role}, absent du miroir frontend`,
      );
    }
  }

  // (4) Les permissions serveur hors miroir sont exactement l'ensemble documenté.
  const serverOnly = [...server.keys()].filter((p) => !frontPerms.has(p)).sort();
  assert.deepEqual(serverOnly, SERVER_ONLY);

  // (5) Exécution réelle : chaque rôle × chaque permission serveur.
  for (const role of ROLES) {
    await asUser(USERS[role]);
    for (const [perm, roles] of server) {
      const res = await db.query('select private.has_salon_permission($1, $2) as allowed', [salonId, perm]);
      assert.equal(
        (res.rows[0] as { allowed: boolean }).allowed,
        roles.has(role),
        `exécution : ${role} / ${perm}`,
      );
    }
  }

  // Membership suspendue et non-membre : aucun accès, même en lecture de base.
  for (const userId of [SUSPENDED, OUTSIDER]) {
    await asUser(userId);
    const res = await db.query('select private.has_salon_permission($1, $2) as allowed', [
      salonId,
      'salon.read',
    ]);
    assert.equal((res.rows[0] as { allowed: boolean }).allowed, false);
  }
});

after(async () => {
  await db.close();
});
