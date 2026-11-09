-- Migration 20261110090000 : vérification des abonnements SaaS (Lot 1, P0).
--
-- Objectifs :
--  1. Une souscription ne s'active jamais sans paiement validé par un super administrateur
--     (validation manuelle, « fallback » prévu par le cahier des charges ; l'intégration d'un
--     fournisseur de paiement reste une décision à prendre).
--  2. Le montant est calculé côté serveur (price_at_subscription), jamais fourni par le client.
--  3. Période annuelle = 12 mois (et non 30 jours).
--  4. Toute décision SuperAdmin laisse une trace dans platform_audit_logs.
--  5. Quotas de personnel (staff actifs) et d'agences appliqués côté serveur selon le forfait actif.
--  6. Révocation d'EXECUTE pour le rôle anon sur les RPC d'administration et d'abonnement.

-- 1. Statut « en attente de paiement » ----------------------------------------------------------
alter table public.saas_subscriptions drop constraint if exists saas_subscriptions_status_check;
alter table public.saas_subscriptions
  add constraint saas_subscriptions_status_check
  check (status in ('pending_payment', 'trialing', 'active', 'past_due', 'cancelled'));

-- Un seul abonnement actif (ou en essai) par salon, une seule demande en attente par salon.
create unique index if not exists saas_subscriptions_one_live_idx
  on public.saas_subscriptions (salon_id)
  where status in ('active', 'trialing');
create unique index if not exists saas_subscriptions_one_pending_idx
  on public.saas_subscriptions (salon_id)
  where status = 'pending_payment';

-- 2. Journal d'audit des décisions de la plateforme ---------------------------------------------
create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(btrim(action)) between 1 and 120),
  target_type text not null check (char_length(btrim(target_type)) between 1 and 60),
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_logs_created_idx on public.platform_audit_logs (created_at desc);

alter table public.platform_audit_logs enable row level security;
revoke all on public.platform_audit_logs from public, anon, authenticated;
grant select on public.platform_audit_logs to authenticated;
drop policy if exists platform_audit_logs_superadmin_read on public.platform_audit_logs;
create policy platform_audit_logs_superadmin_read on public.platform_audit_logs
  for select to authenticated
  using (public.is_platform_superadmin());

-- 3. Paiements déclarés par le propriétaire, validés (ou rejetés) par le super administrateur -----
create table if not exists public.saas_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.saas_subscriptions(id) on delete restrict,
  salon_id uuid not null references public.salons(id) on delete cascade,
  amount_xof bigint not null check (amount_xof > 0),
  method text not null check (method in ('mobile_money', 'bank_transfer', 'cash', 'other')),
  reference text not null check (char_length(btrim(reference)) between 3 and 120),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  declared_by uuid not null references auth.users(id) on delete restrict,
  declared_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  constraint saas_subscription_payments_decision_check
    check (status = 'pending' or decided_at is not null)
);
create index if not exists saas_subscription_payments_salon_idx
  on public.saas_subscription_payments (salon_id, status);
create unique index if not exists saas_subscription_payments_one_pending_idx
  on public.saas_subscription_payments (subscription_id)
  where status = 'pending';

alter table public.saas_subscription_payments enable row level security;
revoke all on public.saas_subscription_payments from public, anon, authenticated;
grant select on public.saas_subscription_payments to authenticated;
drop policy if exists saas_subscription_payments_read on public.saas_subscription_payments;
create policy saas_subscription_payments_read on public.saas_subscription_payments
  for select to authenticated
  using (
    public.is_platform_superadmin()
    or private.has_salon_permission(salon_id, 'subscriptions.read')
  );

-- 4. Helpers ------------------------------------------------------------------------------------
create or replace function private.saas_billing_interval(p_billing_period text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case when p_billing_period = 'yearly' then interval '12 months' else interval '1 month' end
$$;
revoke all on function private.saas_billing_interval(text) from public, anon, authenticated;

create or replace function private.is_salon_owner(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.salon_id = p_salon_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'owner'
  )
$$;
revoke all on function private.is_salon_owner(uuid) from public, anon;
grant execute on function private.is_salon_owner(uuid) to authenticated;

create or replace function private.write_platform_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.platform_audit_logs (actor_user_id, action, target_type, target_id, details)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb))
$$;
revoke all on function private.write_platform_audit(text, text, text, jsonb) from public, anon, authenticated;

