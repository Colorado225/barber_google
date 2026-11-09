# Lot 1 : fiabilisation (P0)

Statut global : **partiel**. Les corrections sont écrites et testées dans le dépôt. Elles ne sont **pas déployées**
en production, et la décision de déploiement est bloquée (voir `MASTER-PLAN-EXECUTION.md`, sections 5 et 9).

## Objectif du lot

1. Un abonnement ne s'active jamais sans paiement vérifié ou validation administrative.
2. Aucun repli `localStorage` pour les abonnements, les permissions, les paiements ou les décisions admin.
3. Périodes annuelles de 12 mois.
4. Quotas de plan appliqués côté serveur.
5. Décisions SuperAdmin persistées par RPC sécurisées, avec trace d'audit.
6. RLS, `SECURITY DEFINER` avec `search_path`, privilèges `EXECUTE` revus.
7. Migrations reproductibles, données de démonstration isolées, composants redondants retirés si inutilisés.

## Ce qui est fait

### Souscription et validation (terminé en code)

- `subscribe_salon_to_plan` crée une demande `pending_payment` et n'active rien. Seul le propriétaire peut souscrire
  (avant : toute personne ayant `subscriptions.read`).
- Le propriétaire déclare son paiement (`declare_saas_payment`). Le montant est lu côté serveur à partir du forfait.
  Le client n'envoie que le moyen et la référence.
- Le SuperAdmin valide ou rejette (`review_saas_payment`). Le rejet exige un motif. La validation remplace
  l'abonnement actif précédent et met à jour `salons.subscription_plan_id`.
- Chaque décision écrit dans `platform_audit_logs` (lecture réservée au SuperAdmin).
- Interface : `SaaSPlanView` affiche seulement les états vérifiés (aucun abonnement, demande en attente, paiement
  déclaré, paiement rejeté, abonnement actif). `SaasPaymentReviewPanel` (onglet Tarifs) gère la file de validation.

### Périodes (terminé en code)

- `private.saas_billing_interval` : `yearly` = 12 mois, sinon 1 mois. Calcul fait à la validation, pas à la demande.
- Le test vérifie une période d'environ 365 jours.

### Quotas (partiel)

- Triggers `staff_enforce_plan_quota` (personnel actif) et `branches_enforce_plan_quota` (établissements).
- Appliqués uniquement si le salon a un abonnement `active` ou `trialing`. Limite connue : voir décision D2.
- Les membres inactifs ne consomment pas de place.

### Lectures sans fabrication (terminé en code)

- `getSalonSubscription` renvoie `null` sans abonnement validé (fin du plan « starter » simulé).
- Aucun repli local pour les abonnements : sans base configurée, la souscription échoue explicitement.
- `superadmin.ts` : listes d'avis et journal d'audit vides par défaut (fin des faux avis « vérifiés »).

### Sécurité (partiel)

- Audit en production (lecture seule) : aucune table sans RLS ; aucune fonction `SECURITY DEFINER` sans `search_path`.
- Politique `saas_plans` réservée au SuperAdmin (migration de garde, présente en production sous la version `20261109080620`).
- Révocation d'`EXECUTE` pour `anon` : écrite dans la migration, non déployée. Les corps de fonction vérifiaient déjà `auth.uid()`.
- `rls_auto_enable` existe en production mais n'est pas dans le dépôt (fonction gérée par la plateforme). Non modifiée.

### Nettoyage (terminé)

- Supprimés car sans aucun import rendu : `ErpLayoutNew.tsx`, `SuperAdminConsoleView.tsx`, `CrmClientsView.tsx`, `ExpensesView.tsx`.
- Imports morts retirés de `ErpLayout.tsx` et `router.tsx`.
- Libellé « commissions déduites » corrigé : la marge affichée est encaissements − dépenses.
- Placeholder « Le Roi du Dégradé » retiré de l'onboarding (il apparaissait dans le bundle de production).

## Ce qui reste ouvert dans le lot

| Élément                                      | Statut          | Détail                                                                       |
| -------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| Suspension des salons en base                | non commencé    | Toujours dans `localStorage` (`superadmin.ts`)                               |
| Modération des avis en base                  | non commencé    | Les RPC `delete_review` existent mais l'admin lit le local                   |
| Gestion des administrateurs                  | non commencé    | —                                                                            |
| Publication via RPC                          | partiel         | `set_salon_publication` existe ; surcharges locales encore lues              |
| Liste admin des forfaits                     | partiel         | `getAdminSalonsList` déduit nom et prix d'une table statique                 |
| Migrations reproductibles                    | bloqué          | Historique distant divergent (3 versions absentes du dépôt, 1 nom différent) |
| Déploiement de la migration `20261110090000` | bloqué          | Décision utilisateur + réparation d'historique + sauvegarde                  |
| Brouillons de forfaits en production         | bloqué          | Dépend de `20261109120000`, non appliquée                                    |
| Test visuel des écrans modifiés              | non fait        | Pas de vérification navigateur dans cette session                            |
| `supabase db reset` / `db lint`              | non exécuté ici | Lancé par la CI à l'ouverture de la PR                                       |

## Fichiers

- Migration : `supabase/migrations/20261110090000_saas_subscription_verification.sql`
- Tests : `database/tests/supabase-saas-subscription-verification.test.mjs` (nouveau),
  `database/tests/supabase-saas-pricing.test.mjs` (adapté : validation avant activation),
  `tests/saas-subscription-lifecycle.test.tsx` (nouveau)
- Code : `src/lib/saas.ts`, `src/lib/superadmin.ts`, `src/types/index.ts`,
  `src/components/erp/SaaSPlanView.tsx`, `src/components/admin/SaasPaymentReviewPanel.tsx` (nouveau),
  `src/components/admin/AdminDashboard.tsx`, `src/components/erp/DashboardView.tsx`,
  `src/components/auth/OnboardingGate.tsx`, `src/components/erp/ErpLayout.tsx`, `src/router.tsx`

## Tests exécutés

- `npm run typecheck` : 0 erreur.
- `npm run lint` : 0 erreur.
- `npx prettier --check .` : conforme.
- `npm test` : Node/PGlite 68/68, TSX 52/52.
- `npm run build` : OK, aucune chaîne de démonstration ni nom fictif dans `dist/`.

## Conditions avant déploiement

1. Décisions D1 (paiement manuel ou passerelle), D2 (quotas sans abonnement) et D6 (réparation d'historique).
2. Sauvegarde de la base de production.
3. Autorisation explicite, puis workflow `supabase-migrations.yml` sur `main` avec `confirm_production_migration`.
4. Contrôle manuel : souscription, déclaration, validation, rejet, et vérification que la file de validation n'est
   visible que par le SuperAdmin.
