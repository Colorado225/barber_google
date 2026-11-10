# P2 — Évaluation SEO, cohérence de langue et stratégie de pré-rendu

## 1. Constat initial et corrections immédiates

### 1.1 Cohérence linguistique (`index.html` & balises sociales)

- **Problème initial** : `index.html` déclarait `<html lang="en">` alors que l'ensemble de l'interface, des métadonnées par défaut (`DEFAULT_MARKETPLACE_CONTENT.siteMetadata`) et des contenus métier est rédigé en français. Par ailleurs, `og:locale` était absent et les balises statiques `<title>`, `<meta name="description">`, `og:title` et `og:description` différaient de la configuration runtime.
- **Correction appliquée** :
  - `index.html` passe à `<html lang="fr">`, aligne les textes statiques sur `BarberCuts | Réservez votre barbier en ligne`, ajoute `<meta name="robots" content="index, follow" />`, `<meta property="og:locale" content="fr_FR" />`, `<meta property="og:site_name" content="BarberCuts" />`, `twitter:title` et `twitter:description`.
  - Les garanties de confidentialité existantes (`<meta name="referrer" content="no-referrer" />` et absence de préchargement global de Google Fonts) sont intégralement conservées.

### 1.2 Audit des métadonnées par route (`src/lib/seo.ts` & `src/hooks/useSiteMetadata.ts`)

Auparavant, `SiteMetadataSync` dans `src/App.tsx` appliquait systématiquement les métadonnées génériques de la marketplace sur toutes les routes hors `/admin` et portail de réservation — ce qui écrasait `/salons/:slug` et `/tarifs` avec le titre de la page d'accueil.

La nouvelle résolution centralisée (`resolvePageMetadata`, `buildSalonSeoMetadata`, `useSiteMetadata`, `usePageSeo`) garantit pour chaque route :

| Route                                                       | Indexation (`robots`)                                            | Canonical       | Métadonnées & Données structurées                                                                                                                                                                                                                                                           |
| :---------------------------------------------------------- | :--------------------------------------------------------------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                                         | `index, follow`                                                  | `/`             | Titre/description configurables (`siteMetadata`), OG/Twitter, JSON-LD `WebSite` (`inLanguage: "fr"`)                                                                                                                                                                                        |
| `/salons/:slug`                                             | `index, follow` (ou `noindex, nofollow` si suspendu/introuvable) | `/salons/:slug` | Titre dynamique `${salon.name} — ${commune}, ${city} \| BarberCuts`, description tronquée ≤ 160 car., `og:type="business.business"`, `og:image`, JSON-LD `HairSalon` (`PostalAddress`, `OpeningHoursSpecification`, `OfferCatalog`, `AggregateRating` réel uniquement si `reviewCount > 0`) |
| `/tarifs`, `/pricing`                                       | `index, follow`                                                  | `/tarifs`       | Titre/description dédiés SaaS en français, OG/Twitter, JSON-LD `WebPage` (`inLanguage: "fr"`)                                                                                                                                                                                               |
| `/inscription`, `/register`                                 | `index, follow`                                                  | `/inscription`  | Titre/description dédiés création de compte professionnel, OG/Twitter                                                                                                                                                                                                                       |
| `/connexion`                                                | `noindex, nofollow`                                              | `/connexion`    | Page utilitaire d'authentification désindexée                                                                                                                                                                                                                                               |
| `/verifier-email`, `/mot-de-passe-oublie`, `/reinitialiser` | `noindex, nofollow`                                              | Chemin courant  | Pages utilitaires d'authentification désindexées                                                                                                                                                                                                                                            |
| `/app/*`, `/vitrine`                                        | `noindex, nofollow`                                              | —               | Espace ERP privé désindexé                                                                                                                                                                                                                                                                  |
| `/admin`, `/admin/*`                                        | `noindex, nofollow`                                              | `/admin`        | Console SuperAdmin désindexée via `usePageSeo` sans conflit avec le skip `SiteMetadataSync`                                                                                                                                                                                                 |
| `/reservation`, `/reservation/:token`, `/mes-reservations`  | `noindex, nofollow, noarchive`                                   | **Supprimé**    | `applyStrictPortalPrivacy()` purge tout `<link rel="canonical">`, `og:*`, `twitter:*`, `JSON-LD` et lien Google Fonts en cas de navigation SPA entrante, et maintient `referrer="no-referrer"` + `lang="fr"`                                                                                |

