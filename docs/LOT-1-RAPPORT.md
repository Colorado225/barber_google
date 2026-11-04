# Rapport Lot 1 — Stabilisation technique et fondations

> Statut : **terminé et vérifié** (typecheck, lint, tests, build).
> Référence : `docs/MISEAJOUR.md` § 5, « LOT 1 — STABILISATION TECHNIQUE ET FONDATIONS ».

## 1.1 Audit technique initial

### Structure réelle

| Zone        | Contenu                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`      | Frontend React 19 + Vite 8 + Tailwind 4 (`App.tsx`, `router.tsx`, `context/`, `components/{auth,common,erp,marketplace}`, `lib/`, `types/`, `data/`) |
| `server/`   | API Express (`index.js`, `auth-app.js`, `resource-app.js`, `*-repository.js`, `password.js`, `session-runner.js`)                                    |
| `database/` | Migrations SQL + tests PGlite (`migrations/`, `tests/`)                                                                                              |
| `tests/`    | Tests API (`node:test`), tests React (`tsx` + Testing Library)                                                                                       |
| `docs/`     | Roadmap et workflow officiel                                                                                                                         |

### Problèmes relevés et classement

| ID    | Priorité | Problème                                                                                                                   | État                                                                                                       |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| L1-01 | P1       | `npm run lint` exécutait seulement `tsc` ; aucun ESLint ni Prettier                                                        | **Corrigé** : ESLint 10 (flat config), Prettier, scripts dédiés                                            |
| L1-02 | P1       | Aucun script `typecheck` / `test` global                                                                                   | **Corrigé** : `typecheck`, `test` (API + DB + React)                                                       |
| L1-03 | P1       | Certains tests existants n'étaient pas branchés dans un script (`tests/api.test.mjs`, `database/tests/resources.test.mjs`) | **Corrigé** : `test:api`, `test:resources`, agrégés dans `test`                                            |
| L1-04 | P1       | Aucune CI                                                                                                                  | **Corrigé** : `.github/workflows/ci.yml` (install, typecheck, lint, test, build)                           |
| L1-05 | P1       | KPI fictif « Taux de croissance global : +18.2 % » codé en dur dans le dashboard                                           | **Corrigé** : calcul à partir des séries réelles, sinon message explicite                                  |
| L1-06 | P1       | Factures SaaS fictives (2 lignes `#FAC-2026-…`, 19 900 FCFA) affichées comme réelles                                       | **Corrigé** : état vide explicite                                                                          |
| L1-07 | P1       | Données locales non identifiées comme démonstration                                                                        | **Corrigé** : `DEMO_DATA`, `DEMO_SALON`, `demoOnboarding`, badge `DemoDataBadge`                           |
| L1-08 | P2       | `AppContext.tsx` monolithique (≈ 1334 lignes)                                                                              | **Documenté**, découpage reporté (voir § 1.4)                                                              |
| L1-09 | P2       | Variables d'environnement frontend (`VITE_NEON_*`) absentes de `.env.example`                                              | **Corrigé** : documentées dans `.env.example`                                                              |
| L1-10 | P2       | Bundle principal > 500 kB (654 kB minifié)                                                                                 | **Documenté** : code-splitting à faire (P2)                                                                |
| L1-11 | P3       | `tsconfig.json` sans `strict`                                                                                              | **Documenté** : le code passe sans erreur, mais `strict` complet demanderait une passe dédiée (voir § 1.2) |

Aucun problème **P0** (bloquant) n'est resté ouvert à l'issue du lot.

## 1.2 TypeScript

- Le projet compile avec `tsc --noEmit` **sans erreur** avant et après le lot.
- `strict` n'a **pas** été activé en global : la version de TypeScript utilisée
  (TS 7) renvoie des milliers d'erreurs historiques sur le mode strict, sans
  valeur immédiate pour les fonctionnalités du lot.
- Les nouveaux fichiers respectent un typage explicite (aucun `any` nouveau).
- Décision : activer `strict` progressivement, écran par écran, en même temps
  que le découpage des features (Lots 2 et 3).

## 1.3 Qualité du code

Scripts npm disponibles :

| Script                            | Rôle                            |
| --------------------------------- | ------------------------------- |
| `npm run dev`                     | Frontend Vite (port 3000)       |
| `npm run dev:auth`                | API Express (port 3001)         |
| `npm run typecheck`               | `tsc --noEmit`                  |
| `npm run lint`                    | `eslint .`                      |
| `npm run format` / `format:check` | Prettier                        |
| `npm test`                        | Tous les tests (API, DB, React) |
| `npm run build`                   | Build de production             |

