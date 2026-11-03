-- Ressources métier du salon (clients, prestations, équipe, dépenses, stocks,
-- fidélité, avis). Chaque table est isolée par salon via RLS et toutes les
-- écritures passent par des fonctions SECURITY DEFINER qui vérifient les droits.
-- Aucune écriture directe n'est accordée à bc_app.

create table public.bc_clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text not null check (char_length(btrim(phone)) between 3 and 40),
  email text check (email is null or char_length(email) <= 254),
  segment text not null default 'new' check (segment in ('new','active','loyal','vip','inactive','to_reactivate')),
  favorite_service text not null default '',
  notes text not null default '',
  total_spent bigint not null default 0 check (total_spent >= 0),
  visits_count integer not null default 0 check (visits_count >= 0),
  last_visit date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bc_clients_salon_idx on public.bc_clients (salon_id, name);

create table public.bc_services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('coupe','barbe','tresses','soins','coloration','visage','combo')),
  description text not null default '',
  price bigint not null check (price > 0),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  popular boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bc_services_salon_idx on public.bc_services (salon_id);

create table public.bc_staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  role text not null check (role in ('master_barber','barber','colorist','stylist','manager')),
  phone text not null default '',
  specialties text[] not null default '{}',
  commission_rate integer not null default 0 check (commission_rate between 0 and 100),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bc_staff_salon_idx on public.bc_staff (salon_id);

create table public.bc_expenses (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null check (category in ('rent','electricity','water','salaries','products','maintenance','marketing','other')),
  amount bigint not null check (amount > 0),
  spent_on date not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index bc_expenses_salon_idx on public.bc_expenses (salon_id, spent_on desc);

create table public.bc_stock_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('shampoing','gel_cire','huile_barbe','lames','soin','accessoires')),
  quantity integer not null default 0 check (quantity >= 0),
  min_threshold integer not null default 0 check (min_threshold >= 0),
  unit_cost bigint not null default 0 check (unit_cost >= 0),
  supplier text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bc_stock_salon_idx on public.bc_stock_items (salon_id);

create table public.bc_loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '',
  points_cost integer not null check (points_cost > 0),
  category text not null check (category in ('free_service','discount','product','vip_upgrade')),
  discount_percentage integer check (discount_percentage is null or (discount_percentage between 1 and 100)),
  free_service_name text,
  is_active boolean not null default true,
  times_redeemed integer not null default 0 check (times_redeemed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bc_rewards_salon_idx on public.bc_loyalty_rewards (salon_id);

create table public.bc_reviews (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.bc_salons(id),
  author text not null check (char_length(btrim(author)) between 1 and 120),
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 1 and 1000),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index bc_reviews_salon_idx on public.bc_reviews (salon_id, created_at desc);

-- Durcissement des droits : lecture seule par RLS, écriture via fonctions seulement.
alter table public.bc_clients enable row level security;
alter table public.bc_services enable row level security;
alter table public.bc_staff enable row level security;
alter table public.bc_expenses enable row level security;
alter table public.bc_stock_items enable row level security;
alter table public.bc_loyalty_rewards enable row level security;
alter table public.bc_reviews enable row level security;

revoke all on public.bc_clients, public.bc_services, public.bc_staff,
  public.bc_expenses, public.bc_stock_items, public.bc_loyalty_rewards,
  public.bc_reviews from public, bc_app;

grant select on public.bc_clients, public.bc_services, public.bc_staff,
  public.bc_expenses, public.bc_stock_items, public.bc_loyalty_rewards,
  public.bc_reviews to bc_app;

create policy bc_clients_read on public.bc_clients for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'clients.read'));
create policy bc_services_read on public.bc_services for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'salon.read'));
create policy bc_staff_read on public.bc_staff for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'salon.read'));
create policy bc_expenses_read on public.bc_expenses for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'reports.read'));
create policy bc_stock_read on public.bc_stock_items for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'salon.read'));
create policy bc_rewards_read on public.bc_loyalty_rewards for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'salon.read'));
create policy bc_reviews_read on public.bc_reviews for select to bc_app
  using (barber_private.has_salon_permission(salon_id, 'salon.read'));

-- Extension de la matrice de permissions aux nouveaux modules.
create or replace function barber_private.has_salon_permission(p_salon_id uuid, p_permission text)
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
        when 'catalog.write' then m.role in ('owner', 'manager')
        when 'team.write' then m.role in ('owner', 'manager')
        when 'clients.read' then m.role in ('owner', 'manager', 'receptionist', 'barber', 'cashier', 'accountant')
        when 'clients.write' then m.role in ('owner', 'manager', 'receptionist')
        when 'finance.write' then m.role in ('owner', 'manager', 'cashier')
        when 'stock.write' then m.role in ('owner', 'manager')
        when 'loyalty.write' then m.role in ('owner', 'manager')
        when 'reports.read' then m.role in ('owner', 'manager', 'accountant')
        when 'branch.create' then m.role in ('owner', 'manager')
        when 'branch.update' then m.role in ('owner', 'manager')
        else false
      end
  )
