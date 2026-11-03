# BARBER CUTS — Audit et fondations, phase 1

> **Mise à jour : Neon (PostgreSQL hébergé) remplace Supabase comme cible technique ; PostgreSQL local reste facultatif.** Les références à Supabase et aux anciens chemins dans ce document sont historiques ; voir [Neon](neon.md) pour les instructions actuelles.

Date : 3 novembre 2026. Périmètre : dépôt à la révision de départ `4b335c3564c76e310dea61fe0c55de5748a28a35`. Audit statique du code et vérifications de compilation ; pas d'audit dynamique complet, ni de test d'intrusion. Les constats ne constituent pas une certification de sécurité.

## 1. Synthèse et limites

Le dépôt contient une SPA Vite/React 19/TypeScript, pas une application Next.js, un serveur API ou une base PostgreSQL. Il s'agit d'un prototype métier local : ses interactions manipulent les états React et le stockage du navigateur, initialisés avec des données de démonstration. Il ne doit pas être commercialisé ni traiter de données ou paiements réels en l'état.

Aucun fichier SQL, migration, client Supabase, politique RLS, serveur d'authentification ou test automatisé n'est présent dans le dépôt. **Aucun projet Supabase externe n'a été inspecté** : l'absence de schéma et de RLS est constatée dans le dépôt uniquement, pas dans une éventuelle instance distante. Toute vérification d'une instance existante nécessite d'identifier l'environnement approprié ; ne pas créer ou modifier de ressources distantes pendant cet audit.

## 2. Inventaire technique

- `src/main.tsx`, `src/App.tsx` : initialisation, composition de la marketplace, ERP et modales. Pas de routeur ; l'URL ne représente pas les écrans.
- `src/components/common/` : barre de navigation et notifications.
- `src/components/marketplace/` : accueil et filtres, cartes, détails d'un salon, réservation, inscription d'un salon, consultation des rendez-vous.
- `src/components/erp/` : dashboard, planning, caisse, clients, services, personnel, dépenses, stocks, vitrine, profil, abonnement, onboarding et modales. `LoyaltyRewardsView.tsx` existe mais n'est pas montée dans `ErpLayout.tsx`.
- `src/context/AppContext.tsx` : état global, persistance locale, navigation et opérations de nombreux domaines ; 1 059 lignes.
- `src/data/mockData.ts` : salons, rendez-vous, transactions et autres données initiales ; `src/types/index.ts` : modèles TypeScript ; pas de couche services, repositories ou hooks métier distincts.
- `public/assets/aistudio/` : médias de démonstration. `index.html` charge des polices Google et définit `lang="en"` malgré une interface française.
- `package.json` : Vite, React, Tailwind, Lucide, Motion et dépendances Express/Google GenAI ; aucun usage applicatif Express/GenAI repéré dans `src`. Pas de lockfile versionné, ni scripts de tests. `lint` exécute uniquement `tsc --noEmit` ; TypeScript n'est pas configuré en mode strict. L'alias `@` cible la racine du dépôt et non `src`.
- `.env.example` mentionne Gemini et `APP_URL`, sans implémentation Supabase dans le dépôt. Ce fichier n'établit pas que des intégrations externes sont actives.

## 3. État fonctionnel observé dans le code

Les termes « fonctionnel » et « partiel » ci-dessous concernent les mécanismes présents dans le prototype ; ils ne signifient pas qu'un parcours a été validé de bout en bout.

### Mécanismes locaux présents

- Navigation marketplace/ERP, sélection de salon et notifications par état React (`App.tsx`, `Navbar.tsx`, `ErpLayout.tsx`).
- Formulaires et opérations en mémoire pour salons, prestations, équipe, clients, rendez-vous, dépenses et stock, avec sauvegarde de la plupart des tableaux dans `localStorage` (`AppContext.tsx`). Recherche marketplace sur nom, sous-titre et commune.
- Interface de calendrier, formulaire de réservation, changements de statut, encaissement local et calculs de caisse. Les liens téléphone et WhatsApp ouvrent des applications externes ; ils ne constituent pas une API de messagerie.
- Interface responsive fondée sur des classes Tailwind et points de rupture, notamment menus et grilles. Aucun test d'appareils, d'accessibilité, de clavier ou de connexion lente n'a été effectué.

### Partiellement fonctionnel ou incohérent

