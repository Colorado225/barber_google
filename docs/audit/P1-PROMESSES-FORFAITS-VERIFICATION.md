# P1 — Vérifier les promesses des forfaits : matrice fonctionnalité annoncée / implémentation réelle

> Audit réalisé le 10 novembre 2026 (base `main` 4d8a151 + lots de la branche courante).
> Méthode : chaque avantage affiché sur `/tarifs` et dans l'ERP (« Abonnement ») a été vérifié dans
> le code (frontend + SQL), dans les contrôles serveur (RLS, RPC, triggers, quotas) et dans les
> suites de tests automatisées. Les formulationsannonçant plus que le livré ont été resserrées dans
> le lot décrit en §2.

## 1. Matrice des promesses (catalogue courant, après resserrement)

### Starter Solo — 15 000 F CFA / mois (quota : 1 barbier, 1 succursale)

| Fonctionnalité annoncée                         | Implémentation réelle                                                                                                                                 | Contrôle serveur                                                                                                                | Test associé                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1 barbier / 1 fauteuil                          | Sélection du forfait à la souscription, quotas affichés dans l'ERP                                                                                    | `private.enforce_staff_quota` (trigger `staff`) lit le plan de l'abonnement actif et refuse au-delà de `max_staff`              | `database/tests/supabase-saas-subscription-verification.test.mjs` (quotas)                   |
| Planning et réservations illimités              | Planning ERP, portail public `/reservation`, demandes en ligne, walk-in                                                                               | Aucun quota sur `appointments` (volume illimité par conception)                                                                 | `database/tests/supabase-client-journey.test.mjs`, `supabase-walk-in.test.mjs`               |
| Caisse & encaissements (Espèces + Mobile Money) | Sessions de caisse, journal append-only, encaissements `cash`/`wave`/`orange_money`/`mtn_momo`/`moov_money`/`card`, remboursements & contrepassations | RPC `record_payment`/`confirm`/`correct`/`close_cash_session`… avec permissions `payments.*`/`cash.*` et RLS                    | `database/tests/supabase-finance.test.mjs`                                                   |
| Fichier clients CRM & historique                | Fiche client liée par téléphone, historique de rendez-vous, fidélité                                                                                  | RLS multi-tenant + RPC clients ; liaison CRM automatique serveur                                                                | `database/tests/supabase-client-journey.test.mjs`                                            |
| Fiche de présence sur la Marketplace            | Fiche publique `/salons/:slug` après publication (profil complet requis)                                                                              | `set_salon_publication` : adresse, téléphone, couverture + ≥ 1 prestation active ; `auto_approve_salons` de `platform_settings` | `database/tests/supabase-marketplace.test.mjs`, `supabase-platform-global-settings.test.mjs` |
| Lien & QR code de réservation                   | Lien de partage + QR code (qrcode.react), jeton secret par fragment, rotation/révocation                                                              | `booking_tokens` : hachage côté serveur, rotation et révocation immédiates                                                      | `database/tests/supabase-booking-token-security.test.mjs`                                    |

### Pro Équipe — 35 000 F CFA / mois (quota : 5 barbiers, 1 succursale)

