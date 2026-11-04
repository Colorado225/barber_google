# Lot 0 — État des lieux

- **Date** : 2026-11-04
- **Branche auditée** : `arena/7c27a032-barber-google`, commit `621c0fa`
  (= `main` après merge PR #3, Lot vitrines marketplace inclus).
- **Méthode** : lecture du code réel, exécution des portes de qualité,
  inventaire SQL depuis `supabase/migrations/`, contrôle en lecture seule
  du projet Supabase lié `barber_google` (`rozsykrjrncbupzmauzj`).
- **Légende** : VÉRIFIÉ (preuve code/exécution) · DÉDUIT (plausible, à
  confirmer) · À VÉRIFIER (non accessible ici) · NON OPÉRATIONNEL ·
  OPÉRATIONNEL (testé dans le contexte indiqué).

## 1. Architecture réelle (VÉRIFIÉ)

| Couche | Réalité | Preuve |
| --- | --- | --- |
| Frontend | React 19 + TS + Vite 8 + Tailwind 4 + React Router 7, SPA unique ERP + marketplace | `package.json`, `src/router.tsx` |
| Source de vérité | **Supabase PostgreSQL** : le frontend n'appelle **aucune** route Express (0 référence `/api/` dans `src/`) | grep `src/` |
| Accès données | PostgREST direct (CRUD simples, RLS) sur 25 tables + **44 RPC** appelées, **toutes définies** dans `supabase/migrations/` (73 fonctions au total) | inventaire automatisé |
| Auth | Supabase Auth (`signInWithPassword`, `signUp`, session persistée) + `OnboardingGate` devant `/app/*` | `src/context/AuthContext.tsx` |
| Backend Express | **Legacy** : `server/` (2 774 lignes, auth + ressources + finance) n'est plus appelé par le produit ; seuls 8 fichiers de tests legacy l'exercent encore. Schéma associé : `database/migrations/` (10 fichiers, distinct de `supabase/migrations/`) + `compose.yaml` (PG local dev uniquement) | `server/`, `database/` |
| Edge Functions | 1 : `notifications-dispatcher` (**déployée, ACTIVE v7** sur le projet lié) | connecteur Supabase |
| CI | GitHub Actions : `ci.yml` (typecheck, lint, tests, build via `npm ci`) + `supabase-migrations.yml` (validation des migrations) | `.github/workflows/` |

Conséquence (DÉDUIT) : la double pile Express/Supabase est un héritage des
anciens « lots » du dépôt. La pile Express peut être retirée **après** le
triage de ses tests (voir §7 et PLAN-D-EXECUTION), mais elle ne bloque aucune
fonctionnalité produit aujourd'hui.

## 2. Résultats des portes de qualité (exécutées le 2026-11-04, VÉRIFIÉ)

| Commande | Résultat |
| --- | --- |
| `npm run typecheck` | ✅ 0 erreur (`strict` non activé dans `tsconfig.json` ; 13 occurrences `any` dans `src/`) |
| `npm run lint` | ✅ 0 erreur |
| `npm test` | ✅ **115 + 16 tests réussis, 0 échec**, 2 ignorés (`tests/operations-lot3.pg.test.mjs` : PostgreSQL réel absent) |
| `npm run build` | ✅ (avertissement taille de chunk uniquement) |
| `npm run format:check` | ❌ **131 fichiers** non formatés Prettier (jamais enforced ; ne pas lancer `format` massif sans décision — diff illisible) |

## 3. Base de données (VÉRIFIÉ depuis les migrations)

- **21 migrations** `supabase/migrations/` (2026-11-03 → 11-04), **29 tables**,
  toutes avec RLS activée, **59 policies**, 86 occurrences `SECURITY DEFINER`
  (toutes avec `set search_path = ''` dans les fonctions auditées).
- Modèle multi-tenant : `organizations → salons → branches` ;
  `memberships` (rôles owner/manager/receptionist/barber/cashier/accountant) ;
  périmètre centralisé dans `private.has_salon_permission` (redéfinie 3 fois,
  dernière version = `20261104100300`).
- Monnaie : montants `bigint` XOF (journal des paiements
  `20261104100100`, `services.price`), pas de flottants côté SQL.
- Rendez-vous : snapshot tarifaire à la création (`appointments.amount`,
  `service_name`, `staff_name`) ; historique append-only
  (`appointment_events`, `payment_events`) ; anti-chevauchement par
  contrainte d'exclusion `btree_gist` quand l'extension est disponible
  (repli documenté sur `private.is_slot_available` sous PGlite).
- **Aucune table d'abonnements SaaS** ; `SaaSPlanView` est un écran
  d'attente honnête (« disponible lorsqu'un service de facturation
  persistant sera connecté ») → Lot 8 de la feuille de route **non commencé**.
