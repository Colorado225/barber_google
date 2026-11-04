# Parcours client complet — les 6 chaîons manquants, implémentés

**Date :** 4 novembre 2026
**Branche :** `arena/65268ae8-barber-google`
**Périmètre :** les 6 points listés en §11 de `docs/WORKFLOW-CLIENT-MARKETPLACE.md`.
**Devise :** XOF, montants entiers. **Fuseau :** `Africa/Abidjan`.

Conventions de statut utilisées dans tout ce document (voir `docs/MISEAJOUR.md` §3.2) :

- **[Vérifié]** : constaté en lisant le code ou en exécutant une requête / un test.
- **[Implémenté]** : écrit, testé localement, appliqué au projet distant.
- **[À activer]** : le code est en place, mais une action de l'exploitant est
  nécessaire (clé fournisseur, nom de domaine). Ce n'est **pas** présenté comme
  fonctionnel tant que cette action n'est pas faite.

---

## 1. Résumé

| #   | Chaînon                                    | État                                                  | Où                                                 |
| --- | ------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------- |
| 1   | Page client persistante « Ma réservation » | **[Implémenté]**                                      | `/reservation/:token`, `BookingPortalView.tsx`     |
| 2   | Envoi réel des notifications               | **[Implémenté]** + **[À activer]** (clés fournisseur) | `supabase/functions/notifications-dispatcher/`     |
| 3   | Inbox ERP des demandes en ligne            | **[Implémenté]**                                      | `/app/demandes-en-ligne`, `OnlineRequestsView.tsx` |
| 4   | CRM automatique par téléphone              | **[Implémenté]**                                      | `private.ensure_client_for_contact`                |
| 5   | Avis vérifié après prestation              | **[Implémenté]**                                      | `marketplace_submit_review` + portail              |
| 6   | Fidélité automatique                       | **[Implémenté]**                                      | `loyalty_*`, `LoyaltyView.tsx`                     |

**Validation [Vérifié]** : `typecheck` ✓, `lint` ✓, `build` ✓,
`test:supabase` **46/46** ✓ (dont 9 nouveaux tests « parcours client »),
tests React ciblés 5/5 ✓, routes `/reservation/:token`,
`/app/demandes-en-ligne`, `/app/notifications` → HTTP 200.

---

## 2. Page client persistante « Ma réservation »

### Problème résolu

Avant, la réservation n'existait que dans l'état React du modal. Fenêtre fermée
= réservation perdue pour le client, qui ne pouvait plus ni suivre ni annuler.

### Fonctionnement

- Chaque réservation possède déjà un **jeton secret** `public_cancel_token`
  (généré en base). Il devient la clé d'une page publique :
  **`/reservation/<jeton>`**.
- La RPC `marketplace_booking_by_token(p_token)` (anonyme, `security definer`)
  renvoie : la réservation, une **fiche salon restreinte** (nom, adresse,
  téléphone, logo — jamais `organization_id` ni donnée interne), l'historique
  des événements, les droits `can_cancel` / `can_review`, l'avis déjà laissé et
  le solde de fidélité.
- Le lien est **copiable** depuis l'écran de confirmation, et mémorisé sur
  l'appareil (`localStorage`, `src/lib/bookingVault.ts`). Une bannière
  « Suivre ma réservation » apparaît sur la marketplace, et `/mes-reservations`
  liste les liens de l'appareil.
- Le lien est aussi injecté dans les e-mails/WhatsApp via le payload
  `booking_token` (voir §3), donc il survit à un changement d'appareil.

### Limites assumées

- Pas de compte client : le jeton **est** le secret. Il est marqué comme
  personnel dans l'UI, et retirables de l'appareil en un clic.
- Aucune table n'est ouverte en lecture `anon` : tout passe par la RPC.

---

## 3. Envoi réel des notifications

### Architecture

```
déclencheur SQL (réservation / confirmation / annulation / fin)
        ↓  écrit dans appointment_notifications (outbox)
planificateur pg_cron (toutes les 5 min)
        ↓  private.invoke_notification_dispatcher() → pg_net
edge function « notifications-dispatcher »
        ↓  claim_due_notifications()  (FOR UPDATE SKIP LOCKED)
        ↓  Resend (e-mail) / Meta WhatsApp Cloud API
        ↓  mark_notification_result()
```

