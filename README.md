# BarberCuts — ERP SaaS & Marketplace pour barbershops et salons

Application web multi-tenant destinée aux salons de coiffure et barbershops (gestion opérationnelle ERP, caisse, planning, stocks/dépenses, fidélité) couplée à une marketplace publique de réservation en ligne et à une console SuperAdmin plateforme.

- **Frontend** : React 19, TypeScript 6, Vite 8, React Router 7, Tailwind CSS 4, Lucide Icons, Motion
- **Backend managé** : Supabase (PostgreSQL 17 avec RLS et RPC `SECURITY DEFINER`, Auth, Realtime, Storage, Edge Functions Deno)
- **Backlog & état d'avancement** : voir [`docs/AMELIORATIONS.md`](docs/AMELIORATIONS.md)
- **Checklist de production & sauvegardes** : voir [`docs/CONFIGURATION-PRODUCTION.md`](docs/CONFIGURATION-PRODUCTION.md)
- **Workflow SQL & migrations** : voir [`docs/supabase-migrations.md`](docs/supabase-migrations.md)

---

## Routes principales

| Route                                              | Accès                         | Rôle                                                                            |
| -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `/`                                                | Public                        | Marketplace de découverte, recherche et prise de rendez-vous                    |
| `/salons/:slug`                                    | Public                        | Vitrine personnalisée d'un salon publié                                         |
| `/reservation`                                     | Public (jeton secret `#`)     | Portail client « Ma réservation » (suivi, annulation, rotation/révocation lien) |
| `/mes-reservations`                                | Public                        | Coffre-fort local des réservations enregistrées sur l'appareil                  |
| `/tarifs` (et `/pricing`)                          | Public                        | Grille publique dynamique des forfaits SaaS (mensuel / annuel)                  |
| `/connexion`, `/inscription`, `/verifier-email`    | Auth                          | Connexion, création de compte + salon et vérification e-mail                    |
| `/mot-de-passe-oublie`, `/reinitialiser`           | Auth                          | Réinitialisation du mot de passe                                                |
| `/app/*`                                           | Authentifié (membre du salon) | ERP multi-salons (dashboard, planning, caisse, clients, stocks, dépenses, etc.) |
| `/admin` (et `/admin/console`, `/admin/dashboard`) | SuperAdmin plateforme         | Pilotage SaaS, validation des paiements, modération, audit et réglages globaux  |

---

## Prérequis

- **Node.js** 22+ et **npm** (installation stricte via `npm ci`, sans `--legacy-peer-deps`)
- Optionnel pour la base locale complète : **Supabase CLI** et **Docker Desktop** (les tests unitaires et PostgreSQL/PGlite de `npm test` s'exécutent sans Docker)

---

## Installation et démarrage local

```bash
# 1. Installer les dépendances exactement depuis package-lock.json
npm ci

# 2. Créer le fichier d'environnement local (non versionné)
cp .env.example .env.local
```

Renseigner `.env.local` avec l'URL et la clé publique (`anon` / publishable) de votre projet Supabase (ou activer `VITE_MARKETPLACE_DEMO=true` pour explorer la vitrine avec des données de démonstration lorsque Supabase n'est pas configuré).

```bash
# 3. Lancer le serveur de développement (http://localhost:3000)
npm run dev
```

---

## Variables d'environnement

### Frontend Vite (`.env.local` ou plateforme d'hébergement)

| Variable                 | Requis | Description                                                                                                |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Oui\*  | URL du projet Supabase (`https://<project-ref>.supabase.co`).                                              |
| `VITE_SUPABASE_ANON_KEY` | Oui\*  | Clé publique cliente Supabase (`anon` / publishable). Ne jamais mettre de `service_role_key` côté client.  |
| `VITE_MARKETPLACE_DEMO`  | Non    | Mettre à `true` pour autoriser le jeu de données démo sur `/` hors connexion Supabase.                     |
| `VITE_PUBLIC_SITE_URL`   | Non    | Origine canonique utilisée au build par `scripts/prerender-public.mjs` (défaut : `https://barbercuts.ci`). |

