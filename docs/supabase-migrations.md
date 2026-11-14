# Gestion et synchronisation des migrations Supabase

## Source de vérité

Les migrations destinées à Supabase sont exclusivement dans
`supabase/migrations/`. La lignée `database/migrations/` appartient encore à
l'ancien backend Express (`bc_*`) et ne doit pas être envoyée au projet
Supabase : elle décrit un autre modèle de données.

Une migration appliquée est immuable. Toute évolution se fait dans un nouveau
fichier versionné ; ne pas renommer, modifier ou supprimer une migration déjà
appliquée. Les données de démonstration restent désactivées par défaut.

## Développer et vérifier localement

Prérequis : Supabase CLI et Docker Desktop démarré.

1. Créer une migration avec `supabase migration new <nom>`.
2. Écrire le changement SQL dans le nouveau fichier sous
   `supabase/migrations/`.
3. Recréer la base locale depuis zéro avec `npm run supabase:db:reset`.
   Cette commande est destructive pour la base Supabase **locale** uniquement.
4. Lancer les tests ciblés et `npm test`.
5. Vérifier que le diff ne modifie pas une migration déjà appliquée.

La CI exécute aussi `supabase db reset` et `supabase db lint` sur le
PostgreSQL Supabase local. Les tests PGlite restent utiles pour les cas
d'isolation/RLS, mais ne remplacent pas cette validation par le moteur utilisé
par Supabase.

## Prévisualiser le projet distant

Avant une application distante, relier la CLI au projet voulu, puis inspecter
le journal et le plan :

```sh
supabase link --project-ref <project-ref>
npm run supabase:db:linked:status
npm run supabase:db:linked:preview
```

Le lien CLI n'est qu'une configuration locale ; il ne synchronise pas le
schéma. La prévisualisation est sans écriture. Vérifier le projet cible, les
migrations en attente, l'impact SQL et disposer d'une sauvegarde avant toute
application.

## Appliquer au projet distant

Le workflow manuel
`.github/workflows/supabase-migrations.yml` n'accepte que la branche `main` et
exige la confirmation explicite `confirm_production_migration`. Il affiche
d'abord le statut et le `--dry-run`, puis applique les migrations avec
`supabase db push --remote --skip-vault --yes`. Le job utilise l'environnement GitHub
`supabase-production` : configurer cet environnement avec des approbateurs
requis avant de l'utiliser.

Configurer dans cet environnement :

- le secret `SUPABASE_ACCESS_TOKEN` ;
- le secret `SUPABASE_DB_PASSWORD` ;
- la variable `SUPABASE_PROJECT_REF`, égale au projet Supabase visé.

Ne jamais placer ces secrets dans `.env.example`, le dépôt, le bundle client ou
les logs. Le workflow ne copie aucun schéma de `database/migrations/` et ne
modifie pas de données de démonstration.

## Limite actuelle de synchronisation

L'application de migrations synchronise le schéma versionné ; elle ne migre pas
automatiquement les lignes de données de l'ancien PostgreSQL/Express et ne
rend pas les écrans ERP synchrones à Supabase par magie. Au moment de cette
mise en place, le schéma Supabase ne couvre que le socle tenant et une partie
des ressources : les domaines métier encore servis par Express doivent être
portés et validés avant son retrait. Aucune application distante ne doit être
considérée comme effectuée pour une nouvelle migration tant que le workflow
n'a pas terminé avec succès. L'état distant déjà vérifié ci-dessous est
antérieur à ce déploiement automatisé.

La migration locale `20261103170000_branch_hours.sql` ajoute un horaire
hebdomadaire par succursale, avec validation des heures, RLS de lecture pour
les membres et écriture réservée aux rôles autorisés à modifier la succursale.
L'écran des horaires lit les succursales et lit/enregistre ces lignes via
Supabase ; son ancien wrapper HTTP Express a été retiré du client frontend.
Les tests PGlite couvrent l'isolation et les contraintes. La migration a été
appliquée au projet distant le 4 novembre 2026 (voir « État distant vérifié »).

## État distant vérifié

Le 3 novembre 2026, le Dashboard Supabase du projet `barber_google` a confirmé :

- `20261103160000 / supabase_core` est enregistré dans
  `supabase_migrations.schema_migrations` et correspond à l'unique fichier de
  `supabase/migrations/` ;
- les 15 tables du schéma `public` existent, toutes avec RLS activée ;
- les 37 policies ainsi que les RPC `create_salon` et
  `assign_member_to_branch` sont présentes ;
