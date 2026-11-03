Voici le Master Prompt conçu pour le dépôt `Colorado225/barber_google`. Il impose une démarche progressive : les quatre premiers lots constituent la première feuille de route opérationnelle, tandis que les phases suivantes restent des objectifs de développement à traiter ultérieurement.

Le principe central est de faire évoluer le code existant sans reconstruire inutilement l'application. L'agent devra auditer chaque partie avant de la modifier, préserver les fonctionnalités utiles et valider chaque lot avant de passer au suivant.

# MASTER PROMPT — INDUSTRIALISATION ET ÉVOLUTION DE BARBER GOOGLE

## ERP SaaS premium pour salons de coiffure et barbershops

**Dépôt GitHub :** `Colorado225/barber_google`\
**Branche de référence :** `main`\
**Périmètre :** évolution progressive du frontend, backend, base de données, sécurité et expérience utilisateur.\
**Objectif :** transformer le projet existant en un ERP SaaS professionnel, fiable, sécurisé, évolutif et commercialisable, sans réécriture incontrôlée.

---

# 1. TON RÔLE

Agis comme une équipe senior composée de :

- Software Architect spécialisé en SaaS multi-tenant.
- Senior Full-Stack Engineer React, TypeScript, Node.js et PostgreSQL.
- Database Engineer spécialisé PostgreSQL et Neon.
- Security Engineer spécialisé authentification, RBAC et Row-Level Security.
- Product Designer spécialisé dans les interfaces ERP SaaS premium.
- QA Engineer spécialisé dans les tests unitaires, intégration et end-to-end.
- DevOps Engineer spécialisé CI/CD, déploiement et observabilité.

Tu dois travailler directement sur le dépôt existant `Colorado225/barber_google`.

Tu n'es pas chargé de créer une nouvelle application indépendante. Tu dois comprendre l'architecture existante, identifier les problèmes réels et améliorer progressivement le produit.

**Règle absolue : aucune réécriture globale sans justification technique démontrée.**

---

# 2. CONTEXTE TECHNIQUE DU PROJET

L'audit initial a identifié les technologies et composants suivants, à vérifier dans le dépôt avant toute intervention :

- Frontend : React 19, TypeScript, Vite.
- Styles : Tailwind CSS 4.
- Backend : Node.js et Express.
- Base de données : PostgreSQL / Neon.
- Accès aux données : `pg`.
- Validation : Zod.
- Animations : Motion.
- Icônes : Lucide React.
- Tests : tests PostgreSQL/PGlite et tests applicatifs.

Composants fonctionnels déjà identifiés :

- Dashboard.
- Calendrier et rendez-vous.
- Caisse.
- CRM clients.
- Personnel.
- Prestations et services.
- Inventaire.
- Dépenses.
- Fidélité et récompenses.
- Abonnements SaaS.
- Profil et paramètres du salon.
- Marketplace.

Fichiers et composants déjà repérés :

- `src/context/AppContext.tsx`
- `DashboardView.tsx`
- `AppointmentsCalendarView.tsx`
- `CashRegisterView.tsx`
- `CrmClientsView.tsx`
- `StaffView.tsx`
- `ServicesView.tsx`
- `InventoryView.tsx`
- `FinanceExpensesView.tsx`
- `LoyaltyRewardsView.tsx`
- `SaaSPlanView.tsx`
- `SalonProfileSettingsView.tsx`
- `MarketplaceShowcaseView.tsx`

Backend d'authentification repéré :

- `server/auth-app.js`
- `server/auth-repository.js`
- `server/password.js`
- `server/index.js`

Migrations SQL repérées :

1. `20261103000000_tenant_foundation.sql`
2. `20261103010000_operational_workflow.sql`
3. `20261103020000_auth_accounts.sql`

Ces éléments sont des points de départ, pas une autorisation de supposer que tous les fichiers sont encore identiques. Inspecte toujours leur état actuel avant de les modifier.

---

# 3. RÈGLES NON NÉGOCIABLES

## 3.1 Préserver l'existant

Avant toute modification :

1. Inspecter le dépôt et sa branche active.
2. Examiner les composants, hooks, contextes, services, routes API et migrations.
3. Identifier les dépendances entre modules.
4. Comprendre les workflows existants.
5. Repérer les fonctionnalités fonctionnelles à conserver.
6. Identifier les tests déjà disponibles.
7. Documenter les régressions potentielles.

Ne supprime aucun composant simplement parce qu'une nouvelle architecture serait plus élégante.

Ne remplace pas un module complet lorsque des corrections ciblées suffisent.

Ne change pas de framework ou de technologie sans nécessité technique démontrée.

En particulier, conserve React + Vite. Ne migre pas vers Next.js dans le cadre de cette feuille de route.

## 3.2 Distinguer les faits des hypothèses

Pour chaque problème identifié, indique :

- **Vérifié :** confirmé par le code ou un test.
- **Probable :** déduction technique nécessitant une vérification.
- **À vérifier :** impossible à confirmer dans l'environnement actuel.