\* Sans `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, l'application démarre en mode dégradé sans appels Supabase.

### Edge Functions Supabase (Secrets Dashboard > Edge Functions)

Ne jamais placer ces secrets dans `.env.example`, `.env.local` ou le bundle client.

| Secret                                                           | Fonction(s)                             | Rôle                                                                        |
| ---------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Automatique                             | Variables injectées par le runtime Edge Supabase.                           |
| `PUBLIC_APP_URL`                                                 | `notifications-dispatcher`, `salon-seo` | Origine publique du site (liens e-mail / SEO).                              |
| `RESEND_API_KEY`                                                 | `notifications-dispatcher`              | Clé API Resend pour l'envoi réel des e-mails transactionnels.               |
| `NOTIFICATIONS_EMAIL_FROM`                                       | `notifications-dispatcher`              | Adresse d'expédition vérifiée chez Resend.                                  |
| `WHATSAPP_TOKEN`                                                 | `notifications-dispatcher`              | Jeton Meta WhatsApp Cloud API.                                              |
| `WHATSAPP_PHONE_NUMBER_ID`                                       | `notifications-dispatcher`              | Identifiant du numéro expéditeur WhatsApp Cloud API.                        |
| `WHATSAPP_BUSINESS_ACCOUNT_ID`                                   | `notifications-dispatcher`              | Optionnel : audit du statut des modèles Meta.                               |
| `WHATSAPP_TEMPLATE_PREFIX`                                       | `notifications-dispatcher`              | Préfixe des modèles WhatsApp approuvés (recommandé hors fenêtre 24 h).      |
| `WHATSAPP_TEMPLATE_LANG`                                         | `notifications-dispatcher`              | Code langue des modèles WhatsApp (défaut : `fr`).                           |
| `WHATSAPP_DEFAULT_COUNTRY_CODE`                                  | `notifications-dispatcher`              | Indicatif téléphonique par défaut pour la normalisation (défaut : `225`).   |
| `NOTIFICATIONS_DISPATCH_TOKEN`                                   | `notifications-dispatcher`              | Jeton partagé avec `private.notification_dispatch_config` pour le cron SQL. |

### CI / Déploiement des migrations (GitHub Actions)

Le workflow `.github/workflows/supabase-migrations.yml` requiert dans l'environnement GitHub :

- Secrets : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
- Variable : `SUPABASE_PROJECT_REF`

---

## Commandes disponibles

### Qualité, build et performance

```bash
npm run typecheck      # Vérification TypeScript stricte (tsc --noEmit)
npm run lint           # ESLint sur JS/MJS/TS/TSX + React Hooks (--max-warnings 0)
npm run format:check   # Vérification Prettier
npm run format         # Formatage Prettier
npm run build          # Build Vite de production + pré-rendu statique SEO (/ , /tarifs, /inscription, sitemap)
npm run perf:check     # Contrôle des budgets de taille des bundles et temps de chargement mobile
npm run perf:report    # Génère aussi reports/bundle-metrics.json (utilisé en CI)
```

### Tests

```bash
npm test               # Suite complète : tests PostgreSQL/PGlite (database/tests/*.test.mjs) + tests UI/lib (tests/*.test.tsx)
```

Suites ciblées :

```bash
npm run test:supabase     # Socle RPC/RLS, RDV, finance, marketplace, walk-in, customizer, sécurité
npm run test:walk-in      # Clients de passage
npm run test:finance      # Caisse, encaissements, remboursements, rapports
npm run test:marketplace  # Navigation marketplace
npm run test:onboarding   # Parcours d'inscription / création de salon
npm run test:journey      # Parcours client complet + fidélité + portail jeton + outbox
npm run test:security     # Isolation multi-tenant & parité RBAC/RLS
```

### Supabase local & liaison distante

```bash
npm run supabase:db:reset          # Recrée la base locale depuis supabase/migrations/
npm run supabase:db:linked:status  # Compare migrations locales et projet distant lié
npm run supabase:db:linked:preview # Aperçu dry-run des migrations à appliquer
npm run supabase:db:linked:push    # Applique les migrations sur le projet lié
```

---

## Déploiement et mise en production

1. **Base de données (`supabase/migrations/`)** :
   - Sur `main`, exécuter manuellement le workflow GitHub `.github/workflows/supabase-migrations.yml` (avec `confirm_production_migration=true`) ou `supabase db push --linked` après revue du `--dry-run`.
2. **Authentification Supabase (`supabase/config.toml` / Dashboard Auth)** :
   - Configurer l'URL du site (`site_url`) et `additional_redirect_urls` avec le domaine de production.
   - Configurer un serveur SMTP dédié (le SMTP par défaut est plafonné à 2 e-mails/h) et traduire les modèles d'e-mails Auth en français.
   - Conserver la confirmation e-mail activée et la longueur minimale de mot de passe à 12 caractères.
3. **Edge Functions** :
   - Déployer `notifications-dispatcher` et `salon-seo` via Supabase CLI (`supabase functions deploy <nom>`).
   - Configurer les secrets Resend / WhatsApp / `PUBLIC_APP_URL` / `NOTIFICATIONS_DISPATCH_TOKEN` dans Supabase, et activer la ligne `private.notification_dispatch_config` si l'envoi planifié toutes les 5 minutes via `pg_cron` est souhaité (cf. `supabase/migrations/20261104130500_notification_scheduler.sql`).
4. **Compte SuperAdmin plateforme** :
   - Créer le compte utilisateur dans Supabase Auth, puis exécuter une seule fois `supabase/manual/platform_superadmin_account.sql` pour l'enregistrer dans `public.platform_admins`.
5. **Frontend & SEO** :
   - Construire le bundle via `npm run build` (`dist/`), exposer `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` et `VITE_PUBLIC_SITE_URL`, et router `/salons/:slug` (robots/crawlers) ainsi que `/sitemap.xml` vers l'Edge Function `salon-seo` selon l'hébergeur CDN choisi (cf. `docs/P2-SEO-EVALUATION.md`).
6. **Validation pré-ouverture & plan de reprise** :
   - Dérouler intégralement la checklist par environnement, le contrôle des secrets Edge, les sauvegardes (DB + Storage) et la procédure de restauration documentés dans [`docs/CONFIGURATION-PRODUCTION.md`](docs/CONFIGURATION-PRODUCTION.md).
