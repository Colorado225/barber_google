# BARBER CUTS Business — Workflow fonctionnel de référence

> **Mise à jour : Supabase devient la cible technique unique pour authentification et données applicatives.** Les références à Neon ou à PostgreSQL local sont historiques et doivent être ignorées. Toutes les données de l’app doivent passer par Supabase.

**Statut : cible produit proposée comme référence de conception ; non implémentée ni validée en production.** Version 1 — 3 novembre 2026. Ce document définit les comportements et routes à construire, avant la migration des données. Il complète `audit-fondations.md` et `multi-tenant.md` ; en cas d'écart, l'application actuelle reste un prototype et ne doit pas être interprétée comme réalisant ces workflows.

## 1. Principes directeurs

1. Un professionnel doit pouvoir gérer son salon **sans publier sur la marketplace**. La publication est un canal facultatif, distinct de l'activation de l'ERP.
2. Une seule identité peut être cliente et professionnelle, avec plusieurs memberships ; les droits sont liés au salon, pas choisis dans l'interface.
3. Les opérations quotidiennes partent du planning : réserver ou accueillir → réaliser → encaisser → clôturer → analyser. Les étapes service et paiement sont indépendantes.
4. Un rendez-vous, une prestation réalisée, une vente, un paiement et une session de caisse sont des objets distincts. Créer un rendez-vous n'est ni une visite réalisée ni un paiement.
5. Le salon est la frontière de sécurité ; la succursale est le lieu opérationnel. Le serveur vérifie l'identité, le salon, la succursale, la permission et les règles métier à chaque action. L'URL n'accorde aucun droit.
6. Les actions critiques sont traçables, idempotentes lorsque nécessaire et confirmées par le serveur. Sur réseau coupé, afficher un état incertain et vérifier le résultat avant de retenter ; ne jamais inventer une confirmation hors ligne.
7. Aucun chiffre de démonstration, statut de paiement fictif ou badge de vérification fabriqué n'apparaît en production.

## 2. Contextes et frontières

```text
Compte utilisateur
  ├─ Espace client personnel (facultatif)
  └─ Memberships actifs
       └─ Organisation / réseau
            └─ Salon = tenant
                 ├─ Succursale A : planning, équipe affectée, caisse, stocks
                 └─ Succursale B : planning, équipe affectée, caisse, stocks
```

- Le rôle est attribué pour un salon ; la portée des succursales est explicite. Un utilisateur peut avoir des rôles différents dans deux salons. Un rôle global plateforme est séparé des rôles salon et n'implique pas l'accès automatique aux données privées ; tout accès de support exceptionnel exige une procédure autorisée et auditée.
- Les clients, prestations et collaborateurs sont rattachés au salon ; chaque rendez-vous, mouvement de caisse ou stock concerne aussi une succursale. L'accès entre succursales est accordé explicitement. Le partage éventuel des clients dans un réseau de **salons distincts** est désactivé par défaut et nécessite une future politique de consentement et de droits.
- Au changement de salon ou de succursale, purger le contexte d'écran et les sélections ; recharger les droits et les données du nouveau périmètre. Ne pas recopier automatiquement des valeurs du précédent salon.
- Fuseau IANA de la succursale, dates stockées en UTC ; montants en unités entières avec code ISO 4217 (par défaut `XOF`). Ne pas additionner des devises distinctes sans conversion explicitement définie.

## 3. Entrée dans l'application et initialisation

### 3.1 Professionnel : inscription et accès

```text
Accueil pro → créer un compte / se connecter → vérifier son identité selon la politique
→ accepter une invitation OU créer un salon → choisir salon et succursale autorisés
→ reprendre la configuration si nécessaire → accueil opérationnel
```

