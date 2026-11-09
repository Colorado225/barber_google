# Clients de passage — service sans rendez-vous

**Date :** 4 novembre 2026
**Projet Supabase :** `rozsykrjrncbupzmauzj`
**Branche :** `arena/65268ae8-barber-google`
**Statut :** ✅ implémenté, testé, appliqué au distant.

## 1. Problème corrigé

L’ERP était trop centré sur la réservation : pour coiffer une personne arrivée
directement au salon, il fallait créer un « rendez-vous » avec date/heure et
créneau disponible. Ce n’est pas le fonctionnement réel d’un salon : beaucoup de
clients entrent, demandent une coupe, attendent éventuellement, sont coiffés,
puis paient. **[Vérifié]** : `NewAppointmentModal` et `create_appointment`
exigeaient un créneau futur et un téléphone ; aucune file d’attente n’existait.

## 2. Nouveau parcours

Un onglet et un bouton **« Sans rendez-vous / Client de passage »** permettent :

1. **Accueillir** le client maintenant, sans créneau futur.
   - Nom et téléphone **optionnels** (« Client de passage » par défaut).
   - Possibilité de lier un client CRM existant.
   - Choix de la prestation et du coiffeur (ou « premier disponible »).
2. **Démarrer immédiatement** si un coiffeur compétent est libre, ou **mettre en
   attente** dans la file.
3. **Suivre** : file d’attente, prestations au fauteuil, temps d’attente / temps
   de service, prestations terminées.
4. **Terminer** la prestation, puis **encaisser** via la caisse existante
   (espèces, Wave, Orange Money, MTN, Moov, carte). Le paiement reste lié au
   passage et au journal immuable du Lot 6.

## 3. Backend — migration `20261104120000_walk_in_services.sql`

Appliquée au distant dans une transaction, enregistrée dans
`supabase_migrations.schema_migrations`. **[Vérifié]**

- `appointments.source` accepte désormais `walk_in`.
- Colonnes : `arrival_at`, `service_started_at`, `service_completed_at`,
  `walk_in_idempotency_key` (index unique partiel par salon).
- RPC `appointments.write` uniquement, `security definer`, historique
  `appointment_events` append-only :
  - `register_walk_in(...)` : accueil, idempotent, statut `checked_in` (attente)
    ou `in_progress` (démarrage immédiat).
  - `start_walk_in(...)` : démarrage depuis la file, réaffectation possible du
    coiffeur, fenêtre réelle recalculée.
  - `complete_walk_in(...)` : fin de prestation, horodatage réel.
- **Anti-double service** : un même coiffeur ne peut pas avoir deux prestations
  actives qui se chevauchent. La contrainte d’exclusion et
  `private.is_slot_available` excluent désormais aussi `completed` : une
  prestation terminée ne bloque plus le coiffeur. **[Vérifié par test]**
- L’encaissement réutilise `record_payment` / le journal de caisse ; aucun
  nouveau chemin de paiement n’est introduit.

### Sécurité

- `authenticated` avec `appointments.write` peut accueillir/démarrer/terminer.
- `anon` n’a **aucun** droit sur ces RPC. **[Vérifié]**
- Isolation multi-tenant : un salon ne peut pas agir sur les passages d’un
  autre. **[Vérifié par test]**

## 4. Frontend

- `src/components/erp/WalkInModal.tsx` : accueil comptoir.
- `src/components/erp/WalkInView.tsx` : file d’attente / en cours / terminés,
  actions Démarrer, Terminer, Encaisser, Annuler.
- `ErpLayout` : onglet `sans-rendez-vous`, bouton global « + Client de passage ».
- `DashboardView` : raccourci comptoir.
- `PlanningView` : badge « Sans RDV », filtre par type, actions adaptées.
- `NewPaymentModal` : libellé et sélection incluent les passages ; correction de
  la dépendance `getAppointmentBalance` (évite une boucle d’effet).
- `AppContext` / `api.ts` / `types` : `registerWalkIn`, `startWalkIn`,
  `completeWalkIn`, horodatages réels.

## 5. Validation

- `npm run test:supabase` : **37/37** (dont 5 tests clients de passage :
  accueil anonyme idempotent, démarrage/fin/paiement caisse, file d’attente et
  conflit coiffeur, lien CRM, isolation tenant, service inactif refusé).
  **[Vérifié]**
- `npm run typecheck` ✓, `npm run lint` ✓, `npm run build` ✓. **[Vérifié]**
- Tests React ciblés (navigation marketplace, onboarding) : 5/5. **[Vérifié]**
- Aperçu `/app/sans-rendez-vous` : HTTP 200. **[Vérifié]**

## 6. État distant vérifié

- **13 migrations** dans le journal.
- 4 colonnes walk-in présentes ; 3 RPC `register_walk_in`, `start_walk_in`,
  `complete_walk_in`.
- `appointments_source_check` inclut `walk_in`.
- Contrainte d’exclusion mise à jour (statuts actifs uniquement).
- Grant `authenticated` = true, `anon` = false sur `register_walk_in`.

## 7. Limites / suites possibles

- Un passage = une prestation. Pour plusieurs prestations, créer plusieurs
  passages ou faire évoluer vers un ticket multi-lignes (hors périmètre actuel).
- Pas de notification automatique au client de passage (téléphone optionnel) ;
  l’outbox du Lot 7 peut être étendue plus tard.
- La file d’attente est temps réel côté base ; l’UI se rafraîchit au chargement
  et après chaque action. Un canal realtime Supabase pourrait être ajouté pour
  un affichage multi-postes instantané.
