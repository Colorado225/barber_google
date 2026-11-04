-- Supabase is the canonical authentication and application-data platform.
-- All business data is tenant-scoped and protected by RLS.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  isPublishedOnMarketplace boolean not null default false,
  nextAvailableSlot timestamptz,
  unique (organization_id, id)
);
create index salons_organization_idx on public.salons (organization_id);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  timezone text not null default 'Africa/Abidjan',
  created_at timestamptz not null default now(),
  unique (salon_id, id)
);
create index branches_salon_idx on public.branches (salon_id);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'receptionist', 'barber', 'cashier', 'accountant')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (salon_id, user_id),
  unique (salon_id, id)
);
create index memberships_user_salon_idx on public.memberships (user_id, salon_id) where status = 'active';

create table public.branch_memberships (
  salon_id uuid not null,
  branch_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (branch_id, membership_id),
  foreign key (salon_id, branch_id) references public.branches(salon_id, id) on delete cascade,
  foreign key (salon_id, membership_id) references public.memberships(salon_id, id) on delete cascade
);
create index branch_memberships_member_idx on public.branch_memberships (membership_id, branch_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('coupe', 'barbe', 'tresses', 'soins', 'coloration', 'visage', 'combo')),
  description text not null default '',
  price bigint not null check (price > 0),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  prep_minutes integer not null default 0 check (prep_minutes between 0 and 120),
  popular boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, id)
);
create index services_active_idx on public.services (salon_id, name) where is_active;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text not null check (char_length(btrim(phone)) between 3 and 40),
  email text,
  segment text not null default 'new' check (segment in ('new', 'active', 'loyal', 'vip', 'inactive', 'to_reactivate')),
  favorite_service text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, id),
  check (email is null or email = '' or (email = lower(btrim(email)) and email ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'))
);
create index clients_salon_name_idx on public.clients (salon_id, name);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  branch_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  role text not null check (role in ('master_barber', 'barber', 'colorist', 'stylist', 'manager')),
  phone text not null default '',
  email text,
  specialties text[] not null default '{}',
  commission_rate integer not null default 0 check (commission_rate between 0 and 100),
  is_available boolean not null default true,
  is_active boolean not null default true,
  service_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, id),
  foreign key (salon_id, branch_id) references public.branches(salon_id, id) on delete restrict
);
create index staff_salon_idx on public.staff (salon_id, name);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  branch_id uuid not null,
  client_id uuid,
  staff_id uuid,
  service_id uuid,
  client_name text not null check (char_length(btrim(client_name)) between 1 and 120),
  client_phone text not null default '',
  service_name text not null check (char_length(btrim(service_name)) between 1 and 120),
  staff_name text not null default '',
  amount bigint not null check (amount >= 0),
  currency text not null default 'XOF' check (currency ~ '^[A-Z]{3}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposit_paid', 'paid', 'refunded')),
  source text not null check (source in ('marketplace', 'direct', 'whatsapp', 'phone')),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, id),
  check (ends_at > starts_at),
  foreign key (salon_id, branch_id) references public.branches(salon_id, id) on delete restrict,
  foreign key (salon_id, client_id) references public.clients(salon_id, id) on delete restrict,
  foreign key (salon_id, staff_id) references public.staff(salon_id, id) on delete restrict,
  foreign key (salon_id, service_id) references public.services(salon_id, id) on delete restrict
);
create index appointments_salon_time_idx on public.appointments (salon_id, starts_at);
create index appointments_staff_time_idx on public.appointments (salon_id, staff_id, starts_at);
create index appointments_client_idx on public.appointments (salon_id, client_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  branch_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null check (category in ('rent', 'electricity', 'water', 'salaries', 'products', 'maintenance', 'marketing', 'other')),
  amount bigint not null check (amount > 0),
  currency text not null default 'XOF' check (currency ~ '^[A-Z]{3}$'),
  spent_on date not null,
  notes text not null default '',
  receipt_ref text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (salon_id, branch_id) references public.branches(salon_id, id) on delete restrict
);
create index expenses_salon_date_idx on public.expenses (salon_id, spent_on desc);

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('shampoing', 'gel_cire', 'huile_barbe', 'lames', 'soin', 'accessoires')),
  quantity integer not null default 0 check (quantity between 0 and 1000000),
  min_threshold integer not null default 0 check (min_threshold between 0 and 1000000),
  unit_cost bigint not null default 0 check (unit_cost >= 0),
  supplier text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, id)
);
create index stock_items_salon_idx on public.stock_items (salon_id, name);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '',
  points_cost integer not null check (points_cost > 0),
  category text not null check (category in ('free_service', 'discount', 'product', 'vip_upgrade')),
  discount_percentage integer check (discount_percentage between 1 and 100),
  free_service_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (salon_id, id)
);
create index rewards_salon_idx on public.rewards (salon_id, name);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  client_id uuid,
  author text not null check (char_length(btrim(author)) between 1 and 120),
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 1 and 1000),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (salon_id, client_id) references public.clients(salon_id, id) on delete restrict
);
create index reviews_salon_created_idx on public.reviews (salon_id, created_at desc);