- Après connexion : zéro salon → proposer « créer un salon » ou « accepter une invitation » ; un seul salon autorisé → y accéder ; plusieurs → sélecteur de salon. Une seule succursale autorisée peut être présélectionnée, sinon la choisir.
- Invitation : lien à usage unique et expiration, identité vérifiée, adhésion au salon et succursales prévues ; refuser une invitation expirée ou déjà utilisée. Un collaborateur ne peut pas s'attribuer un rôle, en modifier un ou augmenter ses propres droits.
- L'authentification, l'invitation et la sélection sont cibles ; les composants existants ne les assurent pas.

### 3.2 Configuration progressive du salon

Ordre recommandé, avec sauvegarde après chaque étape et reprise sans perte :

1. Compte et identité du propriétaire ; création du salon et de sa première succursale en brouillon.
2. Identité du salon et coordonnées ; pays, devise, fuseau et adresse de la succursale.
3. Horaires d'ouverture et règles de réservation : délais, annulation, confirmation, acompte éventuel.
4. Au moins une prestation active : prix, devise, durée et éventuels temps additionnels.
5. Au moins un intervenant actif, affecté à la succursale et habilité sur une prestation ; horaires et absences.
6. Caisse et modes de règlement : seuls les moyens disponibles peuvent être proposés ; choisir si une caisse ouverte est requise pour les encaissements manuels.
7. Facultatif pour démarrer : compléter l'équipe, stock, fidélité et vitrine.
8. Vérification des prérequis → activer les opérations internes. La vitrine reste **brouillon** jusqu'à une publication distincte et explicite.

Un brouillon incomplet peut être consulté et complété ; les actions nécessitant un prérequis indiquent ce qui manque et un lien pour le corriger. Un propriétaire peut passer les étapes facultatives. L'accès à l'historique doit rester possible même si la configuration est ensuite incomplète.

### 3.3 États indépendants

- **Configuration opérationnelle** : brouillon → prêt, avec retour à incomplet si une condition critique disparaît. Cet état ne se confond ni avec la publication ni l'abonnement.
- **Vitrine** : brouillon → publiée → dépubliée ; publication réservée à un utilisateur autorisé, après vérification du contenu public, de l'adresse, du contact et d'au moins une prestation réservable et d'une capacité de réservation valide. Suspendre une vitrine ne supprime pas les rendez-vous déjà pris. Toute remise en ligne revalide les prérequis.
- **Abonnement** : essai / actif / en retard / suspendu / annulé / expiré selon les événements vérifiés. La politique exacte de grâce, de restrictions et de conservation est configurable et à valider juridiquement. Une suspension ne supprime pas les données ; conserver l'accès autorisé à l'historique et aux actions indispensables définies par cette politique. Un plan n'est jamais activé sur simple clic ou réponse navigateur.

## 4. Journée type : workflow central ERP

```text
Préparer le salon / choisir la succursale
  → ouvrir une session de caisse si nécessaire
  → consulter le planning et les demandes
  → créer ou confirmer les rendez-vous
  → accueillir le client
  → démarrer la prestation
  → terminer la prestation
  → encaisser le solde (avant ou après la prestation)
  → délivrer un reçu et mettre à jour les indicateurs
  → clôturer la caisse et traiter les écarts
```

Un client sans réservation suit le même parcours : création d'un rendez-vous immédiat « direct », vérification de capacité et d'intervenant, puis accueil. Aucun encaissement ne marque automatiquement une prestation comme réalisée ; terminer une prestation ne signifie pas qu'elle est payée.

### 4.1 Réserver depuis l'ERP

1. Choisir succursale, client existant ou nouveau, prestation(s), collaborateur ou « sans préférence », date et créneau ; sélectionner la vraie source : salon, téléphone ou WhatsApp.
2. Le serveur vérifie que services et collaborateur appartiennent au salon et sont autorisés dans la succursale ; calcule les disponibilités selon horaires, pauses, absences, durée, buffers et capacité.
3. Confirmation par une écriture atomique. Si le créneau est pris entre-temps, refuser avec explication et proposer d'autres créneaux. Ne pas créer de doublon lors d'un retry.
4. Créer un client si nécessaire, sans incrémenter les visites ni les dépenses à ce stade. Enregistrer prix, durée, devise et prestation tels qu'acceptés à la réservation ; les modifications futures du catalogue ne modifient pas silencieusement l'historique.
5. Par défaut, statut `PENDING` si validation manuelle est configurée, sinon `CONFIRMED`. Acompte éventuel et statut de paiement sont suivis séparément. Notifications uniquement lorsqu'un canal est configuré.

