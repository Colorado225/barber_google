# Lot 2 — Authentification, sécurité et multi-tenant (rapport)

- **Date** : 2026-11-04 · **Branche** : `arena/1e0caae0-barber-google`
  (depuis `main` @ `d448833`, Lots 0 et 1 mergés — PR #4, PR #5).
- **Objectif** : périmètres d'accès stricts et prouvés (master prompt §8),
  selon `docs/audit/PLAN-D-EXECUTION.md` et `docs/audit/ANALYSE-SECURITE.md`.

## A. Résumé exécutif

Le modèle de sécurité Supabase existant (RLS + `has_salon_permission` +
surface `anon` minimale) est confirmé sain et désormais **prouvé par des
tests dédiés**. Trois résultats concrets : (1) la pile Express historique,
confirmée non déployée par l'exploitation, est **retirée** (−10 778 lignes,
183 paquets) — il n'existe plus qu'une seule surface d'authentification ;
(2) la parité front/serveur des permissions est **vérifiée à l'exécution**
en CI, après correction de 2 divergences du miroir frontend ; (3) la
nouvelle suite de sécurité a découvert et permis de corriger un **bug réel
d'autorisation en production** : la création manuelle de clients dans
l'ERP échouait en 42501 (voir §D).

## B. Modifications réalisées

| Zone                                                                           | Modification                                                                                                                                                                    | Justification                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `server/`, `database/migrations/`, `compose.yaml`, 10 fichiers de tests legacy | Supprimés (commit `c0f2266`)                                                                                                                                                    | Frontend 100 % Supabase (vérifié Lot 0) ; serveur confirmé non déployé ; archive = historique Git |
| `package.json` / lockfile                                                      | Scripts legacy retirés ; dépendances mortes supprimées : express, pg, dotenv, zod, supertest, @types/express, @types/supertest, @aws-sdk/client-s3, @google/genai (inutilisées) | Une seule pile maintenue ; surface d'attaque et coût CI réduits                                   |
| `docs/roadmap/MATRICE-PERMISSIONS.md`                                          | Matrice officielle 38 permissions × 6 rôles, générée depuis la fonction SQL effective                                                                                           | Référence unique §8.1                                                                             |
| `src/lib/permissions.ts`                                                       | `receptionist` : retrait de `payments.read` ; retrait de `display.update`                                                                                                       | Divergences front/serveur prouvées (serveur = vérité)                                             |
| `tests/permissions.test.ts` → `.tsx`                                           | Renommage + mise à jour                                                                                                                                                         | Le fichier n'était exécuté par **aucune** phase de `npm test` (glob `*.test.tsx`)                 |
| `tests/permissions-parity.test.tsx`                                            | Test de parité d'exécution (nouveau)                                                                                                                                            | Voir §C                                                                                           |
| `database/tests/supabase-security.test.mjs`                                    | Suite de sécurité dédiée (7 tests)                                                                                                                                              | Voir §C — a révélé le bug §D                                                                      |
| `supabase/migrations/20261104140200_normalize_phone_execute_grant.sql`         | `grant execute … normalize_phone to authenticated`                                                                                                                              | Correctif du bug §D (migration additive, aucune migration appliquée modifiée)                     |
| `package.json` scripts                                                         | `test:supabase` complété (customizer + security) ; nouveau `test:security`                                                                                                      | Les suites sécurité sont exécutées par les commandes documentées                                  |

## C. Preuves (tests ajoutés, tous verts)

**Parité des permissions** (`tests/permissions-parity.test.tsx`) :
applique les 22 migrations sur PGlite, extrait la matrice depuis
`pg_proc.prosrc` de `private.has_salon_permission` (aucun duplicata
manuel), compare au miroir TS dans les deux sens, fige l'ensemble
« serveur uniquement » documenté (`reviews.moderate` + 6 alias hérités
inutilisés par les RPC actuelles), puis **exécute** la fonction pour
6 rôles × 38 permissions avec memberships réelles — y compris membership
suspendue (aucun accès) et non-membre (aucun accès).

