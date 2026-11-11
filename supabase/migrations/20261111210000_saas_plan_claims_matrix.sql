-- Migration 20261111210000 : Matrice promesses des forfaits — resserrement de deux formulations.
--
-- Contexte (P1 « Vérifier les promesses des forfaits ») : l'audit de la matrice
-- fonctionnalité annoncée / implémentation réelle / contrôle serveur / test associé
-- (docs/audit/P1-PROMESSES-FORFAITS-VERIFICATION.md) révèle deux avantages annoncés
-- au-delà du livré :
--  1. « quota serveur & sélecteur ERP » : le quota de succursales est appliqué côté serveur
--     (private.enforce_branch_quota) et les horaires se gèrent par succursale, mais il
--     n'existe aucun sélecteur ERP filtrant les vues (planning, tableau de bord) par
--     succursale. La formulation est resserrée sur le livré.
--  2. « indicateurs d'activité par établissement » : les rapports consolident l'ensemble
--     des succursales du salon ; aucun rapport détaillé par succursale n'est livré.
--
-- Le suivi des taux de commission par membre reste libellé exactement comme livré
-- (taux configurés, calcul des montants dus à venir).

create or replace function private.normalize_saas_plan_features(p_features jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_agg(mapped.val order by mapped.first_ord)
      from (
        select
          min(t.ord) as first_ord,
          case btrim(t.elem)
            when 'Rappels SMS & WhatsApp anti-no-show' then
              'Suivi des confirmations & rappels e-mail / WhatsApp (selon activation opérateur ; SMS non disponible)'
            when 'Calcul automatique des commissions d''équipe' then
              'Suivi des taux de commission par membre (calcul automatique des montants dus à venir)'
            when 'Calcul automatique des commissions d’équipe' then
              'Suivi des taux de commission par membre (calcul automatique des montants dus à venir)'
            when 'Export comptable et réconciliation des caisses' then
              'Rapprochement et réconciliation des caisses (export comptable non disponible)'
            when 'Mise en avant prioritaire sur la Marketplace' then
              'Vitrine complète sur la Marketplace (classement par publication ; mise en avant non automatisée)'
            when 'Support technique VIP prioritaire 7j/7' then
              'Accompagnement à l’onboarding multi-sites (support VIP 7j/7 non intégré à l’application)'
            when 'Multi-succursales & gestion de réseau centralisée' then
              'Multi-succursales jusqu’à 5 établissements (quota serveur ; horaires et effectifs par succursale)'
            when 'Multi-succursales jusqu’à 5 établissements (quota serveur & sélecteur ERP)' then
              'Multi-succursales jusqu’à 5 établissements (quota serveur ; horaires et effectifs par succursale)'
            when 'Rapports financiers et bilans comptables consolidés' then
              'Rapports financiers et indicateurs d’activité consolidés du salon'
            when 'Rapports financiers et indicateurs d’activité par établissement' then
              'Rapports financiers et indicateurs d’activité consolidés du salon'
            else t.elem
          end as val
        from jsonb_array_elements_text(coalesce(p_features, '[]'::jsonb)) with ordinality as t(elem, ord)
        group by 2
      ) mapped
    ),
    '[]'::jsonb
  );
$$;

revoke all on function private.normalize_saas_plan_features(jsonb) from public, anon, authenticated;

update public.saas_plans
set
  features = private.normalize_saas_plan_features(features),
  updated_at = now()
where features is not null;

update public.saas_plan_drafts
set
  payload = jsonb_set(
    payload,
    '{features}',
    private.normalize_saas_plan_features(payload -> 'features')
  ),
  updated_at = now()
where payload ? 'features'
  and jsonb_typeof(payload -> 'features') = 'array';