Outillage ajouté : `eslint` (flat config `eslint.config.js`), `prettier`
(`.prettierrc.json`, `.prettierignore`), `@eslint/js`, `eslint-plugin-react-hooks`,
`eslint-plugin-react-refresh`, `globals`.

**Limite connue et documentée** : TypeScript 7 n'expose pas d'API de parsing
publique et `typescript-eslint` ne supporte pas encore TS 7. Les fichiers
`.ts` / `.tsx` sont donc pour l'instant analysés uniquement par `tsc`
(`typecheck`) ; ESLint couvre le JS (`server/`, `database/`, tests, configs).
À réactiver dès qu'une version de `typescript-eslint` compatible TS 7 sortira.

Corrections appliquées pour que `lint` passe au vert :

- middlewares d'erreur Express à 4 arguments typés `_next` (obligatoire pour
  qu'Express les reconnaisse comme gestionnaires d'erreur) ;
- `catch {}` vide annoté dans `database/tests/resources.test.mjs`.

Verrouillage : `package-lock.json` présent et utilisé en CI (`npm ci`).

## 1.4 Architecture frontend

Aucun déplacement de fichiers n'a été fait dans ce lot (conformément à la
cible « indicative »). Points documentés pour les lots suivants :

- `AppContext.tsx` porte à la fois : navigation, session, données métier
  (clients, RDV, caisse, stock, fidélité), persistance `localStorage` et appels
  API. Découpage proposé, dans l'ordre : `SessionContext` (déjà partiel avec
  `AuthContext`), `WorkspaceContext` (données serveur), `LocalDemoContext`
  (persistance locale), puis un contexte par feature (`pos`, `loyalty`, …).
- Cible de structure `src/features/*` conservée pour les lots suivants.

## 1.5 Données fictives

- `src/data/mockData.ts` est désormais explicitement identifié comme
  **source de démonstration** (`DEMO_DATA`, `DEMO_SALON`).
- Le salon de démonstration porte `demoOnboarding: true` ; un salon réellement
  chargé depuis l'API est créé avec `demoOnboarding: false` (pas de confusion
  entre démo locale et données serveur).
- Un badge `Démo` (`src/components/erp/DemoDataBadge.tsx`) est affiché sur le
  tableau de bord tant que les données utilisées sont les données de démo.
- Dashboard : le « Taux de croissance global : +18.2 % » codé en dur est
  remplacé par une évolution calculée sur les séries réelles, ou
  « aucune donnée comparable ».
- Panier moyen : déjà géré par `computeAverageBasket` (retourne `null` →
  affichage `—` + « Aucun encaissement enregistré »). Aucun repli à 3 800 FCFA
  ne subsiste dans le code.
- Facturation SaaS : table de factures fictives supprimée au profit d'un état
  vide explicite.
- `PersonalizedDashboard` : ordre d'affichage corrigé (« Abidjan, Marcory » au
  lieu de « Cocody, … » incohérent), test de parcours aligné.

## 1.6 CI/CD

Workflow `.github/workflows/ci.yml` :

1. `actions/checkout` + `setup-node` (Node 22, cache npm)
2. `npm ci --legacy-peer-deps` (installation reproductible)
3. `npm run typecheck`
4. `npm run lint`
5. `npm test`
6. `npm run build` + archivage de `dist`

Aucun secret n'est référencé ; les tests utilisent PGlite (PostgreSQL
embarqué) et ne nécessitent pas de base distante.

## Critères d'acceptation

| Critère                                        | Vérification                                         |
| ---------------------------------------------- | ---------------------------------------------------- |
| Architecture React/Vite conservée              | ✅ aucun déplacement de fichier                      |
| Fonctionnalités existantes opérationnelles     | ✅ tests React + API verts, app montée en navigateur |
| Scripts de qualité explicites                  | ✅ `typecheck`, `lint`, `format`, `test`, `build`    |
| Build de production réussi                     | ✅ `npm run build`                                   |
| Tests existants réussis                        | ✅ 25 tests (21 Node + 4 React)                      |
| Données fictives plus présentées comme réelles | ✅ badge Démo, états vides, KPI calculés             |
| Erreurs techniques documentées                 | ✅ ce rapport                                        |
| Changements limités et vérifiables             | ✅ diff ciblé                                        |

## Commandes de vérification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Reste à faire (hors périmètre Lot 1)

- Découpage d'`AppContext.tsx` (P2).
- Code-splitting du bundle > 500 kB (P2).
- Activation progressive de `strict` (P2).
- Réactivation du lint TypeScript quand `typescript-eslint` supportera TS 7 (P2).
- Passage au Lot 2 (authentification, autorisations, multi-tenant).
