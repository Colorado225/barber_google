# Lot 6 — Caisse & finances (Supabase)

> Date : 4 novembre 2026. Branche `arena/65268ae8-barber-google`.
> Projet distant : `barber_google` / ref `rozsykrjrncbupzmauzj`.
> Statut : **implémenté, testé localement (PGlite), appliqué et vérifié sur le distant**.
> Gouvernance : `docs/MISEAJOUR.md` § 3.2 — montants XOF entiers (`bigint`),
> fuseau `Africa/Abidjan`, faits vérifiés par lecture du code et requêtes SQL.

## 1. Périmètre livré

| Réf. | Exigence | État |
| --- | --- | --- |
| 6.1 | Sessions de caisse (`cash_registers`, `cash_sessions`), fond de caisse, clôture, écart, rapprochement, RLS, remplacement du stub `CashRegisterView` | ✅ |
| 6.2 | Paiements (`payments`) liés au rendez-vous, méthode, XOF entier, `payment_status` mis à jour atomiquement, branchement `NewPaymentModal` / `TodayView` / dashboard | ✅ |
| 6.3 | Espèces + Wave / Orange Money / MTN MoMo / Moov Money (+ carte) avec référence opérateur ; **confirmation manuelle**, pas d'appel API opérateur | ✅ (preuve manuelle) |
| 6.4 | Remboursements / annulations avec motif, journal append-only, rapports caisse/dépenses (`ReportsView`, `financial_summary`) | ✅ |

Hors périmètre volontaire : intégration API réelle des opérateurs Mobile Money
(accès marchand non vérifié), retrait du backend Express (conditionné à la
migration de **tous** les contrats legacy), édition/suppression avancée des
dépenses (Lot 8), fidélité points (Lot 8).

## 2. Migrations canoniques appliquées

Toutes dans `supabase/migrations/`, appliquées au distant via le connecteur
Supabase dans une transaction, puis enregistrées dans
`supabase_migrations.schema_migrations` avec la même version que le fichier local.

| Version | Fichier | Contenu |
| --- | --- | --- |
| `20261104100000` | `finance_foundation.sql` | Carte de permissions financières, `cash_registers`, `cash_sessions`, RLS lecture, trigger d'immuabilité des sessions, `ensure_default_register`, `open_cash_session` |
| `20261104100100` | `payment_journal.sql` | `payments`, `payment_events`, triggers append-only, helpers privés, `record_payment`, `record_payment_correction`, `confirm_pending_payment`, `reject_pending_payment`, `close_cash_session`, `reconcile_cash_session`, `get_cash_session`, `list_cash_sessions` |
| `20261104100200` | `finance_reporting.sql` | `list_payments`, `get_appointment_balance`, `financial_summary`, `record_expense`, `expenses.created_by` serveur, contrainte `expenses_currency_xof` |
| `20261104100300` | `finance_permissions_fix.sql` | Correctif : rétablit `reviews.moderate` (Lot 5) après la refonte de la carte de permissions |

> Note d'immuabilité : la migration `100000` a été appliquée avant que l'omission
> de `reviews.moderate` soit détectée. Conformément à la règle « une migration
> appliquée est immuable », le correctif est un **nouveau** fichier `100300`,
> pas une réécriture de `100000`. Un test de non-régression couvre ce cas.

## 3. Modèle et invariants financiers

### 3.1 Caisse

- `cash_registers` : une caisse par succursale (`unique (branch_id)`), créée à la
  demande par `ensure_default_register` (« Caisse principale »).
- `cash_sessions` : `open → closed → reconciled`. Index unique partiel
  `cash_sessions_one_open_per_register` : **une seule session ouverte par caisse**.
- Fond de caisse (`opening_balance`) entier ≥ 0. À la clôture :
  `expected_balance = fond + Σ écritures espèces confirmées de la session`,
  `counted_balance` saisi, `difference = counted − expected`.
- Le solde théorique est **recalculé depuis le journal**, jamais stocké comme
  source de vérité pendant la session.
