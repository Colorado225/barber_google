# Lot 0 — Analyse de sécurité

Périmètre : modèle d'accès Supabase (RLS, RPC, permissions), surface
publique `anon`, liens clients, pile Express legacy. Sources :
`supabase/migrations/`, `src/lib/permissions.ts`, suites de tests
(`supabase-*`, `security-lot2` legacy), contrôle lecture seule du projet lié.

## 1. Modèle d'identité et de permissions (VÉRIFIÉ)

- Auth : Supabase Auth ; ERP derrière `OnboardingGate`
  (session valide + e-mail vérifié + workspace/membership actif).
- Appartenances : `memberships` (salon) + `branch_memberships`
  (succursale) ; rôles : `owner`, `manager`, `receptionist`, `barber`,
  `cashier`, `accountant` (check SQL).
- Autorisation : fonction unique `private.has_salon_permission(salon,
  permission)` utilisée par RLS et RPC ; miroir frontend dans
  `src/lib/permissions.ts` (affichage uniquement — la décision réelle est
  serveur). Permissions granulaires existantes (extraits) :
  `appointments.read/write`, `clients.read/write`, `catalog.write`,
  `team.write`, `payments.read/record/correct`, `cash.read/open/close`,
  `cash.reconcile`, `expenses.read/manage`, `stock.read/write`,
  `loyalty.read/write`, `members.read/manage`, `reports.read`,
  `salon.read/update`, `branch.create/update`, `services.read`,
  `staff.read`, `dashboard.read`, `display.update`, `subscriptions.read`.
- Écart mineur vs master prompt : la permission s'appelle
  `payments.record` (pas `payments.write`) ; `subscriptions.read` existe
  sans backend (Lot 8). **Pas de rôle administrateur de plateforme**
  (VÉRIFIÉ absent) : toute supervision se fait aujourd'hui via accès
  direct au projet Supabase — à cadrer au Lot 8, hors feuille de route.

## 2. RLS et isolation multi-tenant (VÉRIFIÉ)

- RLS activée sur les 29 tables métier ; 59 policies ; les lectures/écritures
  directes PostgREST du frontend passent par ces policies (clé anon +
  JWT utilisateur).
