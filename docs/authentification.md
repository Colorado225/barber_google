# Fondation d'authentification PostgreSQL / Neon — développement uniquement

Cette tranche introduit une API Express indépendante de l'interface existante. **Elle n'est pas branchée aux écrans de connexion et d'inscription**, et aucune connexion Neon n'a été testée. Le parcours UI reste explicitement une démonstration locale. Ne pas l'exposer à des utilisateurs réels ; le démarrage avec `NODE_ENV=production` est volontairement refusé.

## Contenu

- `database/migrations/20261103020000_auth_accounts.sql` ajoute comptes et sessions privées et un rôle `bc_auth` sans login, distinct de `bc_app`. L'identité `bc_users` existante n'est ni supprimée ni recréée.
- `server/auth-app.js` : endpoints `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout`. Validation Zod ; origine exacte obligatoire pour les requêtes mutables ; cookie HTTP-only, SameSite strict et Secure sur HTTPS ; session aléatoire, seul son SHA-256 est stocké. Limitation de requêtes par IP en mémoire **pour développement seulement**.
- `server/password.js` : mots de passe salés avec scrypt et comparaison à temps constant. `server/auth-repository.js` : transactions paramétrées et `SET LOCAL ROLE bc_auth`.
- `vite.config.ts` : proxy de développement `/api/auth` vers l'API sur `127.0.0.1:3001` côté serveur ; aucune URL localhost dans le navigateur.

## Démarrage dans un environnement de développement isolé

1. Créer une base ou branche Neon de développement et appliquer les migrations avec la connexion **directe de migration** après revue (`docs/neon.md`). Tester les droits réellement disponibles sur Neon ; ne pas modifier la production.
2. Provisionner séparément un rôle de connexion backend à privilèges minimums autorisé à adopter `bc_auth`. La migration crée le rôle de groupe, pas les identifiants de connexion. Le backend ne doit pas utiliser un superutilisateur, propriétaire des tables, rôle de migration ou `BYPASSRLS`. Le rôle `bc_auth` peut lire les empreintes de mots de passe et les sessions : son accès est réservé à l'API de confiance.
3. Configurer `AUTH_DATABASE_URL` et `APP_ORIGIN` dans un fichier `.env` non versionné. L'origine doit correspondre **exactement** à l'URL du navigateur, sans slash final. Utiliser TLS et des secrets issus d'un gestionnaire approprié ; ne pas les transmettre dans le chat. Définir `AUTH_PORT` si nécessaire et adapter le proxy si un port différent est choisi.
4. Démarrer `npm run dev:auth` et `npm run dev` sur une machine autorisée à joindre la base. L'API écoute uniquement sur l'interface locale ; le proxy Vite est destiné au développement. Ne pas exposer l'API directement à Internet.
5. `npm run test:auth` teste fonctions, API avec repository simulé et migration/repository avec PGlite. Vérifier ensuite avec PostgreSQL/Neon réel, proxy, cookies et utilisateurs distincts ; PGlite ne valide pas la configuration réseau, les rôles provisionnés ni la concurrence réelle.

## Blocages avant branchement au produit

- Aucun e-mail de vérification ni champ de vérification n'est implémenté. L'API de développement permet la connexion sans vérification d'e-mail ; ne pas la considérer sûre pour la production. La récupération et la rotation de mot de passe, la révocation de toutes les sessions et la suppression de comptes restent à construire.
- La limite par IP est en mémoire, non distribuée et le serveur ne fait pas confiance aux en-têtes de proxy par défaut. Il faut une protection anti-bruteforce partagée, limites par compte/IP, configuration proxy vérifiée et limitation des connexions avant exposition.
- Les erreurs d'inscription indiquent actuellement les doublons ; politique anti-énumération et protection contre le spam à définir. Ajouter audit, surveillance et tests de sécurité.
- Aucun raccordement de session aux memberships, au contexte RLS ou au workflow d'onboarding réel. Le profil et le salon de démonstration restent dans `localStorage` et ne doivent pas être convertis implicitement en compte réel.
- Il faut un mécanisme CSRF adapté au déploiement réel, des en-têtes de sécurité, gestion des origines/environnements, sessions, sécurité du pool, tests E2E et revue externe avant production. La vérification stricte d'Origin actuelle ne doit pas être désactivée pour contourner un problème de configuration.
