# Refactorisation incrémentale : plan et pilote « caisse »

Statut : pilote terminé dans le code (non déployé). Décision de l'utilisateur : approche **incrémentale**, pas de
restructuration complète. Règle permanente : ne pas réécrire l'application.

## Constats (mesurés dans le dépôt)

- `src/context/AppContext.tsx` : 1 393 lignes, 29 `useState`/`useEffect`. Un seul contexte porte salons, services,
  personnel, clients, rendez-vous, paiements, caisse, stock, avis, fidélité et marketplace.
- `src/lib/api.ts` : 1 289 lignes. Accès aux données ERP, importé par 4 fichiers seulement.
- Composants de plus de 650 lignes : `MarketplaceSectionsAdmin` (1 124), `AppointmentsCalendarView` (1 119),
  `MarketplaceHome` (1 061), `MarketplaceConfigManager` (992), `DashboardView` (984), `AdminDashboard` (851),
  `CashRegisterView` (690), `SalonManagement` (689).
- `src/features/` ne contenait que `marketplace-customizer` (6 composants). `src/hooks/` : 2 fichiers.
- Module Stock : `addStockItem` et `adjustStockQuantity` existent dans le contexte mais **aucune interface ne les
  appelle** ; l'écran Stocks est en lecture seule. L'ajustement, s'il est branché plus tard, calcule la quantité à
  partir de l'état local puis envoie la ligne entière : deux ajustements simultanés peuvent s'écraser. À corriger
  avec une fonction serveur atomique avant toute interface d'ajustement (migration à écrire, non faite).

## Choix du pilote

La caisse a été retenue : flux d'écriture réels (ouverture, clôture, rapprochement, confirmation, rejet,
correction), exigence P0 de cohérence du journal (Lot 2), et 690 lignes dont la validation était dispersée dans
les gestionnaires (`Number(...)` transmis sans contrôle). Le stock a été écarté : pas de flux d'écriture à
sécuriser. Les rendez-vous ont été écartés : risque trop élevé pour un premier pilote.

## Structure du pilote

| Fichier                                                 | Rôle                                                                                   | Dépend de React |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------- |
| `src/features/cash-register/cashRules.ts`               | Règles pures : montants entiers FCFA, motifs, références, notes                        | non             |
| `src/features/cash-register/cashCommands.ts`            | Validation puis appel d'une action injectée (port) ; aucun appel si validation refusée | non             |
| `src/features/cash-register/useCashRegisterCommands.ts` | Pont React : occupation, erreur, rafraîchissement après succès                         | oui             |
| `src/components/erp/CashRegisterView.tsx`               | Présentation et formulaires (690 → moins de lignes, sans logique de validation)        | oui             |
| `tests/cash-register-rules.test.tsx`                    | 14 tests : règles et commandes avec port factice                                       | non             |

Règles appliquées côté client, alignées sur les contrôles serveur des migrations `payment_journal` : montant entier
strictement positif (sauf fond de caisse et montant compté : zéro accepté), plafond de 10¹², motif de correction
d'au moins 3 caractères, référence fournisseur obligatoire hors espèces, notes de 500 caractères au plus.

Changement de comportement : une saisie invalide (décimales, vide, zéro là où il est refusé, motif trop court) est
refusée avant l'envoi, avec un message. Auparavant, elle partait vers la base.

## Vérifications

- `tsc --noEmit` : 0 erreur ; `eslint .` : 0 ; `prettier --check .` : conforme.
- `npm test` : Node 70/70 ; TSX 74/74 (dont 14 nouveaux tests caisse).
- `npm run build` : OK.
- Non fait : test de rendu ou visuel de `CashRegisterView` (pas de test existant pour cet écran).

## Avancement du plan incrémental

