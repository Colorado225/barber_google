-- Migration 20261104150000: Modèle SaaS, Plans tarifaires dynamiques et Abonnements multi-tenants.
-- Permet la gestion centralisée des prix et avantages SaaS depuis la console Super Admin,
-- visible immédiatement sur la marketplace et prise en compte pour tous les souscripteurs ultérieurs,
-- tout en conservant le prix historique souscrit pour les abonnés existants (garantie grandfathering).

create table if not exists public.saas_plans (
  id text primary key,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique check (char_length(btrim(slug)) between 1 and 100),
  price_xof bigint not null check (price_xof >= 0),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  description text not null default '',
  features jsonb not null default '[]'::jsonb,
  max_staff integer check (max_staff is null or max_staff > 0),
  max_branches integer not null default 1 check (max_branches > 0),
  is_popular boolean not null default false,
  is_active boolean not null default true,
  badge_text text default null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index pour recherche rapide et tri d'affichage
create index if not exists saas_plans_active_order_idx on public.saas_plans (is_active, display_order);

-- Ajout de la colonne subscription_plan_id à salons si absente
alter table public.salons add column if not exists subscription_plan_id text references public.saas_plans(id) on delete set null;

-- Table des abonnements souscrits par les salons
create table if not exists public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  plan_id text not null references public.saas_plans(id) on delete restrict,
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  -- Instantané figé du tarif au moment de la souscription :
  -- Garantit que les souscripteurs ultérieurs prennent le nouveau prix sans impacter rétroactivement les abonnés actuels.
  price_at_subscription bigint not null check (price_at_subscription >= 0),
  billing_period text not null default 'monthly',
  features_snapshot jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saas_subscriptions_salon_idx on public.saas_subscriptions (salon_id, status);

-- Table des super administrateurs de la plateforme SaaS
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin', 'support_lead')),
  created_at timestamptz not null default now()
);

-- Activation RLS
alter table public.saas_plans enable row level security;
alter table public.saas_subscriptions enable row level security;
alter table public.platform_admins enable row level security;

-- Politiques RLS
-- Les plans actifs sont publiquement lisibles (Marketplace, page Tarifs, onboarding)
drop policy if exists saas_plans_public_select on public.saas_plans;
create policy saas_plans_public_select on public.saas_plans
  for select to anon, authenticated
  using (true);

drop policy if exists saas_plans_admin_manage on public.saas_plans;
create policy saas_plans_admin_manage on public.saas_plans
  for all to authenticated
  using (
    exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
    or exists (select 1 from public.memberships where user_id = (select auth.uid()) and role = 'owner')
  )
  with check (
    exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
    or exists (select 1 from public.memberships where user_id = (select auth.uid()) and role = 'owner')
  );

drop policy if exists saas_subscriptions_member_select on public.saas_subscriptions;
create policy saas_subscriptions_member_select on public.saas_subscriptions
  for select to authenticated
  using (
    private.has_salon_permission(salon_id, 'subscriptions.read')
    or exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
  );

drop policy if exists platform_admins_self_select on public.platform_admins;
create policy platform_admins_self_select on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.saas_plans to anon, authenticated;
grant all on public.saas_plans to authenticated;
grant select, insert, update on public.saas_subscriptions to authenticated;
grant select on public.platform_admins to authenticated;

-- Seed des 3 plans fondateurs avec prix et avantages
insert into public.saas_plans (id, name, slug, price_xof, billing_period, description, features, max_staff, max_branches, is_popular, is_active, badge_text, display_order)
values
  (
    'starter',
    'Starter Solo',
    'starter',
    15000,
    'monthly',
    'Idéal pour barbier solo ou débutant qui lance son activité avec une gestion rigoureuse.',
    '[
      "1 barbier / 1 fauteuil",
      "Planning et réservations illimités",
      "Caisse & encaissements (Espèces + Mobile Money)",
      "Fichier clients CRM & historique",
      "Fiche de présence sur la Marketplace",
      "Lien & QR code de réservation"
    ]'::jsonb,
    1,
    1,
    false,
    true,
    'Solo & Débutant',
    1
  ),
  (
    'pro',
    'Pro Équipe',
    'pro',
    35000,
    'monthly',
    'Le choix de référence pour les salons en pleine croissance cherchant à maximiser leur rentabilité.',
    '[
      "Jusqu''à 5 barbiers",
      "Calcul automatique des commissions d''équipe",
      "Module Clients de passage (Walk-in en direct)",
      "Programme de fidélité et récompenses automatisé",
      "Personnalisation complète de la vitrine (3 thèmes)",
      "Rappels SMS & WhatsApp anti-no-show",
      "Gestion des dépenses et alertes de stock bas"
    ]'::jsonb,
    5,
    1,
    true,
    true,
    'Plus Populaire',
    2
  ),
  (
    'prestige',
    'Prestige & Chaînes',
    'prestige',
    75000,
    'monthly',
    'Conçu pour les barbershops haut de gamme et les chaînes multi-établissements.',
    '[
      "Barbiers et fauteuils illimités",
      "Multi-succursales & gestion de réseau centralisée",
      "Rapports financiers et bilans comptables consolidés",
      "Export comptable et réconciliation des caisses",
      "Mise en avant prioritaire sur la Marketplace",
      "Support technique VIP prioritaire 7j/7"
    ]'::jsonb,
    null,
    5,
    false,
    true,
    'Haut de Gamme',
    3
  )
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  price_xof = excluded.price_xof,
  description = excluded.description,
  features = excluded.features,
  max_staff = excluded.max_staff,
  max_branches = excluded.max_branches,
  is_popular = excluded.is_popular,
  is_active = excluded.is_active,
  badge_text = excluded.badge_text,
  display_order = excluded.display_order;

