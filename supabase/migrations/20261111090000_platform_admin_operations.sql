-- Migration 20261111090000 : opérations SuperAdmin persistées en base (Lot 1, P0).
--
-- Remplace les décisions stockées dans le navigateur (suspension, publication, certification,
-- formule, modération des avis, journal d'audit, administrateurs) par des RPC sécurisées.
-- Chaque décision écrit dans platform_audit_logs.
--
-- Limite connue : le masquage d'un avis est enregistré, mais l'affichage public de marketplace_salon_detail
-- n'est pas encore modifié (cette fonction diffère entre le dépôt et la production, voir docs/implementation).

-- 1. Colonnes ----------------------------------------------------------------------------------
alter table public.salons
  add column if not exists platform_status text not null default 'active'
    check (platform_status in ('active', 'suspended'));
alter table public.salons add column if not exists platform_status_reason text;

alter table public.reviews add column if not exists platform_hidden boolean not null default false;
alter table public.reviews add column if not exists platform_hidden_reason text;

-- 2. Un salon suspendu n'est jamais publié (garde-fou serveur, quel que soit l'appelant) -----------
create or replace function private.enforce_salon_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.platform_status = 'suspended' then
    new.is_published := false;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_salon_suspension() from public, anon, authenticated;

drop trigger if exists salons_enforce_suspension on public.salons;
create trigger salons_enforce_suspension
  before insert or update of is_published, platform_status on public.salons
  for each row execute function private.enforce_salon_suspension();

-- 3. Liste des salons pour l'administration ----------------------------------------------------
create or replace function public.platform_list_salons()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x.row order by x.sort_name), '[]'::jsonb) into v_result
  from (
    select
      s.name as sort_name,
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'organization_name', o.name,
        'city', s.city,
        'commune', s.commune,
        'is_published', s.is_published,
        'is_verified', s.is_verified,
        'platform_status', s.platform_status,
        'platform_status_reason', s.platform_status_reason,
        'publication_date', s.publication_date,
        'plan_id', sub.plan_id,
        'plan_name', p.name,
        'price_at_subscription', sub.price_at_subscription,
        'billing_period', sub.billing_period,
        'subscription_status', sub.status,
        'current_period_end', sub.current_period_end
      ) as row
    from public.salons s
    join public.organizations o on o.id = s.organization_id
    left join public.saas_subscriptions sub on sub.salon_id = s.id and sub.status in ('active', 'trialing')
    left join public.saas_plans p on p.id = sub.plan_id
  ) x;

  return v_result;
end;
$$;

