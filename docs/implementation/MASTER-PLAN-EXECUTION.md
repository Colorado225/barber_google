# Plan maître : audit, fiabilisation et évolution de BarberCuts

Statut au 2026-11-09, branche `arena/2ee0eef3-barber-google` (base `main` `ecf29b7`).

Ce document ne contient que des statuts vérifiés. Chaque ligne « terminé » renvoie à un contrôle exécuté
(test, requête lecture seule sur la base de production, ou relecture du code). Les statuts utilisés sont :
**terminé**, **partiel**, **bloqué**, **non commencé**.

## 1. Résumé exécutif

- Phase 0 (audit de l'existant) : **terminé**. Plusieurs constats de l'audit précédent ont été vérifiés ; deux
  ont été corrigés dans cette session (voir section 3).
- Lot 1 (fiabilisation, P0) : **partiel**. Les corrections de souscription, de quotas et de validation de paiement
  sont écrites et testées, mais **la migration n'est pas appliquée en production** et le déploiement est **bloqué**
  par une divergence d'historique de migrations. Les décisions SuperAdmin (suspension, modération, administrateurs)
  restent dans le `localStorage` du navigateur.
- Lots 2 et 3 : **non commencés**.
- Lot 4 (monétisation SaaS) : **partiel**. Sélection de forfait, demande en attente, validation manuelle par le
  SuperAdmin et quotas serveur existent. L'expiration, les impayés, l'annulation et l'historique ne sont pas faits.
- Lot 5 : **non commencé**, comme demandé (ne démarre qu'après fiabilisation des lots 1 à 4).

**Recommandation objective : usage développement et démonstration uniquement.** Aucune exploitation commerciale
en production n'est recommandée à ce stade (voir section 8).

## 2. Phase 0 : constats vérifiés

| #   | Constat (audit précédent)                                                            | Résultat de la vérification                                                                                                                                                                                                              | Action                                                                                            |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Souscription activée sans paiement (`subscribe_salon_to_plan` insère `active`)       | **Confirmé** : la RPC créait un abonnement `active` immédiatement. Le client repassait aussi en `active` localement si la RPC échouait.                                                                                                  | Corrigé (migration `20261110090000`, `saas.ts`). Non déployé.                                     |
| 2   | Périodes annuelles de 30 jours                                                       | **Confirmé** : `interval '30 days'` pour tous les cycles.                                                                                                                                                                                | Corrigé : 12 mois pour `yearly`. Non déployé.                                                     |
| 3   | Quotas staff/agences non appliqués                                                   | **Confirmé** : `max_staff` et `max_branches` stockés, jamais contrôlés.                                                                                                                                                                  | Partiel : triggers serveur ajoutés, mais seulement si un abonnement est actif (voir décision D2). |
| 4   | `getSalonSubscription` simule un abonnement « starter » actif                        | **Confirmé** dans `saas.ts`.                                                                                                                                                                                                             | Corrigé : renvoie `null` si aucun abonnement validé.                                              |
| 5   | Faux avis « vérifiés » et fausses entrées d'audit en `localStorage`                  | **Confirmé** dans `superadmin.ts` (trois avis et deux entrées d'audit injectés au premier chargement).                                                                                                                                   | Corrigé : listes vides par défaut. Persistance serveur non faite.                                 |
| 6   | Libellé « commissions déduites » sur la marge                                        | **Confirmé** : `totalRevenue − totalExpenses`, aucune commission.                                                                                                                                                                        | Corrigé (libellé).                                                                                |
| 7   | `ErpLayoutNew`, `SuperAdminConsoleView`, `CrmClientsView`, `ExpensesView` redondants | **Confirmé inutilisés** (aucun import rendu).                                                                                                                                                                                            | Supprimés, imports morts retirés. Historique Git conservé.                                        |
| 8   | Politique RLS `saas_plans` ouverte aux propriétaires                                 | **Corrigé auparavant** (migration de garde) : politique réservée à `is_platform_superadmin()`.                                                                                                                                           | Vérifié en relecture.                                                                             |
| 9   | Tables sans RLS en production                                                        | **Aucune** : requête lecture seule sur la base de production.                                                                                                                                                                            | Vérifié.                                                                                          |
| 10  | `SECURITY DEFINER` sans `search_path`                                                | **Aucun** en production (contrôle sur les 56 fonctions applicatives) ni dans le dépôt (105 définitions contrôlées).                                                                                                                      | Vérifié.                                                                                          |
| 11  | `EXECUTE` accordé à `anon` sur des fonctions sensibles                               | **Confirmé** en production : `save_saas_plan`, `subscribe_salon_to_plan`, `get_all_saas_plans`, `get_platform_metrics`, `get_salon_subscription`. Chaque corps vérifie quand même `auth.uid()`, donc pas d'exploitation anonyme directe. | Révocation écrite dans la migration. Non déployé.                                                 |
| 12  | Historique des migrations divergent                                                  | **Confirmé** (voir section 5).                                                                                                                                                                                                           | **Bloqué**, décision requise.                                                                     |
| 13  | Mismatch de `subscribe_salon_to_plan` (prod ≠ dépôt)                                 | **Confirmé** par hash. La migration `20261110090000` remplace la fonction.                                                                                                                                                               | Résolu par la migration, une fois appliquée.                                                      |
| 14  | Pas de souscription en production                                                    | **Confirmé** : `saas_subscriptions` contient 0 ligne.                                                                                                                                                                                    | Les nouveaux index uniques ne risquent donc aucun conflit.                                        |

Constats supplémentaires trouvés pendant l'audit :

- `SaaSPlanView` appelait `get_all_saas_plans`, réservé au SuperAdmin : **un propriétaire de salon ne voyait aucun
  forfait** et la souscription échouait. Corrigé (`getSaasPlans`, public).
- `OnboardingGate` affichait le placeholder « Le Roi du Dégradé » dans le bundle de production. Remplacé par un
  libellé neutre.
- La liste admin (`getAdminSalonsList`) déduit le nom et le prix du forfait d'une table statique. Il ne reflète
  pas les modifications de catalogue. **Non corrigé.**

## 3. Statuts par lot

| Lot           | Élément                                                                                                      | Statut                                                                                        | Preuve                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Phase 0       | Audit de l'existant et vérification des constats                                                             | **terminé**                                                                                   | Section 2                                                   |
| Lot 1         | Souscription sans activation sans paiement validé (serveur)                                                  | **terminé (code)** / non déployé                                                              | Test `supabase-saas-subscription-verification`              |
| Lot 1         | Pas de repli `localStorage` pour les abonnements                                                             | **terminé (code)**                                                                            | Test `saas-subscription-lifecycle` (régression)             |
| Lot 1         | Périodes annuelles = 12 mois                                                                                 | **terminé (code)** / non déployé                                                              | Assertion 365 jours dans le test                            |
| Lot 1         | Quotas serveur staff et agences                                                                              | **partiel** : actifs seulement avec abonnement actif (D2)                                     | Test quotas                                                 |
| Lot 1         | Décisions SuperAdmin via RPC sécurisées avec trace d'audit                                                   | **partiel** : validation des paiements OK ; suspension, modération, administrateurs non faits | `platform_audit_logs`                                       |
| Lot 1         | Suspension des salons via RPC                                                                                | **non commencé**                                                                              | `superadmin.ts` (localStorage)                              |
| Lot 1         | Modération des avis via RPC                                                                                  | **non commencé**                                                                              | `superadmin.ts` (localStorage)                              |
| Lot 1         | Gestion des administrateurs via RPC                                                                          | **non commencé**                                                                              | —                                                           |
| Lot 1         | Publication des salons via RPC                                                                               | **partiel** : RPC `set_salon_publication` existe, l'admin lit encore des surcharges locales   | Code                                                        |
| Lot 1         | Édition des forfaits via RPC (SuperAdmin)                                                                    | **partiel** : RPC et tests OK ; brouillons (`20261109120000`) non appliqués en production     | `save_saas_plan_workflow`, test `supabase-saas-plan-drafts` |
| Lot 1         | RLS, `search_path`, privilèges `EXECUTE`                                                                     | **terminé (audit)** ; révocation `anon` **partiel** (non déployée)                            | Section 2                                                   |
| Lot 1         | Migrations reproductibles                                                                                    | **bloqué**                                                                                    | Section 5                                                   |
| Lot 1         | Données de démonstration isolées                                                                             | **terminé** (PR #7)                                                                           | Build de production sans chaîne de démo                     |
| Lot 1         | Composants redondants consolidés (prouvés inutilisés)                                                        | **terminé**                                                                                   | Section 2, #7                                               |
| Lot 2         | Cycle de vie des réservations, inbox Marketplace, commissions, journal de caisse, notifications, Realtime    | **non commencé**                                                                              | —                                                           |
| Lot 3         | Catalogue et disponibilités synchronisés ERP, prix recalculés serveur, publication, parcours mobile, Storage | **non commencé**                                                                              | —                                                           |
| Lot 4         | Matrice de forfaits centralisée (Starter, Pro, Prestige)                                                     | **terminé** (existant, en base)                                                               | `saas_plans`                                                |
| Lot 4         | Choix du forfait, demande en attente, paiement déclaré, validation manuelle                                  | **terminé (code)** / non déployé                                                              | Tests + `SaasPaymentReviewPanel`                            |
| Lot 4         | Renouvellement, expiration, suspension, impayés, annulation                                                  | **non commencé**                                                                              | Décisions D3, D4                                            |
| Lot 4         | Historique des abonnements côté salon et SuperAdmin                                                          | **partiel** : journal de paiements et audit ; pas d'historique d'abonnements                  | —                                                           |
| Lot 4         | Passerelle de paiement (fournisseur)                                                                         | **non commencé**                                                                              | Décision D1                                                 |
| Lot 5         | CRM, mouvements de stock, rapports, fidélité, SEO                                                            | **non commencé** (volontairement)                                                             | —                                                           |
| Navigation    | Huit groupes, visibilité par rôle                                                                            | **non commencé**                                                                              | —                                                           |
| Documentation | Plan, rapport Lot 1                                                                                          | **terminé** (ce document et `LOT-1-RAPPORT.md`)                                               | Fichiers présents                                           |
| Documentation | Rapports Lots 2 à 5, mise à jour README, sécurité, architecture                                              | **non commencé**                                                                              | —                                                           |

## 4. Fichiers modifiés dans cette session

Base : `main` `ecf29b7`.

- Migration ajoutée : `supabase/migrations/20261110090000_saas_subscription_verification.sql`
- Tests ajoutés : `database/tests/supabase-saas-subscription-verification.test.mjs`, `tests/saas-subscription-lifecycle.test.tsx`
- Tests modifiés : `database/tests/supabase-saas-pricing.test.mjs` (validation ajoutée avant activation, comportement volontairement changé)
- Client : `src/lib/saas.ts`, `src/types/index.ts`, `src/components/erp/SaaSPlanView.tsx`
- Admin : `src/components/admin/SaasPaymentReviewPanel.tsx` (nouveau), `src/components/admin/AdminDashboard.tsx`, `src/lib/superadmin.ts`
- Divers : `src/components/erp/DashboardView.tsx` (libellé), `src/components/auth/OnboardingGate.tsx` (placeholder)
- Supprimés (inutilisés) : `src/components/erp/ErpLayoutNew.tsx`, `src/components/admin/SuperAdminConsoleView.tsx`, `src/components/erp/CrmClientsView.tsx`, `src/components/erp/ExpensesView.tsx`
- Imports morts retirés : `src/components/erp/ErpLayout.tsx`, `src/router.tsx`

## 5. Changements de base de données

**Aucun changement n'est appliqué en production ni sur le projet distant dans cette session.**

Migration `20261110090000_saas_subscription_verification` (dans le dépôt uniquement) :

- Statut `pending_payment` ajouté à `saas_subscriptions`.
- Index uniques : un seul abonnement `active`/`trialing` par salon ; une seule demande `pending_payment` par salon.
- Nouvelles tables : `saas_subscription_payments` (montant serveur, référence, statut, décideur) et
  `platform_audit_logs` (lecture réservée au SuperAdmin, écriture uniquement par fonction).
- Nouvelles RPC : `get_pending_salon_subscription`, `declare_saas_payment`, `list_saas_payments_for_review`,
  `review_saas_payment`. `subscribe_salon_to_plan` est remplacée (propriétaire seulement, sans activation).
- Triggers de quotas sur `public.staff` (personnel actif) et `public.branches`, appliqués si un abonnement est actif.
- `EXECUTE` révoqué pour `anon` sur `save_saas_plan`, `subscribe_salon_to_plan`, `get_all_saas_plans`,
  `get_platform_metrics`, `get_salon_subscription`.

**Divergence d'historique (bloquante).** Comparaison dépôt ↔ production (lecture seule) :

| Version          | Dépôt                            | Production                       |
| ---------------- | -------------------------------- | -------------------------------- |
| `20261104150000` | `saas_pricing_and_subscriptions` | `marketplace_contact_privacy`    |
| `20261108191041` | absente                          | `marketplace_slug_resolution`    |
| `20261109080601` | absente                          | `saas_pricing_and_subscriptions` |
| `20261109080620` | absente                          | `platform_superadmin_guard`      |
| `20261109100000` | `platform_superadmin_guard`      | absente                          |
| `20261109120000` | `saas_plan_drafts`               | absente                          |
| `20261110090000` | nouvelle migration               | absente                          |

Conséquence : `supabase db push` (workflow `supabase-migrations.yml`) signalera les versions distantes absentes du
dépôt et ne pourra pas s'exécuter proprement. La réparation de l'historique (`supabase migration repair`) et le
fichier SQL de `20261108191041` doivent être décidés et vérifiés avant tout déploiement.

Fonctions de brouillons de forfaits (`20261109120000`) : absentes de la production. L'éditeur de forfaits « brouillon »
renverra donc une erreur tant que cette migration n'est pas appliquée.

## 6. Tests exécutés

Toutes les commandes ci-dessous ont été exécutées sur la branche, après les dernières modifications.

| Contrôle                                                             | Résultat                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `npm run typecheck`                                                  | 0 erreur                                                      |
| `npm run lint`                                                       | 0 erreur                                                      |
| `npx prettier --check .`                                             | conforme                                                      |
| `npm test` (Node + PGlite)                                           | 68/68                                                         |
| `npm test` (TSX)                                                     | 52/52                                                         |
| Test PGlite cycle de vie (`supabase-saas-subscription-verification`) | 1/1 (nouveau)                                                 |
| Test PGlite tarification (`supabase-saas-pricing`)                   | 1/1 (mis à jour)                                              |
| `npm run build`                                                      | OK, aucune chaîne de démonstration ou nom fictif dans `dist/` |

Non exécuté : `supabase db reset` et `supabase db lint --local` (CI), car le CLI Supabase n'est pas disponible
dans le bac à sable. Ils s'exécuteront dans la CI à l'ouverture de la PR.

Non vérifié visuellement : les écrans `SaaSPlanView` et `SaasPaymentReviewPanel` n'ont pas été contrôlés dans un
navigateur. La souscription de bout en bout n'a pas été jouée contre une base réelle.

## 7. Travaux restants

1. Décisions bloquantes (voir section 9) avant tout déploiement.
2. Réparer l'historique des migrations, puis appliquer `20261110090000` sur la production avec sauvegarde et
   confirmation explicite.
3. Persister suspension, publication, modération, gestion des administrateurs via RPC avec trace d'audit (Lot 1).
4. Supprimer la liste de forfaits statique dans `getAdminSalonsList` (lire le forfait depuis la base).
5. Lots 2 et 3 entiers.
6. Lot 4 : expiration, impayés, annulation, historique, passerelle de paiement.
7. Lot 5 après les lots 1 à 4.
8. Contrôle visuel des écrans modifiés.

## 8. Maturité

| Usage                  | Adapté ?                                                                              | Raison                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Développement          | Oui                                                                                   | Build et tests verts                                                                                    |
| Démonstration          | Oui                                                                                   | Données de démonstration isolées derrière `VITE_MARKETPLACE_DEMO`, labellisées                          |
| Pilote                 | Non, pas avant la réparation des migrations et la validation SuperAdmin en production | Décisions métier ouvertes, migration non déployée                                                       |
| Production commerciale | Non                                                                                   | Décisions SuperAdmin encore en `localStorage`, lots 2 et 3 non commencés, expiration et impayés absents |

## 9. Décisions demandées (métier, non décidées)

- **D1. Passerelle de paiement.** Pour l'instant : validation manuelle par le SuperAdmin après déclaration de
  paiement (option prévue comme repli). Options : rester manuel (recommandé à court terme, aucun frais ni contrat) ;
  ajouter Mobile Money via un fournisseur (à choisir, contrat et frais à valider).
- **D2. Salons sans abonnement actif.** Aujourd'hui, aucun quota n'est appliqué à ces salons. Options : (a) appliquer
  les quotas du forfait Starter (recommandé, le plus sûr) ; (b) laisser sans quota ; (c) bloquer l'ajout de
  personnel jusqu'à souscription. Décision requise.
- **D3. Politique d'impayés et d'expiration.** Période de grâce, suspension après échéance, conservation des données
  (la règle « ne jamais supprimer les données du salon » est retenue). Durées à fixer.
- **D4. Essai gratuit.** Oui ou non, durée et quotas pendant l'essai.
- **D5. Base de calcul des commissions (Lot 2).** Chiffre d'affaires encaissé, prestations réalisées, ou les deux.
- **D6. Historique de migrations.** Autoriser la réparation de l'historique distant (`migration repair`) et fournir
  le SQL de `20261108191041`, ou reconstruire la base à partir du dépôt.

## 10. Notes

- `ameliorations.md` n'est pas reformaté par Prettier (les tableaux seraient aplatis).
- `docs/LOT-*-RAPPORT.md` existants concernent un plan antérieur. Les rapports de ce plan sont dans `docs/implementation/`.
- Le bac à sable n'atteint pas `*.supabase.co` : les vérifications en production ont été faites via le connecteur
  Supabase, en lecture seule, sauf la migration qui n'a pas été appliquée.
