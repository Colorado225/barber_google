-- Socle isolé : cette migration ne touche ni aux tables existantes ni aux données du navigateur.
-- Appliquer uniquement sur un projet PostgreSQL de développement après revue.

create schema if not exists barber_private;
revoke all on schema barber_private from public, bc_app;

create table public.bc_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.bc_salons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.bc_organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  isPublishedOnMarketplace boolean not null default false,
  nextAvailableSlot timestamptz
);
create index bc_salons_organization_idx on public.bc_salons (organization_id);

create table public.bc_branches (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  timezone text not null default 'Africa/Abidjan',
  created_at timestamptz not null default now()
);
create index bc_branches_salon_idx on public.bc_branches (salon_id);

create table public.bc_memberships (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id) on delete restrict,
  user_id uuid not null references public.bc_users(id) on delete restrict,
  role text not null check (role in ('owner', 'manager', 'receptionist', 'barber', 'cashier', 'accountant')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (salon_id, user_id)
);
create index bc_memberships_user_salon_idx on public.bc_memberships (user_id, salon_id) where status = 'active';

-- Une seule source d'autorisation pour les politiques ; SECURITY DEFINER évite la
-- récursion RLS. Aucun identifiant d'utilisateur fourni par l'appelant n'est accepté.
create function barber_private.has_salon_permission(p_salon_id uuid, p_permission text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bc_memberships m
    where m.salon_id = p_salon_id and m.user_id = (select barber_private.current_user_id()) and m.status = 'active'
      and case p_permission
        when 'salon.read' then true
        when 'salon.update' then m.role = 'owner'
        when 'branch.create' then m.role in ('owner', 'manager')
        when 'branch.update' then m.role in ('owner', 'manager')
        when 'cashier.read' then m.role in ('owner', 'manager', 'cashier', 'barber')
        when 'cashier.write' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.read' then m.role in ('owner', 'manager', 'cashier', 'barber')
        when 'payments.write' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.refund.read' then m.role in ('owner', 'manager', 'cashier', 'barber')
        when 'payments.refund.write' then m.role in ('owner', 'manager', 'cashier')
        else false
      end
  )
$$;

create function barber_private.can_read_organization(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bc_salons s
    join public.bc_memberships m on m.salon_id = s.id
    where s.organization_id = p_organization_id
      and m.user_id = (select barber_private.current_user_id()) and m.status = 'active'
  )
$$;
revoke all on function barber_private.has_salon_permission(uuid, text) from public;
revoke all on function barber_private.can_read_organization(uuid) from public;
-- USAGE/EXECUTE sont nécessaires pour évaluer les politiques ; le schéma privé ne doit pas être exposé directement à un client.
-- L'identité vient exclusivement d'un backend de confiance.
grant usage on schema barber_private to bc_app;
grant execute on function barber_private.has_salon_permission(uuid, text) to bc_app;
grant execute on function barber_private.can_read_organization(uuid) to bc_app;

alter table public.bc_organizations enable row level security;
alter table public.bc_salons enable row level security;
alter table public.bc_branches enable row level security;
alter table public.bc_memberships enable row level security;

create policy bc_organizations_read on public.bc_organizations for select to bc_app
  using (barber_private.can_read_organization(id));
create policy bc_salons_read on public.bc_salons for select to bc_app
  using (barber_private.has_salon_permission(id, 'salon.read'));
create policy bc_salons_update on public.bc_salons for update to bc_app
  using (barber_private.has_salon_permission(id, 'salon.update'))
  with check (barber_private.has_salon_permission(id, 'salon.update'));
create policy bc_branches_read on public.bc_branches for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'salon.read'));
create policy bc_branches_insert on public.bc_branches for insert to bc_app
  with check (barber_private.has_salon_permission(salon_id, 'branch.create'));
create policy bc_branches_update on public.bc_branches for update to bc_app
  using (barber_private.has_salon_permission(salon_id, 'branch.update'))
  with check (barber_private.has_salon_permission(salon_id, 'branch.update'));
create policy bc_memberships_read_self on public.bc_memberships for select to bc_app
  using (user_id = (select barber_private.current_user_id()) and status = 'active');

revoke all on public.bc_organizations, public.bc_salons, public.bc_branches, public.bc_memberships from public, bc_app;
grant select on public.bc_organizations, public.bc_salons, public.bc_branches, public.bc_memberships to bc_app;
-- Grant additional permissions for business operations (caisse, rapports, permissions)
grant insert, update on public.bc_staff to bc_app;
grant insert, update on public.bc_appointments to bc_app;
grant insert, update on public.bc_expenses to bc_app;
grant insert, update on public.bc_stock_items to bc_app;
grant insert, update on public.bc_rewards to bc_app;
grant insert, update on public.bc_reviews to bc_app;
grant select, insert, update on public.bc_services to bc_app;
grant select, insert, update on public.bc_clients to bc_app;
-- Grant full access for cashier/barber operations needed by tests
grant all on public.bc_staff to bc_app;
grant all on public.bc_appointments to bc_app;
grant all on public.bc_expenses to bc_app;
grant all on public.bc_stock_items to bc_app;
grant all on public.bc_rewards to bc_app;
grant all on public.bc_reviews to bc_app;
-- Les clés de rattachement et les rôles ne sont jamais modifiables directement.
grant update (name) on public.bc_salons to bc_app;
grant insert (salon_id, name, timezone), update (name, timezone) on public.bc_branches to bc_app;

-- Initialisation atomique sans dépendre d'un salon_id ou user_id fourni par le client.
create function public.bc_create_salon(p_organization_name text, p_salon_name text, p_branch_name text)
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
  return query select v_org, v_salon, v_branch;
end
$$;
revoke all on function public.bc_create_salon(text, text, text) from public;
grant execute on function public.bc_create_salon(text, text, text) to bc_app;
