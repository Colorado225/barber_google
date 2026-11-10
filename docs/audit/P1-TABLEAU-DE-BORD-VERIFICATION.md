# P1 — Clarifier les chiffres du tableau de bord : audit de conformité

> Audit réalisé le 10 novembre 2026 sur la base `main` (4d8a151) et compléments livrés dans ce lot.
> Objectif : vérifier point par point la fiabilité des chiffres du tableau de bord ERP
> (agrégats serveur, période affichée, fuseau métier, remboursements/contrepassations,
> règles de comptabilisation et occupation réelle).

## 1. Récapitulatif des exigences et de leur couverture

| Exigence P1 | État | Implémentation | Tests |
| --- | --- | --- | --- |
| Agrégats importants calculés **côté serveur** sur une période explicitement demandée | Livré | RPC `public.erp_dashboard_metrics(p_salon_id, p_from, p_to, p_day_filter)` (migration `20261111090000`) appelée avec `from`/`to` explicites par `DashboardView` et `ReportsView` via `loadDashboardMetrics` ; secours local borné à `[from, to]` et signalé « Vue locale (fenêtre chargée) ». | `database/tests/supabase-erp-dashboard-metrics.test.mjs`, `tests/erp-analytics-and-dashboard.test.tsx` |
| Période affichée **pour chaque chiffre** | Livré | Bandeau « Périmètre des indicateurs » (`periodLabel` + `from → to` + fuseau + source serveur/locale) ; chaque carte KPI porte `({période})`, graphique et palmarès affichent leurs bornes. Complément de ce lot : le « Panier Moyen Encaissé » affiche désormais aussi sa période. | `tests/erp-analytics-and-dashboard.test.tsx` |
| Date métier unifiée sur le **fuseau du salon** | Livré | `src/lib/businessTime.ts` (`resolveSalonTimezone`, `zonedToday`, `resolveErpPeriodRange`) ; `appointmentBusinessDate`/`paymentBusinessDate` convertissent `starts_at`/`created_at` vers le fuseau salon ; côté SQL `private.salon_timezone(p_salon_id)` (repli `Africa/Abidjan`) borne toutes les requêtes. | `tests/erp-analytics-and-dashboard.test.tsx` (conversions IANA/DST), migration testée en PGlite |
| Remboursements et contrepassations **cohérents** | Livré | Signes comptables alignés front/SQL : `paymentSignedAmount` ≡ `private.payment_signed_amount` (`refund` et `payment_reversal` négatifs, `refund_reversal` positif) ; `expenseSignedAmount` ≡ `private.expense_signed_amount` (`expense_reversal` négatif). Encaissé net, ventilations par moyen, dépenses nettes, marge et reste à encaisser déduisent systématiquement ces écritures (dashboard, rapports, `financial_summary`). | `database/tests/supabase-finance.test.mjs`, `tests/erp-analytics-and-dashboard.test.tsx` |
| Classement des prestations : **règles métier explicites** | Livré | `buildServicePerformance` et le bloc SQL `service_performance` excluent `cancelled`/`no_show` du volume et du revenu ; double scope explicite « Réalisés (`completed`) » vs « Facturés actifs », avec compteurs d'exclus affichés. | `tests/erp-analytics-and-dashboard.test.tsx` (exclusion annulés/absents) |
| Occupation horaire **réelle** (durées + capacité disponible) | Livré | `buildHourlySeries` et le bloc SQL `hourly_occupancy` mesurent les minutes occupées par chevauchement des durées de RDV actifs sur des tranches de 30 min, rapportées à la capacité disponible (horaires succursale, plannings et absences du personnel, effectif actif). Le repli local utilise les horaires par défaut 08:00–20:00 et reste signalé « Vue locale ». | `tests/erp-analytics-and-dashboard.test.tsx`, `database/tests/supabase-erp-dashboard-metrics.test.mjs` |

## 2. Compléments livrés dans ce lot (affinements)

1. **Croissance « vs mois précédent » sourcée serveur en mode graphique « Mois (semaines) »** —
   `DashboardView.tsx` : auparavant, dans ce mode, la variation affichée sous « CA Encaissé Net »
   était systématiquement recalculée sur la fenêtre mémoire (liste des paiements plafonnée à 500
   lignes), y compris quand l'agrégat serveur était disponible. Désormais, un appel
   `erp_dashboard_metrics` couvrant explicitement les 6 derniers mois alimente cette variation ;
   le repli local n'intervient que si l'agrégat serveur est indisponible (mode « Vue locale »).
2. **Période affichée sur le panier moyen** — la carte « Panier Moyen Encaissé » porte désormais
   la période courante comme les autres indicateurs principaux.

Régression couverte : `tests/erp-analytics-and-dashboard.test.tsx` vérifie qu'en mode
« Mois (semaines) » la variation « vs mois précédent » reste dérivée de l'agrégat serveur 6 mois
(le test échoue si le calcul retombe sur la fenêtre mémoire).

## 3. Limites connues (assumées)

- Le repli local (« Vue locale (fenêtre chargée) ») reste approximatif par construction :
  il ne dispose pas des horaires succursale/plannings/absences (non chargés dans le contexte client)
  et utilise la fenêtre mémoire. Il n'est actif que si la RPC serveur échoue ou si
  `dashboard.read` est absente ; le bandeau l'indique explicitement.
- La mesure d'occupation serveur raisonne à l'échelle du salon (RDV rattachés à la capacité de la
  succursale effective de chaque membre) ; un salon multi-succursales avec double emploi simultané
  reste un cas d'école non modélisé finement.