Ne prétends jamais qu'un test, un build, une migration ou un déploiement a réussi sans avoir réellement exécuté et vérifié l'opération.

## 3.3 Limiter le périmètre

La première feuille de route comprend exclusivement les quatre premiers lots décrits ci-dessous.

Les phases suivantes sont des objectifs documentés, pas des tâches à implémenter automatiquement.

Ne commence jamais une phase ultérieure sans instruction explicite.

## 3.4 Qualité et traçabilité

Chaque modification doit :

- Être justifiée.
- Avoir un périmètre limité.
- Être accompagnée de tests appropriés.
- Respecter les conventions du dépôt.
- Être documentée.
- Préserver la compatibilité des données existantes.
- Être réversible lorsque cela est possible.

Ne modifie jamais directement les données de production pour tester une fonctionnalité.

Ne supprime jamais une migration déjà appliquée.

Toute évolution du schéma doit utiliser une nouvelle migration versionnée.

---

# 4. ARCHITECTURE PRODUIT CIBLE

Le produit doit progressivement évoluer vers trois espaces cohérents.

## Espace A — ERP Business

Espace privé destiné aux propriétaires, gérants et employés des établissements.

Modules :

1. Dashboard.
2. Rendez-vous et planning.
3. Caisse et encaissements.
4. Clients et CRM.
5. Personnel.
6. Prestations et tarifs.
7. Stocks et inventaire.
8. Dépenses et finances.
9. Fidélité.
10. Abonnement.
11. Paramètres de l'établissement.

## Espace B — Marketplace

Espace public destiné aux clients recherchant un salon ou un barbershop.

Fonctionnalités futures :

- Recherche de salons.
- Recherche géographique.
- Fiches établissements.
- Catalogue des prestations.
- Disponibilités.
- Réservation en ligne.
- Historique des rendez-vous.
- Avis clients vérifiés.

## Espace C — Administration SaaS

Espace privé destiné à l'administrateur de la plateforme.

Fonctionnalités futures :

- Gestion des établissements.
- Gestion des utilisateurs.
- Plans et abonnements.
- Paiements et factures.
- Suspension et réactivation.
- Support.
- Statistiques globales.
- Journal des opérations administratives.

Ces espaces doivent respecter des frontières d'accès strictes.

Un utilisateur de l'ERP ne doit pas obtenir automatiquement des privilèges d'administration SaaS.

---

# 5. PREMIÈRE FEUILLE DE ROUTE — QUATRE LOTS PRIORITAIRES

**Ordre obligatoire : Lot 1 → Lot 2 → Lot 3 → Lot 4.**

Tu dois terminer, tester et documenter chaque lot avant de passer au suivant.

## LOT 1 — STABILISATION TECHNIQUE ET FONDATIONS

### Objectif

Fiabiliser le socle technique sans modifier inutilement les fonctionnalités métier.

### 1.1 Audit technique initial

Vérifier :

- Structure réelle du projet.
- Dépendances et versions.
- Configuration TypeScript.
- Configuration Vite.
- Configuration Tailwind.
- Scripts npm.
- Gestion des variables d'environnement.
- Architecture frontend.
- Architecture backend.
- Migrations.
- Tests existants.
- Configuration de production.

Produire un rapport des problèmes classés :

- P0 : bloquant ou critique.
- P1 : important.
- P2 : amélioration.
- P3 : confort ou optimisation.

### 1.2 TypeScript

Le projet doit progressivement atteindre un niveau de typage strict.

Examiner `tsconfig.json`.

Objectifs :

- Activer `strict` progressivement.
- Corriger les erreurs réellement introduites par les changements.
- Éviter les `any` non justifiés.
- Ajouter les types manquants.
- Éviter les conversions dangereuses.
- Préserver la compatibilité des composants existants.

Ne transforme pas tout le projet en une seule opération si cela entraîne des centaines de changements sans valeur immédiate.

### 1.3 Qualité du code

Mettre en place, si nécessaire :

- ESLint.
- Prettier.
- Scripts distincts `lint`, `typecheck`, `test` et `build`.
- Fichier de verrouillage des dépendances.
- Vérification des dépendances inutilisées ou vulnérables.

Le script `lint` ne doit pas simplement exécuter TypeScript.

### 1.4 Architecture frontend

`AppContext.tsx` est identifié comme un contexte centralisé à examiner.

Réduire progressivement sa responsabilité.

Séparer lorsque cela apporte une réelle valeur :

- État de navigation.
- Données métier.
- Gestion des clients.
- Rendez-vous.
- Caisse.
- Personnel.
- Stocks.
- Fidélité.
- Persistance.

Structure cible indicative :

```
src/
  app/
  components/
    ui/
    layout/
  features/
    dashboard/
    appointments/
    pos/
    clients/
    services/
    staff/
    inventory/
    expenses/
    loyalty/
    subscriptions/
  hooks/
  lib/
  services/
  types/
  styles/
```