- Réservation : vérification locale uniquement à l'heure exacte, sans intervalle, horaires, pauses, congés ou transaction atomique. `bookAppointment` recherche le service par ID sans vérifier son appartenance au salon ; un collaborateur explicite inexistant ou non disponible n'est pas rejeté de façon robuste. La source est toujours `marketplace`, y compris depuis le formulaire ERP (`AppContext.tsx`).
- CRM : une réservation incrémente visites et dépenses ; le passage à `completed` peut les incrémenter à nouveau si la fidélité est activée. Les transitions ne sont pas protégées par une machine à états ; repasser par un autre statut puis terminer peut recréditer la fidélité. Le journal de fidélité dépend d'un ID affecté dans un updater React et peut référencer un ID de repli (`AppContext.tsx`).
- Caisse : une seule `cashSession` globale, remplacée lors de l'ouverture suivante ; elle n'est pas isolée par salon. Les transactions n'ont pas de journal financier immuable ni de rapprochement. Les dates mélangent jour UTC et heure locale dans `recordPayment`.
- Onboarding : six étapes à état local, sans reprise persistante de la progression ; la fin positionne la publication à `true`. La création initialise notamment une note, un avis, un statut vérifié et des prestations fictifs (`createSalon`).
- Publication : la liste marketplace ne filtre pas `isPublishedOnMarketplace` (`MarketplaceHome.tsx`). Les catégories placent un texte dans la recherche, qui ne recherche pas réellement dans les prestations.
- Recherche des rendez-vous client : sans filtre, `ClientBookingsModal.tsx` affiche tous les rendez-vous du navigateur ; un téléphone ou nom n'est pas une preuve d'identité. Les annulations sont locales et non autorisées côté serveur.
- Fidélité : règles et vue existent mais la vue est inaccessible par la navigation ERP ; paramètres globaux plutôt que par salon.
- Dashboard et rapports : une partie utilise les états locaux initialisés avec des jeux fictifs ; aucune garantie que les indicateurs correspondent aux définitions comptables demandées. Vérification métier complète nécessaire.
- Devise et dates : `formatPrice` impose FCFA ; les transactions et la plupart des montants ne portent pas de code ISO de devise ; rendez-vous stockés sous forme date/heure sans fuseau ni conversion UTC explicite.

### Simulé / absent

- `bookAppointment` marque les méthodes autres qu'espèces comme payées et crée des références aléatoires ; `recordPayment` crée aussi des transactions « completed » localement. Aucun appel fournisseur, webhook ou vérification serveur n'est présent. **Aucun paiement réel ne doit être déduit de ces états.**
- `upgradePlan` modifie immédiatement le plan local et affiche une activation ; pas de paiement vérifié, renouvellement, facture, contrôle des limites ou suspension.
- Les rôles sont sélectionnables dans la barre de navigation ; il n'y a ni identité vérifiée, ni permission sécurisée. Les données de démonstration et certains badges/chiffres par défaut ne sont pas des données réelles.
- Absents du dépôt : comptes et sessions, invitations, API/backend, SQL/RLS, isolation serveur, stockage distant, vérification téléphone/email, avis authentifiés, fournisseurs de paiement, notifications asynchrones, super-admin, sauvegardes et observabilité. Pas d'internationalisation, thème clair, PWA ni tests automatisés identifiés.

## 4. Risques priorisés et mesures

| Priorité | Risque et preuve | Mesure proposée |
|---|---|---|
| P0 | Paiement et abonnement présentés comme confirmés sans fournisseur (`AppContext.tsx`, `SaaSPlanView.tsx`). | Bloquer toute utilisation réelle ; séparer opérations manuelles et paiements en ligne ; activer uniquement sur événement serveur vérifié et idempotent. |
| P0 | Pas d'authentification ni d'isolation ; tous les rendez-vous locaux peuvent être affichés (`ClientBookingsModal.tsx`). | Sessions authentifiées, contrôles serveur systématiques et RLS ; lecture client limitée à son identité vérifiée. |
| P0 | Double réservation par chevauchement ou concurrence (`checkSlotAvailability`). | Vérifier les intervalles et contraintes en base dans une transaction ; test concurrent et gestion explicite du conflit. |
| P0 | Un salon non publié peut apparaître ; publication et badges fictifs (`MarketplaceHome.tsx`, `createSalon`). | Vue publique minimisée et filtrée côté serveur ; publication explicite après validation, sans statut fictif. |
| P1 | Chiffres CRM/fidélité incorrects et actions non idempotentes. | Définir événements métier et transitions autorisées ; calculs et journal transactionnels avec clés d'idempotence. |
| P1 | Session de caisse et réglages de fidélité globaux. | Modèle tenant/branche contraint ; accès scellé par membership et tests inter-tenant. |
| P1 | Données de navigateur personnelles, effaçables, modifiables et non synchronisées ; `JSON.parse` non protégé. | Export local volontaire, import contrôlé et sauvegardes serveur ; protection contre corruption ; pas de migration automatique destructrice. |
| P1 | État global massif, couplage UI/métier, pas de tests, pas de lockfile, dépendances non strictement reproductibles. | Découpage par domaines, tests critiques, lockfile et CI ; migration incrémentale. |
| P2 | Accessibilité, responsive, fuseaux, devises, performances et confidentialité non vérifiés ; images et polices distantes. | Tests mobile/clavier/réseau, budget de performance, politique médias, i18n et `Intl` avec devise explicite. |

