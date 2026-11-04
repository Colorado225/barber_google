# Rapport Lot 5 — Parité opérationnelle Supabase

> Statut : **terminé et vérifié** (typecheck, lint, 16 tests Supabase PGlite, 5 tests React, build, migrations appliquées au distant).
> Référence : `docs/AMELIORATIONS.md` § 2, « LOT 5 — Parité opérationnelle Supabase ».
> Date : 4 novembre 2026. Projet Supabase : `barber_google` (`rozsykrjrncbupzmauzj`, eu-west-3).

## Objectif

Rendre l'ERP utilisable au quotidien en migrant vers Supabase le cœur opérationnel
qui renvoyait encore des erreurs 501 (`SUPABASE_OPERATION_NOT_MIGRATED`) :
rendez-vous complets, horaires/absences du personnel, avis publics. La logique
éprouvée de l'ancien backend Express (`bc_*`) a été **portée**, pas réinventée.

## 5.1 Rendez-vous complets — Vérifié

Nouvelles migrations `20261104090100_appointment_operations.sql` :

| Élément                           | Détail                                                                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public.appointment_events`       | Journal **append-only** des statuts (previous/new, motif, acteur). Aucune écriture directe accordée ; lecture par `appointments.read`.                                                                                                                                   |
| `private.is_slot_available()`     | Source de vérité unique : horaires succursale (`branch_hours`) + horaires/absences staff + chevauchements, dans le fuseau de la succursale (`Africa/Abidjan` par défaut).                                                                                                |
| `public.create_appointment()`     | Création atomique : vérifie permission, prestation active, compétence du staff, disponibilité ; calcule `ends_at` et `amount` depuis la prestation ; « sans préférence » → affectation automatique d'un staff compétent et libre ; client existant ou client de passage. |
| `public.reschedule_appointment()` | Déplacement/réaffectation avec re-vérification de disponibilité en excluant le RDV courant ; fin et montant **toujours recalculés côté serveur** ; refuse les RDV clos.                                                                                                  |
| `public.transition_appointment()` | Machine à états stricte (`pending→confirmed→checked_in→in_progress→completed`, annulation/absence avec motif obligatoire) + événement d'audit.                                                                                                                           |
| `public.cancel_appointment()`     | Annulation avec motif ; **aucune suppression physique**, l'historique reste.                                                                                                                                                                                             |
| `public.day_availability()`       | Créneaux 08:00→19:00 par staff, fenêtre = durée de la prestation (ou 30 min), contrôlés par `is_slot_available`.                                                                                                                                                         |
| Anti-chevauchement                | Verrou `FOR UPDATE` par employé **+ contrainte d'exclusion `btree_gist`** (active sur le distant, vérifiée).                                                                                                                                                             |

Toutes les fonctions sont `SECURITY DEFINER`, `search_path = ''`, avec
`revoke … from public, anon` et `grant execute … to authenticated`. Aucun
`INSERT/UPDATE/DELETE` direct sur `appointments` n'est accordé au client.

**Frontend branché** (`src/lib/api.ts`, `src/context/AppContext.tsx`) :
`bookAppointment`, `updateAppointment`, `updateAppointmentDetails`,
`updateAppointmentStatus`, `cancelAppointment`, `deleteAppointment` (= annulation)
appellent les RPC. `NewAppointmentModal` charge les disponibilités réelles selon
la prestation choisie et transmet la source proprement.

**Alignement UI / machine à états** : l'UI proposait des transitions invalides
(ex. `confirmed → completed`). Nouveau module partagé
`src/lib/appointment-workflow.ts` ; `PlanningView` (bouton « étape suivante ») et
`AppointmentsCalendarView` (menu de statut + boutons « faire progresser ») ne
proposent/désactivent que les transitions autorisées par le serveur.

## 5.2 Horaires & absences du personnel — Vérifié

Migration `20261104090000_staff_schedules.sql` : tables `staff_schedules`
(plages hebdomadaires, `unique(staff_id, weekday, starts_at)`) et `staff_absences`
(périodes + motif), RLS lecture `staff.read` / écriture `team.write`.
`StaffSchedulePanel` est désormais fonctionnel (lecture, ajout, suppression).
Ces tables alimentent `is_slot_available` (prérequis de 5.1).

## 5.3 Avis publics vérifiés & modération — Vérifié

Migration `20261104090200_review_moderation.sql` :

- `reviews.appointment_id` + index unique partiel → **un avis par rendez-vous**.
- `public.create_review()` : tout utilisateur authentifié peut laisser un avis ;
  il n'est `verified = true` que s'il est lié à un rendez-vous **terminé** du
  salon (client repris du RDV). Sinon `verified = false`.
- `public.delete_review()` : suppression réservée à la nouvelle permission
  `reviews.moderate` (owner/manager), ajoutée via `create or replace` de
  `private.has_salon_permission` (les migrations appliquées restent immuables).

## 5.4 Retrait d'Express — Reporté (décision documentée)

Le retrait du backend Express (`server/`, lignée `database/migrations/bc_*`) est
**reporté au Lot 6**, pour deux raisons :

1. La lignée `bc_*` porte encore la logique finance/caisse (`bc_cash_sessions`,
   `bc_payment_entries`) qui sert de référence au portage du Lot 6. La supprimer
   maintenant ferait perdre cette référence avant son portage.
2. Conformément à `docs/MISEAJOUR.md` (« Décision de plateforme »), Express reste
   tant que **tous** les contrats métier ne sont pas migrés, testés et basculés.
   Les contrats finance ne le sont pas encore.

**Constat préexistant (non causé par le Lot 5)** : les tests PGlite de la lignée
Express (`tenant`, `workflow`, `resources`, `api`, `auth`, `operations-lot3`)
échouent déjà sur le commit de base — ils n'appliquent que 2 migrations alors que
`bc_create_salon` référence `bc_staff` (créé plus tard). Vérifié par `git stash`
avant/après : échec identique sans les changements du Lot 5. `npm test` (global)
reste donc rouge à cause de cette dette ; les tests Supabase et React, eux,
passent. Cette lignée sera supprimée avec le Lot 6.

## Vérifications exécutées

| Vérification                                                                            | Résultat                                              |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `npm run typecheck`                                                                     | ✅ sans erreur                                        |
| `npm run lint`                                                                          | ✅ sans erreur                                        |
| Tests Supabase PGlite (`supabase-core`, `supabase-branch-hours`, `supabase-operations`) | ✅ 16/16                                              |
| Tests React (`marketplace-navigation`, `business-onboarding`)                           | ✅ 5/5                                                |
| `npm run build`                                                                         | ✅ (avertissement bundle > 500 kB préexistant, L1-10) |
| Migrations appliquées au distant + journal `schema_migrations`                          | ✅ 5 versions alignées sur les fichiers locaux        |
| Contrainte d'exclusion `appointments_no_overlap` + `btree_gist` sur le distant          | ✅ présentes                                          |

Les 10 tests `supabase-operations` couvrent : isolation RLS inter-salons,
permissions par rôle, création walk-in/auto-affectation, refus chevauchement /
hors horaires / absence / prestation inactive, machine à états + motifs + audit
append-only, reschedule (recalcul de fin, refus créneau pris et RDV clos),
disponibilités (horaires, durée de prestation, contrôle d'accès), avis vérifiés

- anti-doublon + modération.

## État distant après le lot

- `public` : **19 tables** (16 + `staff_schedules`, `staff_absences`, `appointment_events`), toutes RLS.
- **7 nouvelles RPC** : `create_appointment`, `reschedule_appointment`,
  `transition_appointment`, `cancel_appointment`, `day_availability`,
  `create_review`, `delete_review` (+ `private.is_slot_available`).
- `reviews.moderate` ajouté au modèle de permissions.
- Journal `supabase_migrations.schema_migrations` :
  `20261103160000 / supabase_core`, `20261103170000 / branch_hours`,
  `20261104090000 / staff_schedules`, `20261104090100 / appointment_operations`,
  `20261104090200 / review_moderation`.

## Limites et suite

- Le règlement à la réservation (`paymentMethod`) n'est pas persisté : il sera
  enregistré en caisse au **Lot 6** (la réservation reste `unpaid`).
- La lecture publique des salons/avis pour la marketplace anonyme relève du
  **Lot 7** (aujourd'hui lecture membre uniquement).
- Prochaine étape recommandée : **Lot 6 — Caisse & finances**, puis retrait
  d'Express (5.4) une fois la finance portées.