- `.env.local` cible ce même projet et contient une clé client, sans que ces
  valeurs soient exposées ou versionnées.

Aucune migration n'a été rejouée pendant cette vérification : la base distante
était déjà à jour avec la lignée canonique locale. Cette vérification valide le
schéma et la configuration de connexion, pas la migration des données de
l'ancien backend ni la parité complète des écrans ERP.

Le 4 novembre 2026, le branchement a été complété via le connecteur Supabase
(projet `barber_google`, ref `rozsykrjrncbupzmauzj`) :

- `20261103170000 / branch_hours` appliqué dans une transaction et enregistré
  dans `supabase_migrations.schema_migrations` avec la même version que le
  fichier local ; le schéma `public` compte 16 tables, `branch_hours` a RLS
  activée et ses 4 policies ;
- `.env.local` recréé dans l'environnement de travail avec
  `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (clé publishable du projet,
  jamais versionnée) ;
- Auth : la liste des redirections autorisées contient `http://localhost:3000/**`
  et l'URL de preview de l'environnement de travail ; `site_url` reste
  `http://localhost:3000` et la confirmation d'e-mail reste activée.

Les tests PGlite `supabase-core` et `supabase-branch-hours` passent, et le
serveur Vite injecte bien les variables dans le client. La vérification
bout-en-bout (inscription, e-mail de confirmation) se fait depuis le navigateur :
le sandbox n'a pas d'accès réseau sortant vers `supabase.co`.

Le 4 novembre 2026 (Lot 5 — parité opérationnelle), trois migrations ont été
appliquées au même projet via le connecteur Supabase, chacune dans une
transaction et enregistrée dans `supabase_migrations.schema_migrations` avec la
même version que le fichier local :

- `20261104090000 / staff_schedules` — horaires hebdomadaires et absences du
  personnel (RLS `staff.read` / `team.write`) ;
- `20261104090100 / appointment_operations` — journal `appointment_events`,
  `private.is_slot_available`, RPC `create_appointment`,
  `reschedule_appointment`, `transition_appointment`, `cancel_appointment`,
  `day_availability`, et contrainte d'exclusion `appointments_no_overlap`
  (`btree_gist` créé sur le distant) ;
- `20261104090200 / review_moderation` — `reviews.appointment_id` (unique par
  rendez-vous), RPC `create_review` / `delete_review`, permission
  `reviews.moderate` ajoutée par `create or replace` de
  `private.has_salon_permission`.

État distant vérifié après application : 19 tables `public` (toutes RLS), 7 RPC
métier supplémentaires, contrainte anti-chevauchement et extension `btree_gist`
présentes. Le journal distant contient les 5 versions de la lignée canonique
`supabase/migrations/`, dans l'ordre. Voir `docs/LOT-5-RAPPORT.md` pour le détail
et les limites (règlement en caisse au Lot 6, lecture publique marketplace au
Lot 7, retrait d'Express conditionné à l'audit complet de parité).

Le 4 novembre 2026 (Lot 6 — caisse et finances), quatre migrations ont été
appliquées au même projet via le connecteur Supabase, chacune dans une
transaction et enregistrée dans `supabase_migrations.schema_migrations` avec la
même version que le fichier local :

- `20261104100000 / finance_foundation` — permissions financières canoniques,
  `cash_registers`, `cash_sessions` (une seule session ouverte par caisse),
  trigger d'immuabilité, `ensure_default_register`, `open_cash_session` ;
- `20261104100100 / payment_journal` — `payments` / `payment_events` append-only,
  idempotence, cycle `pending → confirmed/failed`, corrections liées et plafonnées,
  `record_payment`, `record_payment_correction`, `confirm_pending_payment`,
  `reject_pending_payment`, `close_cash_session`, `reconcile_cash_session`,
  `get_cash_session`, `list_cash_sessions` ;
- `20261104100200 / finance_reporting` — `list_payments`,
  `get_appointment_balance`, `financial_summary` (période explicite, remboursements
  nets, pending exclus), `record_expense` (`created_by` serveur, justificatif),
  contrainte `expenses_currency_xof` ;
- `20261104100300 / finance_permissions_fix` — correctif immuable rétablissant
  `reviews.moderate` (Lot 5) après la refonte de la carte de permissions.