### 4.2 Réserver depuis la marketplace

Découverte → fiche publique publiée → prestation → succursale et collaborateur ou sans préférence → créneau réel → identification adaptée (compte ou téléphone vérifié selon politique) → récapitulatif → création atomique → confirmation conditionnée aux règles du salon.

Si un acompte en ligne est obligatoire, le créneau peut être retenu temporairement avec expiration explicite ; confirmation du rendez-vous uniquement après vérification serveur du paiement dans le délai. Les délais, événements tardifs et éventuels remboursements doivent être définis par fournisseur avant activation. Aucune intégration indisponible n'est présentée comme opérationnelle.

### 4.3 États des rendez-vous et transitions

| De                          | Vers                     | Conditions et effets                                                                        |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| création                    | `PENDING` ou `CONFIRMED` | Disponibilité validée atomiquement ; selon règle de confirmation.                           |
| `PENDING`                   | `CONFIRMED`              | Acteur autorisé ou événement de paiement vérifié selon politique.                           |
| `PENDING`, `CONFIRMED`      | `CANCELLED`              | Auteur, motif et date enregistrés ; appliquer politique et traiter séparément les acomptes. |
| `CONFIRMED`                 | `CHECKED_IN`             | Client arrivé ; réservé au personnel autorisé.                                              |
| `CONFIRMED`                 | `NO_SHOW`                | Après l'heure prévue et selon délai configurable ; acteur autorisé, raison tracée.          |
| `CHECKED_IN`                | `IN_PROGRESS`            | Intervenant autorisé commence la prestation.                                                |
| `CHECKED_IN`, `IN_PROGRESS` | `CANCELLED`              | Exception opérateur autorisé, motif obligatoire ; règles financières distinctes.            |
| `IN_PROGRESS`               | `COMPLETED`              | Prestation achevée ; enregistrer l'événement et actualiser la visite une seule fois.        |

Les états `COMPLETED`, `CANCELLED` et `NO_SHOW` sont terminaux dans le flux normal. Une correction nécessite une action explicite autorisée et auditée, avec compensation des effets déjà produits ; pas de retour arbitraire par sélecteur de statut. Les retards sont une information séparée, pas un état qui masque l'état du rendez-vous. Les modifications de date/collaborateur recalculent et réservent le créneau atomiquement ; l'ancien reste réservé si la modification échoue. Pour une réservation en attente, définir la durée de blocage/expiration de façon explicite.

### 4.3 Publier une vitrine et diffuser son QR code

La publication est un acte explicite et distinct de l'activation interne (§3.3). Le QR code est un simple raccourci vers la fiche publique : il ne crée aucune réservation et n'accorde aucun droit.

```text
Vitrine brouillon → vérifier contenu, adresse, contact, ≥1 prestation réservable
  → publier (acteur autorisé) → fiche publique accessible
  → générer le QR code du salon → télécharger / imprimer → afficher sur place
```

- Le QR code encode l'URL absolue de la fiche publique `/salons/[slug]`. Le slug est stable ; s'il change, les affiches déjà imprimées doivent être régénérées.
- Génération et diffusion réservées au propriétaire et au manager. Les autres rôles consultent le lien sans pouvoir le diffuser.
- Tant que la vitrine est en brouillon ou sans prestation active, l'interface indique que le QR code ne mène pas encore à une fiche réservable, et le téléchargement reste bloqué. Ne jamais présenter un QR inactif comme prêt à distribuer.
- Un succès de génération ne s'affiche qu'après obtention réelle du fichier ; en cas de blocage navigateur, afficher l'erreur, pas une confirmation.
- Un scan ouvre la fiche publique puis la réservation (§4.2). Un slug inconnu affiche un message d'erreur explicite, sans redirection silencieuse.

