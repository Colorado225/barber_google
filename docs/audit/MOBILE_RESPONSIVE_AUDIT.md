# Audit mobile et responsive — BarberCuts

> **Statut : diagnostic établi avant toute refonte responsive.**
> **Date : 14 novembre 2026**
> **Périmètre : interface React/Vite du dépôt, contrôles fonctionnels associés et tests existants.**

## 1. Objet, méthode et limite de l'audit

Cet audit précède toute modification responsive. Il vérifie que les améliorations de présentation envisagées ne doivent pas altérer les routes, l'autorisation, la sélection du salon, les appels Supabase, les mutations ERP ni la synchronisation temps réel.

### Méthode

- inspection des layouts, routes, composants de navigation, tableaux, formulaires, modales et primitives UI ;
- analyse des classes Tailwind liées aux breakpoints, dimensions fixes, `overflow`, `fixed`, `sticky`, hauteur et cibles tactiles ;
- lecture des chemins fonctionnels pour la caisse, les rendez-vous, les demandes en ligne, les notifications, le multi-salon et Realtime ;
- lecture des tests pertinents.

### Limite

Les constats de débordement, de clavier virtuel et de superposition sont des constats de code ou des risques vérifiés par structure. Ils doivent être confirmés visuellement dans un navigateur à **320, 360, 375 et 390 px** de large, avec des hauteurs courtes et un clavier virtuel ouvert. Il n'existe pas de suite de capture visuelle multi-viewport dans le dépôt.

### Règle de travail pour la suite

Les corrections responsive devront rester **présentationnelles** : ne pas déplacer les providers, ne pas renommer les routes, ne pas modifier les RPC, ne pas remplacer les gardes de permission et ne pas faire évoluer les migrations Supabase dans ce lot.

---

## 2. Synthèse des priorités

| Priorité | Problème vérifié                                                  | Risque principal                                                                                      |
| -------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **P0**   | Navigation ERP complète rendue avant le contenu sur mobile        | Le premier écran métier est repoussé après 17 entrées ; actions caisse/RDV paraissent inatteignables. |
| **P0**   | Navigation admin complète rendue avant le contenu sur mobile      | Le panneau actif est repoussé après 10 entrées et un bloc métrique.                                   |
| **P0**   | Tableaux sans wrapper horizontal dans plusieurs écrans            | Colonnes/actions coupées par `overflow-hidden` ou débordement de page.                                |
| **P0**   | Modales métier longues sans stratégie de scroll                   | Bouton de validation inaccessible avec faible hauteur ou clavier mobile.                              |
| **P1**   | Header marketplace global + header admin tous deux `sticky top-0` | Chevauchement, contenu masqué et hauteur non compensée sur `/admin`.                                  |
| **P1**   | Cibles tactiles trop petites, dont le `Switch` 12 × 6 px          | Actions difficiles ou erronées sur mobile.                                                            |
| **P1**   | Formulaires ERP en deux/trois colonnes sans fallback mobile       | Champs date, select, téléphone et montant trop étroits.                                               |
| **P1**   | Toast fixe `w-full right-5`                                       | Décalage horizontal et recouvrement des actions basses.                                               |
| **P2**   | Rails horizontaux sans indicateur de défilement                   | Catégories/services hors champ peu découvrables.                                                      |
| **P2**   | Hauteurs de hero/carte/galerie importantes                        | Premier contenu utile repoussé sur appareils courts.                                                  |

---

## 3. Problèmes vérifiés, fichiers concernés, risques et recommandations

### P0 — Navigation ERP mobile trop volumineuse

**Fichier concerné** : `src/components/erp/ErpLayout.tsx`

**Constat vérifié**

- Sous `md`, la structure `flex-col md:flex-row` place l'`aside` `w-full` avant la zone principale.
- Cette aside contient le sélecteur de salon, les informations de session et 17 entrées de navigation filtrées par permission.
- Elle n'est ni repliable, ni transformée en drawer, ni remplacée par une navigation compacte.

**Risque responsive**

