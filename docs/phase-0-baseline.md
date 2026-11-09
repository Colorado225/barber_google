# Phase 0 — Baseline, inventaire et contrat cible

## Décision de cible

Supabase est la cible unique pour l'identité et les données applicatives.
L'authentification de l'interface utilise déjà Supabase Auth, mais une grande
partie des contrats ERP reste branchée sur Express et l'ancien modèle
PostgreSQL `bc_*`. Il n'existe pas de synchronisation automatique entre ces
deux modèles.

La cible de migration est :

- CRUD métier autorisé par RLS avec Supabase ;
- mutations qui impliquent plusieurs écritures, invariants métier ou concurrence
  traitées par RPC PostgreSQL transactionnelles ;
- aucun cookie de session Express comme condition d'accès au workspace ;
- aucune donnée ERP réelle persistée dans `localStorage`.

Les migrations `database/migrations/` décrivent le modèle historique Express.
Elles ne doivent pas être appliquées à Supabase. Toute évolution du modèle
Supabase doit être ajoutée comme une nouvelle migration immuable dans
`supabase/migrations/`.

## Inventaire fonctionnel et parité des contrats

| Domaine                                        | Contrat actuel                                                                                                                    | État du frontend                                                                                                   | Cible / écart à fermer                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Authentification                               | Supabase Auth dans `AuthContext`; Express conserve `/api/auth/*` et ses tables `bc_auth_*`                                        | Login, inscription, vérification et récupération passent par Supabase                                              | Garder Supabase Auth; retirer le chemin legacy seulement après vérification de non-usage et stratégie de migration d'identité |
| Workspace / onboarding                         | `create_salon` RPC et lecture directe des memberships Supabase; Express expose `/api/me`, `/api/onboarding/*`, `POST /api/salons` | Onboarding utilisateur utilise Supabase; le chargement ERP appelle encore `/api/salons/:id/workspace`              | Unifier chargement workspace, onboarding et sélection de succursale sous Supabase/RLS                                         |
| Membres / rôles                                | Express expose lecture et changement de rôle/statut avec permissions; `AuthContext` lit les memberships Supabase                  | Aucun contrat membre correspondant dans `salonApi`; la gestion n'est pas couverte par un parcours Supabase complet | Ajouter les contrats Supabase d'invitation/gestion avec audit et règles de privilège                                          |
| Clients                                        | `salonApi.clients` → CRUD Express, schéma/validation dans le backend                                                              | Appels distants présents; les collections sont aussi restaurées/sauvegardées en `localStorage`                     | Basculer le repository sur Supabase, RLS tenant, conserver les règles de validation et supprimer le cache métier              |
| Catalogue / services                           | `salonApi.services` → Express, activation et CRUD                                                                                 | Appels distants présents                                                                                           | RLS et mutations Supabase; aligner les permissions de lecture/écriture                                                        |
| Succursales / horaires                         | `salonApi.branches` et `branchHours`; règles Express par salon                                                                    | Appels distants présents, contexte de succursale également stocké localement                                       | Modéliser les horaires dans Supabase et vérifier le périmètre salon + succursale                                              |
| Personnel / horaires / absences                | `salonApi.staff` et méthodes de planning; Express/operations repository                                                           | Appels distants présents                                                                                           | Créer les tables et mutations Supabase, avec validation de compétences et disponibilité                                       |
| Rendez-vous / disponibilité / historique       | Contrats Express de liste, réservation, déplacement, transition, annulation, historique et disponibilité                          | Client API défini; mutations via Express; les données sont aussi dans l'état local                                 | Réservation et workflow atomiques; historique append-only; prévenir les conflits concurrents au niveau PostgreSQL             |
| Caisse / paiements / remboursements / rapports | Routes Express de sessions de caisse, encaissements, confirmation, remboursements et rapports                                     | Aucun wrapper correspondant dans `salonApi`; état de caisse et transactions conservé localement dans `AppContext`  | Porter caisse/journaux financiers et rapports vers Supabase avant de déclarer ces écrans synchronisés                         |
| Dépenses                                       | Express expose liste et création; `salonApi` seulement liste/création                                                             | Appels distants partiels et état local persistant                                                                  | Compléter contrats/mutations nécessaires; RLS et rattachement à une succursale                                                |
| Stocks                                         | Express expose CRUD; `salonApi` expose CRUD                                                                                       | Appels distants présents; quantité encore modifiable dans l'état de l'application                                  | Porter les données sur Supabase et décider/implémenter un journal de mouvements avant la bascule                              |
| Fidélité                                       | Express expose CRUD de récompenses; `salonApi` expose les récompenses                                                             | Récompenses distantes, transactions et réglages fidélité en état local                                             | Définir les écritures/soldes transactionnels Supabase avant de remplacer le cache                                             |
| Avis / vitrine                                 | Express expose CRUD d'avis; Supabase a `reviews` et `salon_settings`                                                              | Appels avis présents; aucun contrat API typé de paramètres de vitrine                                              | Définir la frontière public/privé, les permissions et les règles de modération                                                |
| Abonnements / facturation SaaS                 | L'interface contient une vue d'abonnement; aucune route ERP de facturation n'est référencée dans `salonApi`                       | À auditer fonctionnellement avant toute intégration de paiement                                                    | Distinguer affichage d'un plan et abonnement facturé; ne pas inventer de fournisseur ou règle tarifaire                       |