État distant vérifié après application : **9 versions** dans le journal,
**23 tables `public` toutes RLS**, **14 RPC Lot 6**, les deux index uniques
financiers, les trois triggers d'immuabilité, la contrainte XOF des dépenses, et
`private.has_salon_permission` contenant à la fois `reviews.moderate` et
`payments.record`. Voir `docs/LOT-6-RAPPORT.md` pour le détail, les invariants et
les limites (confirmation Mobile Money manuelle, pas d'API opérateur, retrait
d'Express non effectué).

Le 4 novembre 2026 (Lot 7 — marketplace et réservation en ligne), trois
migrations ont été appliquées au même projet via le connecteur Supabase, chacune
dans une transaction et enregistrée dans `supabase_migrations.schema_migrations`
avec la même version que le fichier local :

- `20261104110000 / marketplace_profile` — colonnes vitrine des salons
  (`is_published`, slug, photos en URL, localisation, moyens de paiement),
  `update_salon_profile` (propriétaire, champs whitelistés), `set_salon_publication`
  (prérequis : service actif + adresse + téléphone + photo de couverture),
  lectures publiques `marketplace_list_salons` / `marketplace_salon_detail`
  (salons publiés uniquement, avis vérifiés, aucun contact client exposé) ;
- `20261104110100 / marketplace_booking` — réservation anon
  `marketplace_book_appointment` (statut `pending`, idempotence, anti-chevauchement
  via `private.is_slot_available`, jeton d'annulation secret),
  `marketplace_day_availability`, `marketplace_get_booking`,
  `marketplace_cancel_booking` ;
- `20261104110200 / appointment_notifications` — table outbox
  `appointment_notifications` + trigger d'enqueue (e-mail/WhatsApp/rappel 24 h),
  lecture membres uniquement ; **aucun envoi réel** tant que le fournisseur
  n'est pas branché.

Particularité : le noyau distant ne contenait pas les colonnes vitrine
`ispublishedonmarketplace`/`nextavailableslot` présentes dans le noyau local ;
`110000` renomme si présent, sinon ajoute `is_published` directement, et utilise
`add column if not exists` pour rester compatible avec les deux états.

État distant vérifié après application : **12 versions** dans le journal,
**24 tables `public` toutes RLS**, **6 RPC marketplace**, table outbox présente,
colonne `is_published` présente. Grants `anon` : EXECUTE sur les 6 RPC publiques
de lecture/réservation/annulation, **aucun** EXECUTE sur `update_salon_profile` /
`set_salon_publication`, **aucun** SELECT direct sur les tables, **0 policy anon**.
Voir `docs/LOT-7-RAPPORT.md` pour le détail, les invariants et les limites.

Le 4 novembre 2026 (clients de passage / sans rendez-vous), une migration a été
appliquée au même projet via le connecteur Supabase, dans une transaction et
enregistrée dans `supabase_migrations.schema_migrations` :

- `20261104120000 / walk_in_services` — source `walk_in`, colonnes
  `arrival_at`, `service_started_at`, `service_completed_at`,
  `walk_in_idempotency_key` ; RPC `register_walk_in`, `start_walk_in`,
  `complete_walk_in` (accueil comptoir, file d'attente, démarrage, fin) ;
  contrainte d'exclusion et `private.is_slot_available` alignées pour ne plus
  bloquer un coiffeur après une prestation `completed`. L'encaissement réutilise
  le journal de caisse existant.

État distant vérifié après application : **13 versions** dans le journal,
4 colonnes walk-in, 3 RPC dédiées, grant `authenticated` et refus `anon`.
Voir `docs/CLIENTS-DE-PASSAGE.md`.

Le 4 novembre 2026 (parcours client complet), six migrations ont été appliquées
au même projet via le connecteur Supabase, chacune dans une transaction et
enregistrée dans `supabase_migrations.schema_migrations` :

- `20261104130000 / crm_auto_link` — `private.normalize_phone`,
  `private.ensure_client_for_contact`, index téléphone normalisé ;
  `marketplace_book_appointment` et `register_walk_in` rattachent désormais
  `appointments.client_id` à une fiche CRM retrouvée ou créée sans doublon.
- `20261104130100 / loyalty_ledger` — `loyalty_programs`, `loyalty_accounts`,
  `loyalty_transactions` (append-only), `rewards.times_redeemed` ; attribution
  automatique sur rendez-vous `completed` + `paid`, reprise sur remboursement,
  RPC `set_loyalty_program`, `redeem_loyalty_reward`, `adjust_loyalty_points`.
- `20261104130200 / notification_dispatch` — statut `sending`, type
  `review_request`, colonnes `attempts` / `last_attempt_at` / `locked_at` /
  `provider_message_id` ; `claim_due_notifications` et `mark_notification_result`
  réservés à `service_role`, `retry_notification` et `can_manage_notifications`
  pour l'ERP.
- `20261104130300 / booking_portal` — `marketplace_booking_by_token` et
  `marketplace_submit_review`, exécutables par `anon` (portail client sans
  compte, avis vérifié après prestation terminée).
- `20261104130400 / client_email_check_fix` — correctif du noyau : la contrainte
  `clients_email_check` écrivait `\\.` et rejetait **toute** adresse valide.
- `20261104130500 / notification_scheduler` — `pg_net` + `pg_cron` si disponibles,
  table privée `private.notification_dispatch_config` (aucun secret dans le
  dépôt), `private.invoke_notification_dispatcher()` et tâche
  `dispatch-appointment-notifications` toutes les 5 minutes.

État distant vérifié après application : **19 versions** dans le journal,
3 tables de fidélité + 3 déclencheurs, 4 colonnes outbox, droits `anon` limités
aux deux RPC du portail, `claim`/`mark` refusés à `anon` **et** `authenticated`.
Les **20 fonctions** déployées ont une empreinte `md5(prosrc)` identique aux
fichiers locaux. Edge function `notifications-dispatcher` déployée et appelée
réellement (HTTP 200 via `pg_net`). Voir `docs/PARCOURS-CLIENT-COMPLET.md`.

## Contrôle en lecture seule du 14 novembre 2026 — divergence bloquante

Le journal du projet `barber_google` (`rozsykrjrncbupzmauzj`) a été comparé
aux fichiers de cette branche. **Ne pas exécuter `supabase db push`, ni le
workflow de migration, avant réconciliation et validation en staging.**

- Le dépôt contient 38 fichiers SQL, le journal distant 39 versions ; seuls
  22 couples version/nom correspondent, de `20261103160000` à
  `20261104140200` inclus. Un numéro supplémentaire est commun mais désigne
  deux migrations différentes.
- Les versions divergent ensuite : par exemple, le dépôt contient
  `20261104150000_saas_pricing_and_subscriptions.sql`, tandis que le journal
  distant attribue `20261104150000` à `marketplace_contact_privacy` et enregistre
  `saas_pricing_and_subscriptions` sous `20261109080601`. Plusieurs noms
  ultérieurs correspondent également mais avec des versions différentes. Une
  égalité de nom ne prouve pas l'égalité du SQL ou des effets appliqués.
- `20261113214500_marketplace_avg_price_and_categories.sql` n'apparaît pas dans
  le journal distant. La fonction distante `marketplace_list_salons` ne contient
  pas les champs `avg_price` et `service_categories` ; le filtrage et les
  recommandations qui en dépendent doivent donc être vérifiés avant livraison.

La réconciliation doit comparer les définitions SQL et le schéma effectif,
identifier les migrations équivalentes ou manquantes, tester un plan sur une
base de staging restaurée ou représentative, et sauvegarder avant toute
intervention. Ne pas renommer les fichiers ni modifier le journal distant sur
la seule base des noms ; ne pas considérer une réparation du journal comme une
application de SQL. Cette vérification n'a effectué aucune écriture distante.

### Analyse complémentaire du journal et verrou de déploiement

Le 14 novembre, une lecture de `supabase_migrations.schema_migrations` a comparé
les sommes MD5 des instructions enregistrées (concaténées avec un saut de ligne)
aux fichiers locaux de même nom, en testant les octets complets et le retrait
des espaces en début et fin de fichier. Ce contrôle est un **indice**, pas une
preuve de parité de schéma : il ne tient pas compte des migrations ultérieures,
des modifications manuelles ni des différences de normalisation du SQL.

- Pour dix migrations de même nom mais de version différente, la somme concorde
  avec le fichier brut ou sans espaces périphériques : `saas_plan_drafts`,
  `saas_subscription_verification`, `platform_admin_actions`,
  `platform_financial_metrics`, `erp_realtime_publication`,
  `booking_token_security`, `notifications_observability_and_honest_channels`,
  `p2_operations_stock_suppliers_expenses_storage`,
  `preserve_marketplace_privacy_and_slug` et `saas_annual_billing_subscription`.
- Pour cinq autres noms communs, les sommes ne concordent pas dans ces deux
  représentations : `saas_pricing_and_subscriptions`,
  `platform_superadmin_guard`, `erp_dashboard_metrics_and_timezone`,
  `platform_global_settings` et `saas_honest_plan_features`. Il faut comparer
  leur SQL enregistré et leurs effets ; une différence de somme ne démontre
  pas à elle seule une différence fonctionnelle.
- Dix migrations historiques, de `crm_auto_link` à
  `marketplace_contact_privacy`, n'ont aucune instruction enregistrée dans le
  journal distant. L'historique seul ne permet donc pas de vérifier leur contenu.
  `marketplace_contact_privacy` et `marketplace_slug_resolution` n'ont pas de
  fichier local sous ces noms ; leurs effets peuvent avoir été intégrés à
  d'autres migrations et doivent être contrôlés, notamment pour la confidentialité.

Le workflow manuel de production est volontairement **verrouillé avant toute
connexion ou application**. Ne retirer ce verrou qu'après comparaison des
instructions disponibles, audit du schéma et des permissions, restauration ou
création d'un staging représentatif, test du plan complet, sauvegarde et revue.
Le retrait du verrou ne remplace pas le `--dry-run` ni l'approbation explicite.
Les commandes locales `supabase db push` ne sont pas bloquées par ce workflow :
la même interdiction opérationnelle s'applique donc aussi à la CLI.

### Comparaison reproductible des inventaires

Pour comparer un export JSON **en lecture seule** du journal distant, sans
identifiants ni contenu SQL, utiliser un fichier non versionné contenant soit
un tableau d'objets `{ "version": "20261103160000", "name": "supabase_core" }`,
soit un objet avec une propriété `items` ou `rows` contenant ce tableau :

```sh
node scripts/compare-migration-history.mjs /chemin/vers/historique.json
```

Le rapport distingue les couples communs, collisions de version, versions
exclusives et correspondances de noms à des versions différentes. Il renvoie
le code 1 en cas d'écart et 2 en cas d'entrée invalide ; le code 0 ne prouve
**ni l'identité du SQL ni la parité du schéma**. Le script ne se connecte à
aucune base et n'applique aucune migration.

### Préparation en lecture seule : migration des prix et catégories

Une vérification supplémentaire a confirmé que `marketplace_list_salons(text,
text, text, text, integer)` est une fonction `SECURITY DEFINER`, propriétaire
`postgres`, avec `search_path` vide et droits d'exécution explicites pour
`anon`, `authenticated` et `service_role`. Les colonnes nécessaires à l'ajout
(`services.price`, `category`, `is_active`, `salon_id`, ainsi que les colonnes
clés vérifiées de `salons` et `salon_marketplace_settings`) existent. Ces
constats ne constituent pas un test d'exécution ni une validation exhaustive
des dépendances, permissions ou performances.

La migration locale `20261113214500_marketplace_avg_price_and_categories.sql`
remplace cette fonction et ajoute `avg_price` et `service_categories` à ses
résultats ; elle ne modifie pas directement les données des tables. Le corps
actuel de la fonction a été comparé à celui du fichier : les ajouts des deux
champs constituent la différence constatée. Le remplacement touche néanmoins
une API publique et doit être testé avant toute mise en production. Le connecteur
de migration crée sa propre entrée d'historique : il ne faut pas l'utiliser pour
contourner les divergences de versions ou déclarer l'historique réconcilié.

Plan préalable, sans action distante automatique :

1. Confirmer une sauvegarde récente, couvrant les données et configurations
   nécessaires, et vérifier la procédure de restauration dans un environnement
   isolé. Ne pas publier de sauvegarde ou de secrets dans le dépôt.
2. Comparer les cinq migrations dont les empreintes divergent avec leur SQL
   stocké et les objets effectifs ; examiner aussi les dix historiques sans SQL.
3. Tester sur une copie représentative, notamment la confidentialité des
   contacts, les autorisations anon/authenticated/service_role, les résultats
   avec et sans services actifs et le coût de la requête. Préparer et tester un
   retour arrière restaurant la fonction et ses permissions antérieures.
4. Définir et revoir le plan de réconciliation des versions, sans réparation
   aveugle du journal ; actualiser l'inventaire distant juste avant déploiement.
5. Avec une autorisation de déploiement après revue, appliquer uniquement le plan
   validé, vérifier les résultats et permissions, puis contrôler le journal. Le
   verrou de workflow reste en place tant que ces conditions ne sont pas réunies.

Aucune sauvegarde ni restauration n'a été vérifiée par ces contrôles ; aucune
migration n'a été exécutée. Les SQL enregistrés des cinq migrations divergentes
sont disponibles dans le journal distant (une instruction stockée pour chacune),
mais leur comparaison fonctionnelle demeure à faire.