create table public.salon_settings (
  salon_id uuid primary key references public.salons(id) on delete restrict,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.onboarding_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_verified boolean not null default false,
  salon_created boolean not null default false,
  setup_completed boolean not null default false,
  current_step text not null default 'email_verification'
    check (current_step in ('email_verification', 'salon_creation', 'setup', 'completed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create function private.initialize_user_onboarding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.onboarding_state(user_id, email_verified, current_step)
    values (
      new.id,
      new.email_confirmed_at is not null,
      case when new.email_confirmed_at is not null then 'salon_creation' else 'email_verification' end
    )
    on conflict (user_id) do nothing;
  return new;
end
$$;

create trigger initialize_user_onboarding
  after insert on auth.users
  for each row execute function private.initialize_user_onboarding();

create function private.sync_user_email_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.onboarding_state(user_id, email_verified, current_step)
      values (new.id, true, 'salon_creation')
      on conflict (user_id) do update
        set email_verified = true,
            current_step = case
              when public.onboarding_state.salon_created then public.onboarding_state.current_step
              else 'salon_creation'
            end,
            updated_at = now();
  end if;
  return new;
end
$$;

create trigger sync_user_email_verification
  after update of email_confirmed_at on auth.users
  for each row execute function private.sync_user_email_verification();

create function private.has_salon_permission(p_salon_id uuid, p_permission text)
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
      and case p_permission
        when 'dashboard.read' then true
        when 'services.read' then true
        when 'staff.read' then true
        when 'clients.read' then true
        when 'clients.write' then m.role in ('owner', 'manager', 'receptionist')
        when 'appointments.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier')
        when 'appointments.write' then m.role in ('owner', 'manager', 'receptionist')
        when 'catalog.write' then m.role in ('owner', 'manager')
        when 'team.write' then m.role in ('owner', 'manager')
        when 'expenses.read' then m.role in ('owner', 'manager', 'accountant')
        when 'expenses.manage' then m.role in ('owner', 'manager')
        when 'stock.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier')
        when 'stock.write' then m.role in ('owner', 'manager')
        when 'loyalty.read' then true
        when 'loyalty.write' then m.role in ('owner', 'manager')
        when 'reviews.read' then true
        when 'members.read' then m.role in ('owner', 'manager')
        when 'members.manage' then m.role = 'owner'
        when 'salon.read' then true
        when 'salon.update' then m.role = 'owner'
        when 'branch.create' then m.role in ('owner', 'manager')
        when 'branch.update' then m.role in ('owner', 'manager')
        else false
      end
  )
$$;
revoke all on function private.has_salon_permission(uuid, text) from public, anon;
grant execute on function private.has_salon_permission(uuid, text) to authenticated;

