# Réconciliation dépôt / production (constat du 2026-11-09)

Statut : **constat, aucune écriture en production**. Sources, toutes en lecture seule : `list_migrations`,
`execute_query` sur `pg_proc` et `supabase_migrations.schema_migrations` (projet `rozsykrjrncbupzmauzj`), et
`git` sur `origin/main` (`4d8a151`) et `origin/arena/776ed886-barber-google`.

## 1. Constats structurants

1. **`main` n'a plus d'ancêtre commun avec la branche.** `origin/main` ne contient qu'un commit racine (`4d8a151`, PR #10).
   La branche part de `863b9bc` (PR #8). `git merge-base` est vide : une fusion exige `--allow-unrelated-histories`,
   et une réécriture de la branche est exclue par les règles du projet sans autorisation explicite.
2. **La production correspond à `main` (PR #9 et #10), pas à la branche.** Les 11 migrations distantes
   `20261110110652` à `20261110123520` correspondent aux fichiers de `main` **par leur nom**, mais avec des versions différentes.
3. **Deux API SuperAdmin parallèles.** Production et `main` : RPC `admin_*` (appelées par `main`).
   Branche : RPC `platform_*` (`src/lib/platform-admin.ts`), absentes de la production et de `main`.
4. **Deux chemins de stock.** Production et `main` : `record_stock_movement`, `create_stock_item`,
   `update_stock_item_metadata` (quantités entières, conforme à D11). Branche : `adjust_stock_quantity`
   (migration `20261112090000`), absente de la production et de `main`. `src/services/api/stock.ts` de la branche
   l'appelle : **cet appel échouerait en production**.
5. **Collisions de version.** Les migrations de la branche `20261111090000` et `20261111100000` ont le même
   horodatage que des migrations de `main` (`erp_dashboard_metrics_and_timezone`, `saas_annual_billing_subscription`).
   Une fusion produirait deux fichiers de même version.
6. **Migrations de production sans fichier dans le dépôt** : `20261108191041` (`marketplace_slug_resolution`) et
   `20261104150000` (`marketplace_contact_privacy`, version qui porte `saas_pricing_and_subscriptions` dans le dépôt).
   Le SQL appliqué existe dans `supabase_migrations.schema_migrations.statements` (non vide pour ces versions).
   Il n'est pas recopié ici : environ 250 Ko, à capturer par le CLI depuis un poste ayant accès au projet.

## 2. Fichiers de migration

- **24 fichiers identiques** entre la branche et `main`.
- **3 fichiers propres à la branche** : `20261111090000_platform_admin_operations.sql`,
  `20261111100000_platform_admin_console.sql`, `20261112090000_stock_atomic_adjustment.sql`. Ils ne sont **pas** en production.

## 3. Fonctions (production 142 hors extensions, dépôt 116)

Comparaison par empreinte MD5 du corps (calibrée : `public.is_platform_superadmin` a la même empreinte des deux côtés).

| Catégorie                               | Nombre |
| --------------------------------------- | ------ |
| Identiques (dépôt = production)         | 77     |
| Divergentes (même nom, corps différent) | 19     |
| Dépôt seul (absentes de la production)  | 20     |
| Production seule (absentes du dépôt)    | 46     |

### Divergentes (production plus récente, à capturer)

- `private.record_payment_entry`
- `private.write_platform_audit`
- `public.create_appointment`
- `public.create_salon`
- `public.financial_summary`
- `public.get_platform_metrics`
- `public.list_payments`
- `public.list_saas_payments_for_review`
- `public.mark_notification_result`
- `public.marketplace_book_appointment`
- `public.marketplace_booking_by_token`
- `public.marketplace_day_availability`
- `public.marketplace_list_salons`
- `public.marketplace_salon_detail`
- `public.publish_marketplace_customizer`
- `public.record_expense`
- `public.review_saas_payment`
- `public.set_salon_publication`
- `public.subscribe_salon_to_plan`

### Dépôt seul (non déployées)

- `private.assert_platform_superadmin`
- `private.enforce_salon_suspension`
- `public.adjust_stock_quantity`
- `public.platform_assign_salon_plan`
- `public.platform_audit_actions`
- `public.platform_cancel_salon_subscription`
- `public.platform_dashboard_overview`
- `public.platform_extend_salon_subscription`
- `public.platform_get_salon_360`
- `public.platform_grant_admin`
- `public.platform_list_admins`
- `public.platform_list_audit_logs`
- `public.platform_list_reviews`
- `public.platform_list_salons`
- `public.platform_revoke_admin`
- `public.platform_search_audit_logs`
- `public.platform_set_review_hidden`
- `public.platform_set_salon_publication`
- `public.platform_set_salon_status`
- `public.platform_set_salon_verification`

### Production seule (sans source dans le dépôt)

- `private.admin_salon_summary`
- `private.current_actor_email`
- `private.expense_signed_amount`
- `private.forbid_expense_event_mutation`
- `private.forbid_stock_movement_mutation`
- `private.guard_expenses_immutability`
- `private.guard_stock_items_quantity`
- `private.marketplace_public_contact`
- `private.normalize_saas_plan_features`
- `private.platform_settings_row`
- `private.read_notification_scheduler_health`
- `private.record_platform_audit`
- `private.require_audit_reason`
- `private.require_platform_role`
- `private.resolve_saas_subscription_terms`
- `private.salon_timezone`
- `private.slugify`
- `public.admin_get_platform_settings`
- `public.admin_list_audit_logs`
- `public.admin_list_reviews`
- `public.admin_list_salons`
- `public.admin_moderate_review`
- `public.admin_set_salon_publication`
- `public.admin_set_salon_status`
- `public.admin_set_salon_verification`
- `public.admin_update_platform_settings`
- `public.admin_update_salon_details`
- `public.attach_expense_receipt`
- `public.can_administer_notifications`
- `public.correct_expense`
- `public.create_stock_item`
- `public.erp_dashboard_metrics`
- `public.get_public_platform_status`
- `public.get_salon_notification_health`
- `public.list_expense_events`
- `public.list_stock_movements`
- `public.list_suppliers`
- `public.marketplace_revoke_booking_token`
- `public.marketplace_rotate_booking_token`
- `public.platform_get_notification_health`
- `public.record_notification_dispatch_run`
- `public.record_stock_movement`
- `public.reverse_expense`
- `public.rls_auto_enable`
- `public.update_stock_item_metadata`
- `public.upsert_supplier`

## 4. Ce que cela implique

- **Ne pas appliquer les 3 migrations de la branche en l'état.** Elles dupliquent des fonctions de `main` et
  introduisent une API SuperAdmin et un stock concurrents. Appliquer `20261112090000` seule comme prévu précédemment
  est exclu : la RPC qu'elle crée n'est pas le chemin retenu par `main`.
- **Ne pas rejouer le dépôt sur la production.** 19 fonctions divergentes, dont `write_platform_audit` et
  `get_platform_metrics`, seraient remplacées par une version différente de celle en service.
- **Le code de la branche n'est pas compatible avec la production sur deux points** : `stock.adjust` et la console
  `platform_*`.

## 5. Options (décision utilisateur)

- **A (recommandée)** : fusionner `origin/main` dans la branche avec `--allow-unrelated-histories` (pas de réécriture).
  Puis : retirer ou adapter les 3 migrations (SuperAdmin sur `admin_*`, stock sur `record_stock_movement`), résoudre les
  collisions de version, valider sur base locale (`supabase db reset`, `db lint`), puis réparer l'historique distant (D6).
- **B** : réécrire la branche sur `main` (rebase ou nouvelle base). Exige une autorisation explicite et casse l'historique
  déjà poussé. Non recommandée.
- **C** : garder la branche telle quelle et ne livrer que les refactors front et la D11. Abandonne la console et le stock de la branche.

## 6. Prochaine étape selon l'option retenue

Aucune écriture en production avant : (1) la fusion ou la réécriture validée, (2) la validation locale complète,
(3) la capture des migrations manquantes, (4) une sauvegarde datée (confirmée, date non précisée à ce jour), (5) l'accord écrit de l'équipe.
