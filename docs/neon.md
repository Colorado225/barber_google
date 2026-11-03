# PostgreSQL avec Neon

Neon est désormais la cible PostgreSQL hébergée pour le projet. Docker Compose et PostgreSQL local restent une option de développement ; les migrations SQL sont communes. Aucun projet Neon n'a été connecté, inspecté ou modifié lors de cette préparation.

## Mise en place d'un environnement de développement

1. Créer ou identifier un projet Neon et une base/branche **de développement isolée**, jamais la production. Vérifier la région, les droits et le schéma existant avant toute écriture.
2. Dans la console Neon, récupérer la chaîne de connexion PostgreSQL **directe (non poolée)** pour les migrations. Configurer cette valeur dans un fichier `.env` local non versionné ou un gestionnaire de secrets, sous `DATABASE_URL`. Ne pas mettre de chaîne de connexion, mot de passe ou clé dans le code, le frontend, les logs ou une conversation.
3. Conserver TLS activé. Une URL de connexion Neon comporte généralement `sslmode=require` ; pour vérifier également le certificat et le nom du serveur, utiliser `sslmode=verify-full` avec une autorité de certification de confiance configurée pour libpq. Vérifier la configuration TLS applicable à votre environnement avant d'utiliser des données réelles.
4. Installer localement `psql` et `sha256sum`. Charger uniquement un fichier `.env` de confiance dans le shell, puis lancer `./database/migrate.sh`. Ce script modifie la base : confirmer la cible avant de le lancer ; exécuter une seule instance à la fois. Ne pas appliquer les migrations directement en production.
5. La première migration crée le rôle PostgreSQL `bc_app`. Vérifier que le rôle de migration Neon dispose des privilèges nécessaires pour créer le rôle, les tables, fonctions et politiques RLS. En cas de refus, arrêter et adapter le provisionnement après revue ; ne pas octroyer de privilèges excessifs pour contourner le problème. Vérifier aussi les conflits de noms existants.
6. Exécuter sur cette branche des tests d'intégration PostgreSQL réels : permissions, RLS, changement de rôle, isolation entre transactions et connexions, ainsi que concurrence. Les tests PGlite existants ne remplacent pas ces vérifications. Tester sauvegarde/restauration et relire les migrations avant staging puis production.

Le script de migration enregistre le nom et la somme de chaque fichier dans `bc_schema_migrations`. Une migration modifiée après application provoque une erreur ; créer une nouvelle migration corrective plutôt que modifier une migration déjà appliquée. Il n'exécute pas de suppression de données.

## Connexion de l'application : travail restant

Le navigateur React ne doit **jamais** se connecter directement à Neon. Le dépôt ne contient pas encore de backend connecté, d'authentification réelle ni de gestion des sessions. Il faut les implémenter avant de connecter des utilisateurs ou données réelles.

Le backend devra vérifier l'identité et, pour chaque transaction, établir un contexte utilisateur fiable, adopter un rôle PostgreSQL limité soumis à la RLS et nettoyer le contexte en fin de transaction. `barber.user_id` est une simple variable SQL modifiable par un client SQL : elle ne constitue pas une preuve d'identité. Ne jamais exposer des identifiants SQL ni un accès SQL arbitraire aux clients. Voir la section « Frontière de sécurité » de `postgresql-local.md`.

Séparer les identifiants de migration et d'exécution du backend. Les migrations utilisent une connexion directe ; un pool de connexions peut être étudié pour le backend, en vérifiant sa compatibilité avec `SET LOCAL ROLE`, les transactions et le nettoyage de session. Aucun de ces flux n'est encore implémenté ni testé sur Neon.