create function public.create_salon(p_organization_name text, p_salon_name text, p_branch_name text)
returns table (organization_id uuid, salon_id uuid, branch_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email_verified boolean;
  v_organization_id uuid;
  v_salon_id uuid;
  v_branch_id uuid;
  v_membership_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select u.email_confirmed_at is not null into v_email_verified
    from auth.users u where u.id = v_user_id;
  if not coalesce(v_email_verified, false) then
    raise exception 'Email verification required' using errcode = '42501';
  end if;
  if p_organization_name is null or char_length(btrim(p_organization_name)) not between 1 and 120
    or p_salon_name is null or char_length(btrim(p_salon_name)) not between 1 and 120
    or p_branch_name is null or char_length(btrim(p_branch_name)) not between 1 and 120 then
    raise exception 'Invalid salon details' using errcode = '22023';
  end if;

  insert into public.organizations(name) values (btrim(p_organization_name))
    returning id into v_organization_id;
  insert into public.salons(organization_id, name) values (v_organization_id, btrim(p_salon_name))
    returning id into v_salon_id;
  insert into public.branches(salon_id, name) values (v_salon_id, btrim(p_branch_name))
    returning id into v_branch_id;
  insert into public.memberships(salon_id, user_id, role)
    values (v_salon_id, v_user_id, 'owner')
    returning id into v_membership_id;
  insert into public.branch_memberships(salon_id, branch_id, membership_id)
    values (v_salon_id, v_branch_id, v_membership_id);
  insert into public.onboarding_state(user_id, email_verified, salon_created, current_step)
    values (v_user_id, v_email_verified, true, 'setup')
    on conflict (user_id) do update
      set email_verified = public.onboarding_state.email_verified or excluded.email_verified,
          salon_created = true,
          current_step = case
            when public.onboarding_state.setup_completed then public.onboarding_state.current_step
            else 'setup'
          end,
          updated_at = now();

  return query select v_organization_id, v_salon_id, v_branch_id;
end
$$;
revoke all on function public.create_salon(text, text, text) from public, anon;
grant execute on function public.create_salon(text, text, text) to authenticated;

create function public.assign_member_to_branch(p_salon_id uuid, p_branch_id uuid, p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_salon_permission(p_salon_id, 'members.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.branches b
    join public.memberships m on m.salon_id = b.salon_id
    where b.salon_id = p_salon_id and b.id = p_branch_id
      and m.id = p_membership_id and m.status = 'active'
  ) then
    raise exception 'Invalid branch membership' using errcode = '22023';
  end if;
  insert into public.branch_memberships(salon_id, branch_id, membership_id)
    values (p_salon_id, p_branch_id, p_membership_id)
    on conflict (branch_id, membership_id) do nothing;
end
$$;
revoke all on function public.assign_member_to_branch(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_member_to_branch(uuid, uuid, uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.salons enable row level security;
alter table public.branches enable row level security;
alter table public.memberships enable row level security;
alter table public.branch_memberships enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.staff enable row level security;
alter table public.appointments enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_items enable row level security;
alter table public.rewards enable row level security;
alter table public.reviews enable row level security;
alter table public.salon_settings enable row level security;
alter table public.onboarding_state enable row level security;

create policy organizations_read_member on public.organizations for select to authenticated
  using (exists (
    select 1 from public.salons s
    where s.organization_id = organizations.id
      and private.has_salon_permission(s.id, 'salon.read')
  ));
create policy salons_read_member on public.salons for select to authenticated
  using (private.has_salon_permission(id, 'salon.read'));
create policy salons_update_owner on public.salons for update to authenticated
  using (private.has_salon_permission(id, 'salon.update'))
  with check (private.has_salon_permission(id, 'salon.update'));
create policy branches_read_member on public.branches for select to authenticated
  using (private.has_salon_permission(salon_id, 'salon.read'));
create policy branches_insert_manager on public.branches for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'branch.create'));
create policy branches_update_manager on public.branches for update to authenticated
  using (private.has_salon_permission(salon_id, 'branch.update'))
  with check (private.has_salon_permission(salon_id, 'branch.update'));
create policy memberships_read_member on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_salon_permission(salon_id, 'members.read')
  );
create policy branch_memberships_read_self_or_manager on public.branch_memberships for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.id = branch_memberships.membership_id
        and m.salon_id = branch_memberships.salon_id
        and (m.user_id = (select auth.uid()) or private.has_salon_permission(m.salon_id, 'members.read'))
    )
  );
create policy services_read_member on public.services for select to authenticated
  using (private.has_salon_permission(salon_id, 'services.read'));
create policy services_insert_manager on public.services for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'catalog.write'));
create policy services_update_manager on public.services for update to authenticated
  using (private.has_salon_permission(salon_id, 'catalog.write'))
  with check (private.has_salon_permission(salon_id, 'catalog.write'));
create policy clients_read_member on public.clients for select to authenticated
  using (private.has_salon_permission(salon_id, 'clients.read'));
create policy clients_insert_staff on public.clients for insert to authenticated
  with check (
    private.has_salon_permission(salon_id, 'clients.write')
    and (user_id is null or user_id = (select auth.uid()))
  );
create policy clients_update_staff on public.clients for update to authenticated
  using (private.has_salon_permission(salon_id, 'clients.write'))
  with check (
    private.has_salon_permission(salon_id, 'clients.write')
    and (user_id is null or user_id = (select auth.uid()))
  );
create policy clients_delete_staff on public.clients for delete to authenticated
  using (private.has_salon_permission(salon_id, 'clients.write'));
create policy staff_read_member on public.staff for select to authenticated
  using (private.has_salon_permission(salon_id, 'staff.read'));
create policy staff_insert_manager on public.staff for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'team.write'));
create policy staff_update_manager on public.staff for update to authenticated
  using (private.has_salon_permission(salon_id, 'team.write'))
  with check (private.has_salon_permission(salon_id, 'team.write'));
create policy staff_delete_manager on public.staff for delete to authenticated
  using (private.has_salon_permission(salon_id, 'team.write'));