1. **Fait (partiel)** : `AppContext` découpé par domaine, chacun dans `features/` avec ses règles pures et son hook.
   Le contexte les déstructure avec les mêmes noms ; les composants ne changent pas.
   - stock (`features/stock`) : état et commandes ; 5 tests de règles ;
   - dépenses (`features/expenses`) : état et commandes ;
   - catalogue de récompenses (`features/loyalty`) : état et commandes ; 2 tests ;
   - personnel (`features/staff`) : état et commandes ;
   - fidélité (`features/loyalty/useLoyaltyProgramDomain.ts`) : programme, soldes, journal, échanges et
     ajustements de points. Règles de lecture (`loyaltyRules.ts`) et commandes sur port injecté
     (`loyaltyCommands.ts`) ; sans permission `loyalty.read`, aucune requête n'est émise. 7 tests
     (`tests/loyalty-domain-rules.test.tsx`). Les soldes et le journal restent lus seulement : aucun calcul
     côté client. Aucune validation nouvelle n'a été ajoutée aux points (comportement inchangé).
   - notifications (`features/notifications/useNotificationsDomain.ts`) : file d'envoi, déclenchement serveur et
     relance. Libellé du déclenchement dans `notificationRules.ts` (fournisseur absent, file vide, échecs réels) ;
     commandes sur port injecté (`notificationCommands.ts`) ; sans permission `appointments.read`, aucune requête.
     7 tests (`tests/notification-domain-rules.test.tsx`). Aucun libellé modifié.
   - rendez-vous (`features/appointments/useAppointmentsDomain.ts`) : planning, réservations, statuts,
     déplacements, annulations, passages sans rendez-vous. Charges utiles et motifs dans `appointmentRules.ts`
     (début ISO, « any », motif de transition, déplacement qui garde le collaborateur) ; commandes sur port
     injecté (`appointmentCommands.ts`). La clé d'idempotence passe dans `features/shared/idempotency.ts`
     (partagée avec les encaissements). 12 tests (`tests/appointment-domain-rules.test.tsx`). Aucun message ni
     effet de bord modifié. `AppContext.tsx` : 1 059 → 859 lignes.
   - finances (`features/finance/useFinanceDomain.ts`) : encaissements, corrections, paiements Mobile Money en
     attente, soldes, sessions de caisse et rapport de période. Règles pures dans `financeRules.ts` (période de
     12 mois, statut dérivé du solde, validations d'entiers XOF, succursale d'ouverture) ; commandes sur port
     injecté (`financeCommands.ts`). Chaque écriture est suivie d'un rechargement serveur. Sans permission de
     lecture, aucune requête n'est émise. 14 tests (`tests/finance-domain-rules.test.tsx`). Messages inchangés.
   - marketplace, avis, profil salon (suite) : réservation et annulation publiques (`features/marketplace/publicBookingCommands.ts`, port
     injecté ; 7 tests dans `tests/marketplace-public-booking.test.tsx`) ; avis (`features/reviews`, charge utile dans `reviewRules.ts`) ; profil salon et publication
     (`features/salon`, `toSalonProfilePayload` pure ; 4 tests de profil et 2 tests d'avis dans `tests/salon-reviews-profile-rules.test.tsx`). Comportement conservé, y compris la clé « ?? » et le
     repli horodaté des anciens navigateurs.
     Reste dans le contexte : chargement initial (`reloadWorkspace`, `loadAllData`), liste des salons et
     marketplace (`refreshMarketplace`), états de session. Ce sont des orchestrateurs : leur découpage viendra
     après une revue des dépendances, pas dans ce lot.
   - prestations (`features/services`) : état et commandes ; règles de charge utile et contrôles avant envoi
     (nom requis, prix et durées entiers) ; 6 tests. Changement de comportement : une prestation invalide est
     refusée avant envoi, avec un message.
   - clients (`features/clients`) : **commandes seulement**. L'état reste dans `AppContext`, car la mémoïsation
     `loyaltyTransactions` le lit. Tests de charge utile dans `tests/team-and-client-rules.test.tsx` (3).
     `AppContext.tsx` : 1 393 → 1 175 lignes. Les hooks eux-mêmes ne sont pas testés directement (pas de rendu
     interactif dans le harnais actuel).
2. **Stock (étape 4, fait)** : `adjust_stock_quantity` (migration `20261112090000_stock_atomic_adjustment.sql`)
   verrouille la ligne (`FOR UPDATE`), contrôle la permission `stock.write` et les bornes, puis met à jour la
   quantité dans la même transaction. Le client n'envoie que le delta. 9 tests PGlite
   (`database/tests/supabase-stock-adjustment.test.mjs`) et 3 tests du client (`tests/stock-adjustment-api.test.tsx`).
   Non testé : la concurrence réelle (PGlite est mono-connexion) ; le verrou est une garantie de PostgreSQL.
   **Décision à prendre (D11)** : `stock_items.quantity` est un entier, mais la règle client accepte les quantités
   fractionnaires (kg, litres). Le serveur refuse les fractions. Options : (a) unités entières (recommandé, le
   schéma reste inchangé) ; (b) colonne `numeric` par migration dédiée, avec revue des totaux et alertes.
   **Reste** : `stock.update` envoie encore la quantité complète. Non utilisé par l'interface aujourd'hui ; à
   retirer ou à restreindre aux champs non quantitatifs lors du prochain travail sur le stock.
3. **Fait (partiel)** : `lib/api.ts` (1 289 lignes) découpé en deux temps.
   - Étape 1 (commit `9302222`) : helpers, mappers ligne → domaine et types d'entrée dans
     `src/services/api/shared.ts` (sans accès réseau). Tests des mappers et des erreurs : `tests/api-mappers.test.tsx` (9).
   - Étape 2 (commit `8392803`) : `salonApi` réparti en modules `src/services/api/<domaine>.ts` (clients, services,
     branches, staff, appointments, expenses, finance, stock, rewards, notifications, loyalty, reviews). Chaque module
     exporte une fabrique `createXApi(supabase, salonId)` et, quand le contexte en a besoin, un listeur `listX(...)`.
     `workspace()` reste dans `lib/api.ts`, qui compose les fabriques. `lib/api.ts` passe à 60 lignes et réexporte
     `ApiError` et les types d'entrée, pour que les imports existants restent valides.
     Vérification : surface publique comparée à l'ancienne (69 fonctions, aucune différence) sur un test temporaire
     supprimé ensuite.
     **Reste** : rendez-vous, finances et fidélité sont découpés dans leurs modules, mais leurs hooks de contexte
     ne le sont pas encore (étapes de la section 2).
4. **Fait** : fonction serveur d'ajustement atomique du stock avant toute interface d'ajustement (voir point 2).
5. **À faire** : découper les composants de plus de 650 lignes lorsqu'on touche à leur domaine.