## 5. Routes et workflow cibles — proposition à implémenter progressivement

Les chemins ci-dessous sont une convention proposée, **pas des routes existantes**. Les identifiants d'URL servent à sélectionner une ressource, jamais à prouver l'autorisation.

| Espace | Route | Accès / workflow |
|---|---|---|
| Public | `/`, `/recherche`, `/salons/[slug]` | Découverte et fiches publiées ; filtres dans les paramètres URL. |
| Réservation | `/salons/[slug]/reserver`, `/reservations/[id]/confirmation` | Créneaux recalculés au serveur, confirmation conditionnée à la transaction ; accès à la confirmation protégé. |
| Identité | `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser`, `/invitation/[token]` | Session, vérification, invitation à durée limitée. Ne pas exposer les tokens dans les journaux. |
| Client | `/compte`, `/compte/rendez-vous`, `/compte/favoris`, `/compte/avis`, `/compte/preferences` | Session client ; données propres à l'utilisateur et consentements. |
| Pro | `/pro/inscription`, `/pro/onboarding/[etape]` | Compte puis création de tenant ; brouillon reprenable ; publication explicite après contrôles. |
| ERP | `/app/[salonId]/tableau-de-bord`, `/rendez-vous`, `/caisse`, `/clients`, `/prestations`, `/equipe`, `/depenses`, `/stocks`, `/fidelite`, `/vitrine`, `/parametres`, `/abonnement` | Les suffixes sont relatifs à `/app/[salonId]` ; session et membership requis ; droits par action et branche. |
| Plateforme | `/admin` et sous-routes salons, utilisateurs, plans, abonnements, support, audit | Accès administratif global distinct et audité. |

Pour les modales non partageables, conserver l'état local ; une page métier partageable doit conserver son URL et gérer actualisation, retour et erreur 404/403. Prévoir les états vide/chargement/erreur et protéger la navigation sans révéler l'existence de ressources privées.

## 6. Architecture cible et frontières de confiance

- Migration progressive vers Next.js App Router et React compatibles, après validation de la matrice de versions et du déploiement ; préserver le Vite existant jusqu'à validation des parcours transférés. Server Components par défaut ; composants interactifs isolés.
- `src/app` : routes et layouts ; `src/features/<domaine>` : vues, formulaires, use-cases et tests ; `src/components` : UI partagée ; `src/lib` : infrastructure commune ; `src/repositories` ou repositories propres à chaque domaine : accès aux données. Séparer DTO publics, données internes et permissions.
- Supabase Auth + PostgreSQL : organisations, salons et branches, memberships, rôles et permissions. L'utilisateur peut avoir des rôles différents selon l'établissement. Décider explicitement la relation organisation/salon/tenant avant toute migration. RLS activée sur les tables sensibles, politiques minimales, rôles SQL et fonctions contrôlés ; aucune clé service dans le navigateur. La RLS complète mais ne remplace pas les vérifications métier serveur.
- Toute mutation valide entrée et identité côté serveur (Zod), autorise l'action sur le salon et la branche, puis effectue les écritures liées dans une transaction. Les permissions ne peuvent être élevées par un utilisateur non habilité ; opérations sensibles auditées.
- Disponibilités : timestamps UTC `timestamptz`, fuseau IANA de branche, intervalles `[début, fin)`, horaires/absences/buffers/capacité. Une contrainte d'exclusion PostgreSQL sur les rendez-vous actifs d'un collaborateur peut empêcher les chevauchements ; les règles de capacité et horaires doivent aussi être vérifiées atomiquement. Concevoir les index et tests avec la migration, y compris changements de statut et annulations.
- Paiements : montants entiers et code ISO 4217, journal append-only, opérations de correction, idempotence, signatures webhook vérifiées, secret serveur, réconciliation. Un encaissement déclaré manuellement ne doit pas être présenté comme confirmation fournisseur.
- Notifications : outbox transactionnelle, traitement asynchrone et retries bornés, statuts et consentements ; pas de promesse de livraison sans prestataire.
- Statistiques : définir séparément prestations réalisées, encaissements, remboursements et dépenses ; calculer par salon, branche, devise et période, sans chiffres artificiels.

## 7. Plan de migration non destructif et priorités