- Trigger `cash_sessions_protect` : suppression interdite ; seules les transitions
  contrôlées sont permises, sans réécrire le fond de caisse ni l'identité de la
  session. Le rapprochement (`cash.reconcile`, propriétaire uniquement) exige une
  note et ne modifie que les champs de rapprochement.
- Garde-fou tiroir : une sortie espèces (remboursement/annulation) est refusée si
  le solde espèces de la session ouverte est insuffisant.

### 3.2 Journal de paiements

- `payments` : `kind ∈ {payment, refund, payment_reversal, refund_reversal}`,
  `status ∈ {pending, confirmed, failed}`, `amount bigint > 0`, `currency = 'XOF'`,
  `method ∈ {cash, wave, orange_money, mtn_momo, moov_money, card}`.
- Lien obligatoire vers un rendez-vous (`appointment_id`) et la succursale ;
  clé d'idempotence `unique (salon_id, idempotency_key)` + `request_payload`
  jsonb : un rejeu même clé/même payload renvoie l'écriture existante, une clé
  réutilisée avec un payload différent est rejetée (`23505`).
- **Espèces** : confirmé immédiatement, `settlement_mode = cash_drawer`, session
  ouverte obligatoire. **Non-espèces** : `pending` à l'enregistrement, référence
  opérateur obligatoire (≥ 4 caractères) ; ne compte pas dans les revenus tant
  qu'il n'est pas confirmé.
- Confirmation manuelle (`confirm_pending_payment`) : réservée à
  `payments.correct`, exige la référence **identique** à celle enregistrée et une
  note de vérification ≥ 10 caractères. Elle n'interroge aucun opérateur : c'est
  une preuve humaine, pas une confirmation fournisseur.
- Rejet (`reject_pending_payment`) : motif obligatoire, statut `failed`, exclu
  des totaux.
- Corrections : motif obligatoire (≥ 3 caractères), méthode héritée de l'écriture
  d'origine, plafond par entrée d'origine (remboursements cumulés + annulation
  unique ; restauration de remboursement plafonnée au remboursement). Index
  unique partiel `payments_one_reversal_per_original`. Une correction non-espèces
  exige référence + note de vérification manuelle.
- Trigger `payments_protect` : suppression interdite ; champs financiers immuables
  (montant, méthode, référence, motif, acteur, clé, payload). Seule la résolution
  `pending → confirmed/failed` peut renseigner les champs de règlement.
- `payment_events` : journal append-only (`recorded`, `confirmed`, `rejected`,
  `corrected`), trigger interdisant update/delete.
- `payment_status` du rendez-vous recalculé atomiquement après chaque écriture
  confirmée : `paid` (net ≥ prix), `deposit_paid` (net > 0), `refunded` (net = 0
  avec remboursement), `unpaid` sinon. Le net ne peut être négatif ni dépasser
  le prix du rendez-vous.

### 3.3 Rapports

- `financial_summary(p_salon, p_from, p_to)` : sémantique de période explicite.
  - `revenue_billed` : RDV actifs dont `starts_at` tombe dans la période.
  - `revenue_collected` : Σ signée des écritures **confirmées** créées dans la
    période (remboursements/annulations en négatif).
  - `outstanding` : reste à payer des RDV de la période, tous règlements confondus
    (pas une soustraction de deux périodes différentes — corrige la dérive legacy).
  - `refunds`, `expenses`, `net_balance = collected − expenses`,
    `pending_amount` (exclu des revenus), `payment_count`, `by_method` net.
- `list_payments`, `get_appointment_balance` : filtres période/RDV/session/statut,
  lecture seule, scopés tenant.
- `record_expense` : `expenses.manage`, succursale validée, `created_by` renseigné
  par le serveur (`auth.uid()`), justificatif (`receipt_ref`) optionnel. Le client
  ne peut plus choisir `created_by` ; contrainte `currency = 'XOF'`.

## 4. Permissions canoniques

Alignées serveur (`private.has_salon_permission`) et client
(`src/lib/permissions.ts`). Les alias historiques (`payments.write`,
`payments.create`, `cashier.*`, `payments.refund.*`) sont conservés côté serveur
pour compatibilité, mais l'UI utilise les noms canoniques.

