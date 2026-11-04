# Gestion et synchronisation des migrations Supabase

## Source de vérité

Les migrations destinées à Supabase sont exclusivement dans
`supabase/migrations/`. La lignée `database/migrations/` appartient encore à
l'ancien backend Express (`bc_*`) et ne doit pas être envoyée au projet
Supabase : elle décrit un autre modèle de données.

Une migration appliquée est immuable. Toute évolution se fait dans un nouveau
fichier versionné ; ne pas renommer, modifier ou supprimer une migration déjà
appliquée. Les données de démonstration restent désactivées par défaut.

## Développer et vérifier localement

Prérequis : Supabase CLI et Docker Desktop démarré.

1. Créer une migration avec `supabase migration new <nom>`.
2. Écrire le changement SQL dans le nouveau fichier sous
   `supabase/migrations/`.
3. Recréer la base locale depuis zéro avec `npm run supabase:db:reset`.
   Cette commande est destructive pour la base Supabase **locale** uniquement.
4. Lancer les tests ciblés et `npm test`.
5. Vérifier que le diff ne modifie pas une migration déjà appliquée.

La CI exécute aussi `supabase db reset` et `supabase db lint --local` sur le
PostgreSQL Supabase local. Les tests PGlite restent utiles pour les cas
d'isolation/RLS, mais ne remplacent pas cette validation par le moteur utilisé
par Supabase.

## Prévisualiser le projet distant

Avant une application distante, relier la CLI au projet voulu, puis inspecter
le journal et le plan :

```sh
supabase link --project-ref <project-ref>
npm run supabase:db:linked:status
npm run supabase:db:linked:preview
```

Le lien CLI n'est qu'une configuration locale ; il ne synchronise pas le
schéma. La prévisualisation est sans écriture. Vérifier le projet cible, les
migrations en attente, l'impact SQL et disposer d'une sauvegarde avant toute
application.

## Appliquer au projet distant

Le workflow manuel
`.github/workflows/supabase-migrations.yml` n'accepte que la branche `main` et
exige la confirmation explicite `confirm_production_migration`. Il affiche
d'abord le statut et le `--dry-run`, puis applique les migrations avec
`supabase db push --linked --yes`. Le job utilise l'environnement GitHub
`supabase-production` : configurer cet environnement avec des approbateurs
requis avant de l'utiliser.

Configurer dans cet environnement :

- le secret `SUPABASE_ACCESS_TOKEN` ;
- le secret `SUPABASE_DB_PASSWORD` ;
- la variable `SUPABASE_PROJECT_REF`, égale au projet Supabase visé.

Ne jamais placer ces secrets dans `.env.example`, le dépôt, le bundle client ou
les logs. Le workflow ne copie aucun schéma de `database/migrations/` et ne
modifie pas de données de démonstration.

## Limite actuelle de synchronisation

L'application de migrations synchronise le schéma versionné ; elle ne migre pas
automatiquement les lignes de données de l'ancien PostgreSQL/Express et ne
rend pas les écrans ERP synchrones à Supabase par magie. Au moment de cette
mise en place, le schéma Supabase ne couvre que le socle tenant et une partie
des ressources : les domaines métier encore servis par Express doivent être
portés et validés avant son retrait. Aucune application distante ne doit être
considérée comme effectuée pour une nouvelle migration tant que le workflow
n'a pas terminé avec succès. L'état distant déjà vérifié ci-dessous est
antérieur à ce déploiement automatisé.

La migration locale `20261103170000_branch_hours.sql` ajoute un horaire
hebdomadaire par succursale, avec validation des heures, RLS de lecture pour
les membres et écriture réservée aux rôles autorisés à modifier la succursale.
L'écran des horaires lit les succursales et lit/enregistre ces lignes via
Supabase ; son ancien wrapper HTTP Express a été retiré du client frontend.
Les tests PGlite couvrent l'isolation et les contraintes. La migration n'a pas
été appliquée au projet distant.

## État distant vérifié

Le 3 novembre 2026, le Dashboard Supabase du projet `barber_google` a confirmé :

- `20261103160000 / supabase_core` est enregistré dans
  `supabase_migrations.schema_migrations` et correspond à l'unique fichier de
  `supabase/migrations/` ;
- les 15 tables du schéma `public` existent, toutes avec RLS activée ;
- les 37 policies ainsi que les RPC `create_salon` et
  `assign_member_to_branch` sont présentes ;
- `.env.local` cible ce même projet et contient une clé client, sans que ces
  valeurs soient exposées ou versionnées.

Aucune migration n'a été rejouée pendant cette vérification : la base distante
était déjà à jour avec la lignée canonique locale. Cette vérification valide le
schéma et la configuration de connexion, pas la migration des données de
l'ancien backend ni la parité complète des écrans ERP.
