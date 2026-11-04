# LOT 7 — Marketplace et réservation en ligne

**Date :** 4 novembre 2026
**Projet Supabase :** `rozsykrjrncbupzmauzj` (`eu-west-3`, ACTIVE_HEALTHY)
**Branche :** `arena/65268ae8-barber-google`
**Statut :** ✅ terminé, appliqué au distant, documenté.

> Gouvernance (`docs/MISEAJOUR.md` §3.2) : chaque affirmation est vérifiée par
> lecture/exécution. Les faits sont tagués **[Vérifié]** (lu/exécuté),
> **[Implémenté]** (code livré et testé localement), **[À vérifier]** (non
> prouvé en conditions réelles). Montants en **XOF entiers**, fuseau
> **Africa/Abidjan**.

---

## 1. Objectif et périmètre

Rendre la marketplace réelle et utile, conformément à `docs/AMELIORATIONS.md` §4 :

- **7.1 Publication contrôlée** — un salon n'est visible publiquement que s'il est
  publié ; remplacement de `INITIAL_SALONS` par une requête Supabase. **[Implémenté]**
- **7.2 Fiche publique réelle** — services, horaires, photos, avis vérifiés dans
  `SalonDetailModal`. **[Implémenté]**
- **7.3 Réservation en ligne** — réutilise les règles de créneaux du Lot 5 ;
  confirmation/annulation client par jeton secret. **[Implémenté]**