### Garanti par la base **[Vérifié]**

- `claim_due_notifications` est **réservé au rôle `service_role`** : ni `anon`
  ni `authenticated` ne peuvent l'exécuter (testé, SQLSTATE 42501).
- Un message réservé passe `sending` avec un verrou ; s'il reste bloqué plus de
  10 minutes, il est repris. Deux travailleurs ne peuvent pas prendre le même
  message (`SKIP LOCKED`).
- 5 tentatives maximum, compteur `attempts` persistant.
- `retry_notification` (droit `appointments.write`) relance un message `failed`
  ou `skipped` ; il refuse de relancer un message déjà `sent`.

### Honnêteté des statuts

- `sent` **uniquement** si le fournisseur répond 2xx avec un identifiant, stocké
  dans `provider_message_id`.
- `failed` + message d'erreur du fournisseur sinon.
- **Si aucun fournisseur n'est configuré, la fonction ne réserve rien** : la
  file reste `pending` et repartira toute seule dès qu'une clé sera posée.
  Aucun message n'est jamais affiché « envoyé » sans preuve.

### Déclenchement manuel

Bouton **« Traiter la file d'envoi »** dans `/app/notifications`. L'appel part
avec le JWT de l'utilisateur ; la fonction vérifie son identité puis appelle
`can_manage_notifications(salon_id)` (droit `appointments.write`). Un membre
sans ce droit reçoit 403.

### [À activer] — clés fournisseur

Aucune clé e-mail/WhatsApp n'existe sur le projet **[Vérifié]** : seuls les
secrets `SUPABASE_*` étaient présents. **Aucun e-mail réel n'a donc été envoyé,
et ce document ne prétend pas le contraire.**

Pour activer, dans **Dashboard Supabase → Edge Functions → Secrets** :

| Secret                     | Rôle                                              |
| -------------------------- | ------------------------------------------------- |
| `RESEND_API_KEY`           | clé API Resend (e-mail)                           |
| `NOTIFICATIONS_EMAIL_FROM` | expéditeur vérifié, ex. `Salon <resa@domaine.ci>` |
| `WHATSAPP_TOKEN`           | jeton Meta WhatsApp Cloud API                     |
| `WHATSAPP_PHONE_NUMBER_ID` | identifiant du numéro émetteur                    |
| `WHATSAPP_TEMPLATE_PREFIX` | optionnel : active les modèles approuvés          |
| `PUBLIC_APP_URL`           | origine du site, pour le lien « Ma réservation »  |

Déjà posés : `NOTIFICATIONS_DISPATCH_TOKEN`, `WHATSAPP_DEFAULT_COUNTRY_CODE=225`,
`WHATSAPP_TEMPLATE_LANG=fr`, et `PUBLIC_APP_URL` pointant sur l'URL de préversion
— **à remplacer par le domaine de production**.

> Les clés ne doivent jamais être demandées ni collées dans une conversation :
> elles se saisissent uniquement dans le dashboard Supabase.

**WhatsApp — contrainte réelle :** hors d'une fenêtre de 24 h ouverte par le
client, Meta n'accepte que des **modèles approuvés**. Sans
`WHATSAPP_TEMPLATE_PREFIX`, l'envoi se fait en texte libre et échouera hors
fenêtre ; l'erreur du fournisseur est alors affichée telle quelle dans l'ERP.
Avec le préfixe, la fonction envoie `<préfixe>_<kind>` avec 5 paramètres
(nom client, salon, prestation, date/heure, lien).

### Planificateur

- `pg_cron` + `pg_net` installés, tâche `dispatch-appointment-notifications`
  (`*/5 * * * *`) **[Vérifié]**.
- La configuration vit dans `private.notification_dispatch_config`, **non
  exposée par l'API**, droits révoqués pour `anon`, `authenticated` et
  `service_role`. Le jeton d'appel n'est **pas** dans le dépôt.
