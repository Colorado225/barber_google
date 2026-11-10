# Backlog — État des lieux et feuille de route réconciliés

> **Mise à jour : 10 novembre 2026** (réconciliation par audit direct du dépôt `main` et de l'état courant sur `arena/569f21e0-barber-google` à travers les `37` migrations de `supabase/migrations/` jusqu'à `20261111120000_saas_honest_plan_features.sql`).
>
> **Convention de statut** :
> - **`livré`** : implémenté dans le code frontend/SQL/Edge Functions et couvert par tests automatisés.
> - **`partiel`** : socle fonctionnel livré et utilisable, mais une ou plusieurs extensions métier prévues restent à développer.
> - **`bloqué par configuration`** : le code et le schéma sont prêts dans le dépôt, mais l'activation en production dépend de secrets, réglages Dashboard Supabase, script manuel opérateur ou routage d'hébergement.
> - **`à faire`** : fonctionnalité absente du code actuel, à concevoir et implémenter.

---

## 1. État des lieux réconcilié par domaine

| Domaine | Statut | Ce qui existe dans le code actuel | Ce qui manque ou reste à configurer | Preuves principales |
| --- | --- | --- | --- | --- |
| **Auth, multi-tenant, RBAC / RLS & onboarding** | **`livré`** *(config prod : **`bloqué par configuration`**)* | Inscription/connexion Supabase Auth, vérification e-mail obligatoire, politique mot de passe 12 car., création atomique de salon (`create_salon`), isolation stricte multi-tenant (`memberships` + `private.has_salon_permission`), drapeau `allowPublicSignups` (`platform_settings`). | SMTP dédié (actuellement plafonné à 2 e-mails/h par défaut), templates Auth en français, `site_url` & redirections de production dans Supabase Auth. | `src/context/AuthContext.tsx`, `OnboardingGate.tsx`, `supabase/config.toml`, `20261103160000_supabase_core.sql`, `20261111110000_platform_global_settings.sql` |
| **Retrait du backend Express legacy** | **`livré`** | `server/` et l'ancienne lignée `database/migrations/` ont été entièrement supprimés ; le frontend et la CI s'appuient exclusivement sur Supabase et PGlite. | Aucune dépendance applicative restante (`proxy '/api'` retiré de `vite.config.ts` et variables obsolètes retirées de `.env.example`). | Absence de `server/` et `database/migrations/`, `vite.config.ts`, `.env.example` |
| **Rendez-vous, planning, horaires & walk-in** | **`livré`** | Horaires hebdomadaires par succursale, horaires et absences du personnel, disponibilités serveur, machine à états des RDV, journal `appointment_events`, file d'attente sans rendez-vous (`WalkInView`), inbox demandes en ligne (`OnlineRequestsView`). | — | `20261103170000` → `20261104090100`, `20261104120000_walk_in_services.sql`, `AppointmentsCalendarView.tsx`, `StaffSchedulePanel.tsx` |
| **Caisse, encaissements & dashboard métriques** | **`livré`** *(API opérateur Mobile Money : **`à faire`**)* | Sessions de caisse, journal append-only, encaissements espèces/carte/Wave/Orange/MTN/Moov avec preuve manuelle, remboursements/contrepassations bornés, métriques serveur exactes par fuseau horaire du salon (`get_erp_dashboard_metrics`, séparation encaissé / facturé / réalisé). | Encaissement automatique via API marchande Wave / Orange Money / MTN MoMo / Moov Money. | `20261104100000`–`100300`, `20261111090000_erp_dashboard_metrics_and_timezone.sql`, `CashRegisterView.tsx`, `DashboardView.tsx` |
| **Marketplace, vitrine personnalisable, sécurité jetons & SEO** | **`livré`** *(routage Edge SEO : **`bloqué par configuration`**)* | Catalogue publié contrôlé, respect de la suspension SuperAdmin et de la confidentialité contacts, éditeur de vitrine (`SalonMarketplaceCustomizer`), portail client `/reservation` avec jeton par fragment `#`, rotation et révocation immédiate des jetons, QR code, SEO FR + pré-rendu build + Edge Function `salon-seo`. | Routage CDN/proxy en production pour diriger les crawlers `/salons/:slug` et `/sitemap.xml` vers l'Edge Function `salon-seo`. | `20261104140000`–`140200`, `20261110190000_booking_token_security.sql`, `20261110233000`, `scripts/prerender-public.mjs`, `supabase/functions/salon-seo/` |
| **Avis clients & modération** | **`partiel`** | Avis vérifiés liés à un RDV terminé (`create_review`), modération/masquage côté salon et côté SuperAdmin (`is_hidden`, `admin_moderate_review`), exclusion des avis masqués des notes publiques. | Réponse publique du propriétaire sur un avis (`owner_reply` + RPC dédiée). | `20261104090200_review_moderation.sql`, `20261110120000_platform_admin_actions.sql`, `AdminReviewsPanel.tsx` |
| **Notifications (e-mail, WhatsApp, SMS)** | **`partiel`** + **`bloqué par configuration`** | File d'attente `appointment_notifications`, Edge Function `notifications-dispatcher` (Resend + WhatsApp Cloud API), cron SQL `pg_cron`/`pg_net`, observabilité cumulée (`failure_count`, `notification_dispatch_runs`), sondes de santé ERP & SuperAdmin. | **Config** : secrets `RESEND_API_KEY`, `NOTIFICATIONS_EMAIL_FROM`, `WHATSAPP_*`, `NOTIFICATIONS_DISPATCH_TOKEN` + ligne `private.notification_dispatch_config`. **Code à faire** : canal SMS réel (`sms` aujourd'hui explicitement rejeté `channel_not_supported: sms`) et rappels/relances CRM automatisés. | `supabase/functions/notifications-dispatcher/`, `20261104130500`, `20261110210000_notifications_observability_and_honest_channels.sql`, `NotificationsView.tsx`, `AdminNotificationsPanel.tsx` |
| **CRM, fidélité, stocks, fournisseurs & dépenses** | **`partiel`** | Liaison CRM automatique par téléphone, fidélité append-only déclenchée sur RDV `completed` + payé (avec reprise sur remboursement et consommation atomique), table `suppliers`, mouvements de stock append-only (`stock_movements`), correction et contrepassation auditée des dépenses (`reverse_expense`, `correct_expense`, `expense_events`). | Déstockage automatique lié aux prestations consommées, inventaires physiques guidés, segmentation client avancée / campagnes de rétention, catégories personnalisées de dépenses. | `20261104130000`–`130100`, `20261110230000_p2_operations_stock_suppliers_expenses_storage.sql`, `InventoryView.tsx`, `FinanceExpensesView.tsx`, `LoyaltyView.tsx` |
| **Médias & pièces jointes (Supabase Storage)** | **`livré`** | Compartiments `salon-media` (public, logos/couverture/galerie ≤ 5 Mo) et `expense-attachments` (privé avec URL signées, justificatifs ≤ 10 Mo), politiques RLS multi-tenant sur `storage.objects`, client `src/lib/storage.ts` branché dans les paramètres salon et les dépenses. | — | `20261110230000_p2_operations_stock_suppliers_expenses_storage.sql`, `src/lib/storage.ts`, `SalonProfileSettingsView.tsx`, `FinanceExpensesView.tsx` |
| **Temps réel multi-postes (Realtime)** | **`livré`** | Publication `supabase_realtime` sur `appointments`, `appointment_notifications`, `payments` et `cash_sessions` ; client `src/lib/realtimeSync.ts` avec déduplication, repli offline/online et indicateur de statut temps réel dans l'ERP. | — | `20261110170000_erp_realtime_publication.sql`, `src/lib/realtimeSync.ts`, `src/context/AppContext.tsx`, `ErpLayout.tsx` |
| **Monétisation SaaS (forfaits & abonnements)** | **`partiel`** | Forfaits dynamiques mensuels & annuels (`saas_plans`, `saas_plan_drafts`), fonctionnalités honnêtes alignées sur le produit réel, souscription avec *grandfathering*, quotas serveur (`enforce_staff_quota`, `enforce_branch_quota`), déclaration manuelle de paiement par le salon et validation/rejet SuperAdmin. | Passerelle de paiement récurrent automatisée (Stripe / CinetPay / Paystack), facturation PDF automatique et prorata sur changement de forfait. | `20261104150000`, `20261109120000`, `20261110090000`, `20261111100000`, `20261111120000`, `SaaSPlanView.tsx`, `PricingView.tsx`, `SaasPaymentReviewPanel.tsx` |
| **Console SuperAdmin & gouvernance plateforme** | **`livré`** *(compte opérateur : **`bloqué par configuration`**)* | Garde serveur `is_platform_superadmin()` + `platform_admins`, métriques filtrées par période (MRR/ARR normalisé, encaissements bruts/nets, RDV par statut), gestion salons (publication, certification, suspension/réactivation, édition), modération avis, audit `platform_audit_logs`, réglages globaux `platform_settings` (inscriptions, maintenance, annonce, sans fausse commission). | Création du compte auth opérateur puis exécution manuelle unique du script `supabase/manual/platform_superadmin_account.sql` sur l'environnement cible. | `20261109100000`, `20261110120000`, `20261110150000`, `20261111110000`, `AdminDashboard.tsx`, `AdminPlatformSettingsPanel.tsx` |
| **Qualité, CI, performance & industrialisation** | **`partiel`** | Découpage d'`AppContext` en 5 contextes domaine, routes lazy (`lazyNamed`), code-splitting + budgets CI (`scripts/measure-bundles.mjs`), ESLint étendu à `.ts`/`.tsx` + Hooks sans `--legacy-peer-deps` (`typescript@^6.0.3`, `typescript-eslint@^8.72.2`), `229` tests PGlite + JSDOM, CI GitHub Actions & workflow migrations. | Calcul automatique des commissions barbiers par période (seul le taux `%` par employé existe aujourd'hui), commission plateforme sur transactions (si décidée), mode kiosque/tablette barbier, tests E2E Playwright, PWA / mode hors-ligne complet, monitoring erreurs/logs structurés. | `package.json`, `eslint.config.js`, `.github/workflows/ci.yml`, `scripts/measure-bundles.mjs`, `src/context/domains/*` |

