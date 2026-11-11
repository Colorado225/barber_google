-- Migration 20261111120000 : Alignement des avantages de forfaits sur les fonctionnalités réellement livrées.
--
-- Objectifs :
--  1. Remplacer dans public.saas_plans et public.saas_plan_drafts les promesses non livrées :
--     - « Calcul automatique des commissions d'équipe » -> suivi des taux configurés par membre uniquement
--     - « Export comptable et réconciliation des caisses » -> rapprochement des caisses sans export comptable
--     - « Mise en avant prioritaire sur la Marketplace » -> vitrine complète sans boost automatique
--     - « Support technique VIP prioritaire 7j/7 » -> sans promesse de support 7j/7 intégré
--     - « Multi-succursales & gestion de réseau centralisée » / « Rapports financiers et bilans comptables consolidés » -> périmètre exact
--     - « Rappels SMS & WhatsApp anti-no-show » -> rappel explicite SMS non disponible & dépendance opérateur

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
              'Multi-succursales jusqu’à 5 établissements (quota serveur & sélecteur ERP)'
            when 'Rapports financiers et bilans comptables consolidés' then
              'Rapports financiers et indicateurs d’activité par établissement'
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
