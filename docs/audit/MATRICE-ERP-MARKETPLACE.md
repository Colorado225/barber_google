# Lot 0 — Matrice de connexion ERP ↔ Marketplace

Vérification des contrats du Lot 4 du master prompt **tels qu'ils existent
déjà**. Preuves : migrations `supabase/migrations/`, suites PGlite
`supabase-marketplace` (7), `supabase-client-journey` (9),
`supabase-operations` (10), `supabase-marketplace-customizer` (12) —
toutes vertes le 2026-11-04.

## 1. Source de vérité commune — VÉRIFIÉ

| Donnée                                 | Source unique                                                  | Consommation marketplace                                                                               |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Salon, succursales                     | `salons`, `branches`                                           | `marketplace_list_salons`, `marketplace_salon_detail`                                                  |
| Prestations, prix, durées, préparation | `services` (bigint XOF)                                        | détail public en temps réel ; prix recalculé et **snapshoté** à la réservation (`appointments.amount`) |
| Personnel public                       | `staff` (actif + disponible + sélection publiée de la vitrine) | champs restreints (id, nom, rôle, spécialités, service_ids)                                            |
| Horaires / absences                    | `branch_hours`, `staff_schedules`, `staff_absences`            | moteur commun `private.is_slot_available`                                                              |
| Rendez-vous                            | `appointments` (+ `appointment_events` append-only)            | création directe par RPC, `source='marketplace'`                                                       |
| Clients                                | `clients` (auto-link téléphone normalisé CI)                   | `private.ensure_client_for_contact`                                                                    |
| Avis                                   | `reviews` (verified)                                           | note publique = moyenne des avis vérifiés                                                              |

Aucune table « marketplace » dupliquée. **Conforme §10.1.**

## 2. Critères d'acceptation du Lot 4 — état audité

| Scénario                                                     | État                                   | Preuve / écart                                                                                                                                                   |
| ------------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Prestation ERP → fiche publique (prix/durée)             | ✅ VÉRIFIÉ                             | `supabase-marketplace` + synchro tarifaire temps réel testée (`supabase-marketplace-customizer`)                                                                 |
| B — Employé indisponible → créneaux masqués                  | ✅ VÉRIFIÉ                             | `is_slot_available` (absences) partagé ; `supabase-operations`, journey                                                                                          |
| C — Réservation publique → RDV dans l'ERP sans ressaisie     | ✅ VÉRIFIÉ                             | `marketplace_book_appointment` atomique ; journey de bout en bout                                                                                                |
| D — Confirmation ERP → même statut côté client               | ✅ VÉRIFIÉ                             | `transition_appointment` + `marketplace_booking_by_token`/`get_booking` lisent la même table                                                                     |
| E — Annulation client → planning à jour, historique conservé | ✅ VÉRIFIÉ                             | `marketplace_cancel_booking` (jeton), `appointment_events`                                                                                                       |
| F — RDV terminé → historique client + invitation avis        | ⚠️ PARTIEL                             | Avis vérifié possible via jeton (`marketplace_submit_review`) ; **l'invitation par notification ne part pas** (fournisseurs non configurés, F2)                  |
| G — Paiement confirmé → journal financier                    | ✅ VÉRIFIÉ                             | `record_payment`/`confirm_pending_payment` ; le non-espèces reste `pending` tant qu'un humain ne confirme pas (conforme §9.7/§17.6)                              |
| H — Concurrence (2 résas même créneau)                       | ✅ en intégration / ⚠️ prod À VÉRIFIER | Testé sous PGlite via `is_slot_available` ; en production s'y ajoute la contrainte d'exclusion `btree_gist` **si** l'extension est active sur le projet lié (F9) |
| I — Isolation inter-salons                                   | ✅ VÉRIFIÉ                             | `has_salon_permission` + RLS ; tests d'isolation dans operations/finance/marketplace/customizer                                                                  |
| J — Panne notification ≠ perte de réservation                | ✅ VÉRIFIÉ                             | File persistante découplée (`appointment_notifications`), statuts honnêtes (`skipped: provider_not_configured`), retry via `claim_due_notifications` + pg_cron   |