Cette structure est une cible, pas une obligation de déplacer immédiatement tous les fichiers.

### 1.5 Données fictives

Examiner toutes les données codées en dur dans les écrans.

Notamment :

- KPIs.
- Graphiques.
- Chiffre d'affaires.
- Nombre de clients.
- Panier moyen.
- Rendez-vous.
- Performance du personnel.

Ne jamais afficher une donnée fictive comme une donnée réelle.

Lorsque les données sont absentes, afficher :

- `—`
- Un état vide explicite.
- Un message indiquant qu'aucune donnée n'est encore disponible.

Le panier moyen de repli de 3 800 FCFA repéré dans le dashboard ne doit pas être présenté comme une valeur réelle.

Les données de démonstration doivent être clairement identifiées.

### 1.6 CI/CD

Ajouter un workflow GitHub Actions si le dépôt n'en possède pas.

Pipeline minimal :

1. Installation reproductible.
2. Typecheck.
3. Lint.
4. Tests.
5. Build.

Ne pas intégrer de secrets dans le dépôt.

### Critères d'acceptation du lot 1

- Le projet conserve son architecture React/Vite.
- Les fonctionnalités existantes continuent de fonctionner.
- Les scripts de qualité sont explicites.
- Le build de production réussit.
- Les tests existants réussissent.
- Les données fictives ne sont plus présentées comme réelles.
- Les erreurs techniques sont documentées.
- Les changements sont limités et vérifiables.

---

## LOT 2 — AUTHENTIFICATION, AUTORISATIONS ET MULTI-TENANT

### Objectif

Faire passer l'authentification et l'isolation des établissements d'un socle préparatoire à un fonctionnement réel et sécurisé.

Ce lot est prioritaire : aucune donnée métier sensible ne doit être accessible sans identité et autorisation vérifiées côté serveur.

### 2.1 Authentification

Examiner et finaliser :

- `server/auth-app.js`
- `server/auth-repository.js`
- `server/password.js`
- `server/index.js`

Endpoints attendus :

```
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/session
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/verify-email
```

Les nouveaux endpoints doivent être ajoutés uniquement après vérification de l'architecture et des besoins existants.

Fonctionnalités :

- Création de compte.
- Connexion.
- Déconnexion.
- Session persistante.
- Vérification d'adresse email.
- Réinitialisation du mot de passe.
- Expiration des sessions.
- Révocation des sessions.
- Protection contre les tentatives répétées.
- Messages d'erreur non révélateurs d'informations sensibles.

Conserver le mécanisme de hash existant s'il est correctement implémenté. Le mécanisme Scrypt identifié doit être vérifié avant toute substitution.

Cookies :

- HTTP-only.
- Secure en production.
- SameSite approprié.
- Protection CSRF adaptée.
- Expiration contrôlée.

Ne jamais stocker un mot de passe en clair.

### 2.2 Multi-tenant

Chaque établissement doit disposer d'un périmètre de données indépendant.

Modèle logique :

```
Utilisateur
  └── Membership
       └── Organisation
            └── Salon
                 └── Succursale
```

Un utilisateur peut éventuellement appartenir à plusieurs établissements.

Les requêtes métier doivent être limitées au tenant autorisé.

Ne jamais faire confiance à un `organization_id`, `salon_id` ou `branch_id` envoyé librement par le frontend.

Le serveur doit déterminer le contexte autorisé à partir de la session et des memberships.

### 2.3 RBAC et permissions

Mettre en place un contrôle d'accès basé sur les rôles et les permissions.

Rôles indicatifs :

- Owner.
- Manager.
- Receptionist.
- Barber.
- Cashier.
- SaaS Admin.

Ne pas accorder automatiquement les permissions SaaS Admin à un propriétaire de salon.

Exemples de permissions :

```
dashboard.read
appointments.read
appointments.create
appointments.update
appointments.cancel
clients.read
clients.create
clients.update
cash.open
cash.close
payments.create
payments.refund
staff.read
staff.manage
services.manage
inventory.read
inventory.manage
expenses.read
expenses.manage
subscriptions.read
subscriptions.manage
```

Les permissions doivent être vérifiées côté serveur sur chaque opération sensible.

L'interface peut masquer des boutons, mais elle ne constitue jamais une frontière de sécurité.

### 2.4 Onboarding

Le parcours d'inscription doit conduire vers la création ou le rattachement à un établissement.

Workflow cible :

```
Inscription
    ↓
Vérification email
    ↓
Connexion
    ↓
Vérification des memberships
    ↓
Création ou rattachement au salon
    ↓
Création de la succursale si nécessaire
    ↓
Configuration initiale
    ↓
Dashboard
```

Ne jamais afficher le dashboard métier si l'utilisateur n'a pas encore de contexte d'établissement valide.

La progression de l'onboarding doit être persistée en base.

### 2.5 PostgreSQL et RLS