$$;
revoke all on function barber_private.has_salon_permission(uuid, text) from public;
grant execute on function barber_private.has_salon_permission(uuid, text) to bc_app;

-- ============================================================================
-- Clients
-- ============================================================================
create function public.bc_create_client(
  p_salon uuid, p_name text, p_phone text, p_email text, p_segment text, p_favorite text, p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'clients.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Invalid name' using errcode = '22023'; end if;
  if p_phone is null or char_length(btrim(p_phone)) not between 3 and 40 then raise exception 'Invalid phone' using errcode = '22023'; end if;
  if p_segment not in ('new','active','loyal','vip','inactive','to_reactivate') then raise exception 'Invalid segment' using errcode = '22023'; end if;
  insert into public.bc_clients(salon_id,name,phone,email,segment,favorite_service,notes)
  values(p_salon,btrim(p_name),btrim(p_phone),nullif(btrim(coalesce(p_email,'')),''),p_segment,coalesce(p_favorite,''),coalesce(p_notes,''))
  returning id into v_id;
  return v_id;
end $$;

create function public.bc_update_client(
  p_salon uuid, p_id uuid, p_name text, p_phone text, p_email text, p_segment text, p_favorite text, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'clients.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Invalid name' using errcode = '22023'; end if;
  if p_phone is null or char_length(btrim(p_phone)) not between 3 and 40 then raise exception 'Invalid phone' using errcode = '22023'; end if;
  update public.bc_clients set
    name = btrim(p_name), phone = btrim(p_phone),
    email = nullif(btrim(coalesce(p_email,'')),''), segment = p_segment,
    favorite_service = coalesce(p_favorite,''), notes = coalesce(p_notes,''),
    updated_at = now()
  where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;

create function public.bc_delete_client(p_salon uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'clients.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.bc_clients where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;

-- ============================================================================
-- Prestations
-- ============================================================================
create function public.bc_save_service(
  p_salon uuid, p_id uuid, p_name text, p_category text, p_description text,
  p_price bigint, p_duration integer, p_popular boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'catalog.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Invalid name' using errcode = '22023'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Invalid price' using errcode = '22023'; end if;
  if p_duration is null or p_duration not between 5 and 600 then raise exception 'Invalid duration' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.bc_services(salon_id,name,category,description,price,duration_minutes,popular)
    values(p_salon,btrim(p_name),p_category,coalesce(p_description,''),p_price,p_duration,coalesce(p_popular,false))
    returning id into v_id;
  else
    update public.bc_services set name=btrim(p_name), category=p_category,
      description=coalesce(p_description,''), price=p_price, duration_minutes=p_duration,
      popular=coalesce(p_popular,false), updated_at=now()
    where id=p_id and salon_id=p_salon returning id into v_id;
    if v_id is null then raise exception 'Not found' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

create function public.bc_delete_service(p_salon uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'catalog.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.bc_services where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;

-- ============================================================================
-- Équipe
-- ============================================================================
create function public.bc_save_staff(
  p_salon uuid, p_id uuid, p_name text, p_role text, p_phone text,
  p_specialties text[], p_commission integer, p_available boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'team.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Invalid name' using errcode = '22023'; end if;
  if p_commission is null or p_commission not between 0 and 100 then raise exception 'Invalid commission' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.bc_staff(salon_id,name,role,phone,specialties,commission_rate,is_available)
    values(p_salon,btrim(p_name),p_role,coalesce(p_phone,''),coalesce(p_specialties,'{}'),p_commission,coalesce(p_available,true))
    returning id into v_id;
  else
    update public.bc_staff set name=btrim(p_name), role=p_role, phone=coalesce(p_phone,''),
      specialties=coalesce(p_specialties,'{}'), commission_rate=p_commission,
      is_available=coalesce(p_available,true), updated_at=now()
    where id=p_id and salon_id=p_salon returning id into v_id;
    if v_id is null then raise exception 'Not found' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

create function public.bc_delete_staff(p_salon uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'team.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.bc_staff where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;

-- ============================================================================
-- Dépenses et stocks
-- ============================================================================
create function public.bc_add_expense(
  p_salon uuid, p_title text, p_category text, p_amount bigint, p_date date, p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'finance.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then raise exception 'Invalid title' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Invalid amount' using errcode = '22023'; end if;
  insert into public.bc_expenses(salon_id,title,category,amount,spent_on,notes)
  values(p_salon,btrim(p_title),p_category,p_amount,p_date,coalesce(p_notes,'')) returning id into v_id;
  return v_id;
end $$;

create function public.bc_save_stock_item(
  p_salon uuid, p_id uuid, p_name text, p_category text, p_quantity integer,
  p_threshold integer, p_unit_cost bigint, p_supplier text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'stock.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Invalid name' using errcode = '22023'; end if;
  if p_quantity is null or p_quantity < 0 then raise exception 'Invalid quantity' using errcode = '22023'; end if;
  if p_threshold is null or p_threshold < 0 then raise exception 'Invalid threshold' using errcode = '22023'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'Invalid cost' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.bc_stock_items(salon_id,name,category,quantity,min_threshold,unit_cost,supplier)
    values(p_salon,btrim(p_name),p_category,p_quantity,p_threshold,p_unit_cost,coalesce(p_supplier,''))
    returning id into v_id;
  else
    update public.bc_stock_items set name=btrim(p_name), category=p_category, quantity=p_quantity,
      min_threshold=p_threshold, unit_cost=p_unit_cost, supplier=coalesce(p_supplier,''), updated_at=now()
    where id=p_id and salon_id=p_salon returning id into v_id;
    if v_id is null then raise exception 'Not found' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

create function public.bc_delete_stock_item(p_salon uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'stock.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.bc_stock_items where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;

-- ============================================================================
-- Fidélité
-- ============================================================================
create function public.bc_save_reward(
  p_salon uuid, p_id uuid, p_name text, p_description text, p_points integer,
  p_category text, p_discount integer, p_free_service text, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'loyalty.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Invalid name' using errcode = '22023'; end if;
  if p_points is null or p_points <= 0 then raise exception 'Invalid points cost' using errcode = '22023'; end if;
  if p_category = 'discount' and (p_discount is null or p_discount not between 1 and 100) then
    raise exception 'Invalid discount' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.bc_loyalty_rewards(salon_id,name,description,points_cost,category,discount_percentage,free_service_name,is_active)
    values(p_salon,btrim(p_name),coalesce(p_description,''),p_points,p_category,
      case when p_category = 'discount' then p_discount else null end,
      nullif(btrim(coalesce(p_free_service,'')),''), coalesce(p_active,true))
    returning id into v_id;
  else
    update public.bc_loyalty_rewards set name=btrim(p_name), description=coalesce(p_description,''),
      points_cost=p_points, category=p_category,
      discount_percentage = case when p_category = 'discount' then p_discount else null end,
      free_service_name = nullif(btrim(coalesce(p_free_service,'')),''),
      is_active = coalesce(p_active,true), updated_at=now()
    where id=p_id and salon_id=p_salon returning id into v_id;
    if v_id is null then raise exception 'Not found' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

create function public.bc_delete_reward(p_salon uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'loyalty.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.bc_loyalty_rewards where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;

-- ============================================================================
-- Avis clients
-- ============================================================================
create function public.bc_add_review(p_salon uuid, p_author text, p_rating integer, p_comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not barber_private.has_salon_permission(p_salon, 'salon.read') then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_author is null or char_length(btrim(p_author)) not between 1 and 120 then raise exception 'Invalid author' using errcode = '22023'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Invalid rating' using errcode = '22023'; end if;
  if p_comment is null or char_length(btrim(p_comment)) not between 1 and 1000 then raise exception 'Invalid comment' using errcode = '22023'; end if;
  insert into public.bc_reviews(salon_id,author,rating,comment)
  values(p_salon,btrim(p_author),p_rating,btrim(p_comment)) returning id into v_id;
  return v_id;
end $$;

create function public.bc_delete_review(p_salon uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not barber_private.has_salon_permission(p_salon, 'clients.write') then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.bc_reviews where id = p_id and salon_id = p_salon;
  if not found then raise exception 'Not found' using errcode = '42501'; end if;
end $$;

-- Aucune fonction exposée en écriture directe : on révoque puis on autorise explicitement.
revoke all on function
  public.bc_create_client(uuid,text,text,text,text,text,text),
  public.bc_update_client(uuid,uuid,text,text,text,text,text,text),
  public.bc_delete_client(uuid,uuid),
  public.bc_save_service(uuid,uuid,text,text,text,bigint,integer,boolean),
  public.bc_delete_service(uuid,uuid),
  public.bc_save_staff(uuid,uuid,text,text,text,text[],integer,boolean),
  public.bc_delete_staff(uuid,uuid),
  public.bc_add_expense(uuid,text,text,bigint,date,text),
  public.bc_save_stock_item(uuid,uuid,text,text,integer,integer,bigint,text),
  public.bc_delete_stock_item(uuid,uuid),
  public.bc_save_reward(uuid,uuid,text,text,integer,text,integer,text,boolean),
  public.bc_delete_reward(uuid,uuid),
  public.bc_add_review(uuid,text,integer,text),
  public.bc_delete_review(uuid,uuid)
from public;

grant execute on function
  public.bc_create_client(uuid,text,text,text,text,text,text),
  public.bc_update_client(uuid,uuid,text,text,text,text,text,text),
  public.bc_delete_client(uuid,uuid),
  public.bc_save_service(uuid,uuid,text,text,text,bigint,integer,boolean),
  public.bc_delete_service(uuid,uuid),
  public.bc_save_staff(uuid,uuid,text,text,text,text[],integer,boolean),
  public.bc_delete_staff(uuid,uuid),
  public.bc_add_expense(uuid,text,text,bigint,date,text),
  public.bc_save_stock_item(uuid,uuid,text,text,integer,integer,bigint,text),
  public.bc_delete_stock_item(uuid,uuid),
  public.bc_save_reward(uuid,uuid,text,text,integer,text,integer,text,boolean),
  public.bc_delete_reward(uuid,uuid),
  public.bc_add_review(uuid,text,integer,text),
  public.bc_delete_review(uuid,uuid)
to bc_app;