---

## 2. Backlog détaillé par catégorie de statut

### A. `livré` — Chantiers achevés et vérifiés

Les lots et jalons ci-dessous sont intégrés dans la base, le frontend et les suites de tests automatisées :

1. **Socle SaaS & Sécurité (Lots 1 à 4)** : PostgreSQL/Supabase multi-tenant, RBAC/RLS complet, onboarding, suppression du backend Express legacy.
2. **Opérations salon (Lot 5 — `docs/LOT-5-RAPPORT.md`)** : horaires par succursale, horaires/absences personnel, machine à états RDV, avis vérifiés et modération.
3. **Caisse & Finance (Lot 6 — `docs/LOT-6-RAPPORT.md`)** : sessions de caisse, journal append-only, paiements Mobile Money manuels, remboursements, rapports nets et métriques dashboard exactes par fuseau horaire (`20261111090000`).
4. **Marketplace, Parcours Client & Sécurité Jetons (Lot 7 — `docs/LOT-7-RAPPORT.md`, `docs/PARCOURS-CLIENT-COMPLET.md`)** : fiches publiques, personnalisation vitrine par salon, portail client avec rotation/révocation du jeton secret (`20261110190000`), files d'attente walk-in et inbox demandes en ligne.
5. **Opérations P2 & Stockage (`20261110230000`)** : fournisseurs, mouvements de stock append-only, correction/contrepassation auditée des dépenses, compartiments Supabase Storage (`salon-media`, `expense-attachments`).
6. **Temps réel multi-postes (`20261110170000`)** : synchronisation Postgres Changes sur RDV, notifications, paiements et caisse.
7. **SuperAdmin & Gouvernance (`20261109100000` → `20261111110000`)** : actions serveur auditées, métriques financières fiabilisées, forfaits annuels/mensuels, promesses honnêtes des forfaits, réglages globaux plateforme.
8. **Qualité & Performance P2 (`docs/P2-SEO-EVALUATION.md`)** : SEO dynamique/statique FR, lazy loading, budgets bundle CI, couverture ESLint complète sur `.ts`/`.tsx` avec installation `npm ci` sans `--legacy-peer-deps`.