- **7.4 Recherche** — ville / commune / quartier / catégorie (Abidjan d'abord).
  **[Implémenté]**
- **7.5 Notifications** — outbox e-mail/WhatsApp/rappel 24 h ; **aucun envoi réel**
  tant que le fournisseur n'est pas branché. **[Implémenté — outbox honnête]**

Hors périmètre : paiement en ligne au moment de la réservation (le règlement se
fait au salon, caisse Lot 6) ; envoi réel e-mail/WhatsApp/SMS ; retrait d'Express.

---

## 2. Migrations appliquées (3)

Appliquées via le connecteur Supabase, chacune dans `begin; … commit;` avec une
ligne dans `supabase_migrations.schema_migrations`. **[Vérifié]**

| Version          | Nom                         | Contenu                                                                                                                                                  |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261104110000` | `marketplace_profile`       | Colonnes vitrine `salons`, `update_salon_profile`, `set_salon_publication`, `marketplace_list_salons`, `marketplace_salon_detail`                        |
| `20261104110100` | `marketplace_booking`       | `marketplace_day_availability`, `marketplace_book_appointment`, `marketplace_get_booking`, `marketplace_cancel_booking`, jeton d'annulation, idempotence |
| `20261104110200` | `appointment_notifications` | Table outbox + trigger d'enqueue, RLS lecture membres                                                                                                    |

### 2.1 Particularité de compatibilité noyau

Le noyau **local** (`20261103160000`) créait `salons` avec
`isPublishedOnMarketplace` / `nextAvailableSlot` non quotés, repliés en minuscules
par PostgreSQL. Le noyau **distant** appliqué ne contenait que
`id, organization_id, name, created_at`. **[Vérifié]**

`110000` est donc défensif : il renomme `ispublishedonmarketplace` s'il existe,
sinon ajoute `is_published` ; toutes les colonnes vitrine utilisent
`add column if not exists`. La migration s'applique proprement sur les deux
états (PGlite local et distant). **[Vérifié]**

### 2.2 Modèle de sécurité publique

- **Aucune table métier ouverte en lecture `anon`.** Les lectures publiques
  passent exclusivement par des RPC `security definer` qui ne renvoient que les
  salons **publiés**. **[Vérifié]**
- Grants `anon` : `EXECUTE` sur `marketplace_list_salons`,
  `marketplace_salon_detail`, `marketplace_day_availability`,
  `marketplace_book_appointment`, `marketplace_get_booking`,
  `marketplace_cancel_booking`. **[Vérifié]**
- `anon` n'a **pas** `EXECUTE` sur `update_salon_profile` /
  `set_salon_publication` (réservés aux membres `salon.update`). **[Vérifié]**
- `marketplace_salon_detail` n'expose aucun téléphone/e-mail client ; le staff
  public est limité à `id, name, role, specialties, service_ids`. **[Implémenté]**

---

## 3. Contrat backend (résumé)

### 3.1 Profil & publication (`110000`)

- `update_salon_profile(uuid, jsonb)` : propriétaire uniquement, champs
  whitelistés (nom, slug, type, tagline, description, logo/cover en URL
  `http(s)`, galerie ≤ 12 items URL, localisation, contacts, `payment_methods`
  ⊆ `{cash, wave, orange_money, mtn_momo, moov_money, card}`,
  `featured_service_ids` validés comme services du salon). **[Implémenté]**
- `set_salon_publication(uuid, bool)` : publier exige ≥ 1 service actif + adresse
  - téléphone + photo de couverture ; `publication_date` posée une seule fois.
    **[Implémenté]**
- `marketplace_list_salons(query, commune, city, category, limit)` : cartes avec
  note et nombre d'avis **vérifiés**, prix minimum et nombre de services actifs ;
  limite 1–100. **[Implémenté]**
- `marketplace_salon_detail(key)` : par slug ou id, publié uniquement ; renvoie
  salon + services + staff public + avis vérifiés + succursales/horaires.
  **[Implémenté]**

### 3.2 Réservation publique (`110100`)

- `marketplace_day_availability(salon, date, service?, staff?)` : publié
  uniquement, date aujourd'hui → +60 j, créneaux 08 h → 19 h via
  `private.is_slot_available` (mêmes horaires succursale, horaires/absences staff
  et anti-chevauchement que le planning interne). **[Implémenté]**
- `marketplace_book_appointment(...)` : statut **`pending`**, source
  `marketplace`, paiement `unpaid`, `created_by` nul ; fenêtre `now+5 min` →
  `+60 j` ; ≤ 5 réservations / téléphone / salon / jour ; choix automatique du
  staff + verrou `for update` + fallback succursale + contrôle de créneau ;
  **idempotence** par `public_idempotency_key` (rejeu = même résumé, jeton
  inclus). **[Implémenté]**
- `marketplace_get_booking` / `marketplace_cancel_booking` : par jeton secret ;
  annulation seulement `pending`/`confirmed`, journalise `previous → cancelled`.
  **[Implémenté]**

### 3.3 Notifications (`110200`)

- `appointment_notifications` : canaux `email/whatsapp/sms`, kinds
  `booking_received/confirmed/cancelled/reminder_24h`, statuts
  `pending/sent/failed/skipped`, `scheduled_at`. **[Implémenté]**
- Trigger `after insert or update of status` : enqueue e-mail + WhatsApp, et
  rappel 24 h si le rendez-vous est à > 24 h. Se déclenche aussi pour les
  rendez-vous internes (`create_appointment`). **[Implémenté]**
- RLS lecture membres (`appointments.read`), `authenticated` uniquement.
  **Aucun envoi réel** : le fournisseur (edge function + secret) reste à brancher ;
  le statut `pending` est honnête. **[Implémenté / À vérifier pour l'envoi]**

---

## 4. Frontend branché

- `src/lib/marketplace.ts` : client typé des RPC publiques (liste, détail,
  disponibilités, réservation, lecture/annulation par jeton, profil,
  publication). **[Implémenté]**
- `AppContext` : charge les salons publiés en mode marketplace
  (`refreshMarketplace`, états `marketplaceLoading/Error`), remplace
  `INITIAL_SALONS` ; `updateSalonDetails` persiste via `update_salon_profile` ;
  `setSalonPublished`, `bookPublicAppointment`, `cancelPublicBooking`.
  **[Implémenté]**
- `SalonDetailModal` réécrit : fiche publique réelle, créneaux réels
  (`marketplace_day_availability`), réservation publique → `pending` + jeton
  d'annulation, avis vérifiés uniquement, **pas de paiement à la réservation**,
  lien WhatsApp manuel. **[Implémenté]**
- `ShopView` : bouton **Publier / Retirer** réel (`set_salon_publication`),
  désactivé tant que les prérequis ne sont pas remplis. **[Implémenté]**
- `SalonProfileSettingsView` : uploads base64 remplacés par des **champs URL
  HTTPS** (logo, couverture) ; le RPC refuse les URL non `http(s)`.
  **[Implémenté]**
- `MarketplaceHome` : états de chargement/erreur, liste issue de Supabase,
  recherche/filtres existants conservés. **[Implémenté]**

---

## 5. Validation

- **PGlite** : les 12 migrations s'appliquent proprement. **[Vérifié]**
- `npm run test:supabase` : **32/32** (core, branch-hours, operations, finance,
  marketplace). Le fichier `database/tests/supabase-marketplace.test.mjs`
  couvre 6 scénarios : seed multi-tenant, publication/visibilité, disponibilités
  publiques, réservation anon (idempotence, conflit, annulation, outbox),
  confirmation + filtres de recherche, refus d'accès direct aux tables par
  `anon`. **[Vérifié]**
- `npm run typecheck` ✓, `npm run lint` ✓, `npm run build` ✓. **[Vérifié]**
- Tests React ciblés : `marketplace-navigation` 2/2, `onboarding-flow` 3/3.
  **[Vérifié]**
- Aperçu dev : HTTP 200. **[Vérifié]**

> Les 52 échecs `bc_*` de la suite legacy complète sont **préexistants**
> (vérifiés par stash) et hors périmètre Supabase.

---

## 6. Vérification distante (après application)

Requêtes exécutées sur `rozsykrjrncbupzmauzj` : **[Vérifié]**

- `supabase_migrations.schema_migrations` : **12 versions**.
- Tables `public` : **24**, toutes **RLS activée** (`relrowsecurity`).
- RPC `public.marketplace_%` : **6**.
- `appointment_notifications` : présente ; `salons.is_published` : présent.
- Grants `anon` : `EXECUTE` = true sur les 6 RPC publiques ; false sur
  `update_salon_profile` / `set_salon_publication` ; `SELECT` direct sur
  `salons` = false ; **0 policy `anon`**.

---

## 7. Limites et risques assumés

- **Notifications non envoyées** : outbox `pending` uniquement. Brancher une edge
  function + secret fournisseur (e-mail d'abord) avant de promettre des rappels.
  **[À vérifier]**
- **Formes HTTP PostgREST** des RPC `jsonb`/composite non vérifiées en conditions
  réelles depuis le navigateur (tests PGlite + grants seulement). **[À vérifier]**
- **Paiement** : aucun encaissement en ligne à la réservation ; règlement au
  salon via la caisse (Lot 6). Choix produit assumé.
- **Risque hérité non corrigé** : `NewPaymentModal` `useEffect` sur
  `getAppointmentBalance` peut boucler (signalé au Lot 6, hors périmètre Lot 7).
- **Retrait d'Express** : toujours conditionné à l'audit complet de parité des
  contrats legacy.

---

## 8. Prochaine étape recommandée

**Lot 8 — CRM, fidélité et stocks avancés** (`docs/AMELIORATIONS.md` §5) :
fidélité réelle sur événements confirmés + payés, historique append-only,
segmentation client, stocks avancés. Quick wins transverses restants : e-mails
auth en français, politique mot de passe 12 caractères, code-splitting des
routes, Supabase Storage pour les images (aujourd'hui des URL).
