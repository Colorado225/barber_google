# PostgreSQL local — socle de développement

Neon est la cible PostgreSQL hébergée ; le PostgreSQL local décrit ici reste facultatif pour le développement. Voir [Neon](neon.md). Les migrations sont dans `database/migrations/` et les tests dans `database/tests/`. Le frontend Vite n'est pas encore relié à une API ou à PostgreSQL.

## Démarrer une base de développement

Prérequis : Docker Compose, client PostgreSQL `psql` et `sha256sum`. Ces outils ne sont pas présents dans l'environnement où ce changement a été préparé ; la procédure ci-dessous n'a donc pas été testée ici sur un serveur PostgreSQL réel.

1. Copier `.env.example` vers `.env`, choisir un mot de passe de développement et mettre à jour `POSTGRES_PASSWORD` et `DATABASE_URL` avec la même valeur. Ne jamais committer ce fichier. Si le mot de passe contient des caractères spéciaux, encoder correctement l'URL PostgreSQL.
2. `docker compose up -d postgres` crée un volume persistant et n'expose le port 5432 que sur l'hôte local. Si le port est occupé, ajuster le port publié et l'URL.
3. Charger `DATABASE_URL` dans l'environnement du shell (par exemple `set -a; source .env; set +a`, uniquement pour un fichier `.env` de confiance), puis lancer `./database/migrate.sh`. Utiliser un seul processus de migration à la fois. Le script applique les fichiers dans l'ordre, chacun dans une transaction, et vérifie les sommes SHA-256 des migrations déjà appliquées ; il échoue si une migration historique a changé.
4. `npm run test:tenant` et `npm run test:workflow` testent les règles SQL dans PGlite. Ils n'utilisent pas le serveur local : compléter avec des tests PostgreSQL réel, concurrence et privilèges avant toute mise en service.

Ne pas utiliser `docker compose down -v`, `DROP` ou une recréation de volume pour résoudre une erreur : cela détruirait les données. Avant toute modification d'une base existante, vérifier la cible et sauvegarder ; restaurer uniquement selon une procédure validée. Les migrations emploient des tables `bc_` et échouent en cas de conflit, plutôt que d'écraser une table existante.

## Frontière de sécurité indispensable

PostgreSQL n'authentifie pas les utilisateurs applicatifs. `bc_users` est un registre minimal d'identités, pas un système de comptes. `barber_private.current_user_id()` lit la variable de transaction `barber.user_id` : **un client SQL peut lui-même modifier cette variable**. Par conséquent :

- Ne jamais donner au navigateur, à un client non fiable ou à une personne non autorisée les identifiants PostgreSQL ou la capacité d'exécuter du SQL arbitraire en tant que rôle applicatif.
- Il faudra un backend qui authentifie réellement la session, emprunte une connexion non privilégiée, commence une transaction, fait `SET LOCAL ROLE bc_app` et définit `set_config('barber.user_id', <id authentifié>, true)` via un paramètre lié, puis exécute exclusivement des opérations autorisées et termine par `COMMIT` ou `ROLLBACK`. Ne jamais utiliser un ID transmis par le navigateur comme preuve d'identité.
- `bc_app` est un rôle `NOLOGIN`, sans privilèges d'administration ni bypass RLS ; le rôle de connexion serveur devra être provisionné séparément, uniquement sur un environnement contrôlé, et autorisé à adopter ce rôle. Ne pas utiliser le propriétaire des tables ou un superutilisateur pour les requêtes métier. Ne pas exposer le rôle de migration.
- La variable est locale à la transaction : éviter les fuites entre requêtes et connexions du pool, tester systématiquement rollback et réutilisation. La protection RLS n'est effective que si le rôle de requête ne contourne pas les politiques.

Il n'existe aujourd'hui ni backend, ni Auth, ni sessions sécurisées, ni gestion des comptes ou invitations. Le socle ne doit donc pas être exposé à des utilisateurs réels. Ajouter ces éléments et tester les contrôles d'accès sur un serveur PostgreSQL réel avant intégration.

## Continuité

Les anciens documents d'audit décrivent la cible Supabase envisagée à leur date ; cette décision est remplacée par PostgreSQL sur Neon, avec PostgreSQL local facultatif. Les fonctions et journaux opérationnels restent partiels : pas de vérification des créneaux, caisse complète ou fournisseur de paiement. Voir `docs/implementation-workflow.md` pour le périmètre fonctionnel, en remplaçant ses références historiques à Supabase par cette architecture.