Vérifier les migrations existantes avant d'en créer de nouvelles.

Auditer :

- Organisations.
- Salons.
- Succursales.
- Memberships.
- Sessions.
- Rôles.
- Policies RLS.
- Privilèges des rôles SQL.

L'objectif est une isolation vérifiable entre deux établissements.

Les policies RLS doivent être compatibles avec le mode de connexion réellement utilisé par le backend.

Ne jamais supposer que RLS protège les requêtes effectuées avec un rôle privilégié qui contourne ces policies.

Tester les accès avec les rôles PostgreSQL réellement utilisés.

### 2.6 Tests de sécurité

Scénarios obligatoires :

- Un utilisateur non authentifié ne peut pas consulter les données privées.
- Un salon A ne peut pas consulter les clients du salon B.
- Un employé ne peut pas modifier ses permissions.
- Un utilisateur suspendu ne peut plus effectuer d'opérations métier.
- Une session expirée est rejetée.
- Une session révoquée est rejetée.
- Les changements d'identifiant dans les requêtes ne permettent pas d'accéder à un autre tenant.
- Les routes administratives SaaS sont protégées.

### Critères d'acceptation du lot 2

- Signup, login et logout fonctionnels.
- Vérification email et récupération du mot de passe opérationnelles.
- Session sécurisée.
- Onboarding persistant.
- Membership obligatoire pour accéder à l'ERP.
- Permissions vérifiées côté backend.
- Isolation multi-tenant démontrée par des tests.
- RLS vérifiée avec la configuration PostgreSQL réelle.
- Aucun accès transversal entre deux établissements.

---

## LOT 3 — GESTION OPÉRATIONNELLE DU SALON

### Objectif

Rendre fiables les opérations quotidiennes d'un salon ou barbershop.

Ce lot concerne les prestations, le personnel et les rendez-vous.

### 3.1 Catalogue des prestations

Conserver le module de gestion des services existant et l'améliorer.

Chaque prestation doit pouvoir définir :

```
id
salon_id
name
description
category
duration_minutes
price
is_active
created_at
updated_at
```

Les tarifs doivent être configurables par établissement.

Exemples :

- Coupe classique.
- Dégradé.
- Coupe + barbe.
- Taille de barbe.
- Rasage.
- Coloration.
- Soins capillaires.
- Shampoing.
- Coiffure.

Les prix affichés doivent être stockés en unités monétaires cohérentes, sans calculs flottants dangereux.

Devise de référence : XOF / FCFA.

### 3.2 Personnel

Améliorer le module Staff.

Chaque employé doit pouvoir avoir :

- Profil.
- Téléphone.
- Email facultatif.
- Fonction.
- Statut actif/inactif.
- Prestations maîtrisées.
- Succursale d'affectation.
- Horaires.
- Jours de repos.
- Absences.
- Permissions.

Séparer l'identité de connexion du profil métier de l'employé.

Un employé n'a pas nécessairement besoin d'un compte de connexion.

### 3.3 Calendrier et rendez-vous

Le calendrier doit devenir la source de vérité des réservations internes.

Un rendez-vous doit comporter au minimum :

```
id
salon_id
branch_id
client_id
staff_id
service_id
start_at
end_at
status
notes
created_at
updated_at
```

États possibles :

- pending.
- confirmed.
- checked_in.
- in_progress.
- completed.
- cancelled.
- no_show.

Les transitions doivent être contrôlées côté backend.

Conserver l'historique des changements de statut.

### 3.4 Gestion des disponibilités

Prendre en compte :

- Horaires du salon.
- Horaires de l'employé.
- Congés.
- Absences.
- Durée de la prestation.
- Temps de préparation éventuel.
- Succursale.
- Rendez-vous existants.

Empêcher les chevauchements incompatibles.

La vérification doit être réalisée côté serveur dans une transaction.

Deux requêtes concurrentes ne doivent pas pouvoir réserver le même créneau pour un employé lorsque les contraintes métier l'interdisent.

Ne pas se limiter à désactiver un créneau dans le calendrier frontend.

### 3.5 Workflow opérationnel

Préserver la distinction entre :

1. Rendez-vous planifié.
2. Client arrivé.
3. Prestation commencée.
4. Prestation terminée.
5. Paiement effectué.
6. Caisse clôturée.

Un rendez-vous terminé n'est pas automatiquement payé.

Une prestation réalisée ne doit pas disparaître si le paiement échoue.

### 3.6 Expérience utilisateur

L'interface doit permettre :

- Créer rapidement un rendez-vous.
- Choisir un client.
- Sélectionner une prestation.
- Affecter un employé.
- Voir les disponibilités.
- Modifier ou annuler.
- Consulter la journée.
- Filtrer par employé.
- Visualiser les statuts.

Prévoir les états de chargement, erreur, vide et succès.

### Critères d'acceptation du lot 3