- Le dashboard, la caisse, les rendez-vous et les raccourcis sont visuellement repoussés très bas sur un écran de téléphone.
- Le problème est ergonomique, mais peut être interprété comme une indisponibilité des actions métier.

**Amélioration recommandée**

- Conserver `navItems`, `visibleNavItems`, `setActiveTab`, `buildErpUrl` et `handleSelectSalon`.
- Remplacer seulement la présentation mobile par un header compact + drawer/accordéon, ou un sélecteur d'onglet horizontal.
- À la sélection d'une entrée mobile, exécuter le même flux que la sidebar existante : fermeture du menu, `setActiveTab`, `history.pushState` et conservation de `?salon=`.

### P0 — Navigation admin mobile trop volumineuse

**Fichier concerné** : `src/components/admin/AdminDashboard.tsx`

**Constat vérifié**

- Sous `md`, l'aside admin devient `w-full` et précède le contenu.
- Les dix onglets, puis le bloc métrique, restent visibles simultanément.
- Certains contrôles du header sont masqués : rafraîchissement sous `sm`, aperçu et lien marketplace sous `md`, sans équivalent dans le menu interne.

**Risque responsive**

- Le contenu actif est repoussé après une navigation longue.
- Les actions header masquées ne sont plus directement disponibles sur téléphone.

**Amélioration recommandée**

- Introduire un sélecteur d'onglet ou un drawer mobile sans modifier `activeTab`, les panneaux lazy, les appels admin ni `verifySuperAdminAccess`.
- Rendre les actions masquées accessibles depuis un menu mobile avec les mêmes handlers.

### P0 — Tableaux non adaptés ou pouvant être coupés

| Fichier                                            | Constat vérifié                                                                | Risque                                                           | Recommandation                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/components/erp/ClientsView.tsx`               | Table à six colonnes dans un parent `overflow-hidden`, sans `overflow-x-auto`. | Colonnes et actions d'édition/suppression coupées.               | Ajouter un wrapper horizontal autour de la table ou une vue carte mobile. |
| `src/components/erp/ServicesView.tsx`              | Table à cinq colonnes sans wrapper horizontal.                                 | Prix/actions hors champ.                                         | Même correction.                                                          |
| `src/components/erp/StaffView.tsx`                 | Table sans wrapper horizontal.                                                 | Informations équipe/actions difficiles à atteindre.              | Même correction.                                                          |
| `src/components/erp/DataTableCard.tsx`             | Primitive générique sans wrapper horizontal.                                   | Régression garantie lors de sa prochaine utilisation sur mobile. | Corriger la primitive avant toute réutilisation.                          |
| `src/components/admin/AdminNotificationsPanel.tsx` | Tableau à cinq colonnes sans wrapper horizontal.                               | Texte fournisseur et colonnes d'état coupés.                     | Wrapper horizontal avec indication de défilement.                         |
| `src/components/admin/AdminOverviewPanel.tsx`      | Tableau d'audit à cinq colonnes sans wrapper horizontal.                       | Audit incomplet ou tronqué.                                      | Wrapper horizontal avec indication de défilement.                         |

**Éléments déjà structurés correctement**

- `AdminAuditLogPanel`, `AdminSubscriptionsPanel`, `SalonManagement`, `FinanceExpensesView` et `InventoryView` utilisent déjà `overflow-x-auto`.
- `AppointmentsCalendarView` et `PlanningView` protègent leurs larges grilles avec un scroll horizontal.

**Risque résiduel sur les tableaux déjà scrollables**

Les plannings jour/semaine utilisent des minimums de 750–950 px. Les données restent atteignables, mais le scroll est masqué ou peu signalé. Une alternative liste/carte ou une indication visuelle est recommandée ; elle ne doit pas modifier les filtres ni les handlers de rendez-vous.

### P0 — Modales longues non scrollables

| Fichier                                                               | Constat vérifié                                                                          | Risque                                                        | Recommandation                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/components/erp/CashRegisterView.tsx`                             | Modal fixe centrée sans `overflow-y-auto` ni `max-height`.                               | Les formulaires caisse peuvent sortir du viewport.            | Faire scroller l'overlay ou le panneau ; préserver les `onSubmit`. |
| `src/components/erp/FinanceExpensesView.tsx`                          | Création, correction et contrepassation de dépense dans des panels fixes non contraints. | Champs/boutons inatteignables avec clavier.                   | `max-h-[…] overflow-y-auto` et layout une colonne mobile.          |
| `src/components/erp/InventoryView.tsx`                                | Modales produit, mouvement, édition et fournisseur non contraintes.                      | Même risque, aggravé par les formulaires à plusieurs groupes. | Même stratégie de scroll.                                          |
| `src/components/admin/AdminDashboard.tsx`                             | Confirmation courte fixe non scrollable.                                                 | Fragile si motif ou erreur rendent le contenu plus haut.      | Standardiser via une modale scrollable.                            |
| `src/components/admin/AdminReviewsPanel.tsx` et `SalonManagement.tsx` | Certaines confirmations fixes sans stratégie complète de scroll.                         | Actions pouvant passer sous le clavier.                       | Standardiser les overlays.                                         |

