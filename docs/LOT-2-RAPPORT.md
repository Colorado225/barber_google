# Rapport Lot 2 — Authentification, autorisations et multi-tenant

> Statut : **terminé et vérifié** (typecheck, lint, 43 tests, build, parcours réel sur PostgreSQL).
> Référence : `docs/MISEAJOUR.md` § 5, « LOT 2 — AUTHENTIFICATION, AUTORISATIONS ET MULTI-TENANT ».

## 2.1 Authentification — audit et mises à niveau

### Ce qui existait déjà (conservé)

- Hash **scrypt** (N=16384, r=8, p=1, sel aléatoire, `timingSafeEqual`) — correctement
  implémenté, **aucune substitution**. Ajout d'une politique de mot de passe.
- Cookie de session `bc_session` : `HttpOnly`, `Secure` en https, `SameSite=Strict`, `Path=/`.
- Jeton de session 32 octets, stocké **haché** (SHA-256) ; recherche par hash.
- Protection CSRF par en-tête `Origin` obligatoire sur toutes les écritures.
- Messages d'erreur non révélateurs (connexion : même message pour compte inconnu /
  mot de passe faux).

### Ce qui a été ajouté

| Élément                                | Détail                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/signup`                | Création de compte **sans connexion automatique**, jeton de vérification e-mail                          |
| `POST /api/auth/verify-email`          | Jeton à usage unique, expiration 24 h, stocké haché                                                      |
| `POST /api/auth/resend-verification`   | Renvoi neutre (réponse identique si compte inexistant)                                                   |
| `POST /api/auth/login`                 | Refus 403 `email_not_verified` si adresse non vérifiée                                                   |
| `GET /api/auth/session`                | Expiration glissante (touch ≤ 1×/h), cookie effacé si invalide                                           |
| `POST /api/auth/logout` / `logout-all` | Révocation d'une session / de toutes les sessions                                                        |
| `POST /api/auth/forgot-password`       | Réponse neutre, jeton 1 h, invalide les précédents                                                       |
| `POST /api/auth/reset-password`        | Nouveau mot de passe + **révocation de toutes les sessions**                                             |
| Limitation de débit                    | Global (100/15 min), connexion (10/15 min), e-mails (5/h) par IP — `RateLimit-Remaining` / `Retry-After` |
| Audit                                  | Purge périodique des sessions expirées, `last_used_at`, `user_agent`, `ip_hash` (jamais l'IP en clair)   |

### Politique de mot de passe

12 caractères minimum, 128 maximum, refus des répétitions triviales et d'une liste de
mots de passe courants (`server/password.js`, `validatePasswordPolicy`).

### Envoi des e-mails

`createAuthApp({ sendEmail })` accepte un transport. Sans transport (développement/test),
`AUTH_EXPOSE_TOKENS=true` renvoie le jeton dans la réponse HTTP pour permettre le parcours ;
**jamais en production**. L'interface affiche un lien direct uniquement dans ce mode.

## 2.2 / 2.3 Multi-tenant et RBAC

### Modèle

```
bc_organizations ── bc_salons ── bc_branches
                        │
                 bc_memberships (user_id, role, status)
                        │
                    bc_users ── bc_auth_accounts
