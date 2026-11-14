# Configuration de production, déploiement et reprise après sinistre

> **Date de vérification : 10 novembre 2026**
> Ce document constitue la checklist opérateur par environnement et l'audit des prérequis de mise en production pour **BarberCuts** (`Colorado225/barber_google`).

---

## 1. Audit des traces de configuration héritées (résolu)

| Élément inspecté                           | Constat initial                                                                                  | Décision et état actuel                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dossier `server/` & `database/migrations/` | Supprimés du dépôt ; plus aucun backend Express actif.                                           | Confirmé absent.                                                                                                                                                                            |
| `.env.example`                             | Contenait `APP_ORIGIN`, `AUTH_EXPOSE_TOKENS`, `AUTH_PORT`, `DATABASE_URL`, `SESSION_TTL_MS`.     | **Nettoyé** : aucune référence dans `src/`, `tests/` ou `scripts/`. Conservées uniquement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MARKETPLACE_DEMO`, `VITE_PUBLIC_SITE_URL`. |
| `vite.config.ts`                           | Contenait `server.proxy['/api'] -> http://127.0.0.1:3001`.                                       | **Nettoyé** : aucun appel `/api` ni écoute `:3001` dans le code applicatif ; proxy retiré de `vite.config.ts`.                                                                              |
| `supabase/config.toml` vs projet distant   | `minimum_password_length = 12` en config locale, mais `6` sur le projet distant au 10 nov. 2026. | **Écart documenté** : aligner le réglage Auth distant sur 12 caractères + HIBP (voir § 2 et § 4).                                                                                           |

---

## 2. État vérifié sur le projet Supabase lié (`rozsykrjrncbupzmauzj`)

Contrôle en lecture seule effectué le 10 novembre 2026 sur le projet `barber_google` (`ref: rozsykrjrncbupzmauzj`, région `eu-west-3`, PostgreSQL `17.11`) :

| Composant                            | État constaté                                                                                                                                                                                                                                                                                                                                         | Verdict prod              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Services managés**                 | `auth`, `db`, `db_postgres_user`, `pooler`, `realtime`, `rest`, `storage`, `pg_bouncer` tous `ACTIVE_HEALTHY`.                                                                                                                                                                                                                                        | OK                        |
| **Schéma & migrations**              | Migrations locales appliquées sur la base distante ; `3` forfaits SaaS actifs (`starter`, `pro`, `prestige`), `1` compte `super_admin` dans `public.platform_admins`.                                                                                                                                                                                 | OK                        |
| **Supabase Storage**                 | Compartiments `salon-media` (`public: true`, 5 Mo, JPEG/PNG/WebP) et `expense-attachments` (`public: false`, 10 Mo, JPEG/PNG/WebP/PDF) présents avec `8` politiques RLS sur `storage.objects`.                                                                                                                                                        | OK                        |
| **Edge Functions déployées**         | `notifications-dispatcher` (v8, `verify_jwt: false`) et `salon-seo` (v1, `verify_jwt: false`) actives.                                                                                                                                                                                                                                                | OK (code)                 |
| **Cron SQL notifications**           | `pg_cron` et `pg_net` actifs ; tâche `dispatch-appointment-notifications` (`*/5 * * * *`) active ; `private.notification_dispatch_config.is_enabled = true` avec endpoint + jeton.                                                                                                                                                                    | OK (ordonnanceur)         |
| **Secrets Edge notifications**       | Présents : `NOTIFICATIONS_DISPATCH_TOKEN`, `PUBLIC_APP_URL`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_DEFAULT_COUNTRY_CODE`. **Absents** : `RESEND_API_KEY`, `NOTIFICATIONS_EMAIL_FROM`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEMPLATE_PREFIX`. Dernier run cron : `error = "provider_not_configured"`. | **Non prêt pour la prod** |
| **Auth URLs, SMTP & sécurité**       | `site_url = "http://localhost:3000"`, `uri_allow_list` limitée à `localhost:3000` et preview E2B ; `smtp_host = null` (`rate_limit_email_sent = 2`/h) ; modèles d'e-mails Auth par défaut en anglais ; `password_min_length = 6` et `password_hibp_enabled = false`.                                                                                  | **Non prêt pour la prod** |
| **Routage Edge SEO `/salons/:slug`** | Aucun fichier `vercel.json`, `netlify.toml` ou config reverse-proxy dans le dépôt pour orienter `/salons/:slug` et `/sitemap.xml` vers `salon-seo`.                                                                                                                                                                                                   | **Non prêt pour la prod** |

