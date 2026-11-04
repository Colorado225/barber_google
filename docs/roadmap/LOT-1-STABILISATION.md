# Lot 1 — Stabilisation technique (rapport)

- **Date** : 2026-11-04 · **Branche** : `arena/7c27a032-barber-google`
  (depuis `main` @ `7fc17ad`, Lot 0 mergé par PR #4).
- **Objectif** : base technique fiable avant les évolutions fonctionnelles
  (master prompt §7), selon `docs/audit/PLAN-D-EXECUTION.md`.

## A. Résumé exécutif

État de départ : portes vertes mais `strict` TS désactivé,
`format:check` rouge (131 fichiers), schéma du projet lié divergent de
l'historique des migrations, pile Express legacy non qualifiée.
Résultat : **`strict` activé à 0 erreur**, formatage appliqué et désormais
enforced en CI, `any` injustifiés éliminés (13 → 5 justifiés), gel
documenté de la pile Express, et deux vérifications production importantes
obtenues en lecture seule (anti-chevauchement **actif**). Reste une réserve
externe : le `db push` de régularisation (action exploitant).

## B. Modifications réalisées

| Fichier(s)                                                           | Modification                                                                                           | Justification                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `tsconfig.json`                                                      | `strict`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `forceConsistentCasingInFileNames` = true | Mesures `tsc` : tous ces flags passaient déjà à **0 erreur** — activation sans campagne de réécriture |
| `src/components/erp/ErpLayout.tsx`                                   | `icon: any` → `LucideIcon`                                                                             | Typage réel des items de navigation                                                                   |
| `src/features/marketplace-customizer/SalonMarketplaceCustomizer.tsx` | 4× `catch (err: any)` → `unknown` + `instanceof Error`                                                 | Erreurs API typées, pas d'accès aveugle à `.message`                                                  |
| `DashboardView.tsx`, `NewAppointmentModal.tsx`                       | casts `as any` → unions réelles (`typeof`, `PaymentMethod`)                                            | Contrats UI explicites                                                                                |
| `SalonProfileSettingsView.tsx`                                       | `handleHourChange` générique `<K extends keyof OpeningHour>`                                           | Valeur typée selon le champ modifié                                                                   |
| 129 fichiers                                                         | Prettier appliqué (commit isolé `b957d44`, aucun changement logique)                                   | `format:check` était rouge sur 131 fichiers                                                           |
| `.prettierignore`                                                    | `public/` ajouté                                                                                       | Assets de référence, déjà exclus de `tsconfig`                                                        |
| `.github/workflows/ci.yml`                                           | Étape `Format` (`format:check`)                                                                        | Empêche toute régression de style                                                                     |
| `server/README.md` (nouveau)                                         | Gel documenté de la pile Express                                                                       | F3/S2 de l'audit : plus d'ambiguïté sur la source de vérité                                           |

`any` résiduels (5, justifiés) : `src/components/ui/motion-preset.tsx`
(interop `motion` : composants dynamiques typés `any` par la lib).

## C. Étude `strict` (mesures exactes, tsc 7)

| Flag                                                                   | Erreurs | Décision                                                                                                       |
| ---------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `--strict` (dont strictNullChecks, noImplicitAny, strictFunctionTypes) | **0**   | ✅ activé                                                                                                      |
| `--noFallthroughCasesInSwitch`                                         | 0       | ✅ activé                                                                                                      |
| `--noImplicitReturns`                                                  | 0       | ✅ activé                                                                                                      |
| `--forceConsistentCasingInFileNames`                                   | 0       | ✅ activé                                                                                                      |
| `--noUncheckedIndexedAccess`                                           | **44**  | ⏸️ reporté : campagne dédiée (accès indexés dans de nombreux composants) ; à traiter par domaine, pas en masse |

## D. Base de données — vérifications production (lecture seule, 2026-11-04)

Projet lié `barber_google` (`rozsykrjrncbupzmauzj`), requête catalogues :

| Contrôle                                                       | Résultat                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Extension `btree_gist`                                         | ✅ installée                                                                                           |
| Contrainte d'exclusion (anti-chevauchement) sur `appointments` | ✅ présente → **la garantie dure du scénario H est active en production** (F9 levé positivement)       |
| Policies RLS publiques                                         | 59 (cohérent avec les migrations)                                                                      |
| Dernière migration enregistrée                                 | `20261104130500`                                                                                       |
| RPC `publish_marketplace_customizer`                           | ❌ **toujours absente** — le `db push` de régularisation n'a pas encore été exécuté par l'exploitation |

Aucune migration créée dans ce lot. La régularisation reste l'action
exploitant documentée dans `docs/LOT-4.2-VITRINES-MARKETPLACE.md`
(`npm run supabase:db:linked:push`, migrations idempotentes).

## E. Règles de chargement/rafraîchissement actuelles (constatées, inchangées)

Documentées pour servir de référence aux Lots 3/4 (aucune réécriture
d'`AppContext` dans ce lot, conformément au plan) :

- **Chargement initial ERP** : au montage + au changement de salon actif,
  `AppContext` charge le périmètre complet via `salonApi(salonId)`
  (clients, services, staff, RDV, dépenses, stock, rewards, avis,
  branches) ; états initiaux = tableaux vides (aucune donnée fictive).
- **Après mutation** : l'état local est mis à jour depuis la réponse de la
  RPC/du PostgREST (`setAppointments(prev => …saved…)`), **sans**
  rechargement global — les vues du même poste restent cohérentes.
- **Rafraîchissements explicites** : `refreshMarketplace`,
  `refreshFinance`, `refreshNotifications`, `refreshLoyalty`.
- **Limites connues** : pas de Realtime ni de rechargement au focus →
  un second poste ne voit les changements qu'après rechargement
  (traité au Lot 4, item « fraîcheur ciblée », pas ici).

## F. Tests et portes (résultats exacts)

Après chaque commit du lot :

| Commande                     | Résultat                                  |
| ---------------------------- | ----------------------------------------- |
| `npm run typecheck` (strict) | ✅ 0 erreur                               |
| `npm run lint`               | ✅                                        |
| `npm run format:check`       | ✅ propre (était : 131 fichiers en écart) |
| `npm test`                   | ✅ 115 + 16 réussis, 0 échec, 2 ignorés   |
| `npm run build`              | ✅                                        |

Décision `tests/operations-lot3.pg.test.mjs` (2 ignorés) : cette suite
exerce la **pile Express legacy** sur PostgreSQL réel. Ne pas ajouter de
service PG en CI pour une pile gelée vouée à l'archivage (Lot 2) ; côté
Supabase, la concurrence est couverte par les suites PGlite **et** la
contrainte d'exclusion est vérifiée active en production (§D). La suite
reste exécutable localement via `PG_URL` (voir en-tête du fichier).

## G. Limites restantes / interventions humaines

1. **`db push` de régularisation non exécuté** (exploitant) → bouton
   « Publier » de la vitrine toujours inopérant en production ; tout le
   reste du parcours vitrine fonctionne.
2. `noUncheckedIndexedAccess` : 44 sites à traiter par campagne dédiée.
3. Confirmation « aucun serveur Express déployé » toujours attendue
   (pré-requis du retrait au Lot 2) ; hébergement frontend à confirmer.

## H. Décision

**VALIDÉ AVEC RÉSERVES** — tous les items code du Lot 1 sont terminés et
prouvés ; la seule réserve est externe (régularisation du schéma lié,
action exploitant unique et documentée). Le Lot 2 (authentification,
sécurité, multi-tenant) peut démarrer en parallèle de cette action.