**Éléments déjà correctement implémentés**

- `FormModal` : panneau `max-h-[90vh] overflow-y-auto`.
- `StaffSchedulePanel` : même protection.
- `NewAppointmentModal` et `NewPaymentModal` : overlay `overflow-y-auto`.
- `PricingTierEditor`, édition détaillée salon et `SalonDetailModal` : scroll prévu.

### P1 — Headers sticky et contenus masqués

**Fichiers concernés**

- `src/App.tsx`
- `src/components/common/Navbar.tsx`
- `src/components/admin/AdminDashboard.tsx`

**Constat vérifié**

- `App` rend la `Navbar` sur les routes admin.
- La navbar publique est `sticky top-0 z-40` et sa hauteur mobile peut varier sur plusieurs lignes.
- `AdminDashboard` ajoute un header `sticky top-0 z-40`.

**Risque**

- Les deux headers peuvent se chevaucher ou se masquer lors du scroll ; l'espace supérieur du contenu n'est pas compensé.

**Amélioration recommandée**

- Choisir une seule stratégie : masquer le shell marketplace dans l'administration, ou appliquer une hauteur/offset explicite au header admin.
- Ne pas changer les alias `/admin`, `/admin/console`, `/admin/dashboard` ni le garde SuperAdmin.

### P1 — Cibles tactiles et contrôles trop compacts

**Fichiers particulièrement concernés**

- `src/components/ui/switch.tsx`
- `src/components/ui/button.tsx`
- `src/components/common/Navbar.tsx`
- `src/components/common/ToastContainer.tsx`
- tableaux et modales ERP/admin

**Constat vérifié**

- `Switch` : `h-[6px] w-[12px]`.
- `Button` partagé : aucune hauteur ou padding minimal.
- Nombreux boutons d'icône : `p-0.5`, `p-1`, `p-1.5` ou `w-8 h-8`.
- Catégories, dates, créneaux et actions secondaires emploient souvent `text-xs py-1` ou `py-1.5`.

**Risque**

- Erreurs de manipulation, notamment pour supprimer, fermer une modale, changer un statut de rendez-vous ou corriger une opération financière.

**Amélioration recommandée**

- Définir une cible minimale de 40–44 px pour les contrôles tactiles importants.
- Conserver les labels et `aria-label` existants.
- Pour les actions destructrices ou financières, privilégier label + icône plutôt qu'icône seule quand l'espace le permet.

### P1 — Formulaires trop denses sur mobile

**Fichiers concernés**

- `ClientsView`, `ServicesView`, `StaffView`, `PlanningView`
- `FinanceExpensesView`, `InventoryView`
- `NewAppointmentModal`, `NewPaymentModal`, `WalkInModal`
- `SalonDetailModal`
- `MarketplaceSectionsAdmin`

**Constat vérifié**

- Plusieurs formulaires utilisent `grid-cols-2` ou `grid-cols-3` sans passer par `grid-cols-1 sm:grid-cols-*`.
- `MarketplaceSectionsAdmin` contient plusieurs inputs de largeur fixe : `w-40`, `w-44`, `w-52`, `w-56`.

**Risque**