---

## 3. Matrice des variables et secrets par environnement

> Ne jamais commiter `.env`, `.env.local` ni aucune clé `service_role`, mot de passe DB ou jeton fournisseur.

| Variable / Secret               | Où la configurer                                               | Local Dev                  | Staging / Preview         | Production                                             |
| ------------------------------- | -------------------------------------------------------------- | -------------------------- | ------------------------- | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`             | `.env.local` / Hébergeur SPA                                   | URL projet dev/lié         | URL projet staging        | URL projet prod                                        |
| `VITE_SUPABASE_ANON_KEY`        | `.env.local` / Hébergeur SPA                                   | Clé `anon` / publishable   | Clé `anon` staging        | Clé `anon` prod                                        |
| `VITE_MARKETPLACE_DEMO`         | `.env.local` / Hébergeur SPA                                   | `true` (optionnel) ou vide | `false` / vide            | **`false` ou absent** (obligatoire)                    |
| `VITE_PUBLIC_SITE_URL`          | Build CI / Hébergeur SPA                                       | `http://localhost:3000`    | URL preview HTTPS         | `https://<domaine-prod>` (ex. `https://barbercuts.ci`) |
| `PUBLIC_APP_URL`                | Supabase Edge Secrets                                          | Optionnel                  | URL preview HTTPS         | `https://<domaine-prod>`                               |
| `RESEND_API_KEY`                | Supabase Edge Secrets                                          | Clé sandbox / vide         | Clé test Resend           | Clé production Resend                                  |
| `NOTIFICATIONS_EMAIL_FROM`      | Supabase Edge Secrets                                          | Optionnel                  | Expéditeur domaine test   | `BarberCuts <no-reply@domaine-verifie>`                |
| `WHATSAPP_TOKEN`                | Supabase Edge Secrets                                          | Optionnel                  | Token Meta test           | Token système permanent Meta                           |
| `WHATSAPP_PHONE_NUMBER_ID`      | Supabase Edge Secrets                                          | Optionnel                  | Phone ID test             | Phone ID WhatsApp Business vérifié                     |
| `WHATSAPP_BUSINESS_ACCOUNT_ID`  | Supabase Edge Secrets                                          | Optionnel                  | WABA ID test              | WABA ID prod (audit modèles)                           |
| `WHATSAPP_TEMPLATE_PREFIX`      | Supabase Edge Secrets                                          | Optionnel                  | Préfixe test              | Préfixe approuvé (ex. `barbercuts`)                    |
| `WHATSAPP_TEMPLATE_LANG`        | Supabase Edge Secrets                                          | `fr`                       | `fr`                      | `fr`                                                   |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | Supabase Edge Secrets                                          | `225`                      | `225`                     | `225`                                                  |
| `NOTIFICATIONS_DISPATCH_TOKEN`  | Supabase Edge Secrets + `private.notification_dispatch_config` | Optionnel                  | Secret généré ≥ 32 octets | Secret généré ≥ 32 octets                              |
| `SUPABASE_ACCESS_TOKEN`         | GitHub Environment `supabase-production` (Secret)              | —                          | Token CLI                 | Token CLI prod                                         |
| `SUPABASE_DB_PASSWORD`          | GitHub Environment `supabase-production` (Secret)              | —                          | Mot de passe DB           | Mot de passe DB prod                                   |
| `SUPABASE_PROJECT_REF`          | GitHub Environment `supabase-production` (Variable)            | —                          | Ref staging               | Ref prod                                               |

---

## 4. Checklist de validation par environnement

### Environnement 1 — Développement local

- [ ] `npm ci` exécuté sans `--legacy-peer-deps`.
- [ ] `.env.local` créé à partir de `.env.example` avec `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` et `npm run build` passent sans erreur.
- [ ] Optionnel avec Docker : `npm run supabase:db:reset` et `supabase db lint` passent.

### Environnement 2 — Staging / Preview (avant mise en production)

- [ ] Toutes les migrations de `supabase/migrations/` appliquées (`supabase migration list --remote` : écart = 0).
- [ ] `VITE_MARKETPLACE_DEMO` désactivée (`false` ou absente).
- [ ] Auth Supabase : `uri_allow_list` contient l'URL HTTPS de preview (`https://<preview-domain>/**`).
- [ ] Test complet du parcours réel (création compte, e-mail de confirmation, `create_salon`, création RDV, encaissement caisse, upload photo dans `salon-media`, justificatif dans `expense-attachments`, consultation `/salons/:slug`, portail `/reservation` + rotation jeton).
- [ ] Sonde notifications (`/admin` -> Notifications) validant la connectivité réelle de `notifications-dispatcher`.