-- 5. Souscription : crée une demande en attente, n'active plus rien ----------------------------
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

  if not private.is_salon_owner(p_salon_id) then
    raise exception 'Seul le propriétaire du salon peut souscrire un forfait.' using errcode = '42501';
  end if;

  select * into v_plan
  from public.saas_plans
  where id = p_plan_id and is_active = true;

  if v_plan.id is null then
    raise exception 'Ce forfait d''abonnement n''existe pas ou n''est plus actif.' using errcode = '22023';
  end if;

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
    p_salon_id, v_plan.id, 'pending_payment', v_plan.price_xof, v_plan.billing_period,
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

-- 6. Lecture de la demande en attente et de son dernier paiement déclaré ------------------------
create or replace function public.get_pending_salon_subscription(p_salon_id uuid)
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
    'plan_id', s.plan_id,
    'plan_name', p.name,
    'price_at_subscription', s.price_at_subscription,
    'billing_period', s.billing_period,
    'status', s.status,
    'created_at', s.started_at,
    'payment', (
      select jsonb_build_object(
        'id', sp.id,
        'method', sp.method,
        'reference', sp.reference,
        'status', sp.status,
        'declared_at', sp.declared_at,
        'decision_reason', sp.decision_reason
      )
      from public.saas_subscription_payments sp
      where sp.subscription_id = s.id
      order by sp.declared_at desc
      limit 1
    )
  ) into v_result
  from public.saas_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  where s.salon_id = p_salon_id and s.status = 'pending_payment'
  limit 1;

  return v_result;
end;
$$;

-- 7. Déclaration de paiement par le propriétaire : le montant vient du serveur ----------------
create or replace function public.declare_saas_payment(
  p_salon_id uuid,
  p_method text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_subscription public.saas_subscriptions%rowtype;
  v_payment public.saas_subscription_payments%rowtype;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not private.is_salon_owner(p_salon_id) then
    raise exception 'Seul le propriétaire du salon peut déclarer un paiement.' using errcode = '42501';
  end if;

  select * into v_subscription
  from public.saas_subscriptions
  where salon_id = p_salon_id and status = 'pending_payment'
  limit 1;

  if v_subscription.id is null then
    raise exception 'Aucune souscription en attente de paiement pour ce salon.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.saas_subscription_payments
    where subscription_id = v_subscription.id and status = 'pending'
  ) then
    raise exception 'Un paiement est déjà en attente de validation.' using errcode = '23505';
  end if;

  if btrim(coalesce(p_reference, '')) = '' then
    raise exception 'La référence de paiement est obligatoire.' using errcode = '22023';
  end if;

  insert into public.saas_subscription_payments (
    subscription_id, salon_id, amount_xof, method, reference, status, declared_by
  )
  values (
    v_subscription.id, p_salon_id, v_subscription.price_at_subscription,
    p_method, btrim(p_reference), 'pending', v_uid
  )
  returning * into v_payment;

  return jsonb_build_object(
    'id', v_payment.id,
    'subscription_id', v_payment.subscription_id,
    'amount_xof', v_payment.amount_xof,
    'method', v_payment.method,
    'reference', v_payment.reference,
    'status', v_payment.status,
    'declared_at', v_payment.declared_at
  );
end;
$$;

-- 8. File de validation SuperAdmin ----------------------------------------------------------------
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