De plus, `public/robots.txt` autorise explicitement `/`, `/salons/`, `/tarifs`, `/inscription` et bloque l'indexation de `/app/`, `/admin`, `/reservation`, `/mes-reservations`, `/connexion`, `/verifier-email`, `/mot-de-passe-oublie`, `/reinitialiser` et `/vitrine`.

---

## 2. Évaluation : SSR vs Pré-rendu (SSG / Edge Hybrid) pour `/salons/:slug`

### Option A — Rendu client pur (CSR, statu quo initial)

- **Fonctionnement** : Le serveur renvoie un `index.html` générique unique ; React charge les scripts puis appelle `marketplace_salon_detail` avant de modifier `document.title` et `<meta>`.
- **Limites constatées** :
  1. **Aperçus riches cassés sur messageries et réseaux sociaux** : WhatsApp, Meta/Facebook, iMessage, X/Twitter et LinkedIn n'exécutent pas JavaScript lors du partage d'un lien `/salons/mon-salon` ; le partage affiche toujours le titre/image générique BarberCuts au lieu du nom, de la commune et de la photo de couverture du salon.
  2. **Indexation différée et incomplète** : les moteurs secondaires et robots légers ne bénéficient ni de `og:image`, ni du JSON-LD `HairSalon`, ni d'un HTML initial sémantique `<h1>` / liste de prestations.
- **Verdict** : **Insuffisant** comme unique mécanisme pour les fiches publiques.

### Option B — Pré-rendu statique pur au build (SSG)

- **Fonctionnement** : Génération de fichiers HTML statiques dans `dist/` au moment de `npm run build`.
- **Avantages** : Zéro latence serveur, coût nul, compatible avec tout hébergement statique (CDN Vercel/Netlify/Cloudflare).
- **Limites pour `/salons/:slug`** :
  1. Le catalogue de salons vit dans **Supabase PostgreSQL** (`public.salons`, `services`, `branches`, `reviews`) et évolue en continu sans redéploiement frontend (nouveau salon publié, changement de tarif, suspension immédiate par le SuperAdmin).
  2. Un SSG pur au build publierait des pages obsolètes ou omettrait les nouveaux salons tant qu'un pipeline CI ne reconstruit pas `dist/`.
- **Verdict** : **Optimal pour les pages marketing statiques** (`/`, `/tarifs`, `/inscription`, `sitemap.xml` de base) via `scripts/prerender-public.mjs`, mais **insuffisant seul pour `/salons/:slug`**.

### Option C — SSR complet (migration vers Next.js / serveur Node dédié)

- **Fonctionnement** : Exécution d'un serveur React SSR pour chaque requête entrante (ou réécriture complète de l'application sous Next.js / React Router Framework SSR).
- **Coût et risques pour ce dépôt** :
  1. L'application repose sur Vite 8 + React Router 7 SPA, un contexte `AppContext` client, `localStorage` et **44 RPC Supabase** déjà sécurisées côté base (`security definer` + RLS).
  2. Introduire un serveur Node SSR impose de gérer des secrets ou proxys SSR, d'adapter tous les accès `window`/`localStorage` au rendu serveur (y compris les flux ERP/Admin qui n'ont **aucun besoin SEO**), d'alourdir le runtime et d'augmenter le risque de régression sur l'isolation du portail secret (`/reservation/:token`).
