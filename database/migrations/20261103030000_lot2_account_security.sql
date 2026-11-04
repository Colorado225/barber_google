-- LOT 2 — Authentification, autorisations et multi-tenant.
-- Étend le socle existant sans le remplacer :
--   * sessions : révocation, expiration glissante, suivi des appareils ;
--   * vérification e-mail et réinitialisation de mot de passe (jetons à usage
--     unique, stockés hachés) ;
--   * onboarding persistant par utilisateur ;
--   * audit des actions d'administration (rôles) ;
--   * permissions fines par salon (matrice complète) et fonctions de gestion
--     des memberships (invitation, changement de rôle, suspension).
--
-- Nb : bc_auth est le rôle SQL des données d'authentification, bc_app celui de
-- l'application soumise aux politiques RLS. Aucun mot de passe en clair.

-- ============================================================================
-- Sessions
-- ============================================================================
alter table public.bc_auth_sessions
  add column last_used_at timestamptz not null default now(),
  add column user_agent text,
  add column ip_hash text;
create index bc_auth_sessions_expiry_idx on public.bc_auth_sessions (expires_at);

-- ============================================================================
-- Jetons à usage unique (vérification e-mail, réinitialisation, invitation)
-- ============================================================================
create table public.bc_auth_tokens (
  token_hash text primary key check (char_length(token_hash) = 64),
  user_id uuid not null,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create trigger bc_auth_tokens_user_exists before insert on public.bc_auth_tokens
  for each row execute function barber_private.require_user_exists();
create index bc_auth_tokens_user_purpose_idx on public.bc_auth_tokens (user_id, purpose) where used_at is null;

alter table public.bc_auth_accounts
  add column email_verified_at timestamptz;

-- ============================================================================
-- Onboarding persistant (géré par bc_auth, lu via /api/me)
-- ============================================================================
create table public.bc_onboarding_state (
  user_id uuid primary key,
  email_verified boolean not null default false,
  salon_created boolean not null default false,
  setup_completed boolean not null default false,
  current_step text not null default 'email_verification'
    check (current_step in ('email_verification', 'salon_creation', 'setup', 'completed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Audit d'administration et journal de connexion
-- ============================================================================
create table public.bc_admin_audit (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.bc_salons(id) on delete set null,
  actor_id uuid not null references public.bc_users(id),
  action text not null check (char_length(action) between 1 and 80),
  target_user_id uuid references public.bc_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index bc_admin_audit_salon_idx on public.bc_admin_audit (salon_id, created_at desc);
create index bc_admin_audit_actor_idx on public.bc_admin_audit (actor_id, created_at desc);

-- ============================================================================
-- Droits d'accès (identité serveur uniquement)
-- ============================================================================
revoke all on public.bc_auth_tokens, public.bc_onboarding_state, public.bc_admin_audit from public, bc_app;
grant select, insert, update, delete on public.bc_auth_tokens to bc_auth;
grant select, update on public.bc_auth_accounts to bc_auth;
grant select, insert, update on public.bc_onboarding_state to bc_auth;
-- L'onboarding est entièrement géré par bc_auth ; aucune RLS sur cette table
-- (données non sensibles, accès indirect seulement via /api/me et la fonction
-- bc_onboarding_progress, toutes deux filtrées par l'identité serveur).
grant select on public.bc_users to bc_auth;
grant update (email_verified_at) on public.bc_auth_accounts to bc_auth;
grant update (last_used_at, expires_at), delete on public.bc_auth_sessions to bc_auth;
grant select (last_used_at, expires_at) on public.bc_auth_sessions to bc_auth;
grant insert on public.bc_admin_audit to bc_app;

alter table public.bc_admin_audit enable row level security;
-- Un propriétaire consulte l'audit de son salon.
create policy bc_admin_audit_read_owners on public.bc_admin_audit for select to bc_app
  using (salon_id is not null and barber_private.has_salon_permission(salon_id, 'salon.update'));

-- ============================================================================
-- Matrice de permissions complète (remplace la version précédente)
-- ============================================================================
create or replace function barber_private.has_salon_permission(p_salon_id uuid, p_permission text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bc_memberships m
    where m.salon_id = p_salon_id
      and m.user_id = (select barber_private.current_user_id())
      and m.status = 'active'
      and case p_permission
        -- Lecture de base
        when 'salon.read' then true
        when 'salon.update' then m.role = 'owner'
        -- Référentiel
        when 'catalog.write' then m.role in ('owner', 'manager')
        when 'team.write' then m.role in ('owner', 'manager')
        -- Clients
        when 'clients.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier', 'accountant')
        when 'clients.write' then m.role in ('owner', 'manager', 'receptionist')
        -- Rendez-vous
        when 'appointments.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier')
        when 'appointments.write' then m.role in ('owner', 'manager', 'receptionist')
        -- Caisse, paiements, stocks, dépenses, fidélité
        when 'finance.write' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.refund' then m.role in ('owner', 'manager')
        when 'stock.write' then m.role in ('owner', 'manager')
        when 'expenses.read' then m.role in ('owner', 'manager', 'accountant')
        when 'expenses.manage' then m.role in ('owner', 'manager')
        when 'loyalty.write' then m.role in ('owner', 'manager')
        -- Rapports, succursales
        when 'reports.read' then m.role in ('owner', 'manager', 'accountant')
        when 'branch.create' then m.role in ('owner', 'manager')
        when 'branch.update' then m.role in ('owner', 'manager')
        -- Administration du salon : jamais délégable et jamais un barber/caissier.
        when 'members.read' then m.role in ('owner', 'manager')
        when 'members.manage' then m.role = 'owner'
        when 'subscription.manage' then m.role = 'owner'
        -- Alias métier exposés au frontend (permissions lisibles côté UI).
        when 'dashboard.read' then true
        when 'services.read' then true
        when 'staff.read' then true
        when 'cash.open' then m.role in ('owner', 'manager', 'cashier')
        when 'cash.close' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.create' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.read' then m.role in ('owner', 'manager', 'cashier', 'accountant')
        when 'payments.refund' then m.role in ('owner', 'manager')
        when 'finance.write' then m.role in ('owner', 'manager', 'cashier')
        when 'inventory.read' then m.role in ('owner', 'manager', 'barber', 'cashier', 'accountant')
        when 'inventory.manage' then m.role in ('owner', 'manager')
        when 'loyalty.read' then m.role in ('owner', 'manager', 'receptionist', 'cashier')
        when 'loyalty.manage' then m.role in ('owner', 'manager')
        when 'subscriptions.read' then m.role = 'owner'
        else false
      end
  )
$$;
revoke all on function barber_private.has_salon_permission(uuid, text) from public;
grant execute on function barber_private.has_salon_permission(uuid, text) to bc_app;

-- ============================================================================
-- Permissions effectives d'un utilisateur sur un salon (utilisé par GET /api/me)
-- ============================================================================
create or replace function barber_private.salon_permissions(p_salon_id uuid)
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.permission order by p.permission), '{}')::text[]
  from (values
    ('dashboard.read'),
    ('appointments.read'), ('appointments.write'),
    ('clients.read'), ('clients.write'),
    ('services.read'), ('services.write'),
    ('staff.read'), ('staff.manage'),
    ('cash.open'), ('cash.close'), ('payments.create'), ('payments.read'), ('payments.refund'), ('finance.write'),
    ('inventory.read'), ('inventory.manage'),
    ('expenses.read'), ('expenses.manage'),
    ('loyalty.read'), ('loyalty.manage'),
    ('subscriptions.read'), ('subscriptions.manage'),
    ('members.read'), ('members.manage')
  ) as p(permission)
  where barber_private.has_salon_permission(p_salon_id, p.permission)
$$;
revoke all on function barber_private.salon_permissions(uuid) from public;
grant execute on function barber_private.salon_permissions(uuid) to bc_app;

-- ============================================================================
-- Lecture des membres d'un salon (owner/manager) sans exposer les autres salons
-- ============================================================================
create or replace function public.bc_list_salon_members(p_salon uuid)
returns table (membership_id uuid, user_id uuid, role text, status text, email text, display_name text, created_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'members.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, m.role, m.status, a.email, a.display_name, m.created_at
    from public.bc_memberships m
    left join public.bc_auth_accounts a on a.user_id = m.user_id
    where m.salon_id = p_salon
    order by m.created_at;
end $$;
revoke all on function public.bc_list_salon_members(uuid) from public;
grant execute on function public.bc_list_salon_members(uuid) to bc_app;

-- ============================================================================
-- Changement de rôle / suspension : réservé au propriétaire, audité.
-- Un membre ne peut jamais modifier son propre rôle ni élever un rôle au-delà
-- du sien ; il reste toujours au moins un propriétaire actif.
-- ============================================================================
create or replace function public.bc_set_member_role(p_salon uuid, p_membership uuid, p_role text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := barber_private.current_user_id();
  v_target public.bc_memberships%rowtype;
  v_owner_count integer;
begin
  if p_role not in ('owner', 'manager', 'receptionist', 'barber', 'cashier', 'accountant') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if not barber_private.has_salon_permission(p_salon, 'members.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into v_target from public.bc_memberships where id = p_membership and salon_id = p_salon for update;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
  -- Un utilisateur ne peut pas s'attribuer un rôle ni modifier le sien.
  if v_target.user_id = v_actor then
    raise exception 'Cannot change own role' using errcode = '42501';
  end if;
  -- Ne jamais supprimer le dernier propriétaire actif.
  if v_target.role = 'owner' and v_target.status = 'active' and p_role <> 'owner' then
    select count(*) into v_owner_count from public.bc_memberships
      where salon_id = p_salon and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then
      raise exception 'Last owner cannot be demoted' using errcode = '22023';
    end if;
  end if;
  update public.bc_memberships set role = p_role where id = p_membership;
  insert into public.bc_admin_audit(salon_id, actor_id, action, target_user_id, metadata)
  values (p_salon, v_actor, 'membership.role_change', v_target.user_id,
          jsonb_build_object('from', v_target.role, 'to', p_role, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
end $$;
revoke all on function public.bc_set_member_role(uuid, uuid, text, text) from public;
grant execute on function public.bc_set_member_role(uuid, uuid, text, text) to bc_app;

create or replace function public.bc_set_member_status(p_salon uuid, p_membership uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := barber_private.current_user_id();
  v_target public.bc_memberships%rowtype;
  v_owner_count integer;
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if not barber_private.has_salon_permission(p_salon, 'members.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into v_target from public.bc_memberships where id = p_membership and salon_id = p_salon for update;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
  if v_target.user_id = v_actor then
    raise exception 'Cannot change own status' using errcode = '42501';
  end if;
  if v_target.role = 'owner' and p_status = 'suspended' then
    select count(*) into v_owner_count from public.bc_memberships
      where salon_id = p_salon and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then
      raise exception 'Last owner cannot be suspended' using errcode = '22023';
    end if;
  end if;
  update public.bc_memberships set status = p_status where id = p_membership;
  insert into public.bc_admin_audit(salon_id, actor_id, action, target_user_id, metadata)
  values (p_salon, v_actor, 'membership.status_change', v_target.user_id,
          jsonb_build_object('from', v_target.status, 'to', p_status, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
end $$;
revoke all on function public.bc_set_member_status(uuid, uuid, text, text) from public;
grant execute on function public.bc_set_member_status(uuid, uuid, text, text) to bc_app;

-- ============================================================================
-- Onboarding : progression persistée côté serveur
-- ============================================================================
create or replace function public.bc_onboarding_progress(p_step text, p_salon_created boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := barber_private.current_user_id();
begin
  if p_step not in ('email_verification', 'salon_creation', 'setup', 'completed') then
    raise exception 'Invalid step' using errcode = '22023';
  end if;
  if v_user is not null then
    insert into public.bc_onboarding_state(user_id, current_step, salon_created, completed_at, updated_at)
    values (
      v_user,
      p_step,
      p_step = 'completed' or coalesce(p_salon_created, false),
      case when p_step = 'completed' then now() end,
      now()
    )
    on conflict (user_id) do update set
      current_step = excluded.current_step,
      salon_created = public.bc_onboarding_state.salon_created or excluded.salon_created,
      completed_at = coalesce(public.bc_onboarding_state.completed_at, excluded.completed_at),
      updated_at = now();
    if p_step = 'completed' then
      update public.bc_onboarding_state
         set setup_completed = true, current_step = 'completed', updated_at = now()
       where user_id = v_user;
    end if;
  end if;
end $$;
revoke all on function public.bc_onboarding_progress(text, boolean) from public;
grant execute on function public.bc_onboarding_progress(text, boolean) to bc_app;

-- Le propriétaire crée son salon ET valide l'étape d'onboarding dans la même transaction.
create or replace function public.bc_create_salon(p_organization_name text, p_salon_name text, p_branch_name text)
returns table (organization_id uuid, salon_id uuid, branch_id uuid)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := barber_private.current_user_id();
  v_org uuid;
  v_salon uuid;
  v_branch uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_organization_name is null or char_length(btrim(p_organization_name)) not between 1 and 120
     or p_salon_name is null or char_length(btrim(p_salon_name)) not between 1 and 120
     or p_branch_name is null or char_length(btrim(p_branch_name)) not between 1 and 120 then
    raise exception 'Invalid name' using errcode = '22023';
  end if;
  insert into public.bc_organizations(name) values (btrim(p_organization_name)) returning id into v_org;
  insert into public.bc_salons(organization_id, name) values (v_org, btrim(p_salon_name)) returning id into v_salon;
  insert into public.bc_branches(salon_id, name) values (v_salon, btrim(p_branch_name)) returning id into v_branch;
  insert into public.bc_memberships(salon_id, user_id, role) values (v_salon, v_user, 'owner');
  insert into public.bc_onboarding_state(user_id, current_step, salon_created)
  values (v_user, 'setup', true)
  on conflict (user_id) do update set salon_created = true, current_step = 'setup', updated_at = now();
  insert into public.bc_admin_audit(salon_id, actor_id, action, metadata)
  values (v_salon, v_user, 'salon.create', jsonb_build_object('organization', v_org));
  return query select v_org, v_salon, v_branch;
end
$$;
revoke all on function public.bc_create_salon(text, text, text) from public;
grant execute on function public.bc_create_salon(text, text, text) to bc_app;