### Environnement 3 — Production (bloquant avant ouverture publique)

#### A. Domaine, DNS, TLS et Authentification Supabase

- [ ] Domaine public configuré en HTTPS avec redirection HTTP -> HTTPS et certificat TLS valide.
- [ ] `VITE_PUBLIC_SITE_URL` et secret Edge `PUBLIC_APP_URL` fixés à l'origine canonique exacte (`https://...` sans slash final).
- [ ] Supabase Auth > URL Configuration :
  - [ ] `site_url` mis à jour vers le domaine de production (retirer `http://localhost:3000`).
  - [ ] `additional_redirect_urls` (`uri_allow_list`) limitée aux domaines de production autorisés (retirer les URL de preview temporaires).
- [ ] Supabase Auth > SMTP & Email Templates :
  - [ ] Serveur SMTP dédié configuré (Resend / Postmark / SES) avec enregistrements DNS SPF, DKIM et DMARC vérifiés (lève la limite par défaut de 2 e-mails/h).
  - [ ] Modèles Auth traduits et personnalisés en français (`Confirm signup`, `Reset password`, `Change email`, `Magic link`).
- [ ] Supabase Auth > Attack Protection & Passwords :
  - [ ] Longueur minimale du mot de passe portée à **`12`** caractères (alignement sur `supabase/config.toml`).
  - [ ] Contrôle des mots de passe compromis (HIBP) activé (`password_hibp_enabled = true`).
  - [ ] Confirmation d'e-mail obligatoire maintenue (`mailer_autoconfirm = false`, `mailer_allow_unverified_email_sign_ins = false`).

#### B. Routage `/salons/:slug`, `/sitemap.xml` et Edge Function `salon-seo`

- [ ] `salon-seo` déployée avec `--no-verify-jwt` (`verify_jwt: false`).
- [ ] Règles de réécriture CDN / reverse-proxy configurées **avant** le fallback SPA `/(.*) -> /index.html` :
  - `/sitemap.xml` -> `https://<project-ref>.supabase.co/functions/v1/salon-seo?path=/sitemap.xml`
  - `/salons/:slug` (pour les bots/crawlers WhatsApp, Facebook, X, LinkedIn, Googlebot, Slackbot, Applebot — ou pour toutes les requêtes) -> `https://<project-ref>.supabase.co/functions/v1/salon-seo?slug=:slug`
  - Exemple `vercel.json` à adapter selon l'hébergeur :

    ```json
    {
      "rewrites": [
        {
          "source": "/sitemap.xml",
          "destination": "https://<project-ref>.supabase.co/functions/v1/salon-seo?path=/sitemap.xml"
        },
        {
          "source": "/salons/:slug",
          "has": [
            {
              "type": "header",
              "key": "user-agent",
              "value": ".*(WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Applebot|Googlebot|bingbot).*"
            }
          ],
          "destination": "https://<project-ref>.supabase.co/functions/v1/salon-seo?slug=:slug"
        },
        { "source": "/(.*)", "destination": "/index.html" }
      ]
    }
    ```

- [ ] Contrôles HTTP post-déploiement :
  - `curl -sI https://<domaine>/sitemap.xml` retourne `200` et `Content-Type: application/xml`.
  - `curl -s -A "WhatsApp/2.23" https://<domaine>/salons/<slug-publie>` retourne `200` avec `<html lang="fr">`, `og:title`, `og:image`, `canonical`, et JSON-LD `HairSalon`.
  - `curl -s https://<domaine>/reservation` contient `noindex, nofollow, noarchive` et aucun `canonical`.

#### C. Secrets Edge et modèles WhatsApp (`notifications-dispatcher`)