- Champs de date, montant, téléphone, select ou motif difficiles à lire/toucher à 320–375 px.
- Débordement dans les lignes de configuration marketplace.

**Amélioration recommandée**

- Basculer les groupes de saisie métier à une colonne par défaut, puis deux colonnes à partir de `sm`.
- Remplacer les largeurs fixes par `w-full`, `min-w-0` et des contraintes réservées aux breakpoints larges.
- Ne pas déplacer les hooks d'état ni modifier les payloads soumis aux RPC.

### P1 — Toast fixe et recouvrement du viewport

**Fichier concerné** : `src/components/common/ToastContainer.tsx`

**Constat vérifié**

```tsx
fixed bottom-5 right-5 max-w-md w-full px-4
```

**Risque**

- Un conteneur de largeur complète décalé de `right-5` peut déborder horizontalement sur mobile.
- Les toasts restent au-dessus des modales (`z-[100]`) et peuvent couvrir les boutons en bas de formulaire.

**Amélioration recommandée**

- Sur mobile, utiliser des marges latérales explicites (`inset-x-4`, largeur auto) et respecter les safe areas.
- Prévoir une position qui ne masque pas un footer de modale.

### P2 — Rails horizontaux et hauteur des sections

**Fichiers concernés**

- `Navbar.tsx`, `FeaturedBarbersSection.tsx`, `FeaturedServicesCard.tsx`, `SalonDetailModal.tsx`
- `MarketplaceHome.tsx`, `MarketplaceMapView.tsx`, `SalonGalleryCarousel.tsx`

**Constats vérifiés**

- Plusieurs rails utilisent `overflow-x-auto scrollbar-none` : catégories, services vedettes, dates de réservation, onglets de fiche salon.
- Les flèches de catégories sont masquées sous `sm`.
- Hero marketplace : minimum 620 px sur mobile ; carte : 420 px ; galeries : 340–380 px dès mobile.

**Risque**

- Contenu horizontal hors champ peu découvrable.
- Longueur verticale élevée avant le contenu utile sur appareils courts, sans perte fonctionnelle avérée.

**Amélioration recommandée**

- Ajouter une affordance de scroll ou un gradient de bord, sans supprimer le swipe.
- Réduire les hauteurs sur les petits viewports avec `clamp()` ou des breakpoints ciblés.

---

## 4. Diagnostic fonctionnel : invariants à préserver

Les constats responsive ne révèlent pas de mutation fonctionnelle existante. Ils définissent les invariants que toute correction UI doit respecter.

### 4.1 Routes et navigation

**Vérifié dans** : `src/router.tsx`, `tests/router-browser.test.tsx`.

- `/app/*` reste protégé par `OnboardingGate` et encapsulé dans `AppProvider`.
- Les routes publiques, `/salons/:slug`, `/reservation`, `/reservation/:token`, `/mes-reservations`, `/mes-favoris`, auth, tarifs et admin sont déclarées explicitement.
- Le test navigateur valide les routes publiques et la redirection ERP non authentifiée vers `/connexion`.

**Contrainte de correction**

Un drawer mobile ou un menu compact doit appeler les mêmes liens/handlers que la navigation actuelle. Il ne doit pas remplacer le routeur, modifier `BrowserRouter`, supprimer le fallback lazy ni modifier les paramètres d'URL.

### 4.2 Permissions et rôles utilisateurs

**Vérifié dans** : `src/context/AuthContext.tsx`, `src/lib/permissions.ts`, `src/components/erp/ErpLayout.tsx`, `tests/permissions.test.tsx`, `tests/permissions-parity.test.tsx`.

- Les rôles ERP sont : `owner`, `manager`, `receptionist`, `barber`, `cashier`, `accountant`.
- `ErpLayout` filtre `visibleNavItems` via `hasPermission` pour le salon actif.
- Les actions caisse utilisent notamment `cash.open`, `cash.close`, `cash.reconcile`, `payments.correct`.
- Les demandes en ligne utilisent `appointments.write`.
- Le test de parité exécute la matrice frontend/serveur contre `private.has_salon_permission`.

**Contrainte de correction**

