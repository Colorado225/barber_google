# Backlog — Améliorations et fonctionnalités à implémenter

> Date : 4 novembre 2026. Établi par audit du code réel (branche `arena/65268ae8-barber-google`).
> Chaque point est marqué **Vérifié** (constaté dans le code), **Probable** (déduction à confirmer)
> ou **À vérifier**, conformément à `docs/MISEAJOUR.md` § 3.2.
> Ce document est une proposition de feuille de route : aucune phase n'est lancée sans accord explicite.

## 1. État des lieux vérifié

| Domaine                                                       | État réel                                                                                                                                            | Preuve                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Auth, onboarding, multi-tenant, RBAC/RLS                      | ✅ Fonctionne sur Supabase                                                                                                                           | `src/context/AuthContext.tsx`, RPC `create_salon`, 16 tables + RLS                   |
| Clients, services, personnel (CRUD)                           | ✅ Fonctionne sur Supabase                                                                                                                           | `src/lib/api.ts`                                                                     |
| Dépenses (liste + création), stock (CRUD), récompenses (CRUD) | ✅ Fonctionne sur Supabase                                                                                                                           | `src/lib/api.ts`                                                                     |
| Horaires des succursales                                      | ✅ Fonctionne sur Supabase                                                                                                                           | `BranchHoursManager.tsx`, migration `branch_hours` appliquée                         |
| Rendez-vous                                                   | ✅ Fonctionne sur Supabase (Lot 5) — création, déplacement, statuts, annulation, disponibilités, historique                                          | `api.ts`, migration `appointment_operations`, `docs/LOT-5-RAPPORT.md`                |
| Horaires & absences du personnel                              | ⚠️ **501** — panneau inutilisable                                                                                                                    | `api.ts`, `StaffSchedulePanel.tsx`                                                   |
| Avis publics                                                  | ⚠️ Lecture seule — création/suppression → 501                                                                                                        | `api.ts`                                                                             |
| Caisse / encaissements                                        | ✅ Fonctionne sur Supabase (Lot 6) — sessions, journal append-only, paiements/corrections, rapports                                                  | `CashRegisterView.tsx`, `AppContext.tsx`, `docs/LOT-6-RAPPORT.md`                    |
| Marketplace                                                   | ✅ Fonctionne sur Supabase (Lot 7) — publication contrôlée, fiche publique, réservation en ligne anon, recherche, outbox notifications               | `marketplace.ts`, `SalonDetailModal.tsx`, `docs/LOT-7-RAPPORT.md`                    |
| Clients de passage / sans rendez-vous                         | ✅ Fonctionne sur Supabase — accueil comptoir, file d'attente, démarrage/fin, encaissement caisse                                                    | `WalkInView.tsx`, `WalkInModal.tsx`, `docs/CLIENTS-DE-PASSAGE.md`                    |
| Fidélité (points, historique)                                 | ✅ Fonctionne sur Supabase — attribution auto sur prestation terminée + payée, journal append-only, reprise sur remboursement, consommation atomique | `LoyaltyView.tsx`, migration `loyalty_ledger`, `docs/PARCOURS-CLIENT-COMPLET.md`     |
| Parcours client en ligne (suivi, avis, CRM, inbox)            | ✅ Fonctionne sur Supabase — portail « Ma réservation » par jeton, avis vérifié, CRM auto par téléphone, inbox ERP avec badge                        | `BookingPortalView.tsx`, `OnlineRequestsView.tsx`, `docs/PARCOURS-CLIENT-COMPLET.md` |
| Envoi réel des notifications                                  | ⚙️ Chaîne complète déployée et testée (cron → edge function → claim/mark) ; **[À activer]** clés fournisseur e-mail/WhatsApp                         | `supabase/functions/notifications-dispatcher/`, `NotificationsView.tsx`              |
| Abonnement SaaS                                               | ❌ Placeholder honnête, pas de facturation                                                                                                           | `SaaSPlanView.tsx`                                                                   |
| Backend Express legacy                                        | ⚠️ Encore présent (`server/`, `database/migrations/bc_*`), plus appelé par le frontend auth                                                          | `docs/supabase-migrations.md`                                                        |

**Conclusion : le socle Supabase est solide et le cœur opérationnel (rendez-vous, caisse, marketplace) est désormais fonctionnel côté Supabase (Lots 5, 6 et 7).** La prochaine étape recommandée est le Lot 8 (CRM/fidélité/stocks) ; le retrait d'Express attend l'audit complet de parité des contrats legacy.

## 2. LOT 5 — Parité opérationnelle Supabase (P1, bloquant) — ✅ TERMINÉ (4 nov. 2026)