### Contrats backend absents du client API

`server/resource-app.js` possède des routes legacy pour les membres, les caisses,
les paiements, les remboursements et les rapports financiers. Le client
`src/lib/api.ts` n'expose aucun wrapper pour ces contrats, et aucune autre
référence frontend à ces routes `/api/` n'a été trouvée pendant l'inventaire.
Ces capacités ne doivent donc pas être considérées comme des parcours serveur
de bout en bout : vérifier leur usage réel avec les utilisateurs avant la
migration et faire une décision explicite pour les écrans actuellement locaux.

## Matrice de permissions à réconcilier

`AuthContext.tsx` calcule actuellement une liste locale de permissions à partir
du rôle; `ErpLayout.tsx` filtre la navigation avec cette liste. Le backend
applique une matrice distincte dans PostgreSQL. La phase suivante doit produire
une seule matrice vérifiée à la fois par RLS/RPC et par tests de navigation.

| Permission utilisée par l'interface / le backend                 | Constat frontend actuel                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `salon.read` (navigation vitrine/QR et plusieurs routes backend) | Absente de la liste de permissions `owner` dans `AuthContext`                       |
| `inventory.read` (navigation stocks)                             | `inventory.manage` existe pour owner/manager, mais `inventory.read` est absent      |
| `loyalty.read` (navigation fidélité)                             | `loyalty.write` existe; `loyalty.read` est absent                                   |
| `subscriptions.read` (navigation abonnement)                     | `subscription.manage` existe pour owner, mais le nom ne correspond pas              |
| `payments.read` (routes backend)                                 | Non attribuée dans la liste frontend relevée                                        |
| `cash.close`, `branch.update`, `finance.write` (routes backend)  | À vérifier/aligner par rôle; les routes ne sont pas représentées dans le client API |

Ce relevé est un inventaire de décalages de noms et de couverture, pas une
proposition d'accorder automatiquement ces droits. Chaque rôle doit être validé
avec les règles métier puis testé contre la base.

### Écarts explicites entre les trois matrices

| Capacité            | Interface (`AuthContext`)                                                                           | Legacy (`database/migrations`, modèle final)                                                  | Supabase (`supabase_core`)                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Lecture salon       | Non attribuée au tableau frontend                                                                   | `salon.read` accordée à tout membre actif                                                     | `salon.read` accordée à tout membre actif                                                          |
| Lecture stock       | Aucun rôle n'a `inventory.read`; owner/manager ont `inventory.manage`                               | `inventory.read` : owner, manager, barber, cashier, accountant                                | `stock.read` : owner, manager, receptionist, barber, cashier; nom différent et accountant manquant |
| Écriture stock      | `stock.write` pour owner/manager                                                                    | `stock.write` pour owner/manager                                                              | `stock.write` pour owner/manager                                                                   |
| Lecture fidélité    | Aucun rôle n'a `loyalty.read`                                                                       | `loyalty.read` : owner, manager, receptionist, cashier                                        | `loyalty.read` accordée à tout membre actif                                                        |
| Gestion fidélité    | `loyalty.write` pour owner/manager                                                                  | `loyalty.write` pour owner/manager; `loyalty.manage` apparaît aussi dans une ancienne matrice | `loyalty.write` pour owner/manager                                                                 |
| Lecture abonnements | Owner a `subscription.manage`, pas `subscriptions.read`                                             | `subscriptions.read` pour owner                                                               | Permission absente de la matrice Supabase                                                          |
| Lecture paiements   | `payments.read` absente                                                                             | Owner, manager, cashier, accountant                                                           | Permission absente                                                                                 |
| Encaissement        | Owner/manager/cashier ont `payments.create`; `finance.write` aussi accordée à owner/manager/cashier | `payments.create` et `finance.write` : owner, manager, cashier                                | Permissions financières absentes                                                                   |
| Fermeture caisse    | Aucun `cash.close` dans le tableau frontend                                                         | Owner, manager, cashier                                                                       | Permission absente                                                                                 |
| Rapport / dépenses  | `reports.read`/`expenses.read` sur certains rôles                                                   | `reports.read` et `expenses.read` : owner, manager, accountant                                | `reports.read`/`expenses.read` cohérentes sur ces rôles                                            |