---

### B. `bloqué par configuration` — Prêt dans le code, à activer côté exploitation

| Élément | Action requise côté opérateur / hébergeur | Référence |
| --- | --- | --- |
| **Envoi réel e-mails & WhatsApp + cron** | Définir les secrets Edge (`RESEND_API_KEY`, `NOTIFICATIONS_EMAIL_FROM`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_PREFIX`, `NOTIFICATIONS_DISPATCH_TOKEN`, `PUBLIC_APP_URL`), déployer `notifications-dispatcher` et activer la ligne dans `private.notification_dispatch_config`. | `supabase/functions/notifications-dispatcher/index.ts`, `20261104130500_notification_scheduler.sql` |
| **Compte SuperAdmin plateforme** | Créer l'utilisateur dans Supabase Auth puis exécuter une fois `supabase/manual/platform_superadmin_account.sql`. | `supabase/manual/platform_superadmin_account.sql` |
| **E-mails Auth en français, SMTP & redirections prod** | Renseigner `site_url` et `additional_redirect_urls` de production dans Supabase Auth, brancher un SMTP dédié (au lieu du plafond 2/h par défaut) et traduire les gabarits Auth. | `supabase/config.toml` |
| **Pré-rendu SEO Edge `/salons/:slug` et `/sitemap.xml`** | Déployer `salon-seo` et configurer le routage/rewrite CDN vers l'Edge Function en production (notamment pour les crawlers sociaux). | `supabase/functions/salon-seo/index.ts`, `docs/P2-SEO-EVALUATION.md` |

---

### C. `partiel` — Socle livré, extensions restantes

| Élément | Partie **`livré`** | Extension restante (**`à faire`**) |
| --- | --- | --- |
| **Abonnements & facturation SaaS** | Catalogue mensuel/annuel dynamique, quotas serveur, souscription, déclaration de paiement et validation/rejet SuperAdmin. | Paiement récurrent en ligne automatisé (Stripe / CinetPay / Paystack), factures PDF automatiques et prorata lors des changements de forfait. |
| **Notifications clients** | Outbox SQL, e-mail Resend, WhatsApp Cloud API, cron `pg_cron`, observabilité des échecs et sondes de santé. | Intégration d'un fournisseur SMS local/international (Orange / Termii / Twilio) et automatisation des relances CRM post-visite. |
| **Avis clients** | Création vérifiée après RDV terminé, masquage/modération par salon et SuperAdmin. | Réponse publique du gérant (`owner_reply` + RPC) affichée sous l'avis sur la fiche publique. |
| **Stocks, CRM & dépenses** | Fournisseurs, historique append-only des stocks, contrepassation/correction + pièces jointes Storage sur dépenses, fidélité append-only. | Déstockage automatique par prestation terminée, inventaires physiques, segmentation CRM avancée et catégories personnalisées de dépenses. |
| **Qualité, tests & performance** | Tests PGlite + React/JSDOM (`npm test`), ESLint TS/Hooks propre, budgets bundle P2, CI GitHub Actions. | Suite E2E navigateur (Playwright) sur les parcours critiques et observabilité/monitoring applicatif en production. |

---

### D. `à faire` — Chantiers non implémentés (priorisés)

| Priorité | Chantier | Détail |
| --- | --- | --- |
| **P1** | **Passerelle de paiement SaaS récurrente** | Brancher un PSP adapté à la Côte d'Ivoire / international (CinetPay, Paystack ou Stripe) avec webhooks signés pour automatiser activation, renouvellement et factures PDF. |
| **P1** | **Canal SMS & rappels CRM automatisés** | Choisir et intégrer un opérateur SMS (aujourd'hui refusé explicitement côté code) + règles configurables de rappels J-1 / H-2 et relances clients inactifs. |
| **P2** | **Calcul & relevés des commissions barbiers** | Exploiter le `commission_rate` existant sur le personnel pour calculer les montants dus par période sur les prestations encaissées et suivre les versements. |
| **P2** | **Encaissement Mobile Money automatisé (marchand)** | Ajouter l'initiation et la confirmation webhook Wave / Orange Money / MTN MoMo / Moov Money (sous réserve d'agrément marchand) en complément de la preuve manuelle actuelle. |
| **P2** | **Réponse propriétaire aux avis (`owner_reply`)** | Ajouter la colonne `owner_reply` + horodatage et la RPC autorisée aux rôles `owner`/`manager`. |
| **P2** | **Déstockage automatique & inventaires** | Lier produits consommés aux prestations et ajouter un flux d'inventaire physique générant des mouvements d'ajustement. |
| **P2** | **Tests E2E Playwright** | Scénarios bout en bout en navigateur réel : inscription → onboarding salon → réservation marketplace → encaissement caisse → revue SuperAdmin. |
| **P3** | **Mode kiosque / fauteuil tablette & PWA hors-ligne** | Interface tactile simplifiée par poste barbier, borne d'accueil comptoir et support PWA tolérant aux coupures réseau. |
| **P3** | **Commission plateforme & monitoring prod** | Activer un mécanisme serveur de commission uniquement si le modèle économique le retient (`platform_settings` reste aujourd'hui explicitement sans commission) ; brancher suivi d'erreurs (ex. Sentry) et sauvegardes testées. |
