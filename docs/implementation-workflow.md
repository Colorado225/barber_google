# Implémentation initiale du workflow opérationnel

> **Mise à jour : Neon (PostgreSQL hébergé) remplace Supabase comme cible technique ; PostgreSQL local reste facultatif.** Les références à Supabase et aux anciens chemins dans ce document sont historiques ; voir [Neon](neon.md) pour les instructions actuelles.

Cette tranche ajoute une migration SQL additive, sans toucher aux données existantes ni à la marketplace. Elle **n'est pas branchée à l'application Vite** et n'est déployée sur aucune base distante. Le prototype conserve ses parcours simulés et ne doit pas être utilisé comme ERP réel. Cette implémentation est une fondation partielle, pas une validation de production.

## Ce qui est implémenté dans la migration

- `bc_branch_memberships` relie un membre aux succursales de son salon ; clés étrangères composites interdisant les rattachements entre salons. Le propriétaire a accès à toutes ses succursales ; les autres membres doivent être affectés. La création d'une succursale reste réservée au propriétaire dans cette tranche.
- `bc_assign_member_to_branch` permet au propriétaire d'affecter un membership existant. Les invitations, retrait d'affectation et interface de gestion ne sont pas encore disponibles.
- Des permissions par action vérifient `auth.uid()`, membership actif, salon et succursale côté base. Les politiques RLS limitent les lectures et les clients ne peuvent pas écrire directement dans les journaux. Les règles de la matrice sont initiales et non configurables.
- `bc_appointments` stocke une réservation interne avec salon, succursale, client, prestation, période UTC, prix entier, devise, source et statut ; elle ne dépend pas d'une vitrine marketplace. `bc_appointment_events` historise création et transitions ; `bc_transition_appointment` interdit les transitions non prévues et exige un motif pour annulation/no-show.
- `bc_payment_entries` est un journal accessible en lecture seulement côté client. `bc_record_manual_entry` enregistre séparément paiements déclarés manuellement, remboursements déclarés et corrections par écriture inverse. Il verrouille le rendez-vous, vérifie les limites, enregistre acteur et motif, interdit les doublons de clé d'idempotence et les corrections répétées d'une écriture. L'annulation ne crée jamais de remboursement et un paiement ne termine pas une prestation. Un paiement nouveau est refusé après annulation/no-show.
- Les écritures `manual_mobile` et `manual_card` sont de simples déclarations opérateur ; elles ne prouvent aucun paiement fournisseur. Une entrée de remboursement est également une déclaration, pas une intégration de remboursement fournisseur.

## API SQL initiale

- `bc_create_appointment(salon, branch, client, service, start, end, amount, currency, source)` : création interne uniquement ; l'acteur est dérivé de la session. Les paramètres métier sont des saisies opérateur, non un catalogue sécurisé.
- `bc_transition_appointment(id, statut, motif)` : transition et événement atomiques ; aucune correction d'un état terminal n'est offerte dans cette tranche.
- `bc_record_manual_entry(appointment, kind, amount, method, reason, idempotency_key, original_entry)` : `payment`, `refund`, `payment_reversal`, `refund_reversal`. Pour une correction, l'entrée d'origine doit être du type, montant, méthode et rendez-vous correspondants ; motif requis. Une clé déjà utilisée est rejetée (le client doit interroger le journal avant de retenter, et non générer une nouvelle clé après un résultat incertain).

Le solde net est la somme des `payment` et `refund_reversal`, moins les `refund` et `payment_reversal`. Le solde restant est le prix du rendez-vous moins ce net. La devise est reprise du rendez-vous. Le journal ne représente pas encore une session de caisse, ni un justificatif de transfert effectif.

## Vérification

`npm run test:workflow` applique les deux migrations sur PGlite avec des rôles et un `auth.uid()` simulés. Les tests couvrent permissions par salon/succursale/action, refus d'écriture directe, transition invalide, acompte séparé de la prestation, annulation sans remboursement, limites de montant, clé réutilisée et correction unique. `npm run test:tenant` vérifie le socle précédent seul. Les tests ne simulent ni PostgREST ni de vraies sessions Supabase, et ne prouvent pas le comportement de concurrence entre transactions indépendantes.

## Limitations bloquantes avant mise en service

1. Pas de connexion UI/Auth, de sélection de succursale réelle ni d'intégration aux vues existantes. Les anciens paiements et publications fictifs ne sont pas corrigés par cette migration.
2. Pas de moteur d'horaires, d'affectation de professionnel, de prévention de double réservation concurrente ni de contrôle atomique de disponibilité. Ne pas proposer ce RPC comme moteur de réservation commercial ou public.
3. Pas de catalogue/prix validés côté serveur, d'idempotence de création de rendez-vous, de vérification des devises ISO réelles, de règles de no-show temporelles, ni de validation métier complète. Les saisies internes sont déclaratives.
4. Pas de contrôle de politique d'annulation/acompte, de reçus, de caisse par session, d'intégration fournisseur ou webhook. Les corrections et remboursements sont des déclarations et exigent une revue financière avant usage réel.
5. Pas d'auth UI, gestion d'invitations, révocation d'affectation, UI de permissions, audit administratif ou matrice configurable ; permissions minimales uniquement. Les collaborateurs et clients n'ont pas encore leur parcours spécialisé.
6. Tester les migrations, politiques RLS et concurrence sur PostgreSQL/Supabase réel et indépendant, vérifier les privilèges effectifs et le déploiement, puis réaliser une revue de sécurité avant tout usage. Ne pas appliquer directement en production.