| Fonctionnalité annoncée                                                                               | Implémentation réelle                                                                                                                                                                          | Contrôle serveur                                                                                                                   | Test associé                                                                              |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Jusqu'à 5 barbiers                                                                                    | Ajout/gestion de l'équipe dans l'ERP                                                                                                                                                           | `private.enforce_staff_quota`                                                                                                      | `supabase-saas-subscription-verification.test.mjs`                                        |
| Suivi des taux de commission par membre (calcul automatique des montants dus à venir)                 | `commission_rate` (0–100) éditable par membre, affiché dans le tableau de bord avec la mention explicite « le calcul des montants de commissions dus par période n'est pas encore disponible » | Colonne `staff.commission_rate` contrainte (`check between 0 and 100`), écriture réservée à `team.write` via RPC `upsert_staff`    | `tests/saas-honest-plan-features.test.tsx` (note dashboard), `supabase-core` (contrainte) |
| Module Clients de passage (Walk-in en direct)                                                         | File d'attente sans rendez-vous (`WalkInView`), arrivée tracée, idempotence                                                                                                                    | RPC walk-in dédiées + `walk_in_idempotency_key`                                                                                    | `database/tests/supabase-walk-in.test.mjs`                                                |
| Programme de fidélité et récompenses automatisé                                                       | Points crédités automatiquement au statut « terminé + payé », grand livre append-only, consommation atomique, reprise sur remboursement                                                        | Triggers SQL de fidélité (server-side)                                                                                             | `database/tests/supabase-client-journey.test.mjs`, `20261104130100_loyalty_ledger.sql`    |
| Personnalisation complète de la vitrine (3 thèmes)                                                    | Éditeur de vitrine : 3 modèles de présentation (Classique / Élégant / Éditorial), 6 couleurs d'accent, 3 styles de cartes, brouillon + publication                                             | `save_marketplace_customizer_draft` / `publish_marketplace_customizer` (permission `salon.update`, contrôle `auto_approve_salons`) | `database/tests/supabase-marketplace-customizer.test.mjs`                                 |
| Suivi des confirmations & rappels e-mail / WhatsApp (selon activation opérateur ; SMS non disponible) | File `appointment_notifications`, Edge Function `notifications-dispatcher` (Resend + WhatsApp Cloud API), cron, observabilité                                                                  | File SQL + santé/expédition tracés ; canal SMS rejeté explicitement (`channel_not_supported`) tant qu'aucun fournisseur            | `database/tests/supabase-notifications-observability.test.mjs`                            |
| Gestion des dépenses et alertes de stock bas                                                          | Dépenses avec pièces jointes, contrepassation/correction auditée, stock avec seuil + alerte tableau de bord                                                                                    | RPC dépenses/stock + permissions `expenses.*`/`stock.*`                                                                            | `database/tests/supabase-p2-operations-ledger.test.mjs`                                   |

### Prestige & Chaînes — 75 000 F CFA / mois (quota : barbiers illimités, 5 succursales)

