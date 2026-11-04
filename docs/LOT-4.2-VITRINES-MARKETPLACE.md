# Lot 4.2 — Personnalisation des vitrines marketplace

Module permettant à chaque propriétaire de personnaliser la page publique de son
salon sur la marketplace (composition inspirée du bloc Shadcn `about-us-page-30`,
adaptée au métier : carrousel galerie, prestations en vedette, équipe, confiance,
horaires/localisation, avis vérifiés). Aucune donnée métier n'est dupliquée :
prix, durées, personnel, avis et horaires proviennent toujours de l'ERP.

## Parcours

- **Éditeur ERP** : menu « Vitrine & Personnalisation »
  (`/app/vitrine`, alias `/app/marketplace-personnalisation`),
  composant `SalonMarketplaceCustomizer`
  (`src/features/marketplace-customizer/`). Configuration à gauche
  (Thème / Contenu / Sections), aperçu temps réel à droite
  (desktop / tablette 768 px / mobile 390 px), actions brouillon →
  publier / dépublier / revenir à la version publiée.
- **Page publique** : `/salons/:slug` (`SalonPublicPage`), 3 modèles —
  Classique (bento galerie + cartes), Élégant (grande couverture),
  Éditorial (grille asymétrique) — alimentés par
  `marketplace_salon_detail`, qui ne renvoie que la configuration
  **publiée** (sinon la configuration par défaut). Le brouillon n'est
  jamais exposé publiquement.

## Modèle de configuration

`SalonMarketplaceViewConfig` (`src/types/index.ts`) : `layout`
(classic|elegant|editorial), `accentColor` (hex `#RRGGBB`, palette
prédéfinie dans l'éditeur), `cardStyle`, `sections[7]` (hero, gallery,
featured_services, team, trust, location_hours, reviews — chacune
activable et réordonnable, positions normalisées 0..6),
`featuredServiceIds` (≤ 12), `visibleStaffIds` (≤ 50),
`featuredGalleryImageIds` (URLs des photos du profil, ≤ 20, ordre =
ordre d'affichage, la première = couverture), `showAddress`,
`showPhone`, `showWhatsapp`, `customTagline` (≤ 160),
`customDescription` (≤ 1000), `featuredBranchId`, `themeMode`
(réservé : la marketplace est sombre uniquement pour l'instant).

Stockage : table dédiée `salon_marketplace_settings` (1 ligne/salon,
`draft_config` + `published_config` JSONB normalisés côté serveur +
colonnes dénormalisées), RLS par `private.has_salon_permission`.

## RPC (migrations `20261104140000` + durcissement `20261104140100`)

| RPC                                   | Rôle                                                                                                                                                                                    | Accès          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `get_marketplace_customizer_config`   | Lecture éditeur (crée le défaut : 4 prestations populaires, équipe active)                                                                                                              | `salon.read`   |
| `save_marketplace_customizer_draft`   | Validation stricte + normalisation, puis persistance du brouillon                                                                                                                       | `salon.update` |
| `publish_marketplace_customizer`      | Critères de publication existants (≥ 1 prestation active, adresse, téléphone, couverture) puis `published_config = draft`, `salons.is_published = true`, synchro `featured_service_ids` | `salon.update` |
| `unpublish_marketplace_customizer`    | `is_published = false` des deux côtés (config conservée)                                                                                                                                | `salon.update` |
| `revert_marketplace_customizer_draft` | Brouillon ← dernière version publiée (ou défaut)                                                                                                                                        | `salon.update` |
| `marketplace_salon_detail` (étendue)  | Fiche publique : config publiée uniquement, personnel filtré par la sélection publiée (liste vide = aucun membre), champs privés jamais exposés                                         | anon           |

Validation serveur à l'enregistrement : modèle et style en liste
blanche, couleur hexadécimale stricte (aucune injection CSS), sections
canoniques dédupliquées, identifiants UUID **appartenant au salon**
(prestations, personnel, succursale), images sous-ensemble strict de
la couverture + galerie du salon, plafonds de longueur. Aucun HTML/JS/CSS
libre n'est accepté.

## Règles métier importantes

- Les tarifs affichés proviennent du catalogue `services` en temps
  réel : modifier un prix dans l'ERP le reflète immédiatement sur la
  vitrine, sans republier.
- Un membre d'équipe **masqué** de la vitrine n'est pas non plus
  proposable à la réservation en ligne (la fiche publique ne le
  contient pas) ; il reste pleinement gérable dans l'ERP (planning,
  walk-in).
- Un employé sans photo est représenté par ses **initiales**, un salon
  sans photo par un panneau neutre à son nom — aucune image de
  démonstration externe n'est utilisée.
- La publication via l'éditeur respecte exactement les critères du
  flux historique `set_salon_publication` ; configurer une vitrine ne
  rend jamais public un salon non éligible.

## Déploiement base de données

```bash
npm run supabase:db:linked:status   # vérifier l'écart local/distante
npm run supabase:db:linked:preview  # dry-run
npm run supabase:db:linked:push     # applique 20261104140000 + 20261104140100
```

> Note d'exploitation (2026-11-04) : une tentative d'application via le
> connecteur Supabase managé a été bloquée par son filtre de sécurité
> après la création de la table `salon_marketplace_settings`, de ses
> policies et de deux fonctions (`private.build_default_marketplace_config`,
> `public.get_marketplace_customizer_config`) sur le projet lié
> `barber_google`. La migration `20261104140000` — jamais enregistrée
> comme appliquée — a été rendue idempotente (`drop policy if exists`
> avant chaque `create policy`) : le `db push` ci-dessus aboutit donc
> sans SQL manuel et sans perte (la table créée est vide).

## Tests

- `database/tests/supabase-marketplace-customizer.test.mjs` (PGlite,
  12 tests) : défaut à la première visite, brouillon sans effet métier,
  isolation multi-tenant, rejet d'identifiants étrangers, publication
  et synchronisation des vedettes, fiche publique (filtrage personnel,
  champs privés absents), synchronisation tarifaire en temps réel,
  durcissement (normalisation des sections, rejet couleur/image/slogan
  invalides), **brouillon jamais public**, revert, dépublication,
  sélection de personnel publiée vide.
- `tests/marketplace-customizer.test.tsx` (8 tests) : configuration par
  défaut, rendu des 3 modèles avec prix ERP formatés FCFA, sections
  conditionnelles, personnel visible, synchronisation tarifaire,
  **ordre des sections respecté**, **galerie limitée à la sélection**.

## Limites restantes

- `themeMode` est persisté mais non appliqué (marketplace sombre).
- L'ordre des sections est respecté dans les 3 modèles ; dans le
  modèle Classique, le bento « galerie + cartes » ne s'applique que
  lorsque la galerie précède immédiatement un groupe de cartes.
- La sélection de galerie réutilise les photos du profil salon
  (l'upload reste dans les paramètres du salon, pas dans l'éditeur).