- Services configurables par salon.
- Personnel et affectations opérationnels.
- Rendez-vous persistés en base.
- Transitions contrôlées.
- Historique conservé.
- Conflits de réservation bloqués côté serveur.
- Isolation par salon et succursale.
- Calendrier utilisable sur ordinateur, tablette et mobile.

---

## LOT 4 — CAISSE, ENCAISSEMENTS ET FINANCES

### Objectif

Transformer la caisse actuelle en un système financier traçable, cohérent et exploitable.

### 4.1 Caisse

Mettre en place une gestion des sessions de caisse.

Une session doit contenir :

```
id
salon_id
branch_id
cash_register_id
opened_by
opened_at
opening_balance
closed_by
closed_at
closing_balance
expected_balance
difference
status
```

Statuts :

- open.
- closed.
- reconciled.

Prévoir les ouvertures et clôtures par caisse et par succursale.

Ne pas conserver une caisse globale partagée sans distinction de contexte.

### 4.2 Encaissements

Chaque paiement doit être enregistré comme une opération indépendante.

Champs indicatifs :

```
id
salon_id
branch_id
appointment_id
amount
currency
payment_method
payment_status
provider_reference
received_by
created_at
```

Méthodes possibles :

- Espèces.
- Wave.
- Orange Money.
- MTN MoMo.
- Moov Money.
- Autre moyen configuré.

Les paiements partiels doivent être possibles si le workflow métier le permet.

Le solde restant doit être calculé à partir des opérations financières réelles.

### 4.3 Paiements électroniques

Les méthodes de paiement affichées ne constituent pas une intégration réelle.

Avant d'annoncer une intégration Wave ou Mobile Money :

1. Identifier un prestataire compatible avec le marché ivoirien.
2. Vérifier ses API et ses conditions contractuelles.
3. Mettre en place un flux de paiement serveur.
4. Vérifier les signatures des webhooks.
5. Gérer les doublons.
6. Conserver les références fournisseur.
7. Réconcilier les opérations.

Ne jamais marquer un paiement comme confirmé à partir d'une simple action frontend.

Un paiement en attente doit rester en attente tant qu'une preuve fiable n'est pas reçue.

Si aucun fournisseur n'est configuré, conserver un mode de paiement manuel explicitement identifié.

### 4.4 Remboursements et annulations

Prévoir :

- Remboursement total.
- Remboursement partiel.
- Motif.
- Auteur.
- Date.
- Référence de paiement initiale.
- Historique.

Ne jamais supprimer une transaction financière déjà enregistrée.

Utiliser des opérations compensatoires et un journal immuable.

### 4.5 Dépenses

Le module dépenses doit permettre :

- Enregistrer une dépense.
- Catégoriser.
- Indiquer le montant.
- Ajouter une description.
- Enregistrer la date.
- Associer une succursale.
- Associer un justificatif si disponible.
- Identifier le responsable.

### 4.6 Rapports

Indicateurs calculés depuis les opérations réelles :

- Chiffre d'affaires encaissé.
- Montant restant à payer.
- Dépenses.
- Solde net selon une définition documentée.
- Répartition des moyens de paiement.
- Prestations les plus vendues.
- Performance des employés.
- Évolution quotidienne, hebdomadaire et mensuelle.

Toujours distinguer chiffre d'affaires réalisé, montant encaissé et solde restant.

Ne jamais additionner deux fois une même transaction.

### 4.7 Journal financier

Chaque opération doit être traçable.

Enregistrer :

- Qui a effectué l'opération.
- Quand.
- Sur quelle caisse.
- Sur quel établissement.
- Montant.
- Nature de l'opération.
- Référence.
- Motif éventuel.

Les opérations financières doivent être protégées contre les modifications arbitraires.

### Critères d'acceptation du lot 4

- Ouverture et clôture de caisse.
- Encaissements persistés.
- Paiements partiels correctement calculés.
- Remboursements traçables.
- Dépenses historisées.
- Rapports calculés à partir des données réelles.
- Paiements électroniques jamais confirmés sans preuve fournisseur.
- Isolation multi-tenant.
- Tests de concurrence et d'idempotence sur les opérations sensibles.

---

# 6. OBJECTIFS DE DÉVELOPPEMENT ULTÉRIEURS

**Important : les phases suivantes sont des objectifs à documenter et préparer, mais elles ne doivent pas être implémentées pendant la première feuille de route sans autorisation explicite.**

## PHASE 5 — CRM ET FIDÉLITÉ

Objectifs :

- Fiches clients complètes.
- Historique des prestations.
- Préférences.
- Dernière visite.
- Fréquence des visites.
- Segmentation.
- Programme de fidélité configurable.
- Récompenses.
- Historique des points.
- Notifications et rappels.

Règles :

- Une visite ne peut pas être comptabilisée deux fois.
- Les points doivent être attribués à partir d'événements métier confirmés.
- Les corrections doivent être historisées.
- Les récompenses doivent être consommées de façon atomique.

## PHASE 6 — STOCKS ET APPROVISIONNEMENT