- **Verdict** : **Surdimensionné** (coût d'ingénierie et de maintenance disproportionné par rapport au besoin SEO ciblé sur 4 routes publiques).

### Option D — Architecture retenue : Hybride Statique (SSG build-time) + Edge Pre-rendering (`salon-seo`)

Cette approche combine les bénéfices du SSG et du SSR sans migrer hors de Vite ni alourdir le bundle client (`+~1.3 kB` gzip seulement pour `src/lib/seo.ts`, bien sous le budget P2) :

1. **Au build (`npm run build` → `vite build && node scripts/prerender-public.mjs`)** :
   - Pré-génère `dist/index.html`, `dist/tarifs/index.html`, `dist/inscription/index.html` et `dist/sitemap.xml` avec `<html lang="fr">`, canoniques, OG/Twitter et JSON-LD.
   - Ces routes statiques sont servies directement depuis le CDN en quelques millisecondes.

2. **À la demande à la périphérie (`supabase/functions/salon-seo/index.ts`) pour `/salons/:slug` et `/sitemap.xml`** :
   - **Zéro dépendance externe** (conforme au runtime Edge du projet déjà validé avec `notifications-dispatcher`).
   - Appelle les RPC publiques existantes `marketplace_salon_detail` et `marketplace_list_salons` (déjà accordées à `anon`).
   - Injecte dans le shell HTML (`PUBLIC_APP_URL/index.html` avec repli autonome) :
     - `<html lang="fr">`, `<title>`, `<meta name="description">`, `<link rel="canonical">` ;
     - Open Graph (`og:type="business.business"`, `og:locale="fr_FR"`, `og:image`, `og:url`) et Twitter Cards ;
     - Données structurées `Schema.org HairSalon` (adresse, horaires réels d'ouverture, catalogue de prestations, note moyenne réelle uniquement si `reviewCount > 0`) ;
     - Contenu sémantique `<main data-prerender="salon-seo">` dans `#root` pour les crawlers sans JS, remplacé proprement lors du montage React côté navigateur.
   - Renvoie `HTTP 404` + `<meta name="robots" content="noindex, nofollow" />` + `X-Robots-Tag: noindex, nofollow` si le salon est inconnu, dépublié ou suspendu.
   - Applique une politique de cache CDN HTTP stricte :
     `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`.

---

## 3. Matrice comparative et plan de mise en production

| Critère                                                 |      CSR pur       |   SSG build-time seul   | SSR complet (Next/Node) |    **Hybride Static + Edge (`salon-seo`)**    |
| :------------------------------------------------------ | :----------------: | :---------------------: | :---------------------: | :-------------------------------------------: |
| Aperçus riches WhatsApp / Meta / X sur `/salons/:slug`  |        Non         | Partiel (figé au build) |           Oui           |            **Oui (données live)**             |
| Fraîcheur après suspension / édition salon              | Immédiate (client) |  Non (rebuild requis)   |        Immédiate        |   **≤ 5–60 min (`stale-while-revalidate`)**   |
| Coût de migration sur `barber_google`                   |        Nul         |         Faible          |       Très élevé        |        **Faible (aucune refonte SPA)**        |
| Impact sur la sécurité du portail `/reservation/:token` |        Nul         |           Nul           |   Risque de fuite SSR   | **Nul (route jamais pré-rendue en Edge SEO)** |
| Impact sur le budget JS initial mobile P2               |        Nul         |           Nul           |         Modéré          |       **Négligeable (`~1.3 kB` gzip)**        |

### Déploiement recommandé (hébergement Vercel / CDN frontal)

Lors de la mise en ligne avec domaine public (`PUBLIC_APP_URL` / `VITE_PUBLIC_SITE_URL`) :

1. Déployer la fonction Edge : `supabase functions deploy salon-seo --no-verify-jwt` (route publique anonyme, sans données sensibles).
2. Configurer le secret Edge `PUBLIC_APP_URL` (ex. `https://barbercuts.ci`).
3. Ajouter deux réécritures CDN frontales (ex. `vercel.json`) ciblant uniquement `/salons/:slug` et `/sitemap.xml` vers l'Edge Function `salon-seo` (ou uniquement sur User-Agent crawler si l'on souhaite garder le cold-start nul pour les navigateurs humains), tout en conservant le fallback SPA vers `/index.html` pour les autres routes.