- **Aucun concept d'administrateur de plateforme** (grep négatif
  `platform_admin/superadmin`) → supervision plateforme absente (Lot 8).

## 4. État de la base liée / production (VÉRIFIÉ via connecteur, lecture seule)

| Élément | État |
| --- | --- |
| Migrations enregistrées | jusqu'à `20261104130500` — **`20261104140000` et `…140100` (vitrines) non enregistrées** ; objets créés hors CLI : table `salon_marketplace_settings` + 6/7 fonctions du customizer ; **RPC `publish_marketplace_customizer` absente** → bouton « Publier » de l'éditeur **NON OPÉRATIONNEL** en production (correctif : `npm run supabase:db:linked:push` depuis un poste lié, migrations idempotentes) |
| Edge `notifications-dispatcher` | ✅ ACTIVE v7 |
| Secrets présents | `NOTIFICATIONS_DISPATCH_TOKEN`, `PUBLIC_APP_URL`, `WHATSAPP_DEFAULT_COUNTRY_CODE`, `WHATSAPP_TEMPLATE_LANG` |
| Secrets absents | `RESEND_API_KEY`, `NOTIFICATIONS_EMAIL_FROM`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` → **aucun envoi réel e-mail/WhatsApp possible** (`provider_not_configured`, messages marqués « skipped », jamais « envoyés ») — **NON OPÉRATIONNEL** au sens envoi réel, OPÉRATIONNEL au sens file/journal |
| Hébergement frontend | À VÉRIFIER (aucun `vercel.json` ; l'organisation Supabase est de type Vercel, DÉDUIT : déploiement Vercel depuis `main`) |
| Données réelles en base | À VÉRIFIER (non inspectées : aucune lecture de données métier effectuée pendant l'audit) |

## 5. Points forts confirmés

- **Parcours marketplace transactionnel complet au niveau SQL** :
  `marketplace_book_appointment` vérifie salon publié, prestation active
  (rejet serveur même en appel RPC direct), prix/durée **recalculés côté
  serveur**, snapshot, source `marketplace`, idempotence
  (`public_idempotency_key` + index unique), jeton de suivi UUID,
  limite anti-abus (5 résa/téléphone/jour), rattachement CRM
  (`private.ensure_client_for_contact`, téléphone CI normalisé).
- **Moteur de disponibilité unique** `private.is_slot_available`
  (horaires succursale + employé + absences + compétences + RDV existants)
  partagé ERP (`day_availability`, création/déplacement) et marketplace.
- **Finance journalisée** : paiements `pending → confirmed/failed`,
  confirmation manuelle tracée pour le non-espèces (note ≥ 10 caractères,
  `settled_by`), corrections par écritures, sessions de caisse
  ouverture/clôture/rapprochement, montants entiers.
- **Machine à états des RDV** unique côté serveur, miroir typé côté client
  (`src/lib/appointment-workflow.ts` ↔ `transition_appointment`).
- **Aucune donnée fictive dans les écrans** : les seuls marqueurs « démo »
  sont des commentaires ; `analytics.ts` interdit explicitement les
  fallbacks inventés ; l'ERP est derrière session + e-mail vérifié +
  workspace (`OnboardingGate`).
- Tests d'intégration SQL réels (PGlite applique les vraies migrations) :
  parcours client complet, concurrence et isolation couverts
  (voir MATRICE-ERP-MARKETPLACE).

## 6. Faiblesses et risques principaux

| # | Constat | Catégorie | Gravité |
| --- | --- | --- | --- |
| F1 | RPC `publish_marketplace_customizer` absente en production + historique de migrations divergent (objets hors CLI) | VÉRIFIÉ | **Critique** (bloque « Publier ») |
| F2 | Aucun fournisseur d'envoi configuré (Resend/WhatsApp) : les clients ne reçoivent rien ; le lien de suivi n'est visible qu'à l'écran de confirmation | VÉRIFIÉ | **Élevée** |
| F3 | Double pile historique (Express + `database/migrations/` + ~55 tests legacy) : coût de maintenance, risque de confusion de source de vérité | VÉRIFIÉ | Moyenne |
| F4 | `AppContext.tsx` (1 336 lignes) + `api.ts` (1 137) : god objects ; chargements plein périmètre, pas d'invalidation ciblée ni Realtime (0 abonnement `channel`) → écrans potentiellement périmés entre postes | VÉRIFIÉ | Moyenne |
| F5 | `strict` TS désactivé ; `format:check` rouge (131 fichiers) | VÉRIFIÉ | Faible |
| F6 | Réponse du salon aux avis absente (aucune colonne/fonction de réponse dans `reviews`) | VÉRIFIÉ | Moyenne |
| F7 | Inbox « Demandes en ligne » : actions limitées à Confirmer/Refuser dans l'écran (pas de proposition de créneau ni de réaffectation depuis l'inbox ; possibles via le planning) | VÉRIFIÉ (lecture du composant) | Moyenne |
| F8 | Stocks : table `stock_items` seule, aucun mouvement/fournisseur/consommation par prestation | VÉRIFIÉ | Faible (Lot 7) |
| F9 | Concurrence « 2 réservations simultanées » garantie en prod par `btree_gist` **si** l'extension a été créée sur le projet lié ; sous PGlite le repli fonctionnel est testé | À VÉRIFIER sur le projet lié | Élevée si absent |
| F10 | Hébergement/backup/observabilité de production non documentés dans le dépôt | À VÉRIFIER | Moyenne (Lot 9) |

## 7. Documentation historique vs réalité

`docs/LOT-*-RAPPORT.md` (anciens lots 1–7) décrivent principalement la pile
**Express/PostgreSQL directe** ; le produit actuel tourne sur **Supabase**.
Conformément au master prompt, ces rapports sont conservés comme historique
mais **ne font pas foi** : la numérotation de la présente feuille de route
(Lots 0–4) est indépendante. Documents de référence valides :
`docs/workflow-officiel-erp.md`, `docs/supabase-migrations.md`,
`docs/LOT-4.2-VITRINES-MARKETPLACE.md`, et le présent dossier `docs/audit/`.

## 8. Conclusion du Lot 0

Le produit est **nettement plus avancé qu'un prototype** : cœur Supabase
cohérent, parcours ERP↔marketplace transactionnel déjà câblé et testé en
intégration. Les blocages réels sont **opérationnels** (F1, F2, F9) plus que
fonctionnels. Aucune réécriture n'est justifiée ; le travail des Lots 1–4
consistera surtout à **déployer proprement, vérifier en réel, combler les
écarts ponctuels (F6, F7) et fiabiliser (F4, F5)**, comme détaillé dans
`PLAN-D-EXECUTION.md`.

**Décision Lot 0 : VALIDÉ** (audit complet, livrables produits, aucune
fonctionnalité identifiée à supprimer sans justification).
