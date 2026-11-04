# Rapport Lot 3 — Gestion opérationnelle du salon

> Statut : **terminé et vérifié** (typecheck, lint, 52 tests, build, parcours navigateur sur PostgreSQL réel).
> Référence : `docs/MISEAJOUR.md` § 5, « LOT 3 — GESTION OPÉRATIONNELLE DU SALON ».

## 3.1 Catalogue des prestations

Le module existant est conservé et étendu :

| Champ                             | Statut                                                 |
| --------------------------------- | ------------------------------------------------------ |
| `id`, `salon_id`                  | existant                                               |
| `name`, `description`, `category` | existant                                               |
| `duration_minutes`                | existant                                               |
| `price`                           | existant — **entier** (bigint, XOF sans décimale)      |
| `is_active`                       | **ajouté** : activation/désactivation sans suppression |
| `prep_minutes`                    | **ajouté** : temps de préparation (0–120)              |
| `created_at`, `updated_at`        | existant                                               |

- Tarifs configurés **par salon** (`bc_services.salon_id`).
- Montants stockés en unités entières : `price: 4000.5` est refusé en 400 par le schéma
  Zod **et** par la colonne `bigint`.
- Une prestation n'est plus supprimée silencieusement quand elle est référencée :
  `bc_set_service_active()` la retire du catalogue réservable, l'historique est conservé.
- `GET /api/salons/:id/services` (actives) et `?all=1` (catalogue complet, écran de gestion).

## 3.2 Personnel

| Élément demandé          | Implémentation                                             |
| ------------------------ | ---------------------------------------------------------- |
| Profil                   | `bc_staff` (nom, rôle, avatar)                             |
| Téléphone                | `phone`                                                    |
| Email facultatif         | `email` (nullable)                                         |
| Fonction                 | `role` (master_barber, barber, colorist, stylist, manager) |
| Statut actif/inactif     | `is_active` — un profil inactif n'est jamais affecté       |
| Prestations maîtrisées   | `service_ids uuid[]` — contrôlé à la réservation           |
| Succursale d'affectation | `branch_id`                                                |
| Horaires                 | `bc_staff_schedules` (jour de semaine, début, fin)         |
| Jours de repos           | absence de plage pour le jour concerné                     |
| Absences                 | `bc_staff_absences` (du / au / motif)                      |
| Permissions              | `bc_memberships` (Lot 2)                                   |

**Séparation identité / profil métier** : `bc_staff.user_id` est nullable. Un employé
peut exister sans aucun compte de connexion (vérifié par test : `userId === null`).
Un même utilisateur ne peut avoir qu'un profil par salon (index unique partiel).

UI : bouton « Horaires & absences » par collaborateur (`StaffSchedulePanel`), sélection
des prestations maîtrisées, email et statut actif dans le formulaire.

## 3.3 Calendrier et rendez-vous

Table `bc_appointments` enrichie : `client_id`, `staff_id`, `service_id`, `notes`,
`updated_at`, avec clés étrangères (prestation supprimée → référence conservée mais nulle).

- États : `pending`, `confirmed`, `checked_in`, `in_progress`, `completed`, `cancelled`, `no_show`.
- **Transitions contrôlées côté backend** (`bc_transition_appointment`) : toute transition
  hors machine à états renvoie 400. Ex. `confirmed → completed` est refusé.
- **Historique conservé** : `bc_appointment_events` (append-only), exposé par
  `GET /api/salons/:id/appointments/:id/events`.
- **Aucune suppression physique** : le bouton « supprimer » annule désormais le rendez-vous
  (motif obligatoire), ce qui libère le créneau et préserve l'historique.
- `PATCH` via `PUT /appointments/:id` (déplacement) revérifie la disponibilité en excluant
  le rendez-vous courant.

## 3.4 Gestion des disponibilités

`barber_private.is_slot_available()` prend en compte :

1. Horaires d'ouverture de la succursale (`bc_branch_hours`, si configurés) ;
2. employé actif et affecté à la succursale ;
3. horaires hebdomadaires de l'employé (s'il en a) ;
4. absences sur la date ;
5. chevauchement avec un rendez-vous actif (annulé/absent exclus).

**Concurrence** : deux garanties, en plus de la vérification applicative :

- `SELECT … FOR UPDATE` sur l'employé dans `bc_book_appointment()` : sérialise les
  réservations simultanées pour un même employé ;
- contrainte d'exclusion PostgreSQL `bc_appointments_no_overlap`
  (`tstzrange(starts_at, ends_at) &&`, par salon + employé), active quand l'extension
  `btree_gist` est disponible.

Résultat mesuré sur PostgreSQL réel : **6 requêtes simultanées → 1 succès, 5 × 409**.

## 3.5 Workflow opérationnel

Les étapes restent distinctes et non fusionnées :

