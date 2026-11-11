# P2 — Fiabiliser les parcours client et salon : scénarios E2E navigateur

> **Date** : 10 novembre 2026 · **Branche** : `arena/5e88df37-barber-google`
> **Demande** : les fonctions de réservation et de caisse sont bien séparées, mais certains parcours méritent des tests intégrés (réservation, confirmation, annulation, paiement en attente, remboursement, notification, avis vérifié). Le dépôt avait des tests spécialisés mais **aucune dépendance ni aucun scénario Playwright** pour des tests navigateur.

## 1. Ce qui a été ajouté

| Élément                                     | Rôle                                                                                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/parcours-reservation.spec.ts`          | Réservation depuis la vitrine publique → file de notification → confirmation par le salon (ERP) → suivi puis annulation depuis le portail client.                                                                                                               |
| `e2e/parcours-avis.spec.ts`                 | Avis **vérifié** déposé depuis le portail d'un rendez-vous terminé et réglé, puis affiché sur la vitrine publique.                                                                                                                                              |
| `e2e/parcours-caisse.spec.ts`               | Paiement Wave **en attente de vérification** → confirmation manuelle (référence + note de preuve) → **remboursement** via écriture de correction, reflétés dans le journal de caisse.                                                                           |
| `e2e/helpers.ts`                            | Constantes du jeu de données + client Supabase `service_role` (Node uniquement) pour auditer l'état de la base (RDV, `appointment_notifications`, `payments`).                                                                                                  |
| `supabase/e2e-seed.sql`                     | Jeu de données déterministe (UUID fixes) chargé par `supabase db reset` : compte propriétaire, salon publié, horaires 7j/7, prestations, barbier, RDV terminé + payé, RDV confirmé avec paiement Wave en attente.                                               |
| `supabase/config.toml` (`[db.seed]`)        | Activation du seed local/CI — jamais propagé vers un projet distant (`db push` n'envoie que les migrations).                                                                                                                                                    |
| `database/tests/supabase-e2e-seed.test.mjs` | Garde-fou permanent (`npm test` / `test:supabase`) : rejoue toutes les migrations + le seed dans PGlite et vérifie les invariants dont dépendent les scénarios (créneaux de demain, `can_review`, avis vérifié serveur, paiements Wave, file de notifications). |
| `playwright.config.ts` + `npm run e2e`      | Chromium (desktop) + Chrome mobile (Pixel 7), serveur Vite lancé automatiquement avec les variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` locales.                                                                                                     |
| `.github/workflows/e2e.yml`                 | CI dédiée : `supabase db reset` (migrations + seed), export des clés locales, exécution Playwright, archive du rapport HTML en cas d'échec.                                                                                                                     |

## 2. Parcours demandés → couverture

| Parcours demandé    | Couverture E2E navigateur                                                                                                           | Vérification complémentaire                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Réservation         | ✅ Vitrine `/salons/:slug` → prestation → créneau de demain → formulaire → écran « EN ATTENTE DE CONFIRMATION »                     | —                                                                                            |
| Notification        | ✅ Lecture de la file `appointment_notifications` après chaque étape (`booking_received`, `booking_confirmed`, `booking_cancelled`) | L'envoi réel reste dans la file : Edge `notifications-dispatcher` couvert par `test:journey` |
| Confirmation        | ✅ Le propriétaire confirme la demande en ligne depuis `/app/demandes-en-ligne`                                                     | —                                                                                            |
| Annulation          | ✅ Portail `/reservation#jeton` → « Annuler ma réservation » → badge « Annulée », bouton retiré                                     | —                                                                                            |
| Paiement en attente | ✅ Carte « Paiements en attente de vérification » de la caisse, seedée Wave                                                         | Machine à états financière : `database/tests/supabase-finance.test.mjs`                      |
| Remboursement       | ✅ « Corriger » → remboursement avec motif/preuve → écriture « Remboursement » dans le journal                                      | Bornes et contrepassations : `supabase-finance.test.mjs`                                     |
| Avis vérifié        | ✅ Portail d'un RDV `completed` + payé → note + commentaire → badge « VÉRIFIÉ » → visible sur la vitrine                            | Éligibilité serveur : `marketplace_submit_review` (status `completed`, un avis par RDV)      |

## 3. Hors périmètre assumé (et pourquoi)

- **Inscription / onboarding ERP** : la création de compte exige la confirmation e-mail (SMTP local par défaut, plafonné) — l'étape serait manuelle et non déterministe en E2E. Les tests d'onboarding existent en JSDOM (`npm run test:onboarding`). Reste tracé au backlog (« Tests E2E auth & SuperAdmin »).
- **Revue SuperAdmin** : nécessite le compte opérateur `platform_admins` (script manuel `supabase/manual/platform_superadmin_account.sql`).
- **Envoi réel e-mail / WhatsApp / SMS** : dépend de secrets opérateur (Resend, WhatsApp Cloud API) ; l'E2E vérifie la **file** et ses événements, pas le transport.
- **Paiement mobile automatique (webhook marchand)** : chantier séparé « Encaissement Mobile Money automatisé » — aujourd'hui le produit assume la preuve manuelle, c'est ce parcours qui est testé.
- **Rapports/exports, fidélité avancée** : couverts par les suites PGlite (`test:finance`, `test:journey`).

## 4. Exécution

```bash
supabase start && supabase db reset   # migrations + seed E2E
export $(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')
npm run e2e                           # 3 scénarios × 2 projects (desktop + mobile)
```

- `workers: 1` : les scénarios partagent la base locale seedée ; chaque scénario est indépendant et relit l'état côté base avec la clé `service_role`.
- Le seed n'est appliqué qu'en local/CI (`db reset`) ; `db push --linked` n'envoie jamais les seeds.
- En cas d'échec en CI : artefact `playwright-report` (trace + HTML).

## 5. Garde-fous

- Aucune donnée E2E en production : UUID fixes étiquetés « E2E », seed isolé des migrations.
- Le jeton de portail du RDV « avis » est fixe (`bbbbbbbb-…`), celui du scénario de réservation est relu en base (jamais dans l'URL loguée côté produit : fragment `#` nettoyé par l'app).
- Le lint/format/typecheck couvrent `e2e/` et `playwright.config.ts` (globales Node ajoutées à la config ESLint existante).
