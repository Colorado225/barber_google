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

1. **Fait (partiel)** : `AppContext` découpé pour trois domaines, chacun dans `features/` avec ses règles pures et
   son hook. Le contexte les déstructure avec les mêmes noms ; les composants ne changent pas.
   - stock (`features/stock`) : 5 tests de règles ;
   - dépenses (`features/expenses`) : hook seul ;
   - catalogue de récompenses (`features/loyalty`) : 2 tests de règles.
     `AppContext.tsx` : 1 393 → 1 306 lignes. Les hooks eux-mêmes ne sont pas testés directement (pas de rendu
     interactif dans le harnais actuel).
2. **À faire** : fidélité (chargement, échanges, points, notifications) ; clients et personnel ; rendez-vous ;
   finances (caisse). Les finances dépendent des rendez-vous (`syncAfterFinance`) : elles viennent après.
3. **À faire** : découper `lib/api.ts` en services par domaine, avec un barrel de compatibilité.
4. **À faire** : fonction serveur d'ajustement atomique du stock avant toute interface d'ajustement.
5. **À faire** : découper les composants de plus de 650 lignes lorsqu'on touche à leur domaine.
