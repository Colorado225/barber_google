# P1 — Rendre les réglages SuperAdmin réellement globaux : audit de conformité

> Audit réalisé le 10 novembre 2026 sur la base `main` (4d8a151) et complément livré dans ce lot.
> Objectif : les réglages de plateforme doivent être persistés en base, modifiés uniquement par des
> opérations serveur réservées au SuperAdmin, et les réglages sans effet serveur doivent être
> masqués ou marqués « non activé ».

## 1. Récapitulatif des exigences et de leur couverture

| Exigence P1                                                  | État                          | Implémentation                                                                                                                                                                                                                                                                                  | Tests                                                                                                  |
| ------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Mode maintenance persisté en base et appliqué par le backend | Déjà livré (`20261111110000`) | Table singleton `platform_settings` (RLS SuperAdmin) ; écriture via `admin_update_platform_settings` (motif obligatoire + `platform_audit_logs`) ; application serveur dans `create_salon()` et exposition publique via `get_public_platform_status()` (page `/inscription`, `OnboardingGate`). | `database/tests/supabase-platform-global-settings.test.mjs`, `tests/platform-global-settings.test.tsx` |
| Approbation automatique des salons appliquée côté serveur    | Déjà livré                    | `auto_approve_salons` lu par `set_salon_publication()` et `publish_marketplace_customizer()` : un salon non certifié ne peut pas s'auto-publier lorsque le réglage est désactivé, sauf SuperAdmin.                                                                                              | idem                                                                                                   |
| Taux de commission : masqué / marqué « non activé »          | Déjà livré                    | Aucune colonne ni valeur locale ; `AdminPlatformSettingsPanel` l'affiche dans « Paramètres non implémentés / indisponibles » avec le badge « Sans effet serveur » et `commission_rate_available: false` côté RPC.                                                                               | `tests/platform-global-settings.test.tsx`                                                              |
| Écriture réservée au SuperAdmin, traçée                      | Déjà livré                    | `private.require_platform_role(array['super_admin'])` + `private.require_audit_reason` + `private.record_platform_audit` sur chaque RPC d'administration.                                                                                                                                       | idem                                                                                                   |

## 2. Écart résiduel corrigé dans ce lot : le contenu global Marketplace

Le contenu global de la Marketplace — bandeau d'annonce, bannières (hero, promo, CTA Pro), sections à
la une, onglets, catégories, FAQ et métadonnées du site — était **persisté uniquement dans le
`localStorage`** (`saveMarketplaceContent`), alors même que l'interface des paramètres le décrivait
comme géré « côté serveur » et que l'éditeur affichait lui-même l'avertissement « la persistance
serveur reste à brancher ». Conséquences : configuration invisible des autres administrateurs et des
visiteurs (qui voyaient le contenu par défaut), aucune application backend, aucune trace.

Correctif livré (migration `20261111200000` + `src/lib/marketplace-content.ts`) :

1. **Table `public.platform_marketplace_content`** (singleton `global`, RLS activée, aucun accès
   direct) ; lecture publique non sensible `get_public_marketplace_content()` (anon + authentifié).
2. **Écriture exclusivement serveur et SuperAdmin** : `admin_update_marketplace_content(p_content,
p_reason)` exige un motif (3–500 caractères), valide l'objet JSON (≤ 256 Ko), pose l'horodatage
   côté serveur (le champ `updatedAt` du client est retiré) et écrit dans `platform_audit_logs`
   (`platform.marketplace_content_updated`). `admin_get_marketplace_content()` expose la version et
   l'auteur aux SuperAdmins.
3. **Frontend** : `publishMarketplaceContentUpdate` / `publishMarketplaceContentReset` appellent le
   RPC et hydratent le store partagé depuis la réponse serveur ; le `localStorage` devient un simple
   cache de lecture (`refreshMarketplaceContentFromServer` déclenché au démarrage de l'app) et un
   **aperçu local honnêtement étiqueté** quand Supabase n'est pas configuré
   (`useMarketplaceContentStatus` : « Publié en base » vs « Aperçu local »).
4. **UI** : `Bannières & Métadonnées` et `Sections & Onglets` exigent un **motif de publication**
   (journal d'audit) pour chaque enregistrement, affichent la source réelle (serveur vs aperçu
   local) et propagent les erreurs serveur ; l'ancien avertissement « persistance à brancher » est
   remplacé par l'état réel. Les paramètres globaux renvoient désormais vers une gestion réellement
   servée.

## 3. Tests

- `database/tests/supabase-platform-marketplace-content.test.mjs` (PGlite, ajouté à
  `test:supabase`) : contrôle d'accès (anon / propriétaire / support_lead rejetés ; super_admin
  autorisé), lecture publique vide avant publication puis contenu publié visible, horodatage posé
  par le serveur (`updatedAt` client retiré), validation (motif, objet JSON, taille), ligne d'audit
  avec motif et acteur.
- `tests/marketplace-config-manager.test.tsx` : enregistrement **sans motif refusé** (erreur
  affichée, configuration inchangée), aperçu local annoncé honnêtement, parcours complet avec motif
  (métadonnées, sections à la une, bannières) inchangé.

## 4. Limites connues (assumées)

- Sans Supabase configuré (développement local), les écrans CMS écrivent toujours dans le
  navigateur mais l'indiquent explicitement (« Aperçu local… rien n'est publié ») ; aucune valeur ne
  prétend être publiée.
- Le cache `localStorage` reste utilisé pour l'affichage hors-ligne du contenu déjà publié ; il ne
  fait jamais autorité dès qu'une ligne serveur existe.
- Le SEO pré-rendu à la compilation (`scripts/prerender-public.mjs`) utilise les valeurs par défaut ;
  les métadonnées dynamiques publiées en base s'appliquent à l'exécution côté client, comme avant.
