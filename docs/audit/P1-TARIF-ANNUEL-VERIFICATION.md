# P1 — Aligner le prix annuel présenté avec la demande de souscription : audit de conformité

> Audit réalisé le 10 novembre 2026 sur la base `main` (4d8a151) et complément livré dans ce lot.
> Objectif : garantir qu'un visiteur ne voie jamais un tarif annuel remisé sans que cette période
> soit réellement enregistrée dans sa demande de souscription.

## 1. Modèle retenu

Le projet a retenu la **deuxième option** du chantier : *la période choisie est envoyée au serveur,
où le montant, la durée et les conditions sont recalculés et vérifiés*. La bascule mensuel/annuel
est conservée (les forfaits du catalogue sont configurés au mois et la remise annuelle est réelle),
mais la période n'est jamais déduite implicitement côté client.

## 2. Récapitulatif de la chaîne (vérifiée de bout en bout)

| Maillon | Garantie | Implémentation | Tests |
| --- | --- | --- | --- |
| Affichage public du tarif | Le prix affiché provient d'une formule unique, documentée comme miroir du SQL | `resolvePlanBilling` (`src/lib/saasPricing.ts`) : annuel = `round(prix × 12 × 0,85)`, forfait nativement annuel jamais re-remisé (`supportsPeriodChoice: false`) | `tests/saas-annual-billing.test.tsx` (parité de formule, y compris valeur non divisible par 12) |
| Transmission du choix | La bascule de `PricingView` propage `?plan=…&billing=yearly` + intention session | `savePlanSelectionIntent` / `buildPlanSelectionQuery`, conservée à travers `SignupPage`, `VerifyEmailPage`, `LoginPage`, `OnboardingGate` | `tests/saas-annual-billing.test.tsx` (parcours d'authentification complet) |
| Préselection ERP | `SaaSPlanView` préselectionne la période de l'intention puis l'envoie explicitement | `subscribeSalonToPlan(salonId, planId, billingPeriod)` → RPC `p_billing_period` | `tests/saas-annual-billing.test.tsx` (envoi `billingPeriod=yearly` au RPC, passage mensuel→annuel) |
| Validation & recalcul serveur | La période demandée est validée ; montant et durée recalculés côté PostgreSQL | Migration `20261111100000` : `private.resolve_saas_subscription_terms` (rejet mensuel sur forfait annuel natif, remise 15 % calculée serveur) ; `subscribe_salon_to_plan(p_salon_id, p_plan_id, p_billing_period)` | `database/tests/supabase-saas-subscription-verification.test.mjs` (357 000 = 35 000×12×0,85) |
| Montant du paiement | Jamais fourni par le client : fixé par le serveur | `declare_saas_payment` utilise `price_at_subscription` (montant issu de la période validée) | idem (montant du paiement annuel = 357 000) |
| Durée d'activation | La période validée détermine la durée | `current_period_end = now() + private.saas_billing_interval(billing_period)` (12 mois pour `yearly`) | idem (~365 jours vérifiés) |
| Contrôle SuperAdmin | La file de validation expose la période pour détecter toute incohérence | `list_saas_payments_for_review` renvoie `billing_period` ; panneau `SaasPaymentReviewPanel` | `tests/saas-annual-billing.test.tsx` |

## 3. Complément livré dans ce lot (affinement)

**Masquage de la bascule quand aucun choix de période n'existe.** Avec un catalogue dont tous les
forfaits actifs sont nativement annuels, aucune remise n'est possible et la période ne peut pas être
choisie : la bascule « Facturation Mensuelle / Annuelle (-15 % Économies) » s'affichait encore et
promettait une remise non enregistrable — exactement la classe d'écart affichage ↔ souscription
visée par ce chantier. Désormais :

- `PricingView.tsx` et `SaaSPlanView.tsx` masquent la bascule dès que le catalogue actif chargé ne
  contient aucun forfait configuré au mois (`plans.some((p) => p.billingPeriod !== 'yearly')`) ;
- les cartes continuent d'afficher le prix annuel natif et les CTA pointent vers
  `billing=yearly` : l'affiché, l'envoyé et le stocké restent alignés ;
- avec le catalogue standard (forfaits mensuels), la bascule et la remise réelle restent inchangées.

Régressions couvertes : `tests/saas-annual-billing.test.tsx` — « un forfait nativement annuel ne
subit jamais de double remise ni lien mensuel » (bascule absente, aucune mention « -15 % ») et
nouveau test « bascule masquée pour un catalogue 100 % annuel natif, demande envoyée en yearly ».

## 4. Limites connues (assumées)

- Si l'intention de sélection (URL/session) est perdue entre la page Tarifs et l'ERP (autre
  appareil, session expirée), la bascule retombe sur « Mensuelle » : le prix affiché et la demande
  envoyée restent alignés sur cette période — l'utilisateur revoit le tarif avant de confirmer,
  il n'y a pas de facturation annuelle surprise.
- Le lien « -15 % » du bandeau décrit l'option annuelle générale du catalogue : pour un forfait
  nativement annuel au sein d'un catalogue mixte, la carte affiche explicitement l'absence de
  remise (« engagement 12 mois »), comme testé.