-- 4. Décisions sur un salon ---------------------------------------------------------------------
create or replace function public.platform_set_salon_status(
  p_salon_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon public.salons%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Statut invalide.' using errcode = '22023';
  end if;
  if p_status = 'suspended' and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'Le motif de suspension est obligatoire.' using errcode = '22023';
  end if;

  select * into v_salon from public.salons where id = p_salon_id for update;
  if v_salon.id is null then
    raise exception 'Salon introuvable.' using errcode = '02000';
  end if;

  update public.salons
  set platform_status = p_status,
      platform_status_reason = case when p_status = 'suspended' then v_reason else null end
  where id = p_salon_id
  returning * into v_salon;

  perform private.write_platform_audit(
    case when p_status = 'suspended' then 'salon.suspended' else 'salon.reactivated' end,
    'salon', p_salon_id::text,
    jsonb_build_object('name', v_salon.name, 'reason', v_reason)
  );

  return jsonb_build_object('id', v_salon.id, 'platform_status', v_salon.platform_status, 'is_published', v_salon.is_published);
end;
$$;

create or replace function public.platform_set_salon_verification(p_salon_id uuid, p_verified boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon public.salons%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  update public.salons set is_verified = p_verified
  where id = p_salon_id
  returning * into v_salon;
  if v_salon.id is null then
    raise exception 'Salon introuvable.' using errcode = '02000';
  end if;

  perform private.write_platform_audit(
    case when p_verified then 'salon.verified' else 'salon.unverified' end,
    'salon', p_salon_id::text,
    jsonb_build_object('name', v_salon.name)
  );

  return jsonb_build_object('id', v_salon.id, 'is_verified', v_salon.is_verified);
end;
$$;

create or replace function public.platform_set_salon_publication(p_salon_id uuid, p_published boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_salon public.salons%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select * into v_salon from public.salons where id = p_salon_id for update;
  if v_salon.id is null then
    raise exception 'Salon introuvable.' using errcode = '02000';
  end if;
  if p_published and v_salon.platform_status = 'suspended' then
    raise exception 'Salon suspendu : réactivez-le avant de le publier.' using errcode = '22023';
  end if;

  update public.salons set is_published = p_published, publication_date = case when p_published then coalesce(publication_date, now()) else publication_date end
  where id = p_salon_id
  returning * into v_salon;

  perform private.write_platform_audit(
    case when p_published then 'salon.published' else 'salon.unpublished' end,
    'salon', p_salon_id::text,
    jsonb_build_object('name', v_salon.name)
  );

  return jsonb_build_object('id', v_salon.id, 'is_published', v_salon.is_published);
end;
$$;

-- Attribution d'une formule par l'administrateur : validation administrative explicite (motif obligatoire).
create or replace function public.platform_assign_salon_plan(
  p_salon_id uuid,
  p_plan_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.saas_plans%rowtype;
  v_salon public.salons%rowtype;
  v_subscription public.saas_subscriptions%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'Le motif de validation administrative est obligatoire.' using errcode = '22023';
  end if;

  select * into v_salon from public.salons where id = p_salon_id for update;
  if v_salon.id is null then
    raise exception 'Salon introuvable.' using errcode = '02000';
  end if;

  select * into v_plan from public.saas_plans where id = p_plan_id and is_active = true;
  if v_plan.id is null then
    raise exception 'Ce forfait n’existe pas ou n’est pas actif.' using errcode = '22023';
  end if;

  update public.saas_subscriptions
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where salon_id = p_salon_id and status in ('active', 'trialing', 'pending_payment');

  insert into public.saas_subscriptions (
    salon_id, plan_id, status, price_at_subscription, billing_period, features_snapshot, started_at, current_period_end
  )
  values (
    p_salon_id, v_plan.id, 'active', v_plan.price_xof, v_plan.billing_period, v_plan.features, now(),
    now() + private.saas_billing_interval(v_plan.billing_period)
  )
  returning * into v_subscription;

  update public.salons set subscription_plan_id = v_plan.id where id = p_salon_id;

  perform private.write_platform_audit(
    'subscription.assigned_by_admin', 'salon', p_salon_id::text,
    jsonb_build_object(
      'name', v_salon.name, 'plan_id', v_plan.id, 'amount_xof', v_plan.price_xof,
      'billing_period', v_plan.billing_period, 'reason', v_reason
    )
  );

  return jsonb_build_object(
    'id', v_subscription.id,
    'plan_id', v_subscription.plan_id,
    'status', v_subscription.status,
    'price_at_subscription', v_subscription.price_at_subscription,
    'current_period_end', v_subscription.current_period_end
  );
end;
$$;

-- 5. Avis : liste et masquage plateforme --------------------------------------------------------
create or replace function public.platform_list_reviews()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.created_at desc), '[]'::jsonb) into v_result
  from (
    select
      rv.id,
      rv.salon_id,
      s.name as salon_name,
      rv.author,
      rv.rating,
      rv.comment,
      rv.verified,
      rv.created_at,
      rv.platform_hidden,
      rv.platform_hidden_reason
    from public.reviews rv
    join public.salons s on s.id = rv.salon_id
    order by rv.created_at desc
    limit 500
  ) r;

  return v_result;
end;
$$;

create or replace function public.platform_set_review_hidden(
  p_review_id uuid,
  p_hidden boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;
  if p_hidden and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'Le motif de masquage est obligatoire.' using errcode = '22023';
  end if;

  update public.reviews
  set platform_hidden = p_hidden,
      platform_hidden_reason = case when p_hidden then v_reason else null end
  where id = p_review_id
  returning * into v_review;
  if v_review.id is null then
    raise exception 'Avis introuvable.' using errcode = '02000';
  end if;

  perform private.write_platform_audit(
    case when p_hidden then 'review.hidden' else 'review.restored' end,
    'review', p_review_id::text,
    jsonb_build_object('salon_id', v_review.salon_id, 'reason', v_reason)
  );

  return jsonb_build_object('id', v_review.id, 'platform_hidden', v_review.platform_hidden);
end;
$$;

-- 6. Journal d'audit (lecture) --------------------------------------------------------------------
create or replace function public.platform_list_audit_logs(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(l)::jsonb order by l.created_at desc), '[]'::jsonb) into v_result
  from (
    select
      al.id,
      al.action,
      al.target_type,
      al.target_id,
      al.details,
      al.created_at,
      u.email as actor_email
    from public.platform_audit_logs al
    left join auth.users u on u.id = al.actor_user_id
    order by al.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) l;

  return v_result;
end;
$$;

-- 7. Administrateurs de la plateforme ----------------------------------------------------------------
-- Adresse unique autorisée au rôle super_admin (règle produit).
create or replace function public.platform_list_admins()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(a)::jsonb order by a.created_at), '[]'::jsonb) into v_result
  from (
    select pa.user_id, pa.role, pa.created_at, u.email
    from public.platform_admins pa
    left join auth.users u on u.id = pa.user_id
  ) a;

  return v_result;