-- 9. Décision SuperAdmin : confirmer (active l'abonnement) ou rejeter, avec trace d'audit -----
create or replace function public.review_saas_payment(
  p_payment_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_payment public.saas_subscription_payments%rowtype;
  v_subscription public.saas_subscriptions%rowtype;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not public.is_platform_superadmin() then
    raise exception 'Accès réservé au super administrateur' using errcode = '42501';
  end if;

  if p_decision not in ('confirm', 'reject') then
    raise exception 'Décision invalide.' using errcode = '22023';
  end if;

  select * into v_payment
  from public.saas_subscription_payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'Paiement introuvable.' using errcode = '02000';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Ce paiement a déjà été traité.' using errcode = '22023';
  end if;

  select * into v_subscription
  from public.saas_subscriptions
  where id = v_payment.subscription_id
  for update;

  if p_decision = 'reject' then
    if btrim(coalesce(p_reason, '')) = '' then
      raise exception 'Le motif du rejet est obligatoire.' using errcode = '22023';
    end if;

    update public.saas_subscription_payments
    set status = 'rejected', decided_by = v_uid, decided_at = now(), decision_reason = btrim(p_reason)
    where id = v_payment.id;

    update public.saas_subscriptions
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where id = v_subscription.id and status = 'pending_payment';

    perform private.write_platform_audit(
      'saas_payment.rejected', 'saas_subscription_payment', v_payment.id::text,
      jsonb_build_object('salon_id', v_payment.salon_id, 'amount_xof', v_payment.amount_xof, 'reason', btrim(p_reason))
    );
  else
    -- L'ancien abonnement actif est remplacé ; la nouvelle période commence à la validation.
    update public.saas_subscriptions
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where salon_id = v_payment.salon_id and status in ('active', 'trialing');

    update public.saas_subscriptions
    set status = 'active',
        started_at = now(),
        current_period_end = now() + private.saas_billing_interval(billing_period),
        updated_at = now()
    where id = v_subscription.id;

    update public.saas_subscription_payments
    set status = 'confirmed', decided_by = v_uid, decided_at = now()
    where id = v_payment.id;

    update public.salons
    set subscription_plan_id = v_subscription.plan_id
    where id = v_payment.salon_id;

    perform private.write_platform_audit(
      'saas_payment.confirmed', 'saas_subscription_payment', v_payment.id::text,
      jsonb_build_object(
        'salon_id', v_payment.salon_id,
        'plan_id', v_subscription.plan_id,
        'amount_xof', v_payment.amount_xof,
        'billing_period', v_subscription.billing_period
      )
    );
  end if;

  return jsonb_build_object(
    'id', v_payment.id,
    'decision', case when p_decision = 'confirm' then 'confirmed' else 'rejected' end,
    'subscription_id', v_subscription.id
  );
end;
$$;

-- 10. Quotas serveur : personnel actif et agences, selon le forfait actif du salon -------------
create or replace function private.active_plan_quota(p_salon_id uuid)
returns table (max_staff integer, max_branches integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.max_staff, p.max_branches
  from public.saas_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  where s.salon_id = p_salon_id and s.status in ('active', 'trialing')
  limit 1
$$;
revoke all on function private.active_plan_quota(uuid) from public, anon, authenticated;

create or replace function private.enforce_staff_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota record;
  v_count bigint;
begin
  if not (new.is_active) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active and old.salon_id = new.salon_id then
    return new;
  end if;

  select * into v_quota from private.active_plan_quota(new.salon_id);
  if v_quota.max_staff is null then
    return new;
  end if;

  select count(*) into v_count
  from public.staff
  where salon_id = new.salon_id and is_active = true and id <> new.id;

  if v_count + 1 > v_quota.max_staff then
    raise exception 'Quota de personnel atteint pour le forfait actif (%).', v_quota.max_staff
      using errcode = '53400';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_staff_quota() from public, anon, authenticated;

drop trigger if exists staff_enforce_plan_quota on public.staff;
create trigger staff_enforce_plan_quota
  before insert or update of is_active, salon_id on public.staff
  for each row execute function private.enforce_staff_quota();

create or replace function private.enforce_branch_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota record;
  v_count bigint;
begin
  select * into v_quota from private.active_plan_quota(new.salon_id);
  if v_quota.max_branches is null then
    return new;
  end if;

  select count(*) into v_count
  from public.branches
  where salon_id = new.salon_id;

  if v_count + 1 > v_quota.max_branches then
    raise exception 'Quota d''établissements atteint pour le forfait actif (%).', v_quota.max_branches
      using errcode = '53400';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_branch_quota() from public, anon, authenticated;

drop trigger if exists branches_enforce_plan_quota on public.branches;
create trigger branches_enforce_plan_quota
  before insert on public.branches
  for each row execute function private.enforce_branch_quota();

-- 11. Révocation d'EXECUTE pour anon (défense en profondeur : chaque corps vérifie déjà l'identité)
revoke all on function public.get_all_saas_plans() from public, anon;
revoke all on function public.get_platform_metrics() from public, anon;
revoke all on function public.get_salon_subscription(uuid) from public, anon;
revoke all on function public.save_saas_plan(text, text, text, bigint, text, text, jsonb, integer, integer, boolean, boolean, text, integer) from public, anon;
revoke all on function public.subscribe_salon_to_plan(uuid, text) from public, anon;

grant execute on function public.subscribe_salon_to_plan(uuid, text) to authenticated;
grant execute on function public.get_pending_salon_subscription(uuid) to authenticated;
grant execute on function public.declare_saas_payment(uuid, text, text) to authenticated;
grant execute on function public.list_saas_payments_for_review() to authenticated;
grant execute on function public.review_saas_payment(uuid, text, text) to authenticated;
revoke all on function public.get_pending_salon_subscription(uuid) from public, anon;
revoke all on function public.declare_saas_payment(uuid, text, text) from public, anon;
revoke all on function public.list_saas_payments_for_review() from public, anon;
revoke all on function public.review_saas_payment(uuid, text, text) from public, anon;