| Étape                | Représentation                       |
| -------------------- | ------------------------------------ |
| Rendez-vous planifié | `status = confirmed`                 |
| Client arrivé        | `checked_in`                         |
| Prestation commencée | `in_progress`                        |
| Prestation terminée  | `completed`                          |
| Paiement effectué    | journal `bc_payment_entries` (Lot 4) |
| Caisse clôturée      | Lot 4                                |

Un rendez-vous terminé n'est **jamais** marqué payé automatiquement
(`paymentStatus = 'unpaid'` vérifié par test) et une prestation terminée reste en base
même si aucun paiement n'est enregistré.

## 3.6 Expérience utilisateur

- Création rapide : client (saisie ou existant), prestation, employé (filtré par
  compétence et disponibilité), date/heure.
- Filtres date **et employé** sur le planning, avec réinitialisation.
- Affichage des statuts colorés ; transitions disponibles par le menu de statut
  (annulation/absence demandent un motif).
- **Erreurs visibles** : le message du serveur s'affiche dans le formulaire (`role="alert"`)
  et en toast. Le conteneur de toasts est désormais monté dans l'ERP (il ne l'était pas :
  les erreurs de l'ERP étaient invisibles).
- États : chargement, vide explicite, erreur, succès.
- Responsive : tableaux scrollables et en-têtes empilées sur mobile.

## Base de données

Migration `database/migrations/20261103040000_lot3_operations.sql` :

- `bc_services.is_active`, `bc_services.prep_minutes` ;
- `bc_appointments.client_id / staff_id / service_id / notes / updated_at` + contrainte
  d'exclusion ;
- `bc_staff.email / user_id / branch_id / is_active / service_ids` ;
- `bc_staff_schedules`, `bc_staff_absences`, `bc_branch_hours` (RLS lecture) ;
- fonctions `bc_book_appointment`, `bc_reschedule_appointment`, `bc_cancel_appointment`,
  `bc_set_service_active`, `bc_save_staff_profile`, `bc_save_staff_schedule`,
  `bc_add_staff_absence`, `bc_day_availability`, `is_slot_available`.

### Limites documentées

- `bc_branch_hours` n'a pas encore d'écran de configuration : sans horaires saisis, seuls
  les horaires de l'employé sont contraignants.
- `prep_minutes` est stocké mais pas encore intégré au calcul de fin de créneau.
- Sur la base de test embarquée (PGlite), l'extension `btree_gist` est absente : la
  contrainte d'exclusion n'y est pas créée, la protection reste assurée par le verrou SQL.
- Les paiements restent hors périmètre (Lot 4).

## Tests

`tests/operations-lot3.test.mjs` (7 tests, PGlite) :

| Scénario                                                      | Vérifié |
| ------------------------------------------------------------- | ------- |
| Prix entiers en XOF, refus des décimales                      | ✓       |
| Activation/désactivation d'une prestation                     | ✓       |
| Profil employé sans compte de connexion                       | ✓       |
| Horaires et absences (validations incluses)                   | ✓       |
| Réservation persistée + refus du chevauchement (409)          | ✓       |
| **Trois réservations concurrentes → une seule réussit**       | ✓       |
| Hors horaires / en absence / prestation non maîtrisée refusés | ✓       |
| Transitions contrôlées + historique complet                   | ✓       |
| Annulation motivée, créneau libéré, non payé                  | ✓       |
| Isolation entre deux salons (403)                             | ✓       |

`tests/operations-lot3.pg.test.mjs` (PostgreSQL réel) : contrainte d'exclusion présente et
6 requêtes concurrentes sérialisées (`npm run test:operations:pg` avec `PG_URL`).

## Critères d'acceptation du lot 3

| Critère                                                  | Vérification                                   |
| -------------------------------------------------------- | ---------------------------------------------- |
| Services configurables par salon                         | ✅ API + UI + tests                            |
| Personnel et affectations opérationnels                  | ✅ profil, horaires, absences, compétences     |
| Rendez-vous persistés en base                            | ✅ `bc_appointments`                           |
| Transitions contrôlées                                   | ✅ machine à états SQL, testée                 |
| Historique conservé                                      | ✅ `bc_appointment_events`, aucune suppression |
| Conflits de réservation bloqués côté serveur             | ✅ verrou + contrainte + 409                   |
| Isolation par salon                                      | ✅ permissions + RLS + test                    |
| Calendrier utilisable sur ordinateur, tablette et mobile | ✅ navigateur, captures vérifiées              |

## Commandes

```bash
npm run typecheck
npm run lint
npm test                      # 52 tests
npm run test:operations       # Lot 3 (PGlite)
npm run build
```

## Reste à faire

- Écran de configuration des horaires d'ouverture par succursale.
- Intégrer `prep_minutes` au calcul des créneaux.
- Vue calendrier en grille horaire (aujourd'hui : liste + filtres).
- Passage au **Lot 4** (caisse, encaissements, finances).