| Permission | owner | manager | cashier | accountant | receptionist | barber |
| --- | --- | --- | --- | --- | --- | --- |
| `payments.read` / `cash.read` | ✅ | ✅ | ✅ | ✅ | `payments.read` seul | ❌ |
| `payments.record` / `cash.open` / `cash.close` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `payments.correct` (confirmer/rejeter/rembourser) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `cash.reconcile` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `reports.read` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `subscriptions.read` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `reviews.moderate` (Lot 5, préservé) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

## 5. RPC publiques (signatures)

```sql
ensure_default_register(p_salon_id uuid, p_branch_id uuid) -> uuid
open_cash_session(p_salon_id uuid, p_branch_id uuid, p_opening_balance bigint,
                  p_register_id uuid default null, p_note text default '') -> uuid
close_cash_session(p_salon_id uuid, p_session_id uuid, p_counted_balance bigint,
                   p_note text default '') -> uuid
reconcile_cash_session(p_salon_id uuid, p_session_id uuid, p_note text) -> uuid
get_cash_session(p_salon_id uuid, p_session_id uuid) -> jsonb
list_cash_sessions(p_salon_id uuid, p_limit integer default 20) -> jsonb

record_payment(p_salon_id uuid, p_appointment_id uuid, p_amount bigint,
               p_method text, p_idempotency_key uuid,
               p_provider_reference text default null, p_reason text default '') -> public.payments
record_payment_correction(p_salon_id uuid, p_original_entry_id uuid, p_kind text,
                          p_amount bigint, p_reason text, p_idempotency_key uuid,
                          p_provider_reference text default null,
                          p_settlement_note text default '') -> public.payments
confirm_pending_payment(p_salon_id uuid, p_payment_id uuid,
                        p_provider_reference text, p_settlement_note text) -> public.payments
reject_pending_payment(p_salon_id uuid, p_payment_id uuid, p_reason text) -> public.payments

list_payments(p_salon_id uuid, p_from date default null, p_to date default null,
              p_appointment_id uuid default null, p_cash_session_id uuid default null,
              p_status text default null, p_limit integer default 200) -> jsonb
get_appointment_balance(p_salon_id uuid, p_appointment_id uuid) -> jsonb
financial_summary(p_salon_id uuid, p_from date, p_to date) -> table(...)
record_expense(p_salon_id uuid, p_title text, p_category text, p_amount bigint,
               p_spent_on date, p_branch_id uuid default null,
               p_notes text default '', p_receipt_ref text default null) -> public.expenses
```

Toutes sont `security definer`, `set search_path = ''`, révoquées de
`public`/`anon` et accordées à `authenticated` ; chacune revérifie la permission
et le tenant. Les tables financières n'accordent que `select` au client (RLS).

## 6. Frontend branché

- `src/lib/api.ts` : `salonApi(...).payments`, `.cash`, `.reports`, `expenses.create`
  via RPC ; mappeurs XOF entiers, dates `Africa/Abidjan`, statuts
  `confirmed → completed`, `pending → pending`, `failed → cancelled`.
- `src/context/AppContext.tsx` : `recordPayment`, `confirmPendingPayment`,
  `rejectPendingPayment`, `recordPaymentCorrection`, `getAppointmentBalance`,
  `openNewCashSession`, `closeCurrentCashSession`, `reconcileCashSession`,
  `refreshFinance` réellement persistés ; chargement finance conditionné par les
  permissions du rôle (un barbier ne déclenche pas de RPC finance interdite).
- `NewPaymentModal` : rendez-vous obligatoire, solde serveur (`get_appointment_balance`),
  montant entier ≤ reste à payer, référence opérateur pour le non-espèces,
  reçu « en attente » distinct du reçu confirmé, plus de ticket fictif synchrone.
- `CashRegisterView` : ouverture/clôture/rapprochement, solde théorique, entrées/sorties
  espèces et mobile, file des paiements en attente (confirmer/rejeter), journal
  avec corrections liées, historique des sessions.