```

### Règles appliquées

- **Le serveur ne fait jamais confiance à un `salonId` d'URL.** Chaque route appelle
  `barber_private.has_salon_permission()` dans la transaction `SET LOCAL ROLE bc_app`
  **avant** toute lecture ; RLS reste la seconde barrière.
- Refus **uniforme** (403 générique) qu'un salon existe ou non : aucune fuite d'existence.
- Rôle calculé uniquement depuis `bc_memberships.status = 'active'` et l'identité de session.
- Aucune permission « SaaS Admin » : les routes `/api/admin/*` répondent 403 à tous les
  comptes, propriétaires inclus (le rôle de plateforme sera défini avec son audit au Lot 3+).

### Matrice implémentée (`has_salon_permission`)

| Permission                                                            | owner | manager | receptionist | barber | cashier | accountant |
| --------------------------------------------------------------------- | :---: | :-----: | :----------: | :----: | :-----: | :--------: |
| `dashboard.read`, `services.read`, `staff.read`                       |   ✓   |    ✓    |      ✓       |   ✓    |    ✓    |     ✓      |
| `clients.read`                                                        |   ✓   |    ✓    |      ✓       |   ✓    |    ✓    |     ✓      |
| `clients.write`                                                       |   ✓   |    ✓    |      ✓       |   —    |    —    |     —      |
| `appointments.read`                                                   |   ✓   |    ✓    |      ✓       |   ✓    |    ✓    |     —      |
| `appointments.write`                                                  |   ✓   |    ✓    |      ✓       |   —    |    —    |     —      |
| `catalog.write`, `team.write`                                         |   ✓   |    ✓    |      —       |   —    |    —    |     —      |
| `finance.write`, `payments.create`, `cash.open`                       |   ✓   |    ✓    |      —       |   —    |    ✓    |     —      |
| `payments.refund`                                                     |   ✓   |    ✓    |      —       |   —    |    —    |     —      |
| `stock.write`, `inventory.manage`, `expenses.manage`, `loyalty.write` |   ✓   |    ✓    |      —       |   —    |    —    |     —      |
| `reports.read`, `expenses.read`                                       |   ✓   |    ✓    |      —       |   —    |    —    |     ✓      |
| `members.read`                                                        |   ✓   |    ✓    |      —       |   —    |    —    |     —      |
| `members.manage`, `salon.update`, `subscription.manage`               |   ✓   |    —    |      —       |   —    |    —    |     —      |

Gestion des membres : `bc_list_salon_members`, `bc_set_member_role`, `bc_set_member_status`
(refus si l'acteur modifie son propre rôle, refus de supprimer le dernier propriétaire actif,
journalisation dans `bc_admin_audit`).

L'interface (`ErpLayout`) masque les onglets non autorisés à partir des permissions
serveur — **confort uniquement**, la décision reste côté backend.

## 2.4 Onboarding

- Table `bc_onboarding_state` (persistée) : `email_verification → salon_creation → setup → completed`.
- `bc_create_salon()` crée organisation + salon + succursale + membership owner **et**
  valide l'étape d'onboarding dans la même transaction.
- `GET /api/me` expose memberships, permissions et progression.
- Garde frontend `OnboardingGate` : session → e-mail vérifié → membership actif ; aucun
  écran métier n'est affiché avant.
- Le contexte ERP (`AppContext`) utilise le salon de la session serveur, plus l'identifiant
  local `salon-1`.

## 2.5 PostgreSQL et RLS

Migrations ajoutées : `20261103030000_lot2_account_security.sql` (jetons, sessions
durcies, onboarding, audit, matrice complète, gestion des membres).

Corrections de socle nécessaires pour le mode PostgreSQL réel :

- les tables d'authentification n'utilisent plus de FK vers `bc_users` (impossible pour
  `bc_auth` sans droit de lecture) : trigger `barber_private.require_user_exists()` ;
- absence de RLS sur `bc_onboarding_state` (service d'authentification, accès indirect) ;
- `expenses.read` aligné avec la matrice.

**Vérification effectuée** : les six migrations s'appliquent sur un vrai PostgreSQL local,
et le parcours complet (inscription → vérification → connexion → création de salon →
dashboard vide) a été exécuté contre ce serveur, en plus des tests PGlite.

### Limites documentées

- Le limiteur de débit est **en mémoire** : en production multi-instances, remplacer par
  un store partagé (Redis).
- `server/index.js` refuse toujours de démarrer en `NODE_ENV=production` (fondation de dev).
- Incohérence historique : deux migrations partagent le préfixe `20261103020000_` ; leur
  ordre relatif est alphabétique et stable (`auth_accounts` puis `salon_resources`).

## 2.6 Tests de sécurité (`tests/security-lot2.test.mjs`)

| Scénario obligatoire                                                                 | Couvert                       |
| ------------------------------------------------------------------------------------ | ----------------------------- |
| Utilisateur non authentifié sans accès aux données privées                           | ✓                             |
| Salon A ne peut pas consulter les clients du salon B                                 | ✓                             |
| Changement d'identifiant dans l'URL sans effet (403 identique à un salon inexistant) | ✓                             |
| Un employé ne peut pas modifier ses permissions / son rôle                           | ✓                             |
| Un membre suspendu perd immédiatement l'accès métier                                 | ✓                             |
| Session expirée rejetée                                                              | ✓                             |
| Session révoquée rejetée (logout-all, purge côté serveur)                            | ✓                             |
| Routes d'administration SaaS protégées (403)                                         | ✓                             |
| Jeton de vérification/réinitialisation à usage unique et expirant                    | ✓                             |
| Messages de connexion non révélateurs                                                | ✓                             |
| Cookies `HttpOnly` / `Secure` / `SameSite=Strict`                                    | ✓                             |
| Politique de mot de passe                                                            | ✓                             |
| Limitation des tentatives répétées (429 + `Retry-After`)                             | ✓ `tests/rate-limit.test.mjs` |
| RLS vérifiée avec les rôles réels (`bc_app`, `bc_auth`)                              | ✓                             |

## Critères d'acceptation du lot 2

| Critère                                            | Vérification                                                  |
| -------------------------------------------------- | ------------------------------------------------------------- |
| Signup, login, logout fonctionnels                 | ✅ tests + parcours navigateur                                |
| Vérification e-mail opérationnelle                 | ✅ jeton unique, expiration, renvoi                           |
| Récupération du mot de passe opérationnelle        | ✅ jeton unique, sessions révoquées                           |
| Session sécurisée (cookie, expiration, révocation) | ✅ tests dédiés                                               |
| Onboarding persistant en base                      | ✅ `bc_onboarding_state` + `GET /api/me`                      |
| Membership obligatoire pour accéder à l'ERP        | ✅ `OnboardingGate` + contrôles serveur                       |
| Permissions vérifiées côté backend                 | ✅ `withSalon(permission, …)` sur chaque route                |
| Isolation multi-tenant démontrée                   | ✅ tests + 403 uniformes                                      |
| RLS vérifiée avec la configuration réelle          | ✅ migrations appliquées sur PostgreSQL puis parcours complet |
| Aucun accès transversal entre établissements       | ✅                                                            |

## Commandes

```bash
npm run typecheck
npm run lint
npm test          # 43 tests : API, sécurité Lot 2, rate limit, DB (PGlite), React
npm run build
```

## Reste à faire (hors périmètre Lot 2)

- Transport SMTP réel et modèles d'e-mail (jeton jamais renvoyé en réponse en production).
- Store de rate limiting partagé (Redis) pour le multi-instances.
- Invitations de nouveaux membres par e-mail (aujourd'hui : rattachement par l'exploitant).
- Rôle de plateforme « SaaS Admin » avec politique RLS séparée et journal d'audit dédié.
- Passage au **Lot 3** (prestations, personnel, calendrier).