1. **Phase 1 — audit et fondations (en cours)** : cet inventaire, architecture et plan. Compléter par vérification UX au navigateur, revue détaillée de chaque indicateur et audit de l'environnement Supabase ciblé s'il existe ; établir une base de tests et résoudre le conflit de dépendances. Ne pas prétendre que la phase est terminée avant ces vérifications.
2. **P0 — sécurité avant exposition** : empêcher l'utilisation du prototype comme production. Concevoir le modèle d'autorisations et tests de fuite ; distinguer explicitement démo et opérations réelles. Aucune connexion de paiement avant validation fournisseur.
3. **Phase 2 — socle SaaS** : environnements isolés, migrations versionnées revues, Auth, création tenant atomique, memberships, RLS, invitations, onboarding sauvegardé. Tester deux tenants, plusieurs rôles et changements de droits avant d'exposer les données.
4. **Phase 3 — cœur métier** : réutiliser progressivement interfaces existantes ; extraire règles et accès aux données ; services, équipe, clients, disponibilités et rendez-vous transactionnels, puis planning.
5. **Phase 4 — opérations** : caisse isolée, journal financier, dépenses, stocks et rapports définis et testés. Pas de données de démonstration en production.
6. **Phase 5 — marketplace** : vue publique dédiée, recherche, publication, fiches et parcours client protégés ; contrôler explicitement les informations divulguées.
7. **Phases 6–8** : notifications et fidélité ; intégrations paiement/abonnement uniquement lorsque les contrats et accès existent ; administration séparée et auditée.
8. **Phase 9** : tests de sécurité, performance, restauration, supervision, documentation et déploiement staging avant décision de production.

### Préservation des données locales

Ne jamais supprimer les clés `barber_cuts_state_v1_*` ni considérer les valeurs navigateur comme autorisées ou fiables. Avant toute migration, documenter les versions et proposer un export explicite ; mapper IDs locaux vers UUID, dédupliquer et valider les devises/dates, distinguer données de démonstration et données à importer, présenter un aperçu puis importer par tenant après authentification et confirmation. Tester sur une copie ; conserver le fichier source et journaliser les erreurs ; aucun effacement automatique. Les états de paiement simulés ne deviennent jamais des paiements confirmés lors de l'import. Documenter sauvegarde, restauration et retour arrière côté serveur avant migration réelle.

## 8. Critères d'acceptation

- **Fondations** : audit du dépôt et, si applicable, du projet SQL/RLS ciblé ; routes et modèle tenant documentés ; installation reproductible ; compilation et base de tests exécutées ; parcours critiques inventoriés ; décisions et risques ouverts identifiés.
- **Socle** : inscription, vérification, connexion et invitation testées ; accès inter-tenant refusé côté serveur et RLS, y compris changement de rôle et accès direct API ; brouillon onboarding reprenable ; aucune publication automatique incomplète.
- **Réservations** : durée, horaires, fuseau et capacité testés ; deux tentatives concurrentes pour un même professionnel ne peuvent aboutir simultanément ; modification et annulation respectent les règles.
- **Finance** : aucun état de paiement fournisseur ou abonnement actif sans preuve serveur ; doublons webhook sans double effet ; remboursements et écritures correctives traçables ; caisse par salon/branche.
- **Marketplace et client** : seules les données publiées et publiques sont visibles ; client authentifié ou téléphone vérifié selon politique retenue ; accès et annulation autorisés uniquement pour ses réservations.
- **Production** : tests unitaires, intégration/RLS et E2E réussis sur environnement dédié ; restauration testée, sécurité et permissions revues, monitoring et runbooks disponibles ; aucune statistique fictive ni promesse fournisseur non intégrée.

## 9. Vérifications exécutées

Environnement : Node 22.22.3, npm 10.9.8. Aucune modification de dépendances ou de données versionnées.

- `npm install --no-package-lock --ignore-scripts --no-audit --no-fund` : **échec** `ERESOLVE` ; Vite 8.3.5 demande en dépendance optionnelle pair esbuild `^0.27.0 || ^0.28.0`, alors que le manifeste déclare `^0.25.0`.
- `npm install --no-package-lock --legacy-peer-deps --no-audit --no-fund` : succès pour diagnostic uniquement ; ce contournement ne constitue pas une résolution durable ni une installation reproductible.
- `npm run lint` : succès après installation contournée ; il s'agit uniquement de TypeScript sans mode strict, pas d'un audit de qualité/sécurité.
- `npm run build` : succès après installation contournée ; avertissements sur `__dirname` dans la configuration Vite et bundle JS minifié de 543,85 kB (> 500 kB). Résultat non équivalent à une validation fonctionnelle.
- Aucun test unitaire, intégration, E2E, concurrence, RLS, sécurité ou responsive exécuté : absence d'infrastructure de test dans le dépôt. Aucun déploiement ni migration distante effectué.
