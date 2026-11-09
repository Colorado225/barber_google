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

La CI exécute aussi `supabase db reset` et `supabase db lint --local` sur le
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
`supabase db push --linked --yes`. Le job utilise l'environnement GitHub
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