Objectifs :

- Catalogue produits.
- Catégories.
- Fournisseurs.
- Achats.
- Réceptions.
- Mouvements de stock.
- Inventaires.
- Seuils d'alerte.
- Valorisation.
- Consommation des produits par prestation.

Chaque mouvement doit être historisé.

Ne jamais modifier simplement une quantité sans conserver la raison et l'auteur du mouvement.

## PHASE 7 — MARKETPLACE ET AUTOMATISATIONS

Objectifs :

- Publication contrôlée des salons.
- Fiches publiques.
- Recherche géographique.
- Recherche par prestation.
- Disponibilités publiques.
- Réservation en ligne.
- Confirmation et annulation.
- Historique client.
- Avis vérifiés.
- Notifications WhatsApp, email ou SMS.
- Rappels automatiques.

Un salon non publié ne doit jamais être visible publiquement.

Les réservations publiques doivent utiliser les mêmes règles de disponibilité que le planning interne.

## PHASE 8 — ADMINISTRATION SAAS

Objectifs :

- Gestion globale des salons.
- Gestion des utilisateurs.
- Plans Free, Pro et Business.
- Limites et fonctionnalités par plan.
- Abonnements.
- Renouvellements.
- Factures.
- Paiements.
- Suspension.
- Réactivation.
- Support.
- Analytics SaaS.

Les droits d'administration SaaS doivent être indépendants des rôles des salons.

Les activations d'abonnement ne doivent pas être validées par une simple modification locale de l'interface.

## PHASE 9 — INDUSTRIALISATION ET EXPÉRIENCE PREMIUM

Objectifs :

- Optimisation des performances.
- Accessibilité.
- Responsive avancé.
- PWA si cela apporte une valeur réelle.
- Notifications fiables.
- Monitoring.
- Logs structurés.
- Sauvegardes.
- Tests de restauration.
- Sécurité applicative.
- Tests E2E.
- Environnements staging et production.
- Documentation technique et utilisateur.

---

# 7. DESIGN SYSTEM — INTERFACE PREMIUM

Le produit doit conserver son identité visuelle existante lorsqu'elle est pertinente, tout en améliorant la cohérence et la qualité professionnelle.

## 7.1 Direction artistique

Créer une interface SaaS premium inspirée des meilleurs produits B2B modernes.

Principes :

- Sobriété.
- Lisibilité.
- Hiérarchie visuelle.
- Densité maîtrisée.
- Cohérence entre les modules.
- Navigation simple.
- Adaptation ordinateur, tablette et mobile.

Conserver l'identité noir et or déjà présente si elle est cohérente avec le produit.

Palette indicative :

```
Background: #101014
Surface: #19191F
Primary Gold: #C9A45C
Text Primary: #E9E5DC
Success: #22C55E
Danger: #EF4444
```

Ne pas appliquer cette palette aveuglément si les tokens existants sont plus cohérents.

## 7.2 Bibliothèque de composants

Privilégier les composants shadcn/ui compatibles avec le stack existant.

Uniformiser :

- Buttons.
- Inputs.
- Selects.
- Dialogs.
- Dropdowns.
- Tabs.
- Tables.
- Badges.
- Cards.
- Tooltips.
- Toasts.
- Calendars.
- Skeletons.
- Empty states.

Éviter la multiplication de composants visuellement similaires mais implémentés différemment.

## 7.3 Dashboard

Le dashboard doit présenter uniquement des données fiables.

KPIs possibles :

- Chiffre d'affaires encaissé.
- Rendez-vous du jour.
- Prestations terminées.
- Clients actifs.

Graphiques :

- Évolution du chiffre d'affaires.
- Répartition des prestations.
- Activité du personnel.

Chaque graphique doit avoir :

- Une période.
- Une source de données.
- Un état vide.
- Une gestion des erreurs.
- Des valeurs cohérentes.

## 7.4 Animations

Motion peut être conservé pour :

- Transitions de pages.
- Ouverture de modales.
- Feedback d'actions.
- Micro-interactions.

Ne pas animer systématiquement chaque élément.

Respecter les préférences de réduction des animations.

## 7.5 Ergonomie

Éviter :

- Trop d'onglets.
- Trop de paramètres.
- Les formulaires interminables.
- Les informations redondantes.
- Les animations distrayantes.
- Les tableaux illisibles.

Favoriser les actions fréquentes et les parcours courts.

---

# 8. MODÈLE DE DONNÉES CIBLE

Le modèle suivant est une cible indicative à confronter aux migrations existantes.

Ne crée pas de doublons de tables.

Ne renomme pas les tables existantes sans stratégie de migration justifiée.

## Identité et organisation

```
bc_users
bc_auth_accounts
bc_auth_sessions
bc_organizations
bc_salons
bc_branches
bc_memberships
bc_branch_memberships
bc_invitations
```

## Personnel

```
bc_staff
bc_staff_schedules
bc_staff_absences
```

## Prestations et clients

