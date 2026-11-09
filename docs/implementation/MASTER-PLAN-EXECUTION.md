# Plan maître : audit, fiabilisation et évolution de BarberCuts

Statut au 2026-11-09, branche `arena/776ed886-barber-google` (base `main` `863b9bc`, après fusion de la PR #8).

Ce document ne contient que des statuts vérifiés. Chaque ligne « terminé » renvoie à un contrôle exécuté
(test, requête lecture seule sur la base de production, ou relecture du code). Les statuts utilisés sont :
**terminé**, **partiel**, **bloqué**, **non commencé**.

## 1. Résumé exécutif

- Phase 0 (audit de l'existant) : **terminé**. Plusieurs constats de l'audit précédent ont été vérifiés ; deux
  ont été corrigés dans cette session (voir section 3).
- Lot 1 (fiabilisation, P0) : **partiel**. Les corrections de souscription, de quotas et de validation de paiement
  sont écrites et testées, mais **la migration n'est pas appliquée en production** et le déploiement est **bloqué**
  par une divergence d'historique de migrations. Les décisions SuperAdmin (suspension, publication, certification,
  formule, modération des avis, administrateurs, journal) passent désormais par des RPC `platform_*` qui écrivent
  dans la base avec trace d'audit (migration `20261111090000`, non déployée). Le client ne conserve plus aucune
  décision localement. Limites : le public ne filtre pas encore les avis masqués, et le journal CMS reste local.
- Lots 2 et 3 : **non commencés**.
- Lot 4 (monétisation SaaS) : **partiel**. Sélection de forfait, demande en attente, validation manuelle par le
  SuperAdmin et quotas serveur existent. L'expiration, les impayés, l'annulation et l'historique ne sont pas faits.
- Lot 5 : **non commencé**, comme demandé (ne démarre qu'après fiabilisation des lots 1 à 4).

**Recommandation objective : usage développement et démonstration uniquement.** Aucune exploitation commerciale
en production n'est recommandée à ce stade (voir section 8).

## 2. Phase 0 : constats vérifiés

| #   | Constat (audit précédent)                                                                                                                                           | Résultat de la vérification                                                                                                                                                                                                              | Action                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Souscription activée sans paiement (`subscribe_salon_to_plan` insère `active`)                                                                                      | **Confirmé** : la RPC créait un abonnement `active` immédiatement. Le client repassait aussi en `active` localement si la RPC échouait.                                                                                                  | Corrigé (migration `20261110090000`, `saas.ts`). Non déployé.                                                                           |
| 2   | Périodes annuelles de 30 jours                                                                                                                                      | **Confirmé** : `interval '30 days'` pour tous les cycles.                                                                                                                                                                                | Corrigé : 12 mois pour `yearly`. Non déployé.                                                                                           |
| 3   | Quotas staff/agences non appliqués                                                                                                                                  | **Confirmé** : `max_staff` et `max_branches` stockés, jamais contrôlés.                                                                                                                                                                  | Partiel : triggers serveur ajoutés, mais seulement si un abonnement est actif (voir décision D2).                                       |
| 4   | `getSalonSubscription` simule un abonnement « starter » actif                                                                                                       | **Confirmé** dans `saas.ts`.                                                                                                                                                                                                             | Corrigé : renvoie `null` si aucun abonnement validé.                                                                                    |
| 5   | Faux avis « vérifiés » et fausses entrées d'audit en `localStorage`                                                                                                 | **Confirmé** dans `superadmin.ts` (trois avis et deux entrées d'audit injectés au premier chargement).                                                                                                                                   | Corrigé : listes vides par défaut. Persistance serveur non faite.                                                                       |
| 6   | Libellé « commissions déduites » sur la marge                                                                                                                       | **Confirmé** : `totalRevenue − totalExpenses`, aucune commission.                                                                                                                                                                        | Corrigé (libellé).                                                                                                                      |
| 7   | `ErpLayoutNew`, `SuperAdminConsoleView`, `CrmClientsView`, `ExpensesView` redondants                                                                                | **Confirmé inutilisés** (aucun import rendu).                                                                                                                                                                                            | Supprimés, imports morts retirés. Historique Git conservé.                                                                              |
| 8   | Politique RLS `saas_plans` ouverte aux propriétaires                                                                                                                | **Corrigé auparavant** (migration de garde) : politique réservée à `is_platform_superadmin()`.                                                                                                                                           | Vérifié en relecture.                                                                                                                   |
| 9   | Tables sans RLS en production                                                                                                                                       | **Aucune** : requête lecture seule sur la base de production.                                                                                                                                                                            | Vérifié.                                                                                                                                |
| 10  | `SECURITY DEFINER` sans `search_path`                                                                                                                               | **Aucun** en production (contrôle sur les 56 fonctions applicatives) ni dans le dépôt (105 définitions contrôlées).                                                                                                                      | Vérifié.                                                                                                                                |
| 11  | `EXECUTE` accordé à `anon` sur des fonctions sensibles                                                                                                              | **Confirmé** en production : `save_saas_plan`, `subscribe_salon_to_plan`, `get_all_saas_plans`, `get_platform_metrics`, `get_salon_subscription`. Chaque corps vérifie quand même `auth.uid()`, donc pas d'exploitation anonyme directe. | Révocation écrite dans la migration. Non déployé.                                                                                       |
| 12  | Historique des migrations divergent                                                                                                                                 | **Confirmé** (voir section 5).                                                                                                                                                                                                           | **Bloqué**, décision requise.                                                                                                           |
| 13  | Mismatch de `subscribe_salon_to_plan` (prod ≠ dépôt)                                                                                                                | **Confirmé** par hash. La migration `20261110090000` remplace la fonction.                                                                                                                                                               | Résolu par la migration, une fois appliquée.                                                                                            |
| 14  | Pas de souscription en production                                                                                                                                   | **Confirmé** : `saas_subscriptions` contient 0 ligne.                                                                                                                                                                                    | Les nouveaux index uniques ne risquent donc aucun conflit.                                                                              |
| 15  | Quatre fonctions de production divergentes du dépôt (`create_appointment`, `marketplace_list_salons`, `marketplace_salon_detail`, `publish_marketplace_customizer`) | **Confirmé** par empreintes md5 (lecture seule). La production ajoute la confidentialité des contacts via `private.marketplace_public_contact`.                                                                                          | **Bloqué** : capture à faire avant réparation (runbook D6). `marketplace_salon_detail` conditionne l’affichage public des avis masqués. |
| 16  | Schéma `private` distant sans définition dans le dépôt (`marketplace_public_contact`, `slugify`)                                                                    | **Confirmé** par recherche dans `supabase/migrations`.                                                                                                                                                                                   | **Bloqué** : à capturer dans une migration de baseline (runbook D6, étape 5).                                                           |

Constats supplémentaires trouvés pendant l'audit :

- `SaaSPlanView` appelait `get_all_saas_plans`, réservé au SuperAdmin : **un propriétaire de salon ne voyait aucun
  forfait** et la souscription échouait. Corrigé (`getSaasPlans`, public).
- `OnboardingGate` affichait le placeholder « Le Roi du Dégradé » dans le bundle de production. Remplacé par un
  libellé neutre.
- La liste admin lisait le nom et le prix du forfait dans une table statique (`getAdminSalonsList`) et ne montrait que les salons publiés. **Corrigé** : elle lit `platform_list_salons` (tous les salons, forfait et prix de la base).

## 3. Statuts par lot

| Lot           | Élément                                                                                                      | Statut                                                                                                                                      | Preuve                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Phase 0       | Audit de l'existant et vérification des constats                                                             | **terminé**                                                                                                                                 | Section 2                                                                  |
| Lot 1         | Souscription sans activation sans paiement validé (serveur)                                                  | **terminé (code)** / non déployé                                                                                                            | Test `supabase-saas-subscription-verification`                             |
| Lot 1         | Pas de repli `localStorage` pour les abonnements                                                             | **terminé (code)**                                                                                                                          | Test `saas-subscription-lifecycle` (régression)                            |
| Lot 1         | Périodes annuelles = 12 mois                                                                                 | **terminé (code)** / non déployé                                                                                                            | Assertion 365 jours dans le test                                           |
| Lot 1         | Quotas serveur staff et agences                                                                              | **partiel** : actifs seulement avec abonnement actif (D2)                                                                                   | Test quotas                                                                |
| Lot 1         | Décisions SuperAdmin via RPC sécurisées avec trace d’audit                                                   | **terminé (code)** / non déployé                                                                                                            | Tests PGlite `supabase-platform-admin-operations`, `platform-admin-client` |
| Lot 1         | Suspension des salons via RPC (motif obligatoire, retrait de la marketplace par trigger)                     | **terminé (code)** / non déployé                                                                                                            | Test PGlite, fenêtre de motif `ReasonDialog`                               |
| Lot 1         | Modération des avis via RPC (masquage avec motif)                                                            | **partiel** : décision en base ; le public n’exclut pas encore les avis masqués (`marketplace_salon_detail` à réécrire après D6)            | Test PGlite ; onglet « Modération des Avis »                               |
| Lot 1         | Gestion des administrateurs via RPC                                                                          | **terminé (code)** / non déployé ; rôle `super_admin` réservé à l’adresse autorisée ; rôles de support sans droits distincts pour l’instant | Test PGlite ; onglet « Administrateurs & Journal »                         |
| Lot 1         | Publication et certification des salons via RPC                                                              | **terminé (code)** / non déployé ; publication refusée pour un salon suspendu                                                               | Test PGlite                                                                |
| Lot 1         | Édition des forfaits via RPC (SuperAdmin)                                                                    | **partiel** : RPC et tests OK ; brouillons (`20261109120000`) non appliqués en production                                                   | `save_saas_plan_workflow`, test `supabase-saas-plan-drafts`                |
| Lot 1         | RLS, `search_path`, privilèges `EXECUTE`                                                                     | **terminé (audit)** ; révocation `anon` **partiel** (non déployée)                                                                          | Section 2                                                                  |
| Lot 1         | Migrations reproductibles                                                                                    | **bloqué**                                                                                                                                  | Section 5                                                                  |
| Lot 1         | Données de démonstration isolées                                                                             | **terminé** (PR #7)                                                                                                                         | Build de production sans chaîne de démo                                    |
| Lot 1         | Composants redondants consolidés (prouvés inutilisés)                                                        | **terminé**                                                                                                                                 | Section 2, #7                                                              |
| Lot 2         | Cycle de vie des réservations, inbox Marketplace, commissions, journal de caisse, notifications, Realtime    | **non commencé**                                                                                                                            | —                                                                          |
| Lot 3         | Catalogue et disponibilités synchronisés ERP, prix recalculés serveur, publication, parcours mobile, Storage | **non commencé**                                                                                                                            | —                                                                          |
| Lot 4         | Matrice de forfaits centralisée (Starter, Pro, Prestige)                                                     | **terminé** (existant, en base)                                                                                                             | `saas_plans`                                                               |
| Lot 4         | Choix du forfait, demande en attente, paiement déclaré, validation manuelle                                  | **terminé (code)** / non déployé                                                                                                            | Tests + `SaasPaymentReviewPanel`                                           |
| Lot 4         | Renouvellement, expiration, suspension, impayés, annulation                                                  | **non commencé**                                                                                                                            | Décisions D3, D4                                                           |
| Lot 4         | Historique des abonnements côté salon et SuperAdmin                                                          | **partiel** : journal de paiements et audit ; pas d'historique d'abonnements                                                                | —                                                                          |
| Lot 4         | Passerelle de paiement (fournisseur)                                                                         | **non commencé**                                                                                                                            | Décision D1                                                                |
| Lot 5         | CRM, mouvements de stock, rapports, fidélité, SEO                                                            | **non commencé** (volontairement)                                                                                                           | —                                                                          |
| Navigation    | Huit groupes, visibilité par rôle                                                                            | **non commencé**                                                                                                                            | —                                                                          |
| Documentation | Plan, rapport Lot 1                                                                                          | **terminé** (ce document et `LOT-1-RAPPORT.md`)                                                                                             | Fichiers présents                                                          |
| Documentation | Runbook de réparation de l’historique (D6)                                                                   | **terminé** (préparé, non exécuté)                                                                                                          | `RUNBOOK-D6-HISTORIQUE-MIGRATIONS.md`                                      |
| Documentation | Rapports Lots 2 à 5, mise à jour README, sécurité, architecture                                              | **non commencé**                                                                                                                            | —                                                                          |

## 4. Fichiers modifiés

Base : `main` `863b9bc`. Itérations du Lot 1 : sessions précédentes (PR #7, PR #8) puis cette itération (décisions SuperAdmin en base).

- Migrations ajoutées : `supabase/migrations/20261110090000_saas_subscription_verification.sql` (PR #8),
  `supabase/migrations/20261111090000_platform_admin_operations.sql` (cette itération, non committée à la rédaction)
- Tests ajoutés : `database/tests/supabase-saas-subscription-verification.test.mjs`, `database/tests/supabase-platform-admin-operations.test.mjs`,
  `tests/saas-subscription-lifecycle.test.tsx`, `tests/platform-admin-client.test.tsx`
- Tests modifiés : `database/tests/supabase-saas-pricing.test.mjs`, `tests/marketplace-config-manager.test.tsx`,
  `tests/salon-management-and-marketplace-cms.test.tsx`, `tests/no-fabricated-admin-data.test.tsx`,
  `tests/saas-subscription-lifecycle.test.tsx`
- Client SuperAdmin (RPC) : `src/lib/platform-admin.ts` (nouveau)
- Client, nettoyage : `src/lib/superadmin.ts` (surcharges, avis et audit en `localStorage` retirés ; journal local conservé pour le CMS et les connexions)
- Interface admin : `src/components/admin/AdminDashboard.tsx`, `src/components/admin/SalonManagement.tsx`,
  `src/components/admin/ReasonDialog.tsx` (nouveau), `src/components/admin/ReviewModerationPanel.tsx` (nouveau),
  `src/components/admin/PlatformAdminsPanel.tsx` (nouveau), `src/components/admin/SaasPaymentReviewPanel.tsx`
- Marketplace (lecture de la base) : `src/components/marketplace/MarketplaceHome.tsx`,
  `src/components/marketplace/SalonDetailModal.tsx`, `src/components/marketplace/salon/SalonPublicPage.tsx`
- Abonnements : `src/lib/saas.ts`, `src/types/index.ts`, `src/components/erp/SaaSPlanView.tsx`
- Divers : `src/components/erp/DashboardView.tsx` (libellé), `src/components/auth/OnboardingGate.tsx` (placeholder)
- Supprimés (inutilisés) : `src/components/erp/ErpLayoutNew.tsx`, `src/components/admin/SuperAdminConsoleView.tsx`,
  `src/components/erp/CrmClientsView.tsx`, `src/components/erp/ExpensesView.tsx`
- Imports morts retirés : `src/components/erp/ErpLayout.tsx`, `src/router.tsx`
- Documentation : `docs/implementation/MASTER-PLAN-EXECUTION.md`, `docs/implementation/LOT-1-RAPPORT.md`,
  `docs/implementation/RUNBOOK-D6-HISTORIQUE-MIGRATIONS.md` (nouveau)

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

Migration `20261111090000_platform_admin_operations` (dans le dépôt uniquement, testée sur PGlite) :

- Colonnes : `salons.platform_status` (`active`/`suspended`) et `platform_status_reason` ; `reviews.platform_hidden`
  et `platform_hidden_reason`.
- Trigger `salons_enforce_suspension` : un salon suspendu est dépublié, quelle que soit la mise à jour.
- RPC `SECURITY DEFINER` (`search_path` vide, `EXECUTE` pour `authenticated` seulement, contrôle `is_platform_superadmin()`
  dans chaque corps) : `platform_list_salons`, `platform_set_salon_status`, `platform_set_salon_verification`,
  `platform_set_salon_publication`, `platform_assign_salon_plan`, `platform_list_reviews`,
  `platform_set_review_hidden`, `platform_list_audit_logs`, `platform_list_admins`, `platform_grant_admin`,
  `platform_revoke_admin`.
- Règles : motif obligatoire pour suspendre, attribuer une formule ou masquer un avis ; `super_admin` réservé à
  `dominiquek051@gmail.com` ; pas de retrait de soi-même ni du dernier `super_admin`. Chaque décision est écrite dans
  `platform_audit_logs`.

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
| `20261111090000` | nouvelle migration               | absente                          |

Conséquence : `supabase db push` (workflow `supabase-migrations.yml`) signalera les versions distantes absentes du
dépôt et ne pourra pas s'exécuter proprement. La réparation de l'historique (`supabase migration repair`) et le
fichier SQL de `20261108191041` doivent être décidés et vérifiés avant tout déploiement.

Fonctions de brouillons de forfaits (`20261109120000`) : absentes de la production. L'éditeur de forfaits « brouillon »
renverra donc une erreur tant que cette migration n'est pas appliquée.

## 6. Tests exécutés

Toutes les commandes ci-dessous ont été exécutées sur la branche, après les dernières modifications.

| Contrôle                                                                 | Résultat                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `npm run typecheck`                                                      | 0 erreur                                                            |
| `npm run lint`                                                           | 0 erreur                                                            |
| `npx prettier --check .`                                                 | conforme                                                            |
| `npm test` (Node + PGlite)                                               | 69/69                                                               |
| `npm test` (TSX)                                                         | 58/58                                                               |
| Test PGlite cycle de vie (`supabase-saas-subscription-verification`)     | 1/1                                                                 |
| Test PGlite tarification (`supabase-saas-pricing`)                       | 1/1                                                                 |
| Test PGlite opérations SuperAdmin (`supabase-platform-admin-operations`) | 1/1 (nouveau) : toutes les migrations du dépôt rejouées sur PGlite  |
| `npm run build`                                                          | OK ; build de production sans chaîne de démonstration ni nom fictif |

Non exécuté : `supabase db reset` et `supabase db lint --local` (CI), car le CLI Supabase n'est pas disponible
dans le bac à sable. Ils s'exécuteront dans la CI à l'ouverture de la PR.

Non vérifié visuellement : les écrans admin modifiés (`AdminDashboard`, `SalonManagement`, `ReviewModerationPanel`,
`PlatformAdminsPanel`) et la marketplace n'ont pas été contrôlés dans un navigateur. Les tests TSX rendent les
composants côté serveur, sans interaction réelle. La décision SuperAdmin de bout en bout n'a pas été jouée contre
une base réelle.

## 7. Travaux restants

1. Décisions bloquantes (voir section 9) avant tout déploiement.
2. Réparer l'historique des migrations selon `RUNBOOK-D6-HISTORIQUE-MIGRATIONS.md`, puis appliquer `20261110090000`
   et `20261111090000` sur la production avec sauvegarde et confirmation explicite.
3. Réécrire `marketplace_salon_detail` (et `marketplace_list_salons` si besoin) dans le dépôt pour exclure les avis
   masqués. Cette réécriture doit suivre la capture de la production (D6), sinon elle écrase les contacts privés.
4. Rendre les rôles de support distincts ou les retirer de l'interface (aujourd'hui ils n'ouvrent aucune RPC).
5. Journal : les connexions et le contenu CMS restent dans le journal local. Décider si ces entrées passent en base.
6. Lots 2 et 3 entiers.
7. Lot 4 : expiration, impayés, annulation, historique, passerelle de paiement.
8. Lot 5 après les lots 1 à 4.
9. Contrôle visuel des écrans modifiés dans un navigateur.

## 8. Maturité

| Usage                  | Adapté ?                                                                              | Raison                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Développement          | Oui                                                                                   | Build et tests verts                                                                                                                                |
| Démonstration          | Oui                                                                                   | Données de démonstration isolées derrière `VITE_MARKETPLACE_DEMO`, labellisées                                                                      |
| Pilote                 | Non, pas avant la réparation des migrations et la validation SuperAdmin en production | Décisions métier ouvertes, migrations non déployées, historique divergent                                                                           |
| Production commerciale | Non                                                                                   | Migrations non déployées, historique divergent, lots 2 et 3 non commencés, expiration et impayés absents, avis masqués encore visibles publiquement |

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
  le SQL de `20261108191041`, ou reconstruire la base à partir du dépôt. Procédure préparée, non exécutée :
  `RUNBOOK-D6-HISTORIQUE-MIGRATIONS.md`. Aucune écriture en production sans sauvegarde et confirmation explicite.

## 10. Notes

- `ameliorations.md` n'est pas reformaté par Prettier (les tableaux seraient aplatis).
- `docs/LOT-*-RAPPORT.md` existants concernent un plan antérieur. Les rapports de ce plan sont dans `docs/implementation/`.
- Le bac à sable n'atteint pas `*.supabase.co` : les vérifications en production ont été faites via le connecteur
  Supabase, en lecture seule, sauf la migration qui n'a pas été appliquée.