- `ReportsView` : rapport serveur par période (mois / 30 jours / année), encaissé
  net, facturé, impayé, remboursements, dépenses, résultat, en attente, par moyen.
- `DashboardView`, `TodayView`, `FinanceExpensesView`, `analytics.ts` : les revenus
  somment désormais les écritures confirmées **signées** (remboursements déduits),
  le panier moyen exclut les écritures non confirmées.
- `FinanceExpensesView` : champ justificatif à la place du faux « moyen de
  règlement » non persisté ; montant entier ≥ 1.
- `ErpLayout` : nav caisse sur `payments.read`, bouton « Encaisser » sur
  `payments.record`, plus de montant par défaut inventé.

## 7. Tests et validation

- `database/tests/supabase-finance.test.mjs` (PGlite) : **10 tests** couvrant
  isolation tenant/RLS, une seule session ouverte, idempotence, statut RDV
  atomique, pending exclu des totaux, confirmation manuelle (référence + note),
  rejet, remboursements/annulations/restaurations plafonnés, garde-fou tiroir,
  clôture/rapprochement, immuabilité journal/sessions/événements, rapport net et
  sémantique de période, listing/solde, garde-fous cross-tenant, dépenses tracées,
  et non-régression `reviews.moderate`.
- `npm run test:supabase` : **26/26** (core 6, branch-hours, operations 10, finance 10).
- `npm run test:marketplace` : 2/2 ; `npm run test:onboarding` : 3/3.
- `npm run typecheck`, `npm run lint`, `npm run build` : ✅ (warning de taille de
  chunk Vite préexistant).
- `npm test` complet reste rouge sur la dette legacy `bc_*` (52 échecs
  préexistants, vérifiés par stash au Lot 5) ; hors périmètre Lot 6.

## 8. État distant vérifié (après application)

Requête SQL sur `rozsykrjrncbupzmauzj` :

- `supabase_migrations.schema_migrations` : **9 versions** (5 Lots 1–5 + 4 Lot 6).
- **23 tables `public`**, toutes avec RLS activée (`tables_without_rls = 0`).
- **14 RPC Lot 6** présentes.
- Index uniques `cash_sessions_one_open_per_register` et
  `payments_one_reversal_per_original` présents.
- Triggers `cash_sessions_protect`, `payments_protect`, `payment_events_protect`
  présents.
- Contrainte `expenses_currency_xof` présente.
- `private.has_salon_permission` contient bien `reviews.moderate` **et**
  `payments.record` (correctif `100300` vérifié).

## 9. Limites et hypothèses non vérifiées

- **Pas d'intégration API opérateur** : la confirmation Mobile Money est une
  preuve manuelle (référence + note). Aucun webhook ni appel marchand n'est
  implémenté ; l'accès marchand réel reste **à vérifier** avant tout chantier
  d'automatisation.
- **Forme de retour HTTP PostgREST non vérifiée bout-en-bout** : le sandbox n'a
  pas d'accès sortant vers `supabase.co`. La logique SQL est vérifiée via PGlite
  et le schéma distant via le connecteur ; le client normalise les retours
  scalaires/composites/`returns table` (`firstRow`), mais un test navigateur
  connecté reste recommandé.
- **Retrait d'Express non effectué** : les contrats legacy `bc_*` (finance et
  autres) ne sont pas tous portés/testés/bascules. La référence
  `database/migrations/20261103050000_lot4_finance.sql` et `server/finance-repository.js`
  restent en place jusqu'à l'audit complet de parité.
- Les rendez-vous chargés dans l'ERP démarrent à aujourd'hui ; le rapport
  financier serveur couvre la période choisie indépendamment de cette fenêtre UI.
- La suppression/édition avancée des dépenses et la fidélité (points) restent
  aux lots suivants ; `deleteExpense` demeure un stub honnête.

## 10. Prochaine étape recommandée

**Lot 7 — Marketplace et réservation en ligne** (publication des salons, lecture
publique RLS, réservation en ligne), puis audit de parité complet des contrats
legacy avant tout retrait d'Express.
