-- Super administration de la plateforme : compte unique + contrôle serveur.
--
-- 1. Garde réutilisable : l'appelant doit figurer dans public.platform_admins avec le rôle super_admin.
-- 2. Le rattachement du compte unique se fait hors migration : voir supabase/manual/platform_superadmin_account.sql
-- 3. Les fonctions d'administration des forfaits et des métriques refusent tout autre appelant.
--    Avant, n'importe quel utilisateur authentifié pouvait appeler save_saas_plan (SECURITY DEFINER).
-- 4. La politique RLS d'écriture sur saas_plans n'accorde plus l'écriture aux propriétaires de salon.

-- 1. Garde ---------------------------------------------------------------------------------------------
create or replace function public.is_platform_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and pa.role = 'super_admin'
  );
$$;

revoke all on function public.is_platform_superadmin() from public, anon;
grant execute on function public.is_platform_superadmin() to authenticated;

-- 3. Fonctions d'administration -------------------------------------------------------------------------
create or replace function public.get_all_saas_plans()
returns table (
  id text,
  name text,
  slug text,
  price_xof bigint,
  billing_period text,
  description text,
  features jsonb,
  max_staff integer,
  max_branches integer,
  is_popular boolean,
  is_active boolean,
  badge_text text,
  display_order integer,
  subscribers_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.name,
    p.slug,
    p.price_xof,
    p.billing_period,
    p.description,
    p.features,
    p.max_staff,
    p.max_branches,
    p.is_popular,
    p.is_active,
    p.badge_text,
    p.display_order,
    count(s.id) filter (where s.status in ('active', 'trialing')) as subscribers_count
  from public.saas_plans p
  left join public.saas_subscriptions s on s.plan_id = p.id
  group by p.id
  order by p.display_order asc, p.price_xof asc;
end;
$$;

grant execute on function public.get_all_saas_plans() to authenticated;

create or replace function public.save_saas_plan(
  p_id text,
  p_name text,
  p_slug text,
  p_price_xof bigint,
  p_billing_period text,
  p_description text,
  p_features jsonb,
  p_max_staff integer default null,
  p_max_branches integer default 1,
  p_is_popular boolean default false,
  p_is_active boolean default true,
  p_badge_text text default null,
  p_display_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_plan public.saas_plans%rowtype;
  v_clean_features jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  if p_price_xof < 0 then
    raise exception 'Le tarif doit être supérieur ou égal à zéro.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Le nom du forfait est obligatoire.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_slug, '')) = '' then
    p_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  end if;

  v_clean_features := coalesce(p_features, '[]'::jsonb);

  insert into public.saas_plans (
    id,
    name,
    slug,
    price_xof,
    billing_period,
    description,
    features,
    max_staff,
    max_branches,
    is_popular,
    is_active,
    badge_text,
    display_order,
    updated_at
  )
  values (
    p_id,
    p_name,
    p_slug,
    p_price_xof,
    coalesce(p_billing_period, 'monthly'),
    coalesce(p_description, ''),
    v_clean_features,
    p_max_staff,
    coalesce(p_max_branches, 1),
    coalesce(p_is_popular, false),
    coalesce(p_is_active, true),
    p_badge_text,
    coalesce(p_display_order, 0),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    price_xof = excluded.price_xof,
    billing_period = excluded.billing_period,
    description = excluded.description,
    features = excluded.features,
    max_staff = excluded.max_staff,
    max_branches = excluded.max_branches,
    is_popular = excluded.is_popular,
    is_active = excluded.is_active,
    badge_text = excluded.badge_text,
    display_order = excluded.display_order,
    updated_at = now()
  returning * into v_plan;

  return jsonb_build_object(
    'id', v_plan.id,
    'name', v_plan.name,
    'slug', v_plan.slug,
    'price_xof', v_plan.price_xof,
    'billing_period', v_plan.billing_period,
    'description', v_plan.description,
    'features', v_plan.features,
    'max_staff', v_plan.max_staff,
    'max_branches', v_plan.max_branches,
    'is_popular', v_plan.is_popular,
    'is_active', v_plan.is_active,
    'badge_text', v_plan.badge_text,
    'display_order', v_plan.display_order,
    'updated_at', v_plan.updated_at
  );
end;
$$;

grant execute on function public.save_saas_plan(text, text, text, bigint, text, text, jsonb, integer, integer, boolean, boolean, text, integer) to authenticated;

create or replace function public.get_platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_total_salons bigint;
  v_published_salons bigint;
  v_active_subscriptions bigint;
  v_estimated_mrr_xof bigint;
  v_plans_count bigint;
  v_total_appointments bigint;
  v_total_revenue_xof bigint;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select count(*) into v_total_salons from public.salons;
  select count(*) into v_published_salons from public.salons where is_published = true;
  select count(*), coalesce(sum(price_at_subscription), 0) into v_active_subscriptions, v_estimated_mrr_xof
  from public.saas_subscriptions where status in ('active', 'trialing');
  select count(*) into v_plans_count from public.saas_plans where is_active = true;
  select count(*) into v_total_appointments from public.appointments;
  select coalesce(sum(amount), 0) into v_total_revenue_xof
  from public.payments where status = 'confirmed';

  return jsonb_build_object(
    'total_salons', v_total_salons,
    'published_salons', v_published_salons,
    'active_subscriptions', v_active_subscriptions,
    'estimated_mrr_xof', v_estimated_mrr_xof,
    'plans_count', v_plans_count,
    'total_appointments', v_total_appointments,
    'total_revenue_xof', v_total_revenue_xof
  );
end;
$$;

grant execute on function public.get_platform_metrics() to authenticated;

-- 4. Écriture des forfaits : super administrateur uniquement (plus de propriétaires de salon) ----------
drop policy if exists saas_plans_admin_manage on public.saas_plans;
create policy saas_plans_admin_manage on public.saas_plans
  for all to authenticated
  using (public.is_platform_superadmin())
  with check (public.is_platform_superadmin());