### 4.4 Encaissement et caisse

1. Caisse → ouvrir une session pour une caisse et succursale autorisées ; enregistrer fond et opérateur. Interdire deux sessions ouvertes sur la même caisse.
2. Depuis le rendez-vous ou la caisse, sélectionner l'opération, vérifier montant, devise et solde. Un acompte, un règlement partiel et un solde sont possibles ; la somme des règlements confirmés moins remboursements détermine le reste dû. Empêcher les dépassements involontaires ; traiter toute exception via une opération explicite.
3. **Espèces ou paiement déclaré manuellement** : enregistrer qui confirme la réception, méthode, montant et référence ; l'interface distingue déclaration manuelle de confirmation fournisseur. Toute méthode peut être restreinte par la politique du salon.
4. **Paiement en ligne** : état en attente jusqu'à vérification serveur du fournisseur. Vérifier signature et idempotence des webhooks, gérer échec, événements tardifs et réconciliation. Sans prestataire actif, ne pas offrir l'option en ligne.
5. Un reçu reflète uniquement l'opération confirmée ou déclarée. Un paiement confirmé est immuable ; correction ou remboursement = nouvelle écriture liée, autorisée et auditée.
6. Clôture : compter espèces, calculer solde théorique espèces, renseigner écart et motif ; conserver l'historique des sessions. Les paiements électroniques ne s'ajoutent pas au montant physique. La politique des paiements en attente à la clôture doit être explicitement configurée.

Annulation après acompte : calculer l'éventuel remboursement selon la politique communiquée ; ne jamais supposer que l'annulation a remboursé le client. Afficher l'état réel du remboursement et tracer toute retenue justifiée.

### 4.5 Après prestation

- Une visite est comptabilisée une seule fois à la fin de la prestation ; l'argent encaissé est calculé à partir des paiements, pas du prix réservé. Une correction après clôture produit une compensation traçable.
- Fidélité : crédit selon règle salon clairement définie, sur événement éligible unique ; remboursement ou annulation ultérieure déclenche une compensation définie. Une récompense exige un solde suffisant et une transaction atomique.
- Stock : une consommation prédéfinie peut produire un mouvement au moment configuré ; correction par mouvement inverse, jamais par réécriture silencieuse de l'historique.
- Notifications transactionnelles selon configuration ; marketing seulement avec consentement requis. Ne pas confondre notification mise en file, envoyée et livrée.

## 5. Autres workflows métier

### Clients / CRM

Rechercher → consulter ou créer une fiche dans le salon → réservation et historique → segmentation → action autorisée. Détecter les doublons sans fusion automatique ; éviter d'exposer notes internes et consentements au public. Export/import avec permission, validation et journalisation. Une identité client globale ne donne pas accès aux notes ou historiques d'autres salons.

### Prestations et collaborateurs

Créer une prestation → prix/durée/devise → l'activer dans les succursales pertinentes → associer collaborateurs et horaires → éventuellement publier. Désactiver au lieu de supprimer si elle est liée à l'historique ; le futur planning prévient des conflits.

Inviter ou créer un profil opérationnel → attribuer rôle et succursales → accepter l'invitation pour l'accès numérique → associer les prestations et horaires → gérer congés et indisponibilités. Un profil sans compte ne donne pas d'accès à l'ERP. Une absence conflictuelle génère une liste de rendez-vous à réaffecter, sans modifier silencieusement les réservations.

### Dépenses, stock et reporting

- Dépense : enregistrer date, catégorie, montant, devise, succursale et justificatif si applicable ; correction auditée. Le règlement d'une dépense en espèces peut impacter la caisse par un mouvement lié, selon une règle explicite.
- Stock : achat/réception → entrée, consommation/vente → sortie, inventaire → ajustement motivé. Les quantités et alertes sont par succursale et les mouvements restent traçables.
- Tableau de bord : afficher période, salon, succursale, fuseau et devise. Distinguer réservations, prestations réalisées, encaissements nets des remboursements, dépenses et résultat estimé. Un panier moyen doit préciser son dénominateur ; aucun fallback fictif. Ne pas qualifier le résultat estimé de bénéfice comptable certifié.