## 3. Détails des contrats vérifiés

- **Réservation** (`20261104110100`) : salon publié exigé ; service actif
  exigé (appel RPC direct sur prestation inactive → `22023`) ; fenêtre
  [now+5 min, +60 jours] ; anti-abus 5/téléphone/jour/salon ; idempotence
  (`public_idempotency_key`, index unique partiel) ; jeton de suivi =
  `public_cancel_token` (UUID, jamais l'id seul) ; prix/durée serveur ;
  durée = prestation + `prep_minutes` ; statut initial `pending`.
- **Disponibilités** : `marketplace_day_availability` et `day_availability`
  (ERP) s'appuient sur le même `private.is_slot_available` ; le frontend
  marketplace ne recalcule aucun créneau.
- **Inbox** : écran présent, filtre `source='marketplace'`, transitions via
  les RPC communes (pas de table séparée). Écart : pas de « proposer un
  créneau » ni « réaffecter » dans l'inbox (possible via planning).
- **Suivi client** : `/reservation/:token` (BookingPortalView) +
  `/mes-reservations` (jetons conservés localement, `bookingVault.ts`) ;
  annulation et avis par jeton ; aucune donnée interne exposée (payload
  construit champ par champ côté SQL).
- **Publication salon** : critères serveur identiques ERP et customizer
  (≥1 prestation active, adresse, téléphone, couverture) ;
  `is_published=false` ⇒ détail public en erreur `22023` et réservation
  impossible.
- **Vitrine personnalisée** : configuration publiée uniquement exposée
  (brouillon jamais public) ; **mais RPC de publication absente de la base
  liée (F1)** → le parcours « Publier » est le seul maillon cassé en réel.

## 4. Écarts résiduels à traiter (Lots 1–4)

1. **F1 (critique)** : appliquer proprement les migrations vitrines sur le
   projet lié (`db push`) puis vérifier les 7 fonctions + historique.
2. **F2 (élevée)** : configurer au moins un fournisseur (Resend ou WhatsApp
   Meta) : secrets + modèles WhatsApp approuvés ; tester un envoi réel et
   tracer l'identifiant fournisseur. Sans cela, F reste partiel.
3. **F9 (élevée si négatif)** : confirmer `btree_gist` + contrainte
   d'exclusion sur le projet lié (lecture seule) ; à défaut, documenter que
   la garantie repose sur `is_slot_available` transactionnel.
4. **Inbox** : ajouter proposition de créneau (reschedule) et réaffectation
   d'employé dans `OnlineRequestsView` (RPC existantes :
   `reschedule_appointment`, transitions).
5. **Avis** : réponse du salon (colonne + RPC + affichage public déjà prévu
   conditionnellement dans `SalonReviewsSection`).
6. **Fraîcheur des écrans** : pas de Realtime ; prévoir rafraîchissement
   ciblé (focus/polling léger inbox + planning) avant d'envisager Realtime
   (§10.13 : ne pas complexifier sans besoin).
7. **Visibilité par prestation** : aujourd'hui « actif = public » ; un flag
   dédié n'existe pas (décision produit à confirmer avant d'ajouter une
   colonne — non bloquant).

## 5. Conclusion

La connexion ERP–Marketplace demandée par le Lot 4 est **déjà implémentée
et testée en intégration** dans ses contrats essentiels. Le Lot 4 de cette
feuille de route consistera à : (a) régulariser le déploiement (F1/F9),
(b) activer un canal de notification réel (F2), (c) combler inbox/avis
(§4.4–4.5), (d) re-prouver les scénarios A–J **sur l'environnement réel**
après déploiement, avec preuves consignées.