Ne jamais rendre une action mobile sans conserver la condition de permission existante. La visibilité mobile ne doit pas devenir une nouvelle source d'autorisation : RLS/RPC restent l'autorité serveur.

### 4.3 Sélection du salon actif et isolation multi-salon

**Vérifié dans** : `AuthContext.tsx`, `ErpLayout.tsx`, `tests/multi-salon-selection.test.tsx`.

- `selectSalon` accepte uniquement une adhésion active.
- La priorité de sélection respecte le choix explicite, puis `?salon=`, puis le stockage par utilisateur.
- `ErpLayout.handleSelectSalon` ferme les modales rapides, sélectionne le salon, recalcule l'onglet visible et met à jour l'URL.
- Le test multi-salon vérifie la recharge des données, le recalcul des permissions, l'URL et le réabonnement Realtime après changement de salon.

**Contrainte de correction**

Un sélecteur salon mobile doit réutiliser `handleSelectSalon` ou un flux strictement équivalent. Il ne doit pas écrire un identifiant arbitraire dans l'URL ou le stockage.

### 4.4 Données Supabase et mutations métier

**Vérifié dans** : `src/lib/api.ts`, migrations et tests PGlite/SQL existants.

- Rendez-vous : RPC `create_appointment`, `register_walk_in`, `start_walk_in`, `complete_walk_in`, `reschedule_appointment`, `transition_appointment`, `cancel_appointment`.
- Finance : RPC `record_payment`, corrections, confirmation/refus de paiements en attente, ouverture/fermeture/réconciliation de caisse.
- Dépenses, stock, fournisseurs, fidélité et notifications passent aussi par des RPC ou des accès protégés.

**Contrainte de correction**

Les améliorations de table, modal ou formulaire doivent conserver :

- les noms de champs ;
- les validations ;
- les clés d'idempotence ;
- les callbacks `onSubmit` et handlers existants ;
- les rafraîchissements/invalidation après succès ou échec.

Aucune adaptation responsive ne nécessite de migration, de modification RLS ou de changement de contrat RPC.

### 4.5 Caisse et encaissements

**Vérifié dans** : `CashRegisterView.tsx`, `NewPaymentModal.tsx`, `database/tests/supabase-finance.test.mjs`.

- Les actions sont filtrées par permission côté UI et protégées par RPC côté serveur.
- Les tests couvrent session de caisse, paiements cash, paiements mobile en attente, confirmation/rejet, remboursements, corrections, clôture et réconciliation.

**Risque responsive spécifique**

Les modales caisse actuelles peuvent cacher le bouton de confirmation sous le clavier. Le risque est d'abandonner une action, pas de contourner les contrôles financiers.

**Contrainte**

Le scroll ajouté doit rester dans la modale et ne jamais soumettre automatiquement un formulaire lorsque le panneau est fermé ou recadré.

### 4.6 Rendez-vous, passage sans rendez-vous et demandes en ligne

**Vérifié dans** : `AppointmentsCalendarView.tsx`, `WalkInView.tsx`, `OnlineRequestsView.tsx`, `database/tests/supabase-operations.test.mjs`, `database/tests/supabase-walk-in.test.mjs`, `database/tests/supabase-client-journey.test.mjs`.

- Les listes sont filtrées par `activeSalon.id`.
- Les transitions de statut utilisent les handlers/rpc existants.
- `OnlineRequestsView` filtre les demandes marketplace du salon actif et conditionne confirmer/refuser à `appointments.write`.
- Les tests couvrent l'isolation tenant, le démarrage/la finalisation d'un passage sans rendez-vous, l'encaissement associé et les gardes de disponibilité.

**Contrainte**

Si les actions d'une ligne de tableau deviennent un menu mobile, chaque entrée doit conserver l'identifiant exact du rendez-vous et appeler les handlers existants (`updateAppointmentStatus`, `updateAppointmentDetails`, ouverture paiement). Aucun état de rendez-vous ne doit être recréé localement.

### 4.7 Notifications

**Vérifié dans** : `NotificationsView.tsx`, `src/lib/api.ts`, `database/tests/supabase-client-journey.test.mjs`.