## 6. Matrice de permissions initiale proposée

Légende : **T** = tous les éléments du périmètre autorisé ; **P** = périmètre propre ; **—** = refus par défaut. Les permissions seront configurables dans des limites fixées par la plateforme ; masquer un bouton ne remplace pas le contrôle serveur.

| Action                                     | Propriétaire | Manager                         | Réception        | Barbier                          | Caissier                                 | Comptable                    | Client                            |
| ------------------------------------------ | ------------ | ------------------------------- | ---------------- | -------------------------------- | ---------------------------------------- | ---------------------------- | --------------------------------- |
| Configuration salon / publication          | T            | Selon délégation                | —                | —                                | —                                        | —                            | —                                 |
| Invitations, rôles, droits                 | T            | Selon délégation sans élévation | —                | —                                | —                                        | —                            | —                                 |
| Planning / création et modification RDV    | T            | T                               | T                | P : consulter et traiter ses RDV | —                                        | —                            | P : ses réservations selon règles |
| Accueil, début, fin de prestation          | T            | T                               | T : accueil      | P : ses prestations              | —                                        | —                            | —                                 |
| Clients et notes internes                  | T            | T                               | T : opérationnel | P : données nécessaires          | P : données nécessaires à l'encaissement | —                            | P : son profil                    |
| Encaissement / ouverture et clôture caisse | T            | T                               | Selon délégation | —                                | T                                        | Lecture autorisée            | —                                 |
| Remboursement / correction financière      | T            | Selon délégation                | —                | —                                | Selon délégation                         | Lecture autorisée            | —                                 |
| Dépenses, stocks                           | T            | T                               | —                | —                                | Selon délégation                         | Lecture financière           | —                                 |
| Rapports financiers / export               | T            | Selon délégation                | —                | P : propres chiffres autorisés   | P : sa caisse autorisée                  | T : lecture/export autorisés | —                                 |
| Abonnement et facturation SaaS             | T            | Selon délégation                | —                | —                                | —                                        | Lecture selon délégation     | —                                 |

Toutes les cellules T restent limitées au salon et aux succursales autorisés. Le super-admin relève d'une politique séparée, avec audit et absence d'accès financier/client automatique. Le socle SQL existant ne couvre actuellement qu'une petite partie de cette matrice ; il faudra étendre et tester les permissions avant de les exposer.

## 7. Navigation et routes cibles

Ces routes sont une proposition cohérente avec le futur App Router ; **elles n'existent pas encore**. `salonId` et `branchId` ne sont jamais des preuves d'autorisation. Les détails ont des URL partageables entre personnes autorisées ; les formulaires courts peuvent être des modales, avec retour vers leur contexte.

```text
/                                      Marketplace
/recherche                             Résultats et filtres URL
/salons/[slug]                         Fiche publique
/salons/[slug]/reserver                Réservation
/connexion                             Connexion
/inscription                           Création de compte
/mot-de-passe-oublie                   Récupération
/reinitialiser                         Nouveau mot de passe
/invitation/[token]                    Acceptation invitation
/compte                                Profil client
/compte/rendez-vous                    Rendez-vous client
/compte/rendez-vous/[id]               Détail, modification ou annulation autorisée
/pro/creer-salon                      Création d'un salon
/pro/onboarding/[salonId]/[etape]      Configuration reprenable
/app                                   Sélection d'un salon autorisé
/app/[salonId]                         Sélection de succursale ou redirection autorisée
/app/[salonId]/[branchId]/aujourdhui   Accueil opérationnel
/app/[salonId]/[branchId]/planning     Planning et filtres
/app/[salonId]/[branchId]/rendez-vous/nouveau
/app/[salonId]/[branchId]/rendez-vous/[id]
/app/[salonId]/[branchId]/caisse       Session et mouvements
/app/[salonId]/[branchId]/caisse/sessions/[id]
/app/[salonId]/[branchId]/depenses
/app/[salonId]/[branchId]/stocks
/app/[salonId]/clients                 CRM du salon, limité aux droits
/app/[salonId]/clients/[id]
/app/[salonId]/prestations            Catalogue et affectations
/app/[salonId]/equipe                  Collaborateurs, invitations, horaires
/app/[salonId]/fidelite                Règles et historique
/app/[salonId]/rapports                Filtres par succursale autorisée
/app/[salonId]/vitrine                 Brouillon, aperçu et publication
/app/[salonId]/parametres              Salon et succursales
/app/[salonId]/abonnement              Plan et factures
/admin                                 Espace plateforme distinct
```