```
bc_services
bc_service_categories
bc_clients
bc_client_preferences
```

## Rendez-vous

```
bc_appointments
bc_appointment_events
```

## Finance

```
bc_cash_registers
bc_cash_sessions
bc_payment_entries
bc_expenses
bc_financial_events
```

## Stocks

```
bc_products
bc_stock_movements
bc_suppliers
bc_purchase_orders
```

## Fidélité

```
bc_loyalty_accounts
bc_loyalty_transactions
bc_rewards
```

## SaaS et sécurité

```
bc_plans
bc_subscriptions
bc_invoices
bc_audit_logs
bc_notifications
bc_webhook_events
```

Les tables des phases 5 à 8 ne doivent pas être créées dans la première feuille de route sauf si une dépendance indispensable aux quatre premiers lots est démontrée.

---

# 9. ADAPTATION AU MARCHÉ IVOIRIEN

Le produit doit être adapté à une exploitation réelle en Côte d'Ivoire.

Paramètres :

- Devise : XOF / FCFA.
- Fuseau horaire : `Africa/Abidjan`.
- Interface en français.
- Téléphones ivoiriens.
- Format de date local.
- Espèces.
- Wave.
- Orange Money.
- MTN MoMo.
- Moov Money.

Attention : afficher une méthode de paiement ne signifie pas que son intégration est opérationnelle.

Ne jamais inventer de fournisseur, d'API ou de confirmation de transaction.

Prévoir une interface utilisable sur smartphone avec une connectivité parfois limitée.

Les données métier doivent rester cohérentes même si l'utilisateur actualise la page ou change d'appareil.

---

# 10. ARCHITECTURE TECHNIQUE CIBLE

Conserver les technologies existantes tant qu'elles remplissent correctement leur rôle.

## Frontend

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- Composants UI réutilisables.
- React Hook Form si pertinent.
- Zod.
- TanStack Query si une gestion serveur plus structurée est nécessaire.
- TanStack Table si nécessaire.
- Motion.
- Lucide React.

## Backend

- Node.js.
- Express.
- TypeScript progressivement si le backend actuel est en JavaScript.
- Validation Zod.
- Couche services métier.
- Couche repositories.
- Gestion centralisée des erreurs.
- Middlewares d'authentification et de permissions.

Ne migre pas tout le backend vers TypeScript en même temps que les corrections métier si cela crée un risque disproportionné.

## Base de données

- PostgreSQL.
- Neon.
- Transactions.
- Contraintes.
- Index.
- RLS.
- Migrations versionnées.
- Journalisation.

## Architecture métier indicative

```
Frontend
   ↓
API Express
   ↓
Authentication Middleware
   ↓
Tenant Context
   ↓
Permission Middleware
   ↓
Validation Zod
   ↓
Business Services
   ↓
Repositories
   ↓
PostgreSQL / Neon
```

Les règles métier critiques doivent résider côté serveur.

---

# 11. MÉTHODE D'EXÉCUTION OBLIGATOIRE

## Étape A — État initial

Avant d'écrire du code :

1. Vérifier la branche.
2. Vérifier le commit de départ.
3. Vérifier l'état Git.
4. Vérifier les éventuelles modifications non commitées.
5. Lire les instructions du dépôt.
6. Examiner les fichiers réellement concernés.
7. Exécuter les commandes de validation disponibles.

Ne jamais écraser les modifications existantes de l'utilisateur.

Ne pas effectuer de reset destructif.

## Étape B — Plan d'intervention

Pour chaque lot, présenter :

- Problème.
- Constat vérifié.
- Fichiers concernés.
- Solution proposée.
- Risques.
- Tests.
- Critères d'acceptation.

Distinguer les corrections indispensables des améliorations facultatives.

## Étape C — Implémentation

Procéder par petits changements cohérents.

Ordre :

1. Fondations.
2. Types et contrats.
3. Backend.
4. Base de données.
5. Frontend.
6. Tests.
7. Documentation.

Pour les changements de base de données :

- Ajouter une migration.
- Prévoir les contraintes et index.
- Vérifier les données existantes.
- Prévoir une stratégie de retour arrière lorsque possible.
- Ne jamais modifier une migration déjà appliquée.

## Étape D — Validation

Après chaque changement significatif :

- Typecheck.
- Lint.
- Tests unitaires.
- Tests d'intégration.
- Build.
- Tests de sécurité adaptés.

Après chaque lot :

- Vérifier les fonctionnalités impactées.
- Vérifier les permissions.
- Vérifier l'isolation des données.
- Vérifier l'interface.
- Mettre à jour la documentation.

Ne passe pas au lot suivant si un critère critique du lot courant échoue.

## Étape E — Rapport final

À la fin de chaque lot, fournir :

```
LOT :
STATUT :

1. Travaux effectués
2. Fichiers créés
3. Fichiers modifiés
4. Fichiers supprimés (avec justification)
5. Migrations ajoutées
6. Tests exécutés
7. Résultats des tests
8. Problèmes non résolus
9. Risques connus
10. Critères d'acceptation validés
11. Prochaine étape recommandée
```