- [ ] `notifications-dispatcher` déployée (`verify_jwt: false`, sécurité assurée en interne par `x-dispatch-token` ou JWT vérifié).
- [ ] Secrets e-mail définis : `RESEND_API_KEY`, `NOTIFICATIONS_EMAIL_FROM` (domaine d'envoi vérifié).
- [ ] Secrets WhatsApp Cloud API définis : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEMPLATE_PREFIX`, `WHATSAPP_TEMPLATE_LANG=fr`, `WHATSAPP_DEFAULT_COUNTRY_CODE=225`.
- [ ] **5 modèles Meta WhatsApp approuvés** en langue `WHATSAPP_TEMPLATE_LANG` (`fr`) :
  - `<prefix>_booking_received`
  - `<prefix>_booking_confirmed`
  - `<prefix>_booking_cancelled`
  - `<prefix>_reminder_24h`
  - `<prefix>_review_request`
- [ ] Cron SQL vérifié dans `private.notification_dispatch_config` : `endpoint` = `https://<project-ref>.supabase.co/functions/v1/notifications-dispatcher`, `dispatch_token` égal à `NOTIFICATIONS_DISPATCH_TOKEN`, `is_enabled = true`.
- [ ] Sonde exécutée depuis `/admin` -> Notifications : `email.configured = true`, `whatsapp.configured = true`, `whatsapp.templateMode = true`, aucun run en erreur `provider_not_configured` (le canal SMS reste explicitement marqué non pris en charge).

#### D. Stockage Supabase (`salon-media`, `expense-attachments`)

- [ ] Buckets vérifiés : `salon-media` (`public = true`, 5 Mo, `image/jpeg`, `image/png`, `image/webp`) et `expense-attachments` (`public = false`, 10 Mo, `image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
- [ ] 8 politiques RLS sur `storage.objects` vérifiées (écriture `salon-media` limitée à `salon.update`, lecture/écriture `expense-attachments` limitée à `expenses.read` / `expenses.manage` avec contrôle UUID tenant et blocage traversal `..`).
- [ ] Test réel d'upload d'un logo salon, d'un justificatif PDF de dépense et vérification qu'une URL signée expirant est nécessaire pour `expense-attachments`.

#### E. SuperAdmin & workflow CI/CD migrations

- [ ] Environnement GitHub `supabase-production` configuré avec **Required reviewers**, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` et `SUPABASE_PROJECT_REF`.
- [ ] Compte opérateur unique enregistré dans `public.platform_admins` via `supabase/manual/platform_superadmin_account.sql` et vérifié (aucun compte non autorisé présent).
- [ ] Paramètres globaux `public.platform_settings` vérifiés dans `/admin` (`maintenance_mode = false`, `allow_public_signups = true`, `allow_salon_publications = true`).

---

## 5. Sauvegardes (DB + Storage) et procédure de restauration

### 5.1 Stratégie de sauvegarde (RPO / RTO)

> **Important :** une sauvegarde PostgreSQL (`pg_dump` / snapshot DB) sauvegarde les métadonnées `storage.objects`, mais **ne sauvegarde pas les fichiers binaires stockés dans les buckets S3 de Supabase Storage** (`salon-media`, `expense-attachments`). Les deux couches doivent être sauvegardées séparément.

| Périmètre                                                   | Plan Supabase Free                                                                                                                                                                                                               | Plan Supabase Pro+ (recommandé en production)                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL (schéma + données)**                           | Aucune sauvegarde managée quotidienne. Exporter quotidiennement un dump logique chiffré hors site (ex. `supabase db dump` / `pg_dump --format=custom`) via runner sécurisé.                                                      | Sauvegardes quotidiennes automatiques + **PITR (Point-In-Time Recovery)** activé pour un **RPO ≤ 5 min** ; doublé d'un export logique hebdomadaire hors site. |
| **Supabase Storage (`salon-media`, `expense-attachments`)** | Pas de réplication managée entre régions. Synchronisation planifiée quotidienne via protocole S3 Storage (`[storage.s3_protocol] enabled = true` dans `config.toml`) vers un bucket de secours chiffré (versionné, hors projet). | Idem : synchronisation S3 incrémentale quotidienne vers un stockage objet externe chiffré (RPO ≤ 24 h sur les médias).                                        |
| **Configuration & secrets**                                 | Versionnés dans Git (`supabase/migrations/`, `supabase/config.toml`, `supabase/functions/`) ; secrets hors Git dans un coffre-fort opérateur chiffré (1Password / Vault / KMS).                                                  | Idem.                                                                                                                                                         |

Objectifs cibles recommandés en production : **RPO DB ≤ 5 min (avec PITR) / ≤ 24 h (dump quotidien)**, **RTO < 2 h**.

### 5.2 Commandes de sauvegarde manuelle / hors site

```bash
# 1. Dump logique du schéma + des rôles/données applicatives (jamais stocké dans le dépôt Git)
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="barbercuts-prod-$(date -u +%Y%m%dT%H%M%SZ).dump"

# 2. Chiffrement avant stockage hors site (ex. age ou gpg)
age -r "<CLE_PUBLIQUE_OPERATEUR>" -o barbercuts-prod.dump.age barbercuts-prod-*.dump

# 3. Synchronisation des objets Storage via S3-compatible endpoint Supabase Storage
#    (identifiants S3 générés dans Dashboard Supabase > Project Settings > Storage)
aws s3 sync s3://salon-media s3://<backup-bucket>/salon-media --endpoint-url "$SUPABASE_STORAGE_S3_URL"
aws s3 sync s3://expense-attachments s3://<backup-bucket>/expense-attachments --endpoint-url "$SUPABASE_STORAGE_S3_URL"
```

### 5.3 Procédure pas à pas de restauration (incident majeur ou perte de données)

1. **Contenir l'incident et activer la maintenance applicative** :
   - Si l'application reste accessible, activer le mode maintenance depuis `/admin` (ou `platform_settings`) ou couper le trafic frontend pour éviter les écritures divergentes pendant la restauration.
   - Prendre une sauvegarde d'urgence de l'état courant avant toute manipulation destructive (`pg_dump` si la base répond).
2. **Restaurer PostgreSQL** :
   - **Cas A — PITR / Backup managé Supabase (Pro+)** : depuis Dashboard Supabase > _Database > Backups_, restaurer vers un point temporel sain juste avant l'incident (ou cloner vers un projet de reprise pour valider avant bascule DNS/env).
   - **Cas B — Reconstruction depuis un dump logique (`pg_dump`) sur base neuve** :
     1. Créer un projet Supabase sain et appliquer l'infrastructure de migrations versionnée :
        ```bash
        supabase link --project-ref "<target-project-ref>"
        supabase db push --remote --skip-vault
        ```
     2. Vérifier la cohérence des migrations (`supabase migration list --remote`), puis restaurer les données applicatives (`public`, `auth` si sauvegarde complète, ou tables métier ciblées) avec `--disable-triggers` uniquement lors d'un import complet hors trafic, puis réactiver les triggers et vérifier `supabase_migrations.schema_migrations`.
3. **Restaurer les fichiers binaires Storage** :
   - Vérifier la présence des buckets `salon-media` et `expense-attachments` + les 8 politiques RLS (créées par la migration `20261110230000`).
   - Ré-importer les objets depuis le stockage de secours en conservant exactement les clés `<salon_id>/...` référencées par `salons.logo`, `salons.cover_image`, `salons.gallery` et `expenses.attachment_path` :
     ```bash
     aws s3 sync s3://<backup-bucket>/salon-media s3://salon-media --endpoint-url "$SUPABASE_STORAGE_S3_URL"
     aws s3 sync s3://<backup-bucket>/expense-attachments s3://expense-attachments --endpoint-url "$SUPABASE_STORAGE_S3_URL"
     ```
4. **Ré-appliquer la configuration non contenue dans le dump SQL** :
   - Redéployer les Edge Functions (`notifications-dispatcher`, `salon-seo`) et reconfigurer tous les secrets Edge (§ 3).
   - Vérifier `private.notification_dispatch_config` (`endpoint` vers le projet restauré, `dispatch_token` identique au secret Edge, `is_enabled = true`) et la présence de la tâche `pg_cron`.
   - Revalider Supabase Auth (`site_url`, `additional_redirect_urls`, SMTP, `password_min_length = 12`, HIBP, templates FR).
   - Revalider `public.platform_admins` (`supabase/manual/platform_superadmin_account.sql`).
5. **Contrôles de vérification post-restauration** :
   - [ ] `marketplace_list_salons()` retourne les salons publiés attendus et leurs logos/photos `salon-media` répondent en `200`.
   - [ ] Connexion ERP sur un salon témoin : planning, historique caisse, fidélité, stocks et téléchargement d'un justificatif signé (`expense-attachments`) fonctionnent.
   - [ ] Sonde `/admin` -> Notifications OK (`email.configured = true`, `whatsapp.configured = true`).
   - [ ] Désactiver `maintenance_mode` et consigner l'incident + le RTO/RPO mesuré.

### 5.4 Test périodique de restauration (exercice trimestriel)

- Au moins une fois par trimestre (et avant toute bascule majeure), restaurer le dernier dump + snapshot Storage dans un **projet Supabase isolé de test**.
- Mesurer le temps total jusqu'à service opérationnel (RTO) et vérifier l'intégrité référentielle (`appointments`, `payments`, `cash_sessions`, `stock_movements`, `expenses`, `storage.objects`) ainsi que le jeu de tests `npm run test:supabase`.