end;
$$;

create or replace function public.platform_grant_admin(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;
  if p_role not in ('super_admin', 'support_lead') then
    raise exception 'Rôle invalide.' using errcode = '22023';
  end if;
  if p_role = 'super_admin' and v_email <> 'dominiquek051@gmail.com' then
    raise exception 'Le rôle super administrateur est réservé à l’adresse autorisée.' using errcode = '42501';
  end if;

  select id into v_user_id from auth.users where lower(email) = v_email;
  if v_user_id is null then
    raise exception 'Aucun compte ne correspond à cette adresse.' using errcode = '02000';
  end if;

  insert into public.platform_admins (user_id, role)
  values (v_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;

  perform private.write_platform_audit(
    'platform_admin.granted', 'platform_admin', v_user_id::text,
    jsonb_build_object('email', v_email, 'role', p_role)
  );

  return jsonb_build_object('user_id', v_user_id, 'role', p_role);
end;
$$;

create or replace function public.platform_revoke_admin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_super_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas retirer votre propre accès.' using errcode = '22023';
  end if;

  select role into v_role from public.platform_admins where user_id = p_user_id;
  if v_role is null then
    raise exception 'Cet administrateur n’existe pas.' using errcode = '02000';
  end if;

  if v_role = 'super_admin' then
    select count(*) into v_super_count from public.platform_admins where role = 'super_admin';
    if v_super_count <= 1 then
      raise exception 'Impossible de retirer le dernier super administrateur.' using errcode = '22023';
    end if;
  end if;

  delete from public.platform_admins where user_id = p_user_id;

  perform private.write_platform_audit(
    'platform_admin.revoked', 'platform_admin', p_user_id::text,
    jsonb_build_object('role', v_role)
  );

  return jsonb_build_object('user_id', p_user_id, 'revoked', true);
end;
$$;

-- 8. Privilèges : exécution réservée aux utilisateurs authentifiés (contrôle de rôle dans chaque corps)
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.platform_list_salons()',
    'public.platform_set_salon_status(uuid, text, text)',
    'public.platform_set_salon_verification(uuid, boolean)',
    'public.platform_set_salon_publication(uuid, boolean)',
    'public.platform_assign_salon_plan(uuid, text, text)',
    'public.platform_list_reviews()',
    'public.platform_set_review_hidden(uuid, boolean, text)',
    'public.platform_list_audit_logs(integer)',
    'public.platform_list_admins()',
    'public.platform_grant_admin(text, text)',
    'public.platform_revoke_admin(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