### Navigation quotidienne

- Sidebar ERP : **Aujourd'hui**, **Planning**, **Clients**, **Caisse**, **Prestations**, **Équipe**, **Stocks**, **Dépenses**, **Rapports**, **Fidélité**, **Vitrine**, **Paramètres**, **Abonnement**. Les modules non autorisés sont masqués ; les accès directs sont néanmoins vérifiés.
- En-tête : salon et succursale actifs, recherche contextuelle, notifications et compte ; actions « Nouveau rendez-vous » et « Encaisser » uniquement si autorisées et disponibles.
- Mobile : raccourcis Aujourd'hui / Planning / Clients / Caisse, avec « Plus » pour les autres fonctions ; adapter selon droits, sans déborder d'actions. La navigation client/marketplace est séparée de la navigation ERP.
- Retour arrière, rafraîchissement, URL directe, 404/403 et session expirée doivent être gérés ; un changement de contexte ne doit pas déclencher une mutation.

## 8. Réutilisation et écarts précis du dépôt

| Existant                                                      | Rôle cible                                            | Évolution nécessaire                                                                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`, `Navbar.tsx`, `ErpLayout.tsx`                      | Layouts et navigation séparés                         | Remplacer `mode`, `activeTab` et choix libre du rôle par routes, session et contexte autorisé.                                          |
| `RegisterSalonModal.tsx`, `OnboardingWizardPage.tsx`          | Création et configuration progressive                 | Fusionner les étapes redondantes ; sauvegarde/reprise ; supprimer publication automatique et valeurs fictives.                          |
| `DashboardView.tsx`                                           | Aujourd'hui + rapports                                | Conserver les composants visuels ; remplacer séries et panier moyen codés en dur par calculs réels ou état vide.                        |
| `AppointmentsCalendarView.tsx`, `NewAppointmentModal.tsx`     | Planning, détail et création                          | Généraliser les vues et actions ; respecter la source choisie, le fuseau et le contrôle atomique ; transitions explicites.              |
| `SalonDetailModal.tsx`, `ClientBookingsModal.tsx`             | Fiche publique, réservation et espace client          | Routes dédiées, disponibilités serveur, identité vérifiée ; aucune liste globale de rendez-vous.                                        |
| `CashRegisterView.tsx`, `NewPaymentModal.tsx`                 | Caisse et règlements                                  | Sessions par caisse/succursale ; distinction paiement manuel/fournisseur ; soldes et écritures traçables.                               |
| `CrmClientsView.tsx`, `ServicesView.tsx`, `StaffView.tsx`     | Clients, catalogue, équipe                            | Ajouter détails, droits, cycle de vie, succursales et affectations ; ne pas supprimer l'historique.                                     |
| `FinanceExpensesView.tsx`, `InventoryView.tsx`                | Dépenses, stock et mouvements                         | Historique, corrections, succursale et reporting fiable.                                                                                |
| `LoyaltyRewardsView.tsx`                                      | Fidélité                                              | Brancher à la navigation cible seulement après isolation et règles idempotentes.                                                        |
| `MarketplaceShowcaseView.tsx`, `SalonProfileSettingsView.tsx` | Vitrine et paramètres                                 | Séparer données privées/publiques ; aperçu sans publication ; publication contrôlée.                                                    |
| `SalonQrCodeView.tsx`, `salonLink.ts`                         | QR code de la fiche publique et lien `/salons/[slug]` | Prototype : slug et URL réels, états brouillon/publié, permissions ; à brancher sur la fiche publique et le slug persisté côté serveur. |
| `SaaSPlanView.tsx`                                            | Abonnement                                            | Pas d'activation sur clic ; états et droits issus de paiements vérifiés.                                                                |
| `AppContext.tsx`                                              | Aucun équivalent monolithique                         | Extraire progressivement navigation, services et règles par domaine ; conserver l'ancien prototype jusqu'à validation.                  |

## 9. Ordre d'implémentation du workflow

1. **Contrat et navigation** : valider les règles de ce document ; définir routes, layouts et guards ; maquetter les états vides et accès refusés sans faire croire à une sécurité effective.
2. **Identité et contexte** : Auth, memberships, sélection salon/succursale, invitation, droits réels ; tests d'accès direct et inter-tenant. Étendre le socle SQL existant au périmètre des succursales.
3. **Onboarding et référentiels** : reprise, services, collaborateurs, horaires et activation interne ; vitrine séparée.
4. **Planning et rendez-vous** : disponibilité serveur, contrôle de concurrence, transitions, fiche RDV, sources et historisation.
5. **Caisse et clients** : paiements manuels traçables, sessions, CRM et indicateurs ; intégrations fournisseur seulement après vérification et contractualisation.
6. **Marketplace et client** : publication contrôlée, recherche et réservation sur le même moteur ; identification et droits clients.
7. **Modules complémentaires** : stocks, dépenses, fidélité, rapports, notifications, abonnements puis administration ; chacun avec permissions et tests propres.

La migration de données locales éventuelle est un chantier séparé, explicite et non destructif. À chaque étape, conserver les fonctionnalités réutilisables et ne basculer un parcours qu'après ses tests.

## 10. Critères de validation du workflow

- Un propriétaire peut reprendre sa configuration ; le salon fonctionne en interne sans être public et une vitrine incomplète ne se publie pas.
- Un utilisateur de deux salons change de contexte sans voir ni modifier les données non autorisées, y compris par URL/API ; une personne suspendue perd son accès.
- Une réception crée un rendez-vous avec la bonne source, modifie un créneau sans perdre l'ancien en cas de conflit ; deux requêtes simultanées ne réservent pas le même créneau.
- Un client ne voit et ne modifie que ses propres rendez-vous selon les règles du salon ; un barbier n'agit que dans son périmètre.
- Les transitions invalides sont refusées ; une prestation terminée ne compte qu'une visite ; un acompte ne signifie pas solde payé ; une annulation ne prétend pas qu'un remboursement a eu lieu.
- Deux succursales ont des plannings, stocks et caisses isolés ; les opérations et corrections financières sont auditables et les montants portent leur devise.
- L'interface indique clairement chargement, conflit, permission refusée et résultat incertain après coupure réseau. Les actions peuvent être utilisées sur mobile et au clavier.
- Les données réelles seules alimentent le tableau de bord. Les tests unitaires, intégration/RLS et E2E ci-dessus passent dans un environnement dédié avant activation en production.

## 11. Décisions produit encore ouvertes

- Politique de réservation sans compte et prestataire de vérification téléphone ; politique de conservation et de consentement.
- Durée de réservation temporaire, délais de confirmation/no-show, conditions d'acompte et de remboursement ; valeurs par défaut à définir et rendre configurables.
- Définition de l'éligibilité fidélité (prestation terminée, paiement encaissé ou combinaison), compensation et règles de partage client entre salons d'un réseau.
- Permissions exactes par rôle et succursale, délégations possibles et procédure d'accès support.
- Politique commerciale des abonnements en retard, conservation/export et droits en cas de suspension.
- Fournisseurs de paiement et canaux de notification réellement disponibles, contrats et règles opérationnelles.