- La liste est filtrée par salon actif.
- Envoi, relance, sondage et rafraîchissement utilisent les handlers du contexte.
- Les actions d'envoi sont filtrées par `appointments.write`.
- Les tests couvrent la file d'envoi, les résultats honnêtes, les relances et l'absence d'envoi automatique non configuré.

**Contrainte**

Le panneau mobile ne doit pas masquer définitivement les boutons de rafraîchissement, sondage, envoi ou relance. Les échecs doivent garder leur retour utilisateur et leur action de retry.

### 4.8 Realtime, cache et synchronisation

**Vérifié dans** : `src/lib/realtimeSync.ts`, `src/lib/domainCache.ts`, `tests/realtime-multi-station-sync.test.tsx`, `tests/multi-salon-selection.test.tsx`.

- Les canaux Postgres Changes sont filtrés par `salon_id`.
- Les abonnements aux rendez-vous, paiements et caisse sont conditionnés par permissions.
- Les doublons sont dédupliqués ; les mises à jour sont regroupées.
- Rattrapage au retour réseau, à la visibilité/focus, reconnexion exponentielle et fallback périodique sont implémentés.
- `DomainCache` est isolé par salon/domaine, déduplique les requêtes en vol et propose une invalidation ciblée.

**Contrainte**

Une refonte de navigation mobile ne doit pas démonter/remonter `AppProvider` ni recréer de contexte à chaque ouverture de menu. Elle ne doit pas neutraliser `syncNow`, `reloadWorkspace`, les listeners de visibilité ou le changement de salon.

---

## 5. Éléments déjà correctement implémentés

- Routes lazy pour isoler l'ERP, l'administration, l'authentification et les vues publiques.
- Garde ERP avant rendu métier (`OnboardingGate`).
- Filtrage de navigation par permission et garde serveur/RLS/RPC.
- Sélection multi-salon testée, URL `?salon=` cohérente et réabonnement Realtime couvert par test.
- Tableaux finance, stock, planning et calendrier déjà enveloppés dans un scroll horizontal.
- Plusieurs modales déjà protégées par `max-h` ou `overflow-y-auto`.
- Formulaires de connexion et d'inscription basés sur `100dvh` et mise en page responsive à partir de `lg`.
- Marketplace : recherche empilée, menu mobile, grilles adaptées et rails scrollables explicitement testés.
- Tests de routes, permissions, multi-salon, caisse, rendez-vous, parcours client, notifications et Realtime déjà présents.

---

## 6. Hypothèses nécessitant un test navigateur

| Hypothèse                                                        | Scénario de validation                                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Le header admin et la navbar publique se chevauchent réellement  | Ouvrir `/admin` à 320/375 px, scroller la page, vérifier les deux headers et le début du contenu.                |
| Les tables sans wrapper sont coupées et non seulement comprimées | Charger des noms/adresses/motifs longs dans clients, services, personnel, overview admin et notifications admin. |
| Les modales caisse/dépenses/stock masquent les boutons           | Ouvrir chaque modal à 320 × 568 puis déclencher le clavier virtuel dans le dernier champ.                        |
| Le toast déborde ou masque un CTA                                | Déclencher un toast pendant une modal et sur iPhone avec safe-area.                                              |
| Les actions ERP sont atteignables après ouverture mobile         | Tester dashboard, caisse, rendez-vous et demandes en ligne avec menu ERP compact/drawer proposé.                 |
| Les grids deux/trois colonnes sont saisissables                  | Tester date, montant, téléphone, select et textarea à 320/360 px.                                                |
| Le sticky booking gêne la fiche salon mobile                     | Faire défiler la modale de salon, ouvrir le formulaire de réservation et tester les créneaux.                    |
| Les changements de salon maintiennent le menu mobile cohérent    | Passer owner → barber puis revenir, vérifier onglets visibles, `?salon=`, données et canaux Realtime.            |

---

## 7. Plan de correction recommandé, sans refonte générale

### P0 — À traiter avant une livraison mobile