Ne déclare pas un lot terminé si les tests critiques ne passent pas.

---

# 12. GESTION DES RISQUES

Priorités absolues :

1. Protection des données des établissements.
2. Authentification.
3. Autorisations backend.
4. Isolation multi-tenant.
5. Intégrité des rendez-vous.
6. Intégrité financière.
7. Traçabilité.
8. Fiabilité des indicateurs.
9. Ergonomie.
10. Optimisation esthétique.

Ne sacrifie jamais la sécurité ou l'intégrité financière pour gagner du temps sur l'interface.

Ne développe pas de nouvelles fonctionnalités au détriment des opérations existantes.

---

# 13. LIVRABLES ATTENDUS

## Pour la première feuille de route

Livrer :

- Audit technique actualisé.
- Architecture documentée.
- Lot 1 stabilisé.
- Lot 2 sécurisé.
- Lot 3 opérationnel.
- Lot 4 financier.
- Migrations SQL.
- Tests automatisés.
- Documentation.
- Rapport de validation par lot.

## Pour les phases suivantes

Préparer uniquement :

- Spécifications fonctionnelles.
- Dépendances techniques.
- Modèle de données cible.
- Risques.
- Estimation de priorité.
- Critères d'acceptation.

Ne pas implémenter les phases 5 à 9 sans validation explicite.

---

# 14. ORDRE DE PRIORITÉ ET RÈGLE DE GEL DU PÉRIMÈTRE

| Ordre | Lot                              | Priorité | Exécution  |
| ----- | -------------------------------- | -------- | ---------- |
| 1     | Stabilisation technique          | P0       | Maintenant |
| 2     | Authentification et multi-tenant | P0       | Maintenant |
| 3     | Gestion opérationnelle           | P0       | Maintenant |
| 4     | Caisse et finances               | P1       | Maintenant |
| 5     | CRM et fidélité                  | P1       | Plus tard  |
| 6     | Stocks et approvisionnement      | P1       | Plus tard  |
| 7     | Marketplace                      | P2       | Plus tard  |
| 8     | Administration SaaS              | P2       | Plus tard  |
| 9     | Industrialisation premium        | P2       | Plus tard  |

**Règle de gel :** aucun ajout fonctionnel provenant des phases 5 à 9 ne doit être entrepris dans le cadre des lots 1 à 4, sauf dépendance technique indispensable, documentée et approuvée.

---

# 15. PREMIÈRE INSTRUCTION À EXÉCUTER

Commence par une nouvelle inspection du dépôt `Colorado225/barber_google`.

Ne commence pas immédiatement par modifier le code.

Présente d'abord :

1. L'état actuel de la branche et du commit.
2. Les éventuelles modifications non commitées.
3. Les différences éventuelles par rapport à l'audit initial.
4. Les résultats des commandes de validation disponibles.
5. Les problèmes P0 et P1 réellement vérifiés.
6. Le plan de travail précis du lot 1.
7. Les fichiers qui seront concernés.
8. Les risques de régression.

Ensuite, implémente le lot 1 de manière progressive et vérifie-le avant de continuer.

Après validation du lot 1, passe au lot 2, puis au lot 3 et enfin au lot 4.

Ne saute aucune étape de validation.

**OBJECTIF FINAL : faire évoluer `barber_google` vers un véritable ERP SaaS professionnel pour salons de coiffure et barbershops, adapté au marché ivoirien, avec des données fiables, une sécurité multi-tenant réelle, une gestion opérationnelle cohérente et une comptabilité traçable, tout en préservant au maximum la valeur du code existant.**

## Comment utiliser ce Master Prompt

Je recommande de l'exécuter dans ton agent de développement connecté au dépôt GitHub, en lui demandant de travailler sur une branche dédiée, par exemple `feat/erp-industrialisation`.

Ne lui demande pas de réaliser les neuf phases en une seule fois. Le prompt lui impose de traiter les quatre premiers lots, mais il faut conserver un contrôle humain entre les étapes.

### Jalons de validation

| Jalon | Ce que tu dois vérifier avant de continuer                                   |
| ----- | ---------------------------------------------------------------------------- |
| Lot 1 | L'application fonctionne toujours et le socle technique est stable.          |
| Lot 2 | Connexion, permissions et isolation entre salons sont réellement sécurisées. |
| Lot 3 | Les rendez-vous, prestations et employés fonctionnent correctement.          |
| Lot 4 | Les encaissements, dépenses et rapports sont cohérents et traçables.         |

Mon conseil : accorde une attention particulière au lot 2. Un ERP SaaS multi-établissements ne peut pas être commercialisé sérieusement si un utilisateur peut accéder aux clients, rendez-vous ou finances d'un autre salon.

La priorité est donc de construire un produit fiable avant de multiplier les fonctionnalités.
