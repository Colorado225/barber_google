# Socle multi-tenant — implémentation initiale

> **Mise à jour : Neon (PostgreSQL hébergé) remplace Supabase comme cible technique ; PostgreSQL local reste facultatif.** Les références à Supabase et aux anciens chemins dans ce document sont historiques ; voir [Neon](neon.md) pour les instructions actuelles.

## Périmètre et décision

Cette première tranche crée un modèle isolé dans une migration Supabase versionnée, sans changer l'interface ni modifier de données existantes. Une organisation regroupe des salons ; le salon est la frontière d'autorisation ; une succursale appartient à un salon. Un utilisateur peut avoir un membership actif différent dans plusieurs salons. Le modèle utilise des tables préfixées `bc_` pour éviter de supposer qu'une base existante est vide.

## Modèle et droits

- `bc_organizations`, `bc_salons`, `bc_branches`, `bc_memberships` : UUID, clés étrangères, contraintes et index. Une seule adhésion par utilisateur et salon, avec rôle et état actif/suspendu.
- Lecture des salons et succursales : membership actif dans le salon. Lecture d'une organisation : au moins un membership actif sur un de ses salons. Chaque utilisateur ne voit que ses propres memberships actifs.
- Le propriétaire peut modifier le nom de son salon ; propriétaire et manager peuvent créer une succursale et modifier son nom ou son fuseau. Les autres rôles ne peuvent pas effectuer ces mutations. Les clés de rattachement, rôles et memberships ne sont pas modifiables directement par le client.
- La fonction `bc_create_salon` crée atomiquement organisation, salon, succursale et membership propriétaire à partir de `auth.uid()` ; aucune identité ou appartenance fournie par le navigateur n'est acceptée comme preuve. Les opérations non expressément autorisées sont refusées par défaut.
- Les fonctions internes `SECURITY DEFINER` n'acceptent pas d'ID utilisateur fourni par le client et fixent un `search_path` vide ; `barber_private` ne doit **pas** être exposé dans les schémas PostgREST. Les permissions sont une matrice initiale fixe, pas encore configurables.

## Déploiement sûr

1. Identifier explicitement un projet Supabase de développement ou un environnement local isolé ; vérifier son schéma, les droits, les noms existants et les éventuelles migrations avant application.
2. Relire et tester `supabase/migrations/20261103000000_tenant_foundation.sql` sur une copie représentative. Les tables portent volontairement de nouveaux noms ; si un nom existe déjà, la migration échoue plutôt que de le modifier ou le supprimer.
3. Appliquer avec l'outillage de migration Supabase sur cet environnement seulement, en s'assurant que `barber_private` est absent des schémas API exposés. Tester avec de vrais JWT et différents utilisateurs, y compris les appels REST directs. Ne jamais fournir une service-role key au navigateur.
4. Effectuer une revue de sécurité, un test de restauration et une validation en staging avant toute migration de production. Ne pas supprimer les tables pour revenir en arrière ; préparer une migration corrective et une procédure de restauration adaptées à l'environnement.

## Tests

`npm run test:tenant` exécute les tests sur PGlite, moteur PostgreSQL embarqué. Les tests simulent le rôle `authenticated`, `anon`, `auth.users` et `auth.uid()` : création, lecture inter-tenant, écritures interdites, interdiction de modifier les rôles/rattachements, rôles différents selon le salon, suspension, absence d'identité et saisie invalide. Ils ne remplacent pas les tests d'intégration sur Supabase réel (JWT, PostgREST, rôles et configuration réelle), ni une revue de sécurité indépendante.

L'installation du dépôt nécessite actuellement un contournement du conflit de dépendances documenté dans `audit-fondations.md` : `npm install --legacy-peer-deps`. Cette commande n'est pas une solution de production ; il faut aligner Vite/esbuild et versionner un lockfile après validation.

## Limites et prochaines étapes

- La migration n'est appliquée à aucune base distante. L'application Vite actuelle n'est **pas** branchée à ce modèle : ses données locales et son sélecteur de rôle restent une démo non sécurisée et ne doivent pas être utilisés en production.
- Auth UI, gestion des sessions, onboarding relié à la fonction, sélection du tenant, invitations, retrait de droits, transfert de propriété, audit et permissions configurables restent à développer. Aucun rôle super-admin n'est accordé par ce socle.
- Le nom de fuseau est actuellement du texte non validé côté base ; ajouter validation IANA côté serveur avant d'utiliser ces paramètres pour des réservations.
- Ajouter les données métier par migrations dédiées, avec clés étrangères composites empêchant les références entre tenants, RLS et tests pour chaque domaine. Les politiques de lecture publique marketplace doivent être séparées des tables privées.
- Ajouter vérification d'email, rate limiting, journal d'audit, contraintes de cycle de vie, protection des données personnelles et tests inter-tenant réels avant toute exposition. Ne pas convertir les paiements simulés ou les données de démo en transactions réelles.