- Isolation testée en intégration : suites `supabase-operations`,
  `supabase-finance`, `supabase-marketplace`, `supabase-walk-in`,
  `supabase-marketplace-customizer` incluent des scénarios « propriétaire B
  rejeté sur le salon A » (42501) et rejets d'identifiants étrangers
  (prestations/personnel/images/succursale d'un autre salon refusés côté
  serveur dans les RPC d'écriture).
- `SECURITY DEFINER` : `set search_path = ''` présent dans les fonctions
  auditées ; pattern `revoke all … from public, anon; grant execute … to
  authenticated` appliqué aux RPC ERP ; schéma `private` non exposé par
  PostgREST.

## 3. Surface publique `anon` (VÉRIFIÉ)

Exactement **8 fonctions** accordées à `anon`, toutes marketplace et
construisant leurs payloads champ par champ (pas de `select *` métier) :

`marketplace_list_salons`, `marketplace_salon_detail`,
`marketplace_day_availability`, `marketplace_book_appointment`,
`marketplace_get_booking`, `marketplace_booking_by_token`,
`marketplace_cancel_booking`, `marketplace_submit_review`.

- Aucune lecture anonyme directe des tables métier recensée.
- Données personnel exposées : id, nom, rôle, spécialités, service_ids
  (ni téléphone, ni taux de commission — assertion présente dans les tests).
- Réservation publique : protections §MATRICE-ERP-MARKETPLACE
  (idempotence, limite 5/tél/jour, fenêtre temporelle, prix serveur).

## 4. Liens de suivi client (VÉRIFIÉ)

- Jeton `public_cancel_token` = UUID aléatoire (`gen_random_uuid`),
  indexé ; les RPC de suivi/annulation/avis exigent le triplet
  (salon, rendez-vous, jeton). Aucun accès par identifiant seul.
- Le portail (`BookingPortalView`) n'expose ni notes internes ni autres
  clients (payload SQL restreint).
- Limite À VÉRIFIER : pas de mécanisme de révocation/rotation du jeton
  identifié dans les migrations ; un lien fuité reste valide jusqu'à
  annulation/réalisation. Risque jugé faible (portée = 1 RDV, actions
  limitées) ; à documenter comme accepté ou à traiter en Lot 2.

## 5. Paiements et notifications — honnêteté des statuts (VÉRIFIÉ)

- Mobile Money : `payments.status` démarre `pending` ; la confirmation est
  un acte humain tracé (`settled_by`, note obligatoire, événements) —
  aucune prétention de confirmation opérateur automatique. Conforme §17.6.
- Notifications : statuts distingués (créée/pending/envoyée/échouée/
  `skipped: provider_not_configured`) avec identifiant fournisseur stocké ;
  l'Edge ne renvoie `ok` qu'après réponse 2xx du fournisseur (Resend/Meta).
  Sur le projet lié, **les secrets fournisseurs sont absents** ⇒ envois
  réels impossibles aujourd'hui (F2) mais **aucun faux « envoyé »**.

## 6. Pile Express legacy (VÉRIFIÉ)

- Le frontend n'appelle **aucune** route Express ; `server/` possède sa
  propre auth (sessions, hachage, rate-limit) et son schéma
  (`database/migrations/`). Si ce serveur était déployé quelque part, il
  constituerait une **seconde surface d'authentification** sur une autre
  base — À VÉRIFIER : confirmer qu'aucun déploiement de `server/index.js`
  n'est actif en production. Recommandation Lot 2 : geler puis retirer la
  pile (code + schéma + tests legacy) après inventaire des contrats, ou la
  marquer explicitement « archive » si elle doit rester pour l'historique.
- `compose.yaml` : PostgreSQL local de dev uniquement (mot de passe via
  `.env` requis, port lié à 127.0.0.1) — pas un risque de prod.

## 7. Autres points

- Clés navigateur : `VITE_SUPABASE_ANON_KEY` uniquement (`src/lib/supabase.ts`) ;
  aucune clé `service_role` dans `src/` (grep négatif).
- Vitrine marketplace : aucune injection HTML/CSS/JS possible par le
  propriétaire (validation serveur stricte, couleur hex, listes blanches).
- Stockage navigateur : `localStorage` limité aux ids salon/succursale
  actifs et aux jetons de réservation du client (`bookingVault`) —
  pas de données métier sensibles persistées hors session Supabase.
- CI : `permissions: contents: read`, `npm ci` reproductible.

## 8. Risques résiduels priorisés

| # | Risque | Niveau | Traitement prévu |
| --- | --- | --- | --- |
| S1 | Divergence schéma lié ↔ migrations (objets créés hors CLI, RPC manquante) : état réel de prod partiellement hors historique | Élevé | Lot 1 : `db push` de régularisation + vérification catalogues |
| S2 | Serveur Express possiblement déployé (double auth/base) | Moyen (À VÉRIFIER) | Lot 2 : confirmation + gel/retrait |
| S3 | Jeton de suivi non révocable | Faible | Lot 2 : décision documentée (accepter ou rotation) |
| S4 | `btree_gist` non confirmé sur le projet lié (garantie dure anti-double-réservation) | Moyen | Lot 2/4 : contrôle lecture seule + test de concurrence réel |
| S5 | Secrets fournisseurs absents ⇒ clients non notifiés (lien de suivi affiché une seule fois) | Moyen (métier) | Lot 4 : activation Resend/WhatsApp + preuve d'envoi |
| S6 | Pas d'admin plateforme : support/modération par accès direct base | Faible (actuel) | Lot 8 (hors feuille de route) |

**Conclusion sécurité Lot 0** : les fondamentaux (RLS, permissions
serveur, surface anon minimale, jetons, honnêteté des statuts) sont en
place et testés. Les risques majeurs sont des risques **d'exploitation**
(S1, S2, S4, S5), pas des failles de conception identifiées.