Cette comparaison confirme qu'il ne faut pas simplement corriger l'UI pour
faire disparaître les menus : les noms, rôles autorisés et capacités financières
doivent être décidés une fois, puis représentés en tests de contrat SQL et UI.

## Comparaison des modèles de données

Le schéma historique se trouve dans `database/migrations/`; le schéma cible
actuellement versionné sous `supabase/migrations/` contient une seule migration
de socle et 15 tables `public`.

| Ancien modèle `bc_*`                                          | Modèle Supabase actuel                | Écart connu                                                                                  |
| ------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `bc_users`, `bc_auth_accounts`                                | `auth.users`                          | Stratégie d'identité à définir; ne pas migrer les sessions ou jetons legacy                  |
| `bc_auth_sessions`, `bc_auth_tokens`                          | —                                     | Sessions/jetons temporaires non transférables                                                |
| `bc_organizations`, `bc_salons`, `bc_branches`                | `organizations`, `salons`, `branches` | Modèle de base présent                                                                       |
| `bc_memberships`, `bc_branch_memberships`                     | `memberships`, `branch_memberships`   | Modèle de base présent; gestion des invitations à compléter                                  |
| `bc_member_invitations`, `bc_admin_audit`                     | —                                     | À concevoir/porter avec règles d'accès explicites                                            |
| `bc_clients`, `bc_services`, `bc_staff`                       | `clients`, `services`, `staff`        | Tables présentes; vérifier contrats, contraintes, RLS et parité des colonnes                 |
| `bc_staff_schedules`, `bc_staff_absences`, `bc_branch_hours`  | —                                     | Pas de tables Supabase dans la migration actuelle                                            |
| `bc_appointments`, `bc_appointment_events`                    | `appointments`                        | Table présente, mais policy actuelle de lecture uniquement; historique et workflow manquants |
| `bc_payment_entries`, `bc_cash_registers`, `bc_cash_sessions` | —                                     | Domaine financier non porté                                                                  |
| `bc_expenses`, `bc_stock_items`                               | `expenses`, `stock_items`             | Tables présentes; journaux, mutations et parité à vérifier                                   |
| `bc_loyalty_rewards`                                          | `rewards`                             | Récompenses présentes; transactions/réglages fidélité absents                                |
| `bc_reviews`                                                  | `reviews`                             | Table présente; politique d'accès public/gestion à valider                                   |
| Paramètres de salon                                           | `salon_settings`                      | Table présente; contrat frontend/backend à inventorier                                       |

### État des données : mesures en attente

Aucun comptage de lignes de l'ancienne base Express n'est inclus dans cette
phase. Le fichier `.env` contient bien `DATABASE_URL_READONLY`, mais son hôte
est celui du **même projet Supabase cible** que `SUPABASE_URL`; il ne désigne
pas une source PostgreSQL legacy distincte. La connexion PostgreSQL directe a
échoué dans l'environnement local avec `ENOTFOUND` avant l'authentification.
Dans le Dashboard partagé, une requête catalogue déjà présente a retourné
15 tables `public`, toutes avec RLS activée; cela concorde avec le socle
Supabase et ne montre pas de tables legacy `bc_*`. Aucune donnée métier n'a été
consultée ni modifiée.

Le propriétaire du projet ne sait pas encore si une base legacy distincte
existe ni où elle est hébergée. Retrouver la configuration du déploiement
historique (variables d'environnement du serveur, fournisseur PostgreSQL,
logs/archives de déploiement) est donc le prochain préalable à la mesure des
données; ne pas assimiler l'absence de source configurée à l'absence de données.
Dans le dépôt, `compose.yaml` ne décrit qu'un PostgreSQL local de développement;
aucune configuration de déploiement Express hébergé ou variable de connexion
legacy distincte n'a été trouvée.

**Périmètre confirmé par le propriétaire du projet :** tous les domaines
existants listés dans la matrice sont requis pour la bascule. Toutes les données
métier historiques valides doivent être reprises et rapprochées; elles ne
seront pas importées avant inventaire, mapping, sauvegarde et validation. Les
sessions, jetons temporaires et identifiants legacy ne sont pas inclus dans
l'import métier; la stratégie de compte utilisateur reste à traiter séparément.

Le rapport SQL [`database/inventory-readonly.sql`](../database/inventory-readonly.sql)
fournit les présences de tables, comptages exacts, tailles, colonnes/types SQL
et relations de clés étrangères sans sélectionner de valeurs métier. Il refuse
les rôles superutilisateurs, `BYPASSRLS` ou qui ont des droits d'écriture sur
les tables `bc_*`; sa transaction est également `READ ONLY`. Il peut être
exécuté sur une copie approuvée ou une source legacy **distincte** lorsqu'une
connexion en lecture seule vers cette source est fournie :