1. Créer une navigation ERP mobile compacte qui conserve tous les handlers et permissions existants.
2. Créer une navigation admin mobile compacte et rendre accessibles les actions header cachées.
3. Encapsuler les six tableaux listés dans un défilement horizontal sûr, ou leur proposer une variante carte mobile.
4. Standardiser les modales longues sur un overlay/panneau scrollable.
5. Ajouter des tests de structure pour les wrappers de table, les modales scrollables et les menus mobiles.

### P1 — À traiter dans le même lot si possible

1. Résoudre le conflit de headers sticky de l'administration.
2. Introduire une primitive de contrôle tactile à hauteur minimale et corriger `Switch`.
3. Empiler les groupes de formulaire en une colonne avant `sm`.
4. Corriger la géométrie mobile du toast et les safe areas.
5. Limiter le sticky booking au contexte desktop après validation navigateur.

### P2 — Amélioration progressive

1. Ajouter une indication de scroll sur les rails horizontaux.
2. Réduire hero, carte et galerie sur appareils bas.
3. Ajouter une suite de tests viewport/capture visuelle et des tests clavier virtuel manuels documentés.

---

## 8. Validation de sortie attendue après correction

Avant de considérer le lot mobile terminé :

- `npm run typecheck`, `npm run lint`, `npm run format:check` et `npm test` doivent rester verts ;
- les tests de route, de permissions, de multi-salon et Realtime doivent rester inchangés ou être étendus ;
- les tests financiers, opérationnels, client journey et notifications doivent rester verts ;
- test navigateur manuel à 320/360/375/390 px et avec clavier virtuel ;
- aucune migration Supabase, aucune policy RLS, aucune signature RPC et aucune route ne doit être modifiée par les corrections purement responsive.

---

## 9. Suivi d’implémentation — premier lot démarré le 14 novembre 2026

### P0 réalisé dans le code, à confirmer visuellement

- `ErpLayout.tsx` : la sidebar ne précède plus le contenu sous `md`. Elle devient un drawer ouvert par un bouton compact, fermé par action, backdrop ou touche Échap. Les entrées continuent toutes d’appeler le même `handleSelectTab`, qui conserve `buildErpUrl`, `?salon=`, les permissions et la fermeture des modales existantes ; le changement de salon conserve `handleSelectSalon`.
- `AdminDashboard.tsx` : la navigation devient un drawer mobile utilisant le même `activeTab`; les actions masquées (actualisation, tarifs publics, marketplace) sont disponibles dans ce drawer. Le header admin n’est plus sticky, pour ne plus empiler une seconde barre sticky avec `Navbar`.
- Les six tableaux P0 sont contenus dans une région clavier `overflow-x-auto` avec largeur minimale : clients, prestations, équipe, `DataTableCard`, santé des notifications et extrait d’audit admin.
- Les overlays/panneaux caisse, dépenses, stock et confirmation d’abonnement ont maintenant `overflow-y-auto` et une hauteur maximale basée sur `100dvh`.
- `tests/mobile-responsive-structure.test.mjs` vérifie la présence des drawers, des wrappers de tableaux et des contraintes de modal.

### P1 engagé

- `Switch` possède désormais une cible tactile de 44 × 44 px, en conservant son input natif et ses callbacks.
- Les toasts sont ancrés horizontalement dans le viewport mobile, respectent la safe area basse et conservent leur largeur maximale sur desktop ; leur bouton de fermeture a une cible tactile dédiée.

### Restant avant qualification mobile complète

- Empiler et vérifier les grilles de formulaires ERP avant `sm` ; limiter le sticky booking après test réel.
- Valider au navigateur 320/360/375/390 px, avec faible hauteur et clavier virtuel, notamment drawer ERP/admin, changement de salon, actions caisse/RDV, modales longues, tables, toast et booking.
- Aucune modification de route, de rôle/permission, de contexte, de RPC, de migration, de RLS ou de cycle Realtime n’a été effectuée dans ce lot.
- Le build est valide, mais `npm run perf:check` reste non conforme au budget initial existant : 171,55 kB gzip de JavaScript initial pour un budget de 166,02 kB. Cette non-conformité P2 doit être résolue avant de déclarer une CI entièrement verte.
