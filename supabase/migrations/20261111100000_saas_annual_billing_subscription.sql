-- Migration 20261111100000 : Alignement de la tarification annuelle (affichage <-> souscription).
--
-- Objectifs :
--  1. La sélection mensuelle/annuelle est une donnée de souscription validée côté serveur
--     (paramètre optionnel p_billing_period sur public.subscribe_salon_to_plan).
--  2. Lorsque le forfait est mensuel et que la souscription est annuelle, le serveur calcule
--     le montant annuel avec la remise de 15 % : round(price_xof * 12 * 0.85)::bigint,
--     stocké dans saas_subscriptions.price_at_subscription (et repris par declare_saas_payment).
--  3. Lorsque p_billing_period est omis (NULL), la période du forfait dans saas_plans reste
--     utilisée telle quelle (rétrocompatibilité des plans annuels natifs et des appelants existants).
--  4. Si le forfait est déjà configuré en facturation annuelle native, une demande mensuelle est rejetée.
--  5. list_saas_payments_for_review() expose billing_period pour la validation SuperAdmin.

-- 1. Contrainte d'intégrité sur saas_subscriptions.billing_period -------------------------
alter table public.saas_subscriptions
  drop constraint if exists saas_subscriptions_billing_period_check;
alter table public.saas_subscriptions
  add constraint saas_subscriptions_billing_period_check
  check (billing_period in ('monthly', 'yearly'));

-- 2. Calcul serveur déterministe de la période et du montant de souscription --------------
create or replace function private.resolve_saas_subscription_terms(
  p_plan_price_xof bigint,
  p_plan_billing_period text,
  p_requested_billing_period text
)
returns table (billing_period text, price_xof bigint)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_plan_period text := coalesce(nullif(lower(btrim(p_plan_billing_period)), ''), 'monthly');
  v_req_period text := nullif(lower(btrim(coalesce(p_requested_billing_period, ''))), '');
  v_effective_period text;
  v_effective_price bigint;
begin
  if v_plan_period not in ('monthly', 'yearly') then
    raise exception 'Période de facturation du forfait invalide.' using errcode = '22023';
  end if;

  v_effective_period := coalesce(v_req_period, v_plan_period);
  if v_effective_period not in ('monthly', 'yearly') then
    raise exception 'Période de facturation invalide : choisissez mensuelle ou annuelle.'
      using errcode = '22023';
  end if;

  if v_plan_period = 'yearly' and v_effective_period = 'monthly' then
    raise exception 'Ce forfait est uniquement disponible en facturation annuelle.'
      using errcode = '22023';
  end if;

  if v_plan_period = 'monthly' and v_effective_period = 'yearly' then
    v_effective_price := round(p_plan_price_xof::numeric * 12 * 0.85)::bigint;
  else
    v_effective_price := p_plan_price_xof;
  end if;

  return query select v_effective_period, v_effective_price;
end;
$$;

revoke all on function private.resolve_saas_subscription_terms(bigint, text, text) from public, anon, authenticated;

-- 3. Remplacement sans surcharge ambiguë de public.subscribe_salon_to_plan ----------------
drop function if exists public.subscribe_salon_to_plan(uuid, text);

create or replace function public.subscribe_salon_to_plan(
  p_salon_id uuid,
  p_plan_id text,
  p_billing_period text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_plan public.saas_plans%rowtype;
  v_terms record;
  v_subscription public.saas_subscriptions%rowtype;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not private.is_salon_owner(p_salon_id) then
    raise exception 'Seul le propriétaire du salon peut souscrire un forfait.' using errcode = '42501';
  end if;

  select * into v_plan
  from public.saas_plans
  where id = p_plan_id and is_active = true;

  if v_plan.id is null then
    raise exception 'Ce forfait d''abonnement n''existe pas ou n''est plus actif.' using errcode = '22023';
  end if;

  select * into v_terms
  from private.resolve_saas_subscription_terms(v_plan.price_xof, v_plan.billing_period, p_billing_period);

  -- Une seule demande en attente par salon : la précédente est abandonnée.
  -- L'abonnement actif éventuel reste en place jusqu'à la validation du paiement.
  update public.saas_subscriptions
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where salon_id = p_salon_id and status = 'pending_payment';

  insert into public.saas_subscriptions (
    salon_id, plan_id, status, price_at_subscription, billing_period,
    features_snapshot, started_at, current_period_end
  )
  values (
    p_salon_id, v_plan.id, 'pending_payment', v_terms.price_xof, v_terms.billing_period,
    v_plan.features, now(), now()
  )
  returning * into v_subscription;

  return jsonb_build_object(
    'id', v_subscription.id,
    'salon_id', v_subscription.salon_id,
    'plan_id', v_subscription.plan_id,
    'status', v_subscription.status,
    'price_at_subscription', v_subscription.price_at_subscription,
    'billing_period', v_subscription.billing_period,
    'features_snapshot', v_subscription.features_snapshot,
    'started_at', v_subscription.started_at,
    'current_period_end', v_subscription.current_period_end
  );
end;
$$;

revoke all on function public.subscribe_salon_to_plan(uuid, text, text) from public, anon;
grant execute on function public.subscribe_salon_to_plan(uuid, text, text) to authenticated;

-- 4. Exposition de billing_period dans la file de validation SuperAdmin -------------------
create or replace function public.list_saas_payments_for_review()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_result jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.declared_at), '[]'::jsonb) into v_result
  from (
    select
      sp.id,
      sp.salon_id,
      sl.name as salon_name,
      s.plan_id,
      p.name as plan_name,
      s.billing_period,
      sp.amount_xof,
      sp.method,
      sp.reference,
      sp.declared_at
    from public.saas_subscription_payments sp
    join public.saas_subscriptions s on s.id = sp.subscription_id
    join public.saas_plans p on p.id = s.plan_id
    join public.salons sl on sl.id = sp.salon_id
    where sp.status = 'pending'
  ) r;

  return v_result;
end;
$$;

revoke all on function public.list_saas_payments_for_review() from public, anon;
grant execute on function public.list_saas_payments_for_review() to authenticated;