```sh
psql "$DATABASE_URL_READONLY" -X -v ON_ERROR_STOP=1 -f database/inventory-readonly.sql
```

Ne pas fournir une URL ou un secret dans le dépôt, le terminal partagé ou le
chat. La connexion `.env` actuellement configurée ne doit pas servir à
inventorier l'ancienne base tant qu'il n'est pas établi qu'elle en est bien la
source : elle vise le projet cible Supabase. Avant tout import, compléter le
relevé pour chaque domaine avec le nombre de lignes, les relations non intègres,
les doublons métier, les devises/périodes, les données de démonstration et la
décision de conservation. Les identifiants d'authentification doivent faire
l'objet d'une décision séparée; les sessions, jetons de réinitialisation et
jetons d'invitation expirés ne sont pas à migrer.

## Baseline qualité et validation

- Les scripts npm `typecheck`, `lint`, `test`, `build` existent et la CI les
  exécute, ainsi qu'un reset/lint Supabase local.
- ESLint ignore actuellement tous les fichiers `.ts` et `.tsx`; `tsc` reste le
  contrôle TypeScript actif.
- Deux imports inutilisés `createFinanceRepository` dans les tests Lot 3 ont
  été retirés dans cette phase 0.
- Les tests PostgreSQL/HTTP qui ouvrent un port ont échoué dans l'environnement
  sandbox avec `listen EPERM`; cette restriction n'est pas un verdict sur la
  logique applicative. La CI hébergée doit exécuter ces tests; une réussite
  locale nécessite un environnement qui autorise l'écoute.
- Vérification après correction : `npm run lint` réussi,
  `npm run typecheck -- --pretty false` réussi; tests DB isolés 14/14; tests
  React ciblés 6/6; `npm run build` réussi.
- Les sept tests ciblés de `tests/operations-lot3.test.mjs` n'ont pas pu
  démarrer leur serveur HTTP : la sandbox refuse l'écoute sur `127.0.0.1`
  (`listen EPERM`). Aucune assertion métier de ces sept tests n'a donc été
  exécutée. Le build conserve les avertissements Vite déjà connus (`__dirname`
  et bundle JS supérieur à 500 kB).
- `psql` 17 est disponible, mais le rapport SQL n'a pas été exécuté : aucun
  endpoint de la base historique distincte n'est configuré. Le
  `DATABASE_URL_READONLY` du fichier `.env` cible le même projet Supabase que
  l'application; la résolution DNS a échoué en sandbox (`ENOTFOUND`). Le
  Dashboard confirme le socle Supabase déjà recensé, pas l'existence ou le
  contenu d'une base legacy externe. Aucune migration distante n'a été lancée.
- Les 10 migrations legacy ont été rejouées sur une base PGlite jetable dans
  l'ordre lexical exact utilisé par `database/migrate.sh`; elles s'appliquent
  toutes. Cela vérifie la reproductibilité du schéma legacy local, pas son
  application à la base Supabase ni la présence de données historiques.

## Décisions et portes de sortie de phase 0

- [x] Confirmer Supabase comme cible unique et conserver Express durant la migration.
- [x] Recenser les domaines, routes backend, usages frontend et lacunes Supabase.
- [x] Identifier le décalage entre permissions UI et permissions backend sans
      élargir les droits.
- [x] Ajouter un inventaire SQL read-only des relations legacy attendues.
- [x] Corriger les deux imports inutilisés; lint, typecheck, DB et React ciblés passent.
- [x] Confirmer que tous les domaines ERP existants sont requis et que toutes les
      données métier historiques valides sont à reprendre.
- [x] Comparer les noms et attributions des permissions frontend, legacy et
      migration Supabase; laisser les divergences comme décisions explicites.
- [x] Rejouer les migrations legacy dans l'ordre exact du runner sur PGlite;
      les 10 fichiers s'appliquent.
- [ ] Identifier si une base legacy distincte existe encore et où elle est
      hébergée en consultant la configuration du déploiement historique hors dépôt;
      obtenir son endpoint sans le partager dans le chat.
- [ ] Si cette source existe, configurer une URL de connexion dédiée en lecture
      seule vers cette source et exécuter l'inventaire.
- [ ] Valider avec le propriétaire métier les capacités de caisse, finance,
      membres, fidélité, marketplace et abonnements dans leurs règles détaillées.
- [ ] Établir le mapping précis et les règles de réconciliation à partir des
      comptages/contraintes de la base réelle.
- [ ] Approuver la stratégie de migration d'identité avant tout import utilisateur.

La phase 1 ne doit pas commencer par une suppression du backend : les éléments
en attente de cette liste bloquent la conception finale du schéma et de
l'import, mais pas la correction indépendante des erreurs de lint.
