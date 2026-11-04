# Backend Express — PILE HISTORIQUE GELÉE (Lot 1)

Ce dossier contient l'ancien backend Express (auth, ressources salon,
opérations, finance) et son schéma PostgreSQL associé
(`../database/migrations/`, distinct de `../supabase/migrations/`).

**État vérifié par l'audit du Lot 0 (2026-11-04, voir
`../docs/audit/ETAT-DES-LIEUX.md` §1 et §6-F3) :**

- Le frontend (`src/`) n'appelle **aucune** route `/api/` de ce serveur :
  le produit utilise exclusivement Supabase (PostgREST sous RLS + RPC).
- Les 44 RPC appelées par le frontend sont toutes définies dans
  `supabase/migrations/` ; aucun contrat produit ne dépend d'Express.
- Ce code n'est exercé que par ses tests historiques
  (`tests/api|auth|finance-lot4|operations-lot3|rate-limit|security-lot2`
  et `database/tests/tenant|workflow|resources`), conservés en CI en
  attendant la décision d'archivage du Lot 2.

**Règles jusqu'à décision du Lot 2 :**

- Ne pas ajouter de fonctionnalité ici ; toute évolution métier va dans
  Supabase (migration + RPC/RLS) et `src/`.
- Ne pas déployer ce serveur : il constituerait une seconde surface
  d'authentification sur une autre base (risque S2 de l'audit).
- Le script `npm run dev:auth` n'est conservé que pour exécuter les
  tests historiques localement.

Retrait ou archivage définitif : planifié au **Lot 2**, après confirmation
par l'exploitation qu'aucun déploiement de ce serveur n'est actif.