**Suite de sécurité** (`database/tests/supabase-security.test.mjs`) :

- `anon` : 42501 sur `clients/appointments/payments/expenses/staff/
memberships` en lecture directe et sur les RPC ERP
  (customizer get/save, `record_expense`) ; `marketplace_list_salons` OK.
- RLS en accès direct : le salon B ne voit aucun client/service du A,
  insert cross-salon 42501, update cross-salon = 0 ligne (prix inchangé,
  contrôle positif) ; authentifié sans membership = 0 salon visible.
- Moindre privilège : barbier et manager **suspendu** rejetés (42501) sur
  `record_expense` ; comptable rejeté sur `transition_appointment` alors
  que le propriétaire confirme le même RDV.
- Appels RPC directs : prestation inactive → 22023 ; salon non publié →
  22023 ; annulation avec jeton forgé → 22023, avec le vrai jeton → OK
  (même après confirmation ERP).
- Régression §D : insert/update direct d'un client par un membre
  authentifié réussit.

## D. Bug réel corrigé (découvert par la suite ci-dessus)

**Symptôme** : création/modification manuelle d'un client dans l'ERP
(Clients/CRM, `src/lib/api.ts` → PostgREST direct) échoue en
`42501 permission denied for function normalize_phone`.
**Cause** : la migration `20261104130000_crm_auto_link` a créé l'index
fonctionnel `clients_salon_phone_normalized_idx` sur
`private.normalize_phone(phone)` tout en révoquant `EXECUTE` sur cette
fonction au rôle `authenticated` ; PostgreSQL exige ce privilège lors de
la maintenance de l'index par le rôle qui écrit. Seuls les chemins
`SECURITY DEFINER` (réservation marketplace, walk-in) fonctionnaient.
**Correctif** : migration `20261104140200` accordant `EXECUTE` à
`authenticated` (helper pur, aucun accès données ; `anon` inchangé).
**Déploiement** : incluse dans le prochain
`npm run supabase:db:linked:push` (avec les migrations vitrines en
attente). Aucun autre helper révoqué n'est utilisé dans un index
(vérifié par grep exhaustif des `revoke … authenticated`).

## E. Points tranchés / restants

| Point                                    | État                                                                                                                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serveur Express déployé ?                | **Non** (confirmation exploitation 2026-11-04) → retrait exécuté, risque S2 clos                                                                                                                         |
| Garantie anti-double-réservation en prod | Confirmée au Lot 1 (`btree_gist` + exclusion actifs sur le projet lié), risque S4 clos                                                                                                                   |
| Jeton de suivi client non révocable (S3) | **Décision produit non reçue** : comportement actuel conservé et documenté (portée = 1 RDV, actions limitées, jeton UUID imprévisible) ; rotation possible par migration additive dès validation produit |
| Divergence schéma lié ↔ historique (S1)  | Inchangée : `db push` toujours en attente côté exploitation (appliquera aussi `20261104140200`)                                                                                                          |
| Admin plateforme                         | Toujours absent (Lot 8, hors feuille de route)                                                                                                                                                           |

## F. Tests exécutés (résultats exacts)

- Après retrait Express : typecheck/lint/format ✅, `npm test`
  **58 + 16, 0 échec, 0 ignoré**, build ✅.
- Parité + permissions renommé : 2/2 ✅.
- Suite sécurité : 7/7 ✅ (après correctif §D ; avant correctif, 4 échecs
  dont la preuve du bug).
- Suite complète finale : voir §F de la PR du Lot 2 (portes relancées
  avant push).

## H. Décision

**VALIDÉ AVEC RÉSERVES** — réserves externes inchangées : (1) `db push`
de régularisation non exécuté (débloque « Publier » vitrine + correctif
§D en production), (2) décision produit sur la révocation du jeton de
suivi. Le Lot 3 (cœur opérationnel : définitions KPI dashboard testées,
section actions à effectuer, scénario §9.8 automatisé) peut démarrer.