create policy appointments_read_member on public.appointments for select to authenticated
  using (private.has_salon_permission(salon_id, 'appointments.read'));
create policy expenses_read_member on public.expenses for select to authenticated
  using (private.has_salon_permission(salon_id, 'expenses.read'));
create policy expenses_insert_manager on public.expenses for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'expenses.manage'));
create policy expenses_update_manager on public.expenses for update to authenticated
  using (private.has_salon_permission(salon_id, 'expenses.manage'))
  with check (private.has_salon_permission(salon_id, 'expenses.manage'));
create policy expenses_delete_manager on public.expenses for delete to authenticated
  using (private.has_salon_permission(salon_id, 'expenses.manage'));
create policy stock_items_read_member on public.stock_items for select to authenticated
  using (private.has_salon_permission(salon_id, 'stock.read'));
create policy stock_items_insert_manager on public.stock_items for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'stock.write'));
create policy stock_items_update_manager on public.stock_items for update to authenticated
  using (private.has_salon_permission(salon_id, 'stock.write'))
  with check (private.has_salon_permission(salon_id, 'stock.write'));
create policy stock_items_delete_manager on public.stock_items for delete to authenticated
  using (private.has_salon_permission(salon_id, 'stock.write'));
create policy rewards_read_member on public.rewards for select to authenticated
  using (private.has_salon_permission(salon_id, 'loyalty.read'));
create policy rewards_insert_manager on public.rewards for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'loyalty.write'));
create policy rewards_update_manager on public.rewards for update to authenticated
  using (private.has_salon_permission(salon_id, 'loyalty.write'))
  with check (private.has_salon_permission(salon_id, 'loyalty.write'));
create policy rewards_delete_manager on public.rewards for delete to authenticated
  using (private.has_salon_permission(salon_id, 'loyalty.write'));
create policy reviews_read_member on public.reviews for select to authenticated
  using (private.has_salon_permission(salon_id, 'reviews.read'));
create policy salon_settings_read_member on public.salon_settings for select to authenticated
  using (private.has_salon_permission(salon_id, 'salon.read'));
create policy salon_settings_insert_owner on public.salon_settings for insert to authenticated
  with check (private.has_salon_permission(salon_id, 'salon.update'));
create policy salon_settings_update_owner on public.salon_settings for update to authenticated
  using (private.has_salon_permission(salon_id, 'salon.update'))
  with check (private.has_salon_permission(salon_id, 'salon.update'));
create policy onboarding_state_read_self on public.onboarding_state for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.organizations, public.salons, public.branches, public.memberships,
  public.branch_memberships, public.services, public.clients, public.staff, public.appointments, public.expenses,
  public.stock_items, public.rewards, public.reviews, public.salon_settings,
  public.onboarding_state from anon, authenticated;
grant select on public.organizations, public.salons, public.branches, public.memberships,
  public.branch_memberships, public.services, public.clients, public.staff, public.appointments, public.expenses,
  public.stock_items, public.rewards, public.reviews, public.salon_settings,
  public.onboarding_state to authenticated;
grant update (name) on public.salons to authenticated;
grant insert (salon_id, name, timezone), update (name, timezone) on public.branches to authenticated;
grant insert (salon_id, name, category, description, price, duration_minutes, prep_minutes, popular, is_active),
  update (name, category, description, price, duration_minutes, prep_minutes, popular, is_active)
  on public.services to authenticated;
grant insert (salon_id, user_id, name, phone, email, segment, favorite_service, notes),
  update (user_id, name, phone, email, segment, favorite_service, notes), delete
  on public.clients to authenticated;
grant insert (salon_id, user_id, branch_id, name, role, phone, email, specialties, commission_rate, is_available, is_active, service_ids),
  update (user_id, branch_id, name, role, phone, email, specialties, commission_rate, is_available, is_active, service_ids), delete
  on public.staff to authenticated;
grant insert (salon_id, branch_id, title, category, amount, currency, spent_on, notes, receipt_ref, created_by),
  update (branch_id, title, category, amount, currency, spent_on, notes, receipt_ref), delete
  on public.expenses to authenticated;
grant insert (salon_id, name, category, quantity, min_threshold, unit_cost, supplier),
  update (name, category, quantity, min_threshold, unit_cost, supplier), delete
  on public.stock_items to authenticated;
grant insert (salon_id, name, description, points_cost, category, discount_percentage, free_service_name, is_active),
  update (name, description, points_cost, category, discount_percentage, free_service_name, is_active), delete
  on public.rewards to authenticated;
grant insert (salon_id, settings), update (settings) on public.salon_settings to authenticated;
