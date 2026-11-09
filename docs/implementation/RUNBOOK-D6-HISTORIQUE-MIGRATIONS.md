# Runbook D6 : réparation de l'historique des migrations Supabase

Statut : **préparé, non exécuté**. Aucune commande de ce document n'a été lancée sur le projet distant.
Toute écriture en production exige : (1) une sauvegarde vérifiée, (2) une confirmation explicite de l'équipe,
(3) le workflow `supabase-migrations.yml` (`confirm_production_migration`, branche `main`).

## 1. Constat (lecture seule, déjà vérifié)

- `supabase_migrations.schema_migrations` (production) : 26 versions. Les colonnes `statements` sont vides pour
  `20261104130000` à `20261104140200` et `20261104150000`. Elles ne peuvent donc pas être rejouées depuis la base.
- Versions présentes en production et absentes du dépôt : `20261108191041` (`marketplace_slug_resolution`),
  `20261109080601` (`saas_pricing_and_subscriptions`), `20261109080620` (`platform_superadmin_guard`).
- Versions présentes dans le dépôt et absentes de la production : `20261109100000`, `20261109120000`,
  `20261110090000`, `20261111090000`.
- Nom différent pour la même version : `20261104150000` (production : `marketplace_contact_privacy` ; dépôt :
  `saas_pricing_and_subscriptions`).
- Fonctions : 56 fonctions publiques distantes. 50 corps identiques au dépôt. Divergentes : `create_appointment`,
  `marketplace_list_salons`, `marketplace_salon_detail`, `publish_marketplace_customizer` (la production ajoute la
  confidentialité des contacts via `private.marketplace_public_contact`). `subscribe_salon_to_plan` diverge et sera
  remplacée par `20261110090000`. Distant seul : `rls_auto_enable`.
- Schéma `private` distant : `marketplace_public_contact` et `slugify` n'ont **aucune définition dans le dépôt**.

Conséquence : `supabase db push` échouera tant que l'historique n'est pas réparé, et un rejeu complet du dépôt
ne reproduit pas la production.

## 2. Décision à prendre (D6)

- **Option A (recommandée) : réparer l'historique et capturer l'existant.** Récupérer le SQL réel de la production
  (schéma distant), l'ajouter au dépôt sous des versions dédiées, puis marquer l'historique avec `migration repair`.
- **Option B : reconstruire.** Recréer une base neuve depuis le dépôt, migrer les données, puis basculer.
  Plus coûteuse et plus risquée ; à retenir seulement si l'option A est impossible.

Ce runbook décrit l'option A.

## 3. Prérequis

1. Accès au projet Supabase `rozsykrjrncbupzmauzj` depuis une machine disposant du CLI (le bac à sable ne joint pas
   `*.supabase.co`).
2. CLI Supabase installé, version fixée et notée dans le ticket.
3. Sauvegarde complète : `supabase db dump --linked -f backups/prod-schema-AAAAMMJJ.sql` et
   `supabase db dump --linked --data-only -f backups/prod-data-AAAAMMJJ.sql`. Vérifier que les fichiers ne sont pas vides,
   puis les stocker hors dépôt (les sauvegardes ne doivent pas être versionnées).
4. Confirmation écrite de l'équipe avant l'étape 5.

## 4. Inventaire (lecture seule)

```bash
supabase migration list --linked
supabase db dump --linked -f /tmp/prod-schema.sql
```

Comparer `/tmp/prod-schema.sql` avec le dépôt (`supabase db reset` puis `supabase db diff --linked`). Le résultat
attendu : la liste exacte des objets présents en production et absents du dépôt, à reporter dans le ticket.

## 5. Capture de l'existant dans le dépôt (sans toucher à la production)

1. Créer une migration `supabase/migrations/<version>_captured_production_baseline.sql` dont le contenu est
   **uniquement** la différence constatée à l'étape 4 (objets `private.*`, fonctions divergentes en production,
   `rls_auto_enable`). Ne jamais modifier une migration déjà appliquée.
2. Pour `20261108191041`, `20261109080601` et `20261109080620` : les fichiers SQL absents du dépôt doivent être
   reconstruits à partir de `schema_migrations.statements` (disponible pour ces versions) et relus.
3. Vérifier localement : `supabase db reset` doit réussir et `supabase db lint --local` ne doit rien signaler de nouveau.

## 6. Réparation de l'historique (uniquement après confirmation, et sur production seulement après sauvegarde)

Marquer comme appliquées les versions qui existent déjà en production (sans rejouer leur SQL) :

```bash
supabase migration repair --status applied 20261108191041 20261109080601 20261109080620 --linked
```

Marquer comme non appliquées les versions du dépôt absentes de la production, pour qu'elles soient rejouées ensuite
(ne pas les marquer `applied` sans les avoir exécutées) :

```bash
supabase migration repair --status reverted 20261109100000 20261109120000 --linked
```

**Attention au double rejeu.** Le schéma SaaS (`saas_pricing_and_subscriptions`) est appliqué en production sous
`20261109080601`, alors que le dépôt le porte sous `20261104150000`. De même, la garde `platform_superadmin_guard`
est appliquée sous `20261109080620`, alors que le dépôt contient une variante sous `20261109100000`. Avant tout
`reverted` ou rejeu, comparer le SQL de chaque paire et ne garder qu'une seule version active par objet. Un rejeu
non idempotent créerait des doublons ou des erreurs de contrainte.

Pour `20261104150000` (nom différent) : relire le SQL réel, décider avec l'équipe s'il faut renommer la version
dans le dépôt, puis documenter la décision. Ne jamais réécrire l'historique Git.

## 7. Vérification avant toute application

```bash
supabase migration list --linked
supabase db push --linked --dry-run
```

Attendu : seules `20261109100000`, `20261109120000`, `20261110090000`, `20261111090000` et la baseline capturée
apparaissent comme « à appliquer ». Toute autre ligne bloque le déploiement.

## 8. Application en production (autorisation explicite requise)

1. Rejouer la même commande `--dry-run` et la faire relire.
2. Lancer le workflow manuel `supabase-migrations.yml` sur `main` avec `confirm_production_migration` renseigné.
3. Contrôles après application : `platform_list_salons` et `platform_list_reviews` appelées par le SuperAdmin ;
   souscription de test ; abonnement non activé sans validation ; fonctions `anon` refusées sur les RPC sensibles.

## 9. Retour arrière

- Ne pas supprimer de lignes de `schema_migrations` à la main : utiliser `migration repair` pour corriger un statut.
- En cas d'échec d'une migration : restaurer la sauvegarde de l'étape 3 sur un projet de test, analyser, puis
  décider. Ne pas improviser sur la production.