| Fonctionnalité annoncée                                                                           | Implémentation réelle                                                                                                                                                           | Contrôle serveur                                                                                   | Test associé                                                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Barbiers et fauteuils illimités                                                                   | Pas de plafond de membres au forfait Prestige                                                                                                                                   | `enforce_staff_quota` : `max_staff IS NULL` → aucune limite                                        | `supabase-saas-subscription-verification.test.mjs`                                                     |
| Multi-succursales jusqu'à 5 établissements (quota serveur ; horaires et effectifs par succursale) | Création/gestion de succursales, horaires par succursale (`BranchHoursManager`), affectation des effectifs par succursale, sélecteur de succursale pour la gestion des horaires | `private.enforce_branch_quota` lit le plan de l'abonnement actif (refus au-delà de `max_branches`) | `supabase-saas-subscription-verification.test.mjs`, `supabase-branch-hours.test.mjs`                   |
| Rapports financiers et indicateurs d'activité consolidés du salon                                 | `ReportsView` + RPC `erp_dashboard_metrics` (encaissé/facturé/réalisé, occupation, palmarès) consolidant toutes les succursales du salon                                        | `dashboard.read`/`reports.read` + séparation RBAC par bloc dans la RPC                             | `database/tests/supabase-erp-dashboard-metrics.test.mjs`, `tests/erp-analytics-and-dashboard.test.tsx` |
| Rapprochement et réconciliation des caisses (export comptable non disponible)                     | Sessions de caisse, clôture avec écart, rapprochement (`reconcile_cash_session`), journal append-only                                                                           | RPC caisse + permissions `cash.*`                                                                  | `database/tests/supabase-finance.test.mjs`                                                             |
| Vitrine complète sur la Marketplace (classement par publication ; mise en avant non automatisée)  | Fiche publique enrichie (customizer), classement par date de publication — aucun boost payant                                                                                   | Publication contrôlée serveur + suspension SuperAdmin                                              | `supabase-marketplace.test.mjs`                                                                        |
| Accompagnement à l'onboarding multi-sites (support VIP 7j/7 non intégré à l'application)          | Engagement de service hors produit (accompagnement à l'installation) ; aucune fonctionnalité « support » dans l'app                                                             | — (hors périmètre applicatif, libellé explicite)                                                   | —                                                                                                      |

### Promesses transverses

| Fonctionnalité annoncée                       | Implémentation réelle                                                                                             | Contrôle serveur                                                                                          | Test associé                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Facturation mensuelle ou annuelle (-15 %)     | Bascule transmise au serveur ; montant & durée recalculés côté PostgreSQL                                         | `private.resolve_saas_subscription_terms` + `saas_billing_interval` ; montant jamais fourni par le client | `database/tests/supabase-saas-subscription-verification.test.mjs`, `tests/saas-annual-billing.test.tsx` |
| Tarif garanti (grandfathering)                | `price_at_subscription` figé à la souscription ; les modifications de forfaits ne touchent pas les abonnés actifs | Snapshot serveur dans `saas_subscriptions`                                                                | `supabase-saas-pricing.test.mjs`                                                                        |
| « Sans engagement, résiliable à tout moment » | Statut `cancelled`, période en cours honorée                                                                      | Cycle de vie serveur des abonnements                                                                      | `supabase-saas-subscription-verification.test.mjs`                                                      |

## 2. Resserrements livrés dans ce lot (formulations allant au-delà du livré)

L'audit a identifié **deux formulations « honnêtes » antérieures devenues trop généreuses** :

1. « Multi-succursales jusqu'à 5 établissements (quota serveur **& sélecteur ERP**) » — il n'existe
   aucun sélecteur ERP filtrant les vues (planning, tableau de bord, rapports) par succursale ;
   `SalonContext.activeBranchId` n'est consommé par aucune vue. → **« (quota serveur ; horaires et
   effectifs par succursale) »**, qui décrit exactement le livré.
2. « Rapports financiers et indicateurs d'activité **par établissement** » — les rapports
   consolident l'ensemble des succursales du salon ; aucun rapport détaillé par succursale.
   → **« Rapports financiers et indicateurs d'activité consolidés du salon »**.

Changements :

- `src/lib/notifications.ts` : nouveaux libellés + remappage automatique des anciens libellés vers
  les nouveaux (`LEGACY_FEATURE_REPLACEMENTS`), donc toute donnée lue depuis une base existante est
  normalisée à l'affichage ;
- migration `20261111210000_saas_plan_claims_matrix.sql` : `normalize_saas_plan_features` remappe
  les deux anciennes formulations et met à jour `saas_plans` / `saas_plan_drafts` existants ;
- garde-fous : la suite SQL (`supabase-saas-honest-plan-features.test.mjs`) et la suite frontend
  (`tests/saas-honest-plan-features.test.tsx`) échouent si « sélecteur ERP » ou « par
  établissement » réapparaît dans un forfait, et vérifient les nouveaux libellés.

La promesse « commissions » est vérifiée conforme : les forfaits annoncent **le suivi des taux par
membre** et nomment explicitement le calcul des montants dus comme « à venir » ; le tableau de bord
porte la même mention. Rappel : le calcul automatique des commissions dues reste un chantier P2 du
backlog — il ne doit pas être commercialisé avant livraison.

## 3. Verdict

- **Toute fonctionnalité affichée est livrée, contrôlée côté serveur et testée**, à l'exception
  assumée des éléments explicitement bornés par leur libellé (SMS non disponible, export comptable
  non disponible, mise en avant non automatisée, support hors application, calcul des commissions
  à venir, rappels selon activation opérateur).
- Les quotas vendus (1/5/illimité barbier, 1/5 succursale) sont appliqués par triggers serveur et
  testés en PGlite.
