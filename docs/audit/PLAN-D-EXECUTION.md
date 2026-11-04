# Lot 0 — Plan d'exécution Lots 1 à 4

Dérivé uniquement des constats **vérifiés** de l'audit (voir
`ETAT-DES-LIEUX.md`). Principe : aucun lot ne réimplémente ce qui marche ;
chaque item cite fichiers, migrations, tests et critères d'acceptation.
Ordre d'exécution : Lot 1 → 2 → 3 → 4, avec rapport et validation à
chaque fin de lot (§18 du master prompt). Arrêt après le Lot 4.

## Pré-requis humain (bloquant, avant Lot 1 code)

| Action                                                                              | Qui                    | Pourquoi                                                                                                                                |
| ----------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run supabase:db:linked:push` sur le projet lié                                 | Exploitant (poste lié) | Régularise F1/S1 : crée `publish_marketplace_customizer`, enregistre l'historique `…140000/…140100` (migrations idempotentes vérifiées) |
| Confirmer l'hébergement frontend réel + aucun `server/` Express déployé             | Exploitant             | F10/S2                                                                                                                                  |
| Décider jeton de suivi (accepter non-révocable ou rotation)                         | Produit                | S3                                                                                                                                      |
| Comptes fournisseurs notifications (Resend et/ou WhatsApp Meta + modèles approuvés) | Exploitant             | F2/S5 (Lot 4)                                                                                                                           |

## Lot 1 — Stabilisation technique

Objectif : base fiable, zéro dette bloquante, avant tout fonctionnel.

1. **Régularisation schéma (avec l'exploitant)** — après le `db push` :
   vérifier par lecture catalogues que base liée = migrations
   (fonctions, tables, contrainte d'exclusion `btree_gist` — F9/S4).
   Critère : `migration list` local = distant ; inventaire signé dans le
   rapport Lot 1.
2. **Format** — décider : soit appliquer Prettier en un commit dédié
   (131 fichiers, aucun changement logique) puis ajouter `format:check`
   à la CI, soit retirer le script. Recommandation : commit dédié.
   Fichiers : tout le dépôt (commit isolé) + `.github/workflows/ci.yml`.
3. **TypeScript** — étude d'impact `strict` (compter les erreurs sur une
   branche d'essai) ; activer d'abord `noUncheckedIndexedAccess` **si**
   le coût est faible, sinon planifier. Réduire les 13 `any` restants
   quand ils touchent aux contrats API. Ne pas lancer de campagne massive.
4. **`AppContext` / `api.ts`** — pas de réécriture ; extractions ciblées
   uniquement si un item des Lots 3/4 l'exige (ex. refresh ciblé inbox).
   Documenter les règles de rechargement actuelles dans le rapport.
5. **Tests** — `tests/operations-lot3.pg.test.mjs` (2 ignorés) : décider
   CI avec service PostgreSQL ou maintien PGlite seul ; documenter.
   Aucun test désactivé.
6. **Legacy Express — gel** : marquer `server/` + `database/migrations/`
   comme archivés (README dans `server/`), retirer le script `dev:auth`
   des usages documentés ; **conserver** les tests legacy en CI tant que
   la décision Lot 2 (retrait) n'est pas prise.

Critères de validation Lot 1 : typecheck/lint/tests/build verts ;
format tranché ; schéma lié = migrations (preuve) ; rapport Lot 1.

## Lot 2 — Authentification, sécurité, multi-tenant

Objectif : prouver l'isolation et fermer les risques d'exploitation.

1. **Matrice rôles/permissions officielle** — publier la table complète
   (depuis `private.has_salon_permission` version `…100300` +
   `src/lib/permissions.ts`) dans `docs/` ; corriger toute divergence
   front/serveur détectée par test de parité (étendre
   `tests/permissions.test.ts`).
2. **Suite de sécurité Supabase dédiée** (`database/tests/`) : accès anon
   (seules les 8 RPC publiques), employé sans permission, cross-salon sur
   chaque domaine (clients, RDV, paiements, dépenses, notifications,
   rapports), jeton client invalide/forgé, RPC directe sur prestation
   inactive. Une partie existe déjà dans les suites métier — factoriser
   sans dupliquer.
3. **Pile Express** : après confirmation « non déployée », retirer
   `server/`, `database/migrations/`, `compose.yaml` et leurs tests
   (ou déplacer en `archive/` hors CI) — commit dédié, justification :
   contrats intégralement remplacés par Supabase (44/44 RPC frontales
   définies, 0 appel `/api/`). Conserver l'historique Git comme archive.
4. **Jeton de suivi** : appliquer la décision produit (S3). Si rotation :
   migration additive (nouveau jeton à la demande via RPC authentifiée
   salon) + tests.
5. **Concurrence réelle** : test de double réservation simultanée contre
   PostgreSQL réel (pas PGlite) si un environnement de test est
   disponible ; sinon, preuve par contrainte + test PGlite existant,
   limite documentée.

Critères de validation Lot 2 : suite sécurité verte ; matrice publiée ;
décision Express exécutée ; rapport Lot 2.

## Lot 3 — Cœur opérationnel ERP (écarts uniquement)

L'audit établit que planning, prestations, personnel, walk-in, CRM,
caisse et fidélité sont **déjà connectés et testés**. Items restants :

1. **Définitions d'indicateurs du dashboard** — documenter chaque KPI
   (CA encaissé = paiements `confirmed` nets des refunds via
   `payment_signed_amount`, clients reçus = RDV `completed`, etc.),
   aligner `DashboardView`/`analytics.ts` sur ces définitions, ajouter
   des tests unitaires d'agrégation. Fichiers : `src/lib/analytics.ts`,
   `src/components/erp/DashboardView.tsx`. Retirer le commentaire
   « badge de démonstration » obsolète.
2. **Section « actions à effectuer »** du dashboard (demandes en attente,
   paiements à vérifier = `payments pending`, stock bas déjà présent).
3. **Scénario §9.8 de bout en bout** : l'automatiser en test d'intégration
   (PGlite) s'il n'est pas déjà couvert tel quel par
   `supabase-client-journey` — compléter les étapes manquantes
   (dashboard après encaissement = solde/CRM vérifiés par requêtes).
4. **Inbox** : pré-requis Lot 4 — voir item Lot 4.2 (regroupé là-bas).
5. **Frais/justificatifs, paiements partiels avancés** : déjà couverts par
   le journal (solde par écritures) ; justificatifs fichiers = Lot 5
   (hors feuille de route) — ne pas commencer.

Critères de validation Lot 3 : scénario §9.8 prouvé par test ;
définitions KPI documentées et testées ; rapport Lot 3.

## Lot 4 — Connexion ERP–Marketplace (finalisation et preuve en réel)

Les contrats existent (voir MATRICE-ERP-MARKETPLACE) ; il s'agit de
fermer les écarts et de prouver A–J sur l'environnement réel.

1. **Vitrine** : après régularisation (Lot 1.1), tester le parcours
   complet propriétaire (brouillon → publier → page publique →
   dépublier) sur le projet lié avec un salon de démonstration dédié.
   Critère : preuves consignées (requêtes + captures horodatées).
2. **Inbox complète** (`OnlineRequestsView`) : ajouter « Proposer un
   nouveau créneau » (`reschedule_appointment`) et « Réaffecter l'employé »
   (transition/reasign existants côté planning — réutiliser, pas dupliquer),
   motif de refus transmis à `cancel_appointment`, lien fiche client.
   Tests UI + intégration.
3. **Réponse du salon aux avis** : migration additive
   (`reviews.salon_reply`, `reply_at` ou table dédiée — trancher au Lot 4),
   RPC avec permission, affichage public (déjà prévu conditionnellement
   dans `SalonReviewsSection`), tests PG + UI.
4. **Notifications réelles** : injecter les secrets (Resend prioritaire —
   coût/complexité moindre ; WhatsApp = modèles Meta approuvés),
   déployer l'Edge si modifiée, envoyer une notification réelle de test,
   vérifier `provider_id` et statut. Critère §10.11 : aucune mention
   « envoyé » sans acceptation fournisseur (déjà le comportement).
5. **Fraîcheur des écrans** : rafraîchissement ciblé à la reprise de
   focus + après actions inbox/planning (pas de Realtime à ce stade) ;
   mesurer avant d'envisager plus (§10.13).
6. **Preuve A–J en réel** : exécuter les 10 scénarios du §10.14 sur le
   projet lié (salon de test), résultats exacts dans le rapport Lot 4.

Critères de validation Lot 4 : scénarios A–J réussis **avec preuves** ;
F (avis) complet une fois le canal actif ; rapport Lot 4 + bilan global
de la feuille de route ; **arrêt** (Lots 5–9 non commencés).

## Hors périmètre confirmé

- Abonnements/admin plateforme (Lot 8), stocks avancés (Lot 7),
  campagnes CRM (Lot 6), intégrations Mobile Money marchandes (Lot 5) :
  **documentés, non démarrés**.
- Aucune migration de framework, aucune seconde base, aucune modification
  de migration déjà appliquée sur le projet lié (les deux migrations
  vitrines, jamais enregistrées, ont déjà été rendues idempotentes —
  voir `docs/LOT-4.2-VITRINES-MARKETPLACE.md`).

## Risques du plan

| Risque                                                         | Atténuation                                                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `db push` non exécuté → Lots 1/4 bloqués sur la preuve en réel | Pré-requis humain explicite ; le code et les tests peuvent avancer, la validation « réel » attend le push |
| Commit Prettier massif polluant l'historique                   | Commit isolé, aucun mélange fonctionnel                                                                   |
| Retrait Express révélant un consommateur inconnu               | Gel + archivage d'abord (Lot 1), retrait seulement au Lot 2 après confirmation d'exploitation             |
| Modèles WhatsApp Meta : délais d'approbation externes          | Resend (e-mail) en premier canal ; WhatsApp ensuite                                                       |