> **Statut : terminé et vérifié.** RDV complets, horaires/absences staff et avis
> vérifiés migrés vers Supabase et appliqués au distant ; UI alignée sur la
> machine à états. Voir `docs/LOT-5-RAPPORT.md`. Le retrait d'Express (5.4) est
> reporté après audit complet de parité des contrats legacy (le Lot 6 est livré
> sans retrait d'Express).

Objectif : rendre l'ERP utilisable au quotidien, puis retirer Express.

| #   | Tâche                         | Détail                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Taille | Statut             |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------ |
| 5.1 | **Rendez-vous complets**      | Migration + RPC `create_appointment`, `reschedule_appointment`, `transition_appointment` (machine à états), `cancel_appointment`, `appointment_events` (append-only), `get_availability` (horaires succursale + horaires/absences staff + chevauchements). Porter la logique déjà écrite et testée dans `database/migrations/20261103040000_lot3_operations.sql` vers la lignée Supabase. Brancher `NewAppointmentModal`, `PlanningView`, `TodayView`. | L      | Vérifié (501)      |
| 5.2 | **Horaires & absences staff** | Tables `staff_schedules`, `staff_absences` + RLS ; brancher `StaffSchedulePanel`. Prérequis de 5.1 (disponibilités).                                                                                                                                                                                                                                                                                                                                   | M      | Vérifié (501)      |
| 5.3 | **Avis publics**              | RPC de création liée à un rendez-vous `completed` (avis vérifié), suppression/modération par le salon.                                                                                                                                                                                                                                                                                                                                                 | S      | Vérifié (501)      |
| 5.4 | **Retrait d'Express**         | Une fois 5.1–5.3 validés : supprimer `server/`, lignée `database/migrations/bc_*`, scripts `dev:auth`/`test:auth`, proxy `/api`, dépendances `express`/`pg`/`@aws-sdk/client-s3` si inutilisées.                                                                                                                                                                                                                                                       | M      | Vérifié (présence) |

## 3. LOT 6 — Caisse et finances (P1) — ✅ TERMINÉ (4 nov. 2026)

> **Statut : terminé, testé (PGlite 26/26 sur la suite Supabase), appliqué et
> vérifié sur le distant.** 4 migrations canoniques (`100000` → `100300`),
> 14 RPC, journal append-only, confirmation Mobile Money **manuelle** (pas d'API
> opérateur), rapports nets. Voir `docs/LOT-6-RAPPORT.md`. Le retrait d'Express
> reste conditionné à l'audit complet de parité des contrats legacy.

| #   | Tâche                                  | Détail                                                                                                                                                                                                            | Taille | Statut |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| 6.1 | **Sessions de caisse**                 | Tables `cash_registers`, `cash_sessions` (ouverture/fermeture, fond de caisse, écart constaté, rapprochement) + RLS ; `CashRegisterView` remplacé.                                                                | L      | ✅     |
| 6.2 | **Encaissements**                      | Table `payments` (méthode, montant XOF entier, lien rendez-vous, `payment_status` mis à jour atomiquement, idempotence) ; `NewPaymentModal`, `TodayView`, dashboard branchés.                                     | L      | ✅     |
| 6.3 | **Méthodes marché ivoirien**           | Espèces + Wave / Orange Money / MTN MoMo / Moov Money (+ carte) avec référence opérateur et **preuve manuelle** (référence + note). Intégration API réelle = chantier distinct (**À vérifier** : accès marchand). | M      | ✅     |
| 6.4 | **Remboursements & journal financier** | Annulations/remboursements avec motif et plafond par écriture d'origine, journal append-only, rapports caisse/dépenses (`ReportsView`, `financial_summary`, remboursements déduits, pending exclus).              | M      | ✅     |

## 4. LOT 7 — Marketplace et réservation en ligne (P1/P2, phase 7) — ✅ TERMINÉ (4 nov. 2026)

> Livré : 3 migrations appliquées (`20261104110000/110100/110200`), 32/32 tests
> Supabase, frontend branché (`marketplace.ts`, `SalonDetailModal`, publication
> dans `ShopView`, profil en URL HTTPS). Voir `docs/LOT-7-RAPPORT.md`. Les
> notifications sont une outbox honnête (aucun envoi réel tant que le fournisseur
> n'est pas branché).

| #   | Tâche                                | Détail                                                                                                                                                             | Taille |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 7.1 | **Publication contrôlée des salons** | Champ `is_published` + RPC/page publique en lecture (anon) ; un salon non publié n'est jamais visible. Remplacer `INITIAL_SALONS` par une requête Supabase.        | M      |
| 7.2 | **Fiche publique réelle**            | Services, horaires, photos, avis vérifiés lus depuis Supabase (`SalonDetailModal`).                                                                                | M      |
| 7.3 | **Réservation en ligne**             | Réutiliser les mêmes RPC de disponibilité que le planning interne (5.1) ; confirmation/annulation client.                                                          | L      |
| 7.4 | **Recherche**                        | Par ville/quartier et prestation ; géolocalisation simple d'abord (Abidjan).                                                                                       | M      |
| 7.5 | **Notifications**                    | ✅ Chaîne d'envoi réelle implémentée (outbox + edge function + cron), e-mail Resend et WhatsApp Cloud API. **[À activer]** : clés fournisseur. SMS non implémenté. | M      |

## 5. LOT 8 proposé — CRM, fidélité et stocks avancés (P2, phases 5–6)

- **Fidélité réelle** : points attribués sur événements confirmés (rendez-vous `completed` + payé), historique append-only, consommation atomique des récompenses, anti-double-comptage. Aujourd'hui en état local (**Vérifié**).
- **CRM enrichi** : historique des prestations par client, dernière visite/fréquence calculées, segmentation automatique, préférences.
- **Stocks historisés** : mouvements (entrée/sortie/ajustement avec auteur + raison), fournisseurs, achats/réceptions, inventaires, consommation par prestation, alertes de seuil. Ne jamais modifier une quantité sans trace.
- **Dépenses** : édition/suppression (seule la création existe), catégories personnalisées, pièces jointes (Supabase Storage).

## 6. LOT 9 proposé — Administration SaaS (P2, phase 8)

- Plans Free / Pro / Business avec limites appliquées **côté serveur** (RLS/RPC, pas seulement UI).
- Abonnements, renouvellements, factures, suspension/réactivation.
- Rôle admin SaaS indépendant des rôles salon ; analytics d'usage.
- Paiement des abonnements (**À vérifier** : prestataire de facturation adapté à la Côte d'Ivoire).

## 7. Améliorations techniques transverses

### P1 — à faire avec les lots 5–6

| Point                                     | Détail                                                                                                                  | Statut               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Realtime Supabase**                     | Planning, caisse et dashboard synchronisés entre appareils (plusieurs employés au salon).                               | Vérifié (absent)     |
| **E-mails auth en français + SMTP dédié** | Templates actuellement en anglais, SMTP par défaut limité (~2 e-mails/h) — bloque les tests et la prod.                 | Vérifié (config lue) |
| **Politique de mot de passe**             | Minimum Supabase = 6 caractères ; l'ancienne politique Express exigeait 12. Aligner (12 + contrôle HIBP).               | Vérifié (config lue) |
| **Conflit de dépendances**                | `npm ci` échoue sans `--legacy-peer-deps` (esbuild 0.25 vs vite 8). Aligner les versions pour retirer le contournement. | Vérifié (reproduit)  |

### P2 — qualité et performance (reliquats lot 1)

- **Code-splitting** : bundle principal > 500 kB (L1-10) ; routes `/app` et marketplace en lazy loading.
- **TypeScript `strict` progressif** (L1-11) et découpage d'`AppContext` (790 lignes, L1-08).
- **Supabase Storage** : logos salon, avatars staff, photos marketplace (aujourd'hui champs texte ; le SDK S3 est un reliquat).
- **Tests E2E** (Playwright) sur les parcours critiques : inscription → salon → rendez-vous → encaissement.
- **`site_url` + redirections de production** à configurer au déploiement (actuellement localhost + preview).

### P3 — industrialisation (phase 9)

- PWA / mode dégradé faible connectivité (usage smartphone majoritaire en Côte d'Ivoire).
- Monitoring, logs structurés, sauvegardes + tests de restauration, environnements staging/production.
- Accessibilité, responsive avancé, formats locaux (XOF, `Africa/Abidjan`, dates FR, téléphones CI).

## 8. Ordre recommandé et dépendances

```
LOT 5 (RDV + horaires staff + avis)  ──►  LOT 6 (caisse + paiements)
        │                                      │
        └────────►  LOT 7 (marketplace + résa en ligne)
                           │
                           └──►  LOT 8 (CRM/fidélité/stocks)  ──►  LOT 9 (admin SaaS)
```

1. **Lot 5 — ✅ terminé** : rendez-vous, horaires/absences staff, avis vérifiés.
2. **Lot 6 — ✅ terminé** : caisse, paiements, corrections, journal et rapports financiers.
3. **Lot 7 — ✅ terminé** : marketplace publiée, fiche publique, réservation en ligne anon et outbox de notifications.
4. **Lot 8 — prochaine étape recommandée** : CRM/fidélité/stocks, une fois la base opérationnelle stable.
5. **Lot 9** : admin SaaS.
6. Les améliorations techniques P1 accompagnent les lots 5–7 ; le reste en continu.

**Quick wins immédiats (hors lots)** : e-mails auth en français, politique mot de passe 12 caractères, fix du conflit esbuild/vite, code-splitting des routes.