-- RPC 1 : Récupération des plans actifs pour la Marketplace et les souscriptions
create or replace function public.get_saas_plans()
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
  display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
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
    p.display_order
  from public.saas_plans p
  where p.is_active = true
  order by p.display_order asc, p.price_xof asc;
$$;

grant execute on function public.get_saas_plans() to anon, authenticated;

-- RPC 2 : Récupération de tous les plans (y compris inactifs) pour la console Super Admin
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
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

grant execute on function public.get_all_saas_plans() to authenticated;

-- RPC 3 : Sauvegarde / Modification d'un plan depuis la console Super Admin
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

-- RPC 4 : Souscription d'un salon à un plan (ou changement d'offre)
create or replace function public.subscribe_salon_to_plan(
  p_salon_id uuid,
  p_plan_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_plan public.saas_plans%rowtype;
  v_subscription public.saas_subscriptions%rowtype;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not private.has_salon_permission(p_salon_id, 'subscriptions.read') then
    raise exception 'Permission refusée sur ce salon' using errcode = '42501';
  end if;

  select * into v_plan
  from public.saas_plans
  where id = p_plan_id and is_active = true;

  if v_plan.id is null then
    raise exception 'Ce forfait d''abonnement n''existe pas ou n''est plus actif.' using errcode = '22023';
  end if;

  -- Annulation de l'abonnement actif précédent
  update public.saas_subscriptions
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where salon_id = p_salon_id and status in ('active', 'trialing');

  -- Création du nouvel abonnement avec capture du prix et avantages au moment de la souscription
  insert into public.saas_subscriptions (
    salon_id,
    plan_id,
    status,
    price_at_subscription,
    billing_period,
    features_snapshot,
    started_at,
    current_period_end
  )
  values (
    p_salon_id,
    v_plan.id,
    'active',
    v_plan.price_xof,
    v_plan.billing_period,
    v_plan.features,
    now(),
    now() + interval '30 days'
  )
  returning * into v_subscription;

  -- Mise à jour du salon
  update public.salons
  set subscription_plan_id = v_plan.id
  where id = p_salon_id;

  return jsonb_build_object(
    'id', v_subscription.id,
    'salon_id', v_subscription.salon_id,
    'plan_id', v_subscription.plan_id,
    'status', v_subscription.status,
    'price_at_subscription', v_subscription.price_at_subscription,
    'billing_period', v_subscription.billing_period,
    'features_snapshot', v_subscription.features_snapshot,
    'started_at', v_subscription.started_at,
    'current_period_end', v_subscription.current_period_end,
    'plan_name', v_plan.name
  );
end;
$$;

grant execute on function public.subscribe_salon_to_plan(uuid, text) to authenticated;

-- RPC 5 : Récupération de l'abonnement en cours d'un salon
create or replace function public.get_salon_subscription(p_salon_id uuid)
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

  if not private.has_salon_permission(p_salon_id, 'subscriptions.read') then
    raise exception 'Permission refusée sur ce salon' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', s.id,
    'salon_id', s.salon_id,
    'plan_id', s.plan_id,
    'status', s.status,
    'price_at_subscription', s.price_at_subscription,
    'billing_period', s.billing_period,
    'features_snapshot', s.features_snapshot,
    'started_at', s.started_at,
    'current_period_end', s.current_period_end,
    'cancelled_at', s.cancelled_at,
    'plan', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'current_price_xof', p.price_xof,
      'description', p.description,
      'features', p.features,
      'badge_text', p.badge_text,
      'max_staff', p.max_staff,
      'max_branches', p.max_branches
    )
  ) into v_result
  from public.saas_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  where s.salon_id = p_salon_id and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  return v_result;
end;
$$;

grant execute on function public.get_salon_subscription(uuid) to authenticated;

-- RPC 6 : Métriques globales de la plateforme pour la console Super Admin
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