- Pour tout arrêter : `update private.notification_dispatch_config set is_enabled = false;`
  ou `select cron.unschedule('dispatch-appointment-notifications');`

### Preuve d'exécution **[Vérifié]**

Appel réel de la fonction déployée depuis la base (`pg_net`) : **HTTP 200**,
corps `{"processed":0,...,"provider_configured":false,"message":"Aucun
fournisseur configuré : la file est conservée telle quelle."}`, et la file
réelle du projet est restée `pending / 0 tentative`.

> Incident maîtrisé : un premier appel de test (avant l'ajout du garde-fou) a
> consommé une notification réelle du salon et l'a marquée `skipped`. Elle a été
> **remise exactement dans son état initial** (`pending`, `attempts = 0`,
> `error = null`). Aucune autre donnée de production n'a été modifiée.

---

## 4. Inbox ERP des demandes en ligne

- Nouvel onglet **« Demandes en ligne »** (`/app/demandes-en-ligne`) avec
  **badge chiffré** dans la barre latérale = nombre de réservations marketplace
  `pending`.
- Filtres : À confirmer / Confirmées à venir / Historique / Toutes.
- Chaque demande affiche client, prestation, montant XOF, créneau, coiffeur,
  téléphone, e-mail, **rattachement CRM**, ancienneté et note du client.
- Actions **Confirmer** / **Refuser** (motif obligatoire, ≥ 3 caractères),
  réservées au droit `appointments.write`.
- Le planning gagne un badge **« En ligne »** et un filtre
  « Réservations en ligne » en plus de « Sans rendez-vous ».

---

## 5. CRM automatique, sans doublon

- `private.normalize_phone()` met le numéro en chiffres, retire `00` et
  l'indicatif `225` : `+225 07 00 00 00 02`, `00225…` et `0700000002` désignent
  **la même personne**. Index `clients_salon_phone_normalized_idx`.
- `private.ensure_client_for_contact()` retrouve la fiche ou la crée, sous
  **verrou consultatif de transaction** (deux arrivées simultanées du même
  numéro ne créent pas deux fiches).
- Branché sur `marketplace_book_appointment` **et** `register_walk_in` :
  `appointments.client_id` est désormais renseigné.
- Une fiche existante n'est **jamais renommée** ; seul un e-mail manquant peut
  être complété.
- Sans téléphone exploitable (< 6 chiffres), **aucune fiche n'est créée** :
  le client de passage anonyme reste anonyme.
- **Aucune reprise rétroactive** : les réservations antérieures ne sont pas
  rattachées automatiquement.

### Correctif bloquant découvert au passage **[Vérifié]**

La contrainte `clients_email_check` du noyau contenait `\\.` dans son littéral
SQL : la regex exigeait un **antislash littéral**, donc **toute adresse e-mail
valide était rejetée** — ce qui rendait toute notification e-mail impossible.
Corrigée par la migration `20261104130400` (le noyau appliqué n'est pas modifié).

---

## 6. Avis vérifié après prestation

- À la fin de la prestation (`completed`), le déclencheur met en file une
  **invitation à noter** (e-mail + WhatsApp), **différée de 2 heures**, contenant
  le lien de suivi.
- Sur le portail, le formulaire n'apparaît que si `can_review` est vrai, c.-à-d.
  rendez-vous `completed` **et** aucun avis existant.
- `marketplace_submit_review(p_token, p_rating, p_comment, p_author)` :
  - note 1–5, commentaire 3–1000 caractères ;
  - refuse si la prestation n'est pas terminée ;
  - **un seul avis par rendez-vous** (index unique + contrôle) ;
  - `verified = true` car le jeton prouve la réservation et le statut prouve la
    prestation ;
  - l'avis alimente immédiatement la note publique du salon.
- Modération inchangée : suppression par le propriétaire/manager
  (`reviews.moderate`).

---

## 7. Fidélité automatique

### Règle

Points crédités **uniquement** quand le rendez-vous est `completed` **et**
`payment_status = 'paid'`, pour un client rattaché au CRM.

Barème par défaut : **1 point / 100 XOF** (4 000 XOF → 40 points), modifiable.
Seuils : Argent 100, Or 250, VIP 500. Bonus de bienvenue : 0 par défaut.

### Invariants **[Vérifié par tests]**

- **Un seul gain par rendez-vous** (index unique partiel) : rejouer le
  déclencheur ne crédite rien de plus.
- Un paiement mobile money **non rapproché** reste `pending` → **aucun point**.
  Les points n'arrivent qu'après `confirm_pending_payment`.
- **Remboursement** → reprise automatique des points, plafonnée au solde
  disponible : un solde ne devient **jamais négatif**. Une seule reprise par
  rendez-vous.
- Journal **append-only** : `UPDATE`/`DELETE` refusés (42501).
- Consommation d'une récompense **atomique** (verrou de ligne), plafonnée au
  solde, avec compteur `times_redeemed`.
- Ajustement manuel : droit `loyalty.write`, motif obligatoire ≥ 3 caractères,
  tracé avec son auteur.
- Lecture seule côté navigateur : aucune écriture directe, tout passe par RPC.

### Écran

`/app/fidelite` affiche désormais : compteurs, règle d'attribution éditable,
soldes et paliers par client, consommation de récompense, ajustement motivé,
catalogue et **journal réel des mouvements**. La mention « indisponible tant
qu'une API persistante n'est pas configurée » a disparu.

---

## 8. Migrations appliquées au projet distant

Projet `rozsykrjrncbupzmauzj`. Toutes appliquées en transaction et enregistrées
dans `supabase_migrations.schema_migrations`. **Ne pas les réappliquer.**

| Version          | Contenu                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `20261104130000` | `crm_auto_link` — normalisation téléphone, `ensure_client_for_contact`, RPC de réservation et walk-in liées au CRM |
| `20261104130100` | `loyalty_ledger` — 3 tables, 4 index, 3 déclencheurs, 6 fonctions, RLS                                             |
| `20261104130200` | `notification_dispatch` — statut `sending`, kind `review_request`, 4 colonnes, claim/mark/retry                    |
| `20261104130300` | `booking_portal` — `marketplace_booking_by_token`, `marketplace_submit_review`                                     |
| `20261104130400` | `client_email_check_fix` — correction de la regex e-mail du noyau                                                  |
| `20261104130500` | `notification_scheduler` — pg_cron/pg_net, config privée, planification                                            |

### Vérification après application **[Vérifié]**

- **19 versions** dans le journal de migrations.
- 3 tables de fidélité, 3 déclencheurs, 4 colonnes outbox, `rewards.times_redeemed`.
- Droits : `anon` EXECUTE sur le portail et l'avis ; `anon` **et** `authenticated`
  **refusés** sur `claim_due_notifications` ; `service_role` autorisé sur
  claim/mark ; `anon` refusé sur `redeem_loyalty_reward`.
- **Parité code source** : les **20 fonctions** déployées ont une empreinte
  `md5(prosrc)` **identique octet pour octet** aux fichiers de migration locaux.

---

## 9. Ce qui reste ouvert

| Point                                                       | État                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Clés fournisseur e-mail / WhatsApp                          | **[À activer]** par l'exploitant — aucun envoi réel tant que ce n'est pas fait |
| `PUBLIC_APP_URL` = domaine de production                    | **[À activer]** — actuellement l'URL de préversion                             |
| Modèles WhatsApp approuvés par Meta                         | **[À activer]** si envoi hors fenêtre de 24 h                                  |
| SMS                                                         | Non implémenté : le canal est marqué `skipped` (`channel_not_supported`)       |
| Rattachement rétroactif des réservations antérieures au CRM | Non fait, volontairement                                                       |
| Temps réel multi-postes (point 7 du §11)                    | Hors périmètre de ce lot                                                       |
| 52 tests `bc_*` du backend Express legacy                   | Rouges **avant** ce lot (préexistant, vérifié par stash)                       |

---

## 10. Rejouer la validation

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:supabase     # 46/46
npm run test:journey      # 9/9 — parcours client complet
npm run test:marketplace
npm run test:onboarding
npm run build
```
