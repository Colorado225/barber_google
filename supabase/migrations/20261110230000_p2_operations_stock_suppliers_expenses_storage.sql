-- P2 — Parcours opérationnels : fournisseurs, mouvements de stock historisés
-- (append-only), contrepassation/correction auditée et pièces jointes des
-- dépenses, et compartiments Supabase Storage (`salon-media`, `expense-attachments`).
--
-- Principes de conception :
--  1. Aucun remplacement silencieux des quantités de stock ni suppression/écrasement
--     des écritures de dépenses : toute variation passe par un mouvement ou une
--     écriture liée avec auteur, horodatage et motif conservés.
--  2. Les rapports (`financial_summary`) comptabilisent algébriquement les
--     contrepassations (`expense_reversal`) pour rester cohérents sur la période.
--  3. Multi-tenant strict via `private.has_salon_permission` et clés composites
--     `(salon_id, ...)`.

-- ---------------------------------------------------------------------------
-- 1. Fournisseurs (`public.suppliers`)
-- ---------------------------------------------------------------------------

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  contact_name text not null default '' check (char_length(contact_name) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  address text not null default '' check (char_length(address) <= 300),
  notes text not null default '' check (char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, id)
);

create unique index suppliers_salon_lower_name_uidx
  on public.suppliers (salon_id, lower(btrim(name)));
create index suppliers_salon_active_idx
  on public.suppliers (salon_id, is_active, name);

alter table public.suppliers enable row level security;

create policy suppliers_read_member on public.suppliers
  for select to authenticated
  using (
    private.has_salon_permission(salon_id, 'stock.write')
    or private.has_salon_permission(salon_id, 'expenses.read')
  );

-- Toute écriture passe par `upsert_supplier` (pas de suppression physique pour
-- préserver les liens historiques avec les stocks et les dépenses).
revoke all on public.suppliers from anon, authenticated;
grant select on public.suppliers to authenticated;

create or replace function public.list_suppliers(
  p_salon_id uuid,
  p_include_inactive boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (
    private.has_salon_permission(p_salon_id, 'stock.write')
    or private.has_salon_permission(p_salon_id, 'expenses.read')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.is_active desc, lower(s.name), s.id), '[]'::jsonb)
    into v_result
    from public.suppliers s
    where s.salon_id = p_salon_id
      and (coalesce(p_include_inactive, false) or s.is_active);

  return v_result;
end;
$$;
revoke all on function public.list_suppliers(uuid, boolean) from public, anon;
grant execute on function public.list_suppliers(uuid, boolean) to authenticated;

create or replace function public.upsert_supplier(
  p_salon_id uuid,
  p_name text,
  p_contact_name text default '',
  p_phone text default '',
  p_email text default null,
  p_address text default '',
  p_notes text default '',
  p_is_active boolean default true,
  p_supplier_id uuid default null
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_row public.suppliers;
begin
  if not (
    private.has_salon_permission(p_salon_id, 'stock.write')
    or private.has_salon_permission(p_salon_id, 'expenses.manage')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 120
    or char_length(coalesce(p_contact_name, '')) > 120
    or char_length(coalesce(p_phone, '')) > 40
    or char_length(coalesce(p_address, '')) > 300
    or char_length(coalesce(p_notes, '')) > 500
    or (v_email is not null and v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Invalid supplier' using errcode = '22023';
  end if;

  if p_supplier_id is null then
    insert into public.suppliers(
      salon_id, name, contact_name, phone, email, address, notes, is_active, created_by
    )
    values (
      p_salon_id,
      v_name,
      btrim(coalesce(p_contact_name, '')),
      btrim(coalesce(p_phone, '')),
      v_email,
      btrim(coalesce(p_address, '')),
      btrim(coalesce(p_notes, '')),
      coalesce(p_is_active, true),
      auth.uid()
    )
    returning * into v_row;
  else
    update public.suppliers
       set name = v_name,
           contact_name = btrim(coalesce(p_contact_name, '')),
           phone = btrim(coalesce(p_phone, '')),
           email = v_email,
           address = btrim(coalesce(p_address, '')),
           notes = btrim(coalesce(p_notes, '')),
           is_active = coalesce(p_is_active, is_active),
           updated_at = now()
     where id = p_supplier_id
       and salon_id = p_salon_id
     returning * into v_row;
    if not found then
      raise exception 'Supplier not found' using errcode = '22023';
    end if;
  end if;

  return v_row;
end;
$$;
revoke all on function public.upsert_supplier(uuid, text, text, text, text, text, text, boolean, uuid) from public, anon;
grant execute on function public.upsert_supplier(uuid, text, text, text, text, text, text, boolean, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Stocks historisés (`public.stock_items` + `public.stock_movements`)
-- ---------------------------------------------------------------------------

alter table public.stock_items
  add column if not exists supplier_id uuid,
  add column if not exists selling_price bigint check (selling_price is null or selling_price >= 0),
  add column if not exists last_restock timestamptz,
  add column if not exists is_active boolean not null default true;

alter table public.stock_items
  add constraint stock_items_supplier_fk
  foreign key (salon_id, supplier_id) references public.suppliers(salon_id, id) on delete restrict;

create index if not exists stock_items_supplier_idx
  on public.stock_items (salon_id, supplier_id)
  where supplier_id is not null;

-- Interdit toute mutation directe sans passer par les RPC tracées.
revoke insert, update, delete on public.stock_items from anon, authenticated;
grant select on public.stock_items to authenticated;

create or replace function private.guard_stock_items_quantity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quantity is distinct from old.quantity
    and coalesce(current_setting('barbercuts.stock_rpc', true), '') <> '1' then
    raise exception 'Stock quantity can only change via record_stock_movement' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_items_guard_quantity on public.stock_items;
create trigger stock_items_guard_quantity
  before update on public.stock_items
  for each row execute function private.guard_stock_items_quantity();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  branch_id uuid,
  stock_item_id uuid not null,
  supplier_id uuid,
  movement_type text not null check (
    movement_type in ('initial', 'restock', 'sale', 'service_use', 'loss', 'adjustment', 'return')
  ),
  quantity_delta integer not null check (quantity_delta <> 0 and quantity_delta between -1000000 and 1000000),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after integer not null check (quantity_after >= 0 and quantity_after = quantity_before + quantity_delta),
  unit_cost bigint check (unit_cost is null or unit_cost >= 0),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  reference text check (reference is null or char_length(btrim(reference)) <= 120),
  appointment_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (salon_id, branch_id) references public.branches(salon_id, id) on delete restrict,
  foreign key (salon_id, stock_item_id) references public.stock_items(salon_id, id) on delete restrict,
  foreign key (salon_id, supplier_id) references public.suppliers(salon_id, id) on delete restrict,
  foreign key (salon_id, appointment_id) references public.appointments(salon_id, id) on delete restrict
);

create index stock_movements_salon_created_idx
  on public.stock_movements (salon_id, created_at desc, id desc);
create index stock_movements_item_idx
  on public.stock_movements (salon_id, stock_item_id, created_at desc);

alter table public.stock_movements enable row level security;
create policy stock_movements_read_member on public.stock_movements
  for select to authenticated
  using (private.has_salon_permission(salon_id, 'stock.read'));

revoke all on public.stock_movements from anon, authenticated;
grant select on public.stock_movements to authenticated;

create or replace function private.forbid_stock_movement_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Stock movements are append-only' using errcode = '42501';
end;
$$;

create trigger stock_movements_append_only
  before update or delete on public.stock_movements
  for each row execute function private.forbid_stock_movement_mutation();

create or replace function public.create_stock_item(
  p_salon_id uuid,
  p_name text,
  p_category text,
  p_initial_quantity integer default 0,
  p_min_threshold integer default 0,
  p_unit_cost bigint default 0,
  p_supplier_id uuid default null,
  p_supplier_name text default '',
  p_reason text default 'Stock initial',
  p_branch_id uuid default null,
  p_selling_price bigint default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_supplier_name text := btrim(coalesce(p_supplier_name, ''));
  v_reason text := btrim(coalesce(p_reason, 'Stock initial'));
  v_item public.stock_items;
begin
  if not private.has_salon_permission(p_salon_id, 'stock.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 120
    or p_category not in ('shampoing', 'gel_cire', 'huile_barbe', 'lames', 'soin', 'accessoires')
    or p_initial_quantity is null or p_initial_quantity < 0 or p_initial_quantity > 1000000
    or p_min_threshold is null or p_min_threshold < 0 or p_min_threshold > 1000000
    or p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 1000000000
    or (p_selling_price is not null and (p_selling_price < 0 or p_selling_price > 1000000000))
    or char_length(v_supplier_name) > 120
    or char_length(v_reason) not between 2 and 500 then
    raise exception 'Invalid stock item' using errcode = '22023';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.branches where id = p_branch_id and salon_id = p_salon_id
  ) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;

  if p_supplier_id is not null then
    select name into v_supplier_name
      from public.suppliers
      where id = p_supplier_id and salon_id = p_salon_id;
    if not found then
      raise exception 'Invalid supplier' using errcode = '22023';
    end if;
  end if;

  insert into public.stock_items(
    salon_id, name, category, quantity, min_threshold, unit_cost, selling_price,
    supplier_id, supplier, last_restock, is_active
  )
  values (
    p_salon_id,
    v_name,
    p_category,
    p_initial_quantity,
    p_min_threshold,
    p_unit_cost,
    p_selling_price,
    p_supplier_id,
    v_supplier_name,
    case when p_initial_quantity > 0 then now() else null end,
    true
  )
  returning * into v_item;

  if p_initial_quantity > 0 then
    insert into public.stock_movements(
      salon_id, branch_id, stock_item_id, supplier_id, movement_type,
      quantity_delta, quantity_before, quantity_after, unit_cost, reason, actor_id
    )
    values (
      p_salon_id, p_branch_id, v_item.id, p_supplier_id, 'initial',
      p_initial_quantity, 0, p_initial_quantity, p_unit_cost, v_reason, auth.uid()
    );
  end if;

  return v_item;
end;
$$;
revoke all on function public.create_stock_item(uuid, text, text, integer, integer, bigint, uuid, text, text, uuid, bigint) from public, anon;
grant execute on function public.create_stock_item(uuid, text, text, integer, integer, bigint, uuid, text, text, uuid, bigint) to authenticated;

create or replace function public.update_stock_item_metadata(
  p_salon_id uuid,
  p_stock_item_id uuid,
  p_name text,
  p_category text,
  p_min_threshold integer,
  p_unit_cost bigint,
  p_supplier_id uuid default null,
  p_supplier_name text default '',
  p_selling_price bigint default null,
  p_is_active boolean default true
)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_supplier_name text := btrim(coalesce(p_supplier_name, ''));
  v_item public.stock_items;
begin
  if not private.has_salon_permission(p_salon_id, 'stock.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 120
    or p_category not in ('shampoing', 'gel_cire', 'huile_barbe', 'lames', 'soin', 'accessoires')
    or p_min_threshold is null or p_min_threshold < 0 or p_min_threshold > 1000000
    or p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 1000000000
    or (p_selling_price is not null and (p_selling_price < 0 or p_selling_price > 1000000000))
    or char_length(v_supplier_name) > 120 then
    raise exception 'Invalid stock metadata' using errcode = '22023';
  end if;

  if p_supplier_id is not null then
    select name into v_supplier_name
      from public.suppliers
      where id = p_supplier_id and salon_id = p_salon_id;
    if not found then
      raise exception 'Invalid supplier' using errcode = '22023';
    end if;
  end if;

  update public.stock_items
     set name = v_name,
         category = p_category,
         min_threshold = p_min_threshold,
         unit_cost = p_unit_cost,
         selling_price = p_selling_price,
         supplier_id = p_supplier_id,
         supplier = v_supplier_name,
         is_active = coalesce(p_is_active, is_active),
         updated_at = now()
   where id = p_stock_item_id
     and salon_id = p_salon_id
   returning * into v_item;

  if not found then
    raise exception 'Stock item not found' using errcode = '22023';
  end if;

  return v_item;
end;
$$;
revoke all on function public.update_stock_item_metadata(uuid, uuid, text, text, integer, bigint, uuid, text, bigint, boolean) from public, anon;
grant execute on function public.update_stock_item_metadata(uuid, uuid, text, text, integer, bigint, uuid, text, bigint, boolean) to authenticated;

create or replace function public.record_stock_movement(
  p_salon_id uuid,
  p_stock_item_id uuid,
  p_movement_type text,
  p_quantity_delta integer,
  p_reason text,
  p_branch_id uuid default null,
  p_supplier_id uuid default null,
  p_unit_cost bigint default null,
  p_reference text default null,
  p_appointment_id uuid default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.stock_items;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_before integer;
  v_after integer;
  v_supplier_id uuid;
  v_supplier_name text;
  v_movement public.stock_movements;
begin
  if not private.has_salon_permission(p_salon_id, 'stock.write') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_movement_type not in ('restock', 'sale', 'service_use', 'loss', 'adjustment', 'return')
    or p_quantity_delta is null or p_quantity_delta = 0
    or p_quantity_delta not between -1000000 and 1000000
    or char_length(v_reason) not between 2 and 500
    or (v_ref is not null and char_length(v_ref) > 120)
    or (p_unit_cost is not null and (p_unit_cost < 0 or p_unit_cost > 1000000000)) then
    raise exception 'Invalid stock movement' using errcode = '22023';
  end if;

  if p_movement_type in ('restock', 'return') and p_quantity_delta <= 0 then
    raise exception 'Restock and return movements require a positive quantity' using errcode = '22023';
  end if;
  if p_movement_type in ('sale', 'service_use', 'loss') and p_quantity_delta >= 0 then
    raise exception 'Outgoing stock movements require a negative quantity' using errcode = '22023';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.branches where id = p_branch_id and salon_id = p_salon_id
  ) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;

  if p_appointment_id is not null and not exists (
    select 1 from public.appointments where id = p_appointment_id and salon_id = p_salon_id
  ) then
    raise exception 'Invalid appointment' using errcode = '22023';
  end if;

  select * into v_item
    from public.stock_items
    where id = p_stock_item_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Stock item not found' using errcode = '22023';
  end if;

  v_before := v_item.quantity;
  v_after := v_before + p_quantity_delta;
  if v_after < 0 or v_after > 1000000 then
    raise exception 'Insufficient stock quantity' using errcode = '22023';
  end if;

  v_supplier_id := coalesce(p_supplier_id, v_item.supplier_id);
  v_supplier_name := v_item.supplier;
  if p_supplier_id is not null then
    select name into v_supplier_name
      from public.suppliers
      where id = p_supplier_id and salon_id = p_salon_id;
    if not found then
      raise exception 'Invalid supplier' using errcode = '22023';
    end if;
  end if;

  perform set_config('barbercuts.stock_rpc', '1', true);
  update public.stock_items
     set quantity = v_after,
         unit_cost = case when p_movement_type = 'restock' and p_unit_cost is not null then p_unit_cost else unit_cost end,
         supplier_id = coalesce(p_supplier_id, supplier_id),
         supplier = case when p_supplier_id is not null then v_supplier_name else supplier end,
         last_restock = case when p_movement_type = 'restock' then now() else last_restock end,
         updated_at = now()
   where id = v_item.id and salon_id = p_salon_id;
  perform set_config('barbercuts.stock_rpc', '0', true);

  insert into public.stock_movements(
    salon_id, branch_id, stock_item_id, supplier_id, movement_type,
    quantity_delta, quantity_before, quantity_after, unit_cost, reason,
    reference, appointment_id, actor_id
  )
  values (
    p_salon_id,
    p_branch_id,
    v_item.id,
    v_supplier_id,
    p_movement_type,
    p_quantity_delta,
    v_before,
    v_after,
    coalesce(p_unit_cost, v_item.unit_cost),
    v_reason,
    v_ref,
    p_appointment_id,
    auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;
revoke all on function public.record_stock_movement(uuid, uuid, text, integer, text, uuid, uuid, bigint, text, uuid) from public, anon;
grant execute on function public.record_stock_movement(uuid, uuid, text, integer, text, uuid, uuid, bigint, text, uuid) to authenticated;

create or replace function public.list_stock_movements(
  p_salon_id uuid,
  p_stock_item_id uuid default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.has_salon_permission(p_salon_id, 'stock.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'Invalid limit' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(m) || jsonb_build_object(
        'stock_item_name', si.name,
        'supplier_name', sp.name
      )
      order by m.created_at desc, m.id desc
    ),
    '[]'::jsonb
  )
    into v_result
    from (
      select *
      from public.stock_movements sm
      where sm.salon_id = p_salon_id
        and (p_stock_item_id is null or sm.stock_item_id = p_stock_item_id)
      order by sm.created_at desc, sm.id desc
      limit p_limit
    ) m
    join public.stock_items si on si.salon_id = m.salon_id and si.id = m.stock_item_id
    left join public.suppliers sp on sp.salon_id = m.salon_id and sp.id = m.supplier_id;

  return v_result;
end;
$$;
revoke all on function public.list_stock_movements(uuid, uuid, integer) from public, anon;
grant execute on function public.list_stock_movements(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dépenses auditables (historique préservé, contrepassation, correction, pièces jointes)
-- ---------------------------------------------------------------------------

alter table public.expenses
  add column if not exists entry_kind text not null default 'expense'
    check (entry_kind in ('expense', 'expense_reversal')),
  add column if not exists original_expense_id uuid,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'reversed', 'superseded')),
  add column if not exists supplier_id uuid,
  add column if not exists attachment_path text
    check (attachment_path is null or (char_length(attachment_path) between 5 and 300 and attachment_path !~ '(^|/)\.\.(/|$)')),
  add column if not exists attachment_name text
    check (attachment_name is null or char_length(attachment_name) <= 180),
  add column if not exists attachment_mime text
    check (attachment_mime is null or attachment_mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  add column if not exists attachment_size bigint
    check (attachment_size is null or (attachment_size > 0 and attachment_size <= 10485760)),
  add column if not exists reason text not null default ''
    check (char_length(reason) <= 500),
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references auth.users(id) on delete set null;

alter table public.expenses
  add constraint expenses_salon_id_unique unique (salon_id, id),
  add constraint expenses_original_fk
    foreign key (salon_id, original_expense_id) references public.expenses(salon_id, id) on delete restrict,
  add constraint expenses_supplier_fk
    foreign key (salon_id, supplier_id) references public.suppliers(salon_id, id) on delete restrict;

create unique index if not exists expenses_one_reversal_per_original
  on public.expenses (original_expense_id)
  where entry_kind = 'expense_reversal';

create index if not exists expenses_supplier_idx
  on public.expenses (salon_id, supplier_id)
  where supplier_id is not null;

create table public.expense_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  expense_id uuid not null,
  event_type text not null check (event_type in ('recorded', 'attachment_updated', 'reversed', 'corrected')),
  amount bigint not null check (amount > 0),
  reason text not null default '' check (char_length(reason) <= 500),
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (salon_id, expense_id) references public.expenses(salon_id, id) on delete restrict
);

create index expense_events_salon_idx
  on public.expense_events (salon_id, created_at desc, id desc);
create index expense_events_expense_idx
  on public.expense_events (salon_id, expense_id, created_at desc);

alter table public.expense_events enable row level security;
create policy expense_events_read_member on public.expense_events
  for select to authenticated
  using (private.has_salon_permission(salon_id, 'expenses.read'));

revoke all on public.expense_events from anon, authenticated;
grant select on public.expense_events to authenticated;

create or replace function private.forbid_expense_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Expense events are append-only' using errcode = '42501';
end;
$$;

create trigger expense_events_append_only
  before update or delete on public.expense_events
  for each row execute function private.forbid_expense_event_mutation();

-- Plus aucune suppression ni modification directe silencieuse sur public.expenses.
revoke insert, update, delete on public.expenses from anon, authenticated;
grant select on public.expenses to authenticated;

create or replace function private.guard_expenses_immutability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Expenses cannot be physically deleted; use reverse_expense' using errcode = '42501';
  end if;

  if coalesce(current_setting('barbercuts.expense_rpc', true), '') <> '1' then
    raise exception 'Expenses can only be modified via audited RPCs' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.salon_id is distinct from old.salon_id
    or new.branch_id is distinct from old.branch_id
    or new.title is distinct from old.title
    or new.category is distinct from old.category
    or new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.spent_on is distinct from old.spent_on
    or new.entry_kind is distinct from old.entry_kind
    or new.original_expense_id is distinct from old.original_expense_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Historical expense fields are immutable; use correct_expense or reverse_expense' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_guard_immutability on public.expenses;
create trigger expenses_guard_immutability
  before update or delete on public.expenses
  for each row execute function private.guard_expenses_immutability();

create or replace function private.expense_signed_amount(p_kind text, p_amount bigint)
returns bigint
language sql
immutable
as $$
  select case when p_kind = 'expense_reversal' then -p_amount else p_amount end
$$;

-- Met à jour `financial_summary` pour déduire les contrepassations (`expense_reversal`).
create or replace function public.financial_summary(p_salon_id uuid, p_from date, p_to date)
returns table (
  revenue_billed bigint,
  revenue_collected bigint,
  outstanding bigint,
  refunds bigint,
  expenses bigint,
  net_balance bigint,
  pending_amount bigint,
  payment_count bigint,
  by_method jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_salon_permission(p_salon_id, 'reports.read')
    or not private.has_salon_permission(p_salon_id, 'expenses.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to or (p_to - p_from) > 366 then
    raise exception 'Invalid report period' using errcode = '22023';
  end if;
  return query
  with apt as (
    select a.amount,
           coalesce((
             select sum(private.payment_signed_amount(p.kind, p.amount))
             from public.payments p
             where p.appointment_id = a.id and p.status = 'confirmed'
           ), 0) as net
    from public.appointments a
    where a.salon_id = p_salon_id
      and a.status not in ('cancelled', 'no_show')
      and a.starts_at >= (p_from::timestamp at time zone 'Africa/Abidjan')
      and a.starts_at < ((p_to + 1)::timestamp at time zone 'Africa/Abidjan')
  ), entries as (
    select p.method, p.kind, p.amount
    from public.payments p
    where p.salon_id = p_salon_id and p.status = 'confirmed'
      and p.created_at >= (p_from::timestamp at time zone 'Africa/Abidjan')
      and p.created_at < ((p_to + 1)::timestamp at time zone 'Africa/Abidjan')
  ), exp as (
    select private.expense_signed_amount(e.entry_kind, e.amount) as signed_amount
    from public.expenses e
    where e.salon_id = p_salon_id and e.spent_on between p_from and p_to
  ), pending as (
    select p.amount from public.payments p
    where p.salon_id = p_salon_id and p.status = 'pending'
      and p.created_at >= (p_from::timestamp at time zone 'Africa/Abidjan')
      and p.created_at < ((p_to + 1)::timestamp at time zone 'Africa/Abidjan')
  ), methods as (
    select method, sum(private.payment_signed_amount(kind, amount)) as net
    from entries group by method
  )
  select
    coalesce((select sum(amount) from apt), 0)::bigint,
    coalesce((select sum(private.payment_signed_amount(kind, amount)) from entries), 0)::bigint,
    coalesce((select sum(greatest(amount - net, 0)) from apt), 0)::bigint,
    coalesce((select sum(amount) from entries where kind = 'refund'), 0)::bigint,
    coalesce((select sum(signed_amount) from exp), 0)::bigint,
    (coalesce((select sum(private.payment_signed_amount(kind, amount)) from entries), 0)
      - coalesce((select sum(signed_amount) from exp), 0))::bigint,
    coalesce((select sum(amount) from pending), 0)::bigint,
    coalesce((select count(*) from entries where kind = 'payment'), 0)::bigint,
    coalesce((select jsonb_object_agg(method, net) from methods), '{}'::jsonb);
end;
$$;
revoke all on function public.financial_summary(uuid, date, date) from public, anon;
grant execute on function public.financial_summary(uuid, date, date) to authenticated;

drop function if exists public.record_expense(uuid, text, text, bigint, date, uuid, text, text);
create or replace function public.record_expense(
  p_salon_id uuid,
  p_title text,
  p_category text,
  p_amount bigint,
  p_spent_on date,
  p_branch_id uuid default null,
  p_notes text default '',
  p_receipt_ref text default null,
  p_supplier_id uuid default null,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_mime text default null,
  p_attachment_size bigint default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses;
  v_path text := nullif(btrim(coalesce(p_attachment_path, '')), '');
  v_name text := nullif(btrim(coalesce(p_attachment_name, '')), '');
begin
  if not private.has_salon_permission(p_salon_id, 'expenses.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120
    or p_category not in ('rent', 'electricity', 'water', 'salaries', 'products', 'maintenance', 'marketing', 'other')
    or p_amount is null or p_amount <= 0 or p_amount > 1000000000000
    or p_spent_on is null
    or char_length(coalesce(p_notes, '')) > 500
    or char_length(coalesce(p_receipt_ref, '')) > 120 then
    raise exception 'Invalid expense' using errcode = '22023';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches where id = p_branch_id and salon_id = p_salon_id
  ) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers where id = p_supplier_id and salon_id = p_salon_id
  ) then
    raise exception 'Invalid supplier' using errcode = '22023';
  end if;
  if v_path is not null then
    if split_part(v_path, '/', 1) <> p_salon_id::text
      or split_part(v_path, '/', 2) <> 'expenses'
      or v_path ~ '(^|/)\.\.(/|$)'
      or char_length(v_path) not between 5 and 300
      or p_attachment_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
      or p_attachment_size is null or p_attachment_size <= 0 or p_attachment_size > 10485760 then
      raise exception 'Invalid expense attachment' using errcode = '22023';
    end if;
  end if;

  insert into public.expenses(
    salon_id, branch_id, title, category, amount, currency, spent_on, notes, receipt_ref,
    supplier_id, attachment_path, attachment_name, attachment_mime, attachment_size,
    entry_kind, status, created_by
  )
  values (
    p_salon_id, p_branch_id, btrim(p_title), p_category, p_amount, 'XOF', p_spent_on,
    btrim(coalesce(p_notes, '')), nullif(btrim(coalesce(p_receipt_ref, '')), ''),
    p_supplier_id, v_path, v_name, p_attachment_mime, p_attachment_size,
    'expense', 'active', auth.uid()
  )
  returning * into v_expense;

  insert into public.expense_events(
    salon_id, expense_id, event_type, amount, reason, actor_id, metadata
  )
  values (
    p_salon_id, v_expense.id, 'recorded', v_expense.amount, '',
    auth.uid(),
    jsonb_build_object(
      'category', v_expense.category,
      'spent_on', v_expense.spent_on,
      'supplier_id', v_expense.supplier_id,
      'has_attachment', v_path is not null
    )
  );

  return v_expense;
end;
$$;
revoke all on function public.record_expense(uuid, text, text, bigint, date, uuid, text, text, uuid, text, text, text, bigint) from public, anon;
grant execute on function public.record_expense(uuid, text, text, bigint, date, uuid, text, text, uuid, text, text, text, bigint) to authenticated;

create or replace function public.attach_expense_receipt(
  p_salon_id uuid,
  p_expense_id uuid,
  p_attachment_path text,
  p_attachment_name text,
  p_attachment_mime text,
  p_attachment_size bigint
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := nullif(btrim(coalesce(p_attachment_path, '')), '');
  v_name text := nullif(btrim(coalesce(p_attachment_name, '')), '');
  v_row public.expenses;
begin
  if not private.has_salon_permission(p_salon_id, 'expenses.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_path is null
    or split_part(v_path, '/', 1) <> p_salon_id::text
    or split_part(v_path, '/', 2) <> 'expenses'
    or v_path ~ '(^|/)\.\.(/|$)'
    or char_length(v_path) not between 5 and 300
    or v_name is null or char_length(v_name) > 180
    or p_attachment_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    or p_attachment_size is null or p_attachment_size <= 0 or p_attachment_size > 10485760 then
    raise exception 'Invalid expense attachment' using errcode = '22023';
  end if;

  select * into v_row
    from public.expenses
    where id = p_expense_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Expense not found' using errcode = '22023';
  end if;
  if v_row.entry_kind <> 'expense' or v_row.status <> 'active' then
    raise exception 'Cannot attach receipt to non-active expense' using errcode = '22023';
  end if;

  perform set_config('barbercuts.expense_rpc', '1', true);
  update public.expenses
     set attachment_path = v_path,
         attachment_name = v_name,
         attachment_mime = p_attachment_mime,
         attachment_size = p_attachment_size
   where id = v_row.id and salon_id = p_salon_id
   returning * into v_row;
  perform set_config('barbercuts.expense_rpc', '0', true);

  insert into public.expense_events(
    salon_id, expense_id, event_type, amount, reason, actor_id, metadata
  )
  values (
    p_salon_id, v_row.id, 'attachment_updated', v_row.amount, '',
    auth.uid(),
    jsonb_build_object('attachment_name', v_name, 'attachment_mime', p_attachment_mime, 'attachment_size', p_attachment_size)
  );

  return v_row;
end;
$$;
revoke all on function public.attach_expense_receipt(uuid, uuid, text, text, text, bigint) from public, anon;
grant execute on function public.attach_expense_receipt(uuid, uuid, text, text, text, bigint) to authenticated;

create or replace function public.reverse_expense(
  p_salon_id uuid,
  p_expense_id uuid,
  p_reason text
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_original public.expenses;
  v_reversal public.expenses;
begin
  if not private.has_salon_permission(p_salon_id, 'expenses.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 3 and 500 then
    raise exception 'Reason is required to reverse an expense' using errcode = '22023';
  end if;

  select * into v_original
    from public.expenses
    where id = p_expense_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Expense not found' using errcode = '22023';
  end if;
  if v_original.entry_kind <> 'expense' or v_original.status <> 'active' then
    raise exception 'Expense already reversed or superseded' using errcode = '22023';
  end if;

  perform set_config('barbercuts.expense_rpc', '1', true);
  update public.expenses
     set status = 'reversed',
         reversed_at = now(),
         reversed_by = auth.uid(),
         reason = v_reason
   where id = v_original.id and salon_id = p_salon_id;
  perform set_config('barbercuts.expense_rpc', '0', true);

  insert into public.expenses(
    salon_id, branch_id, title, category, amount, currency, spent_on, notes, receipt_ref,
    supplier_id, entry_kind, original_expense_id, status, reason, created_by
  )
  values (
    p_salon_id, v_original.branch_id,
    left('Contrepassation : ' || v_original.title, 120),
    v_original.category, v_original.amount, v_original.currency,
    v_original.spent_on, v_original.notes, v_original.receipt_ref,
    v_original.supplier_id, 'expense_reversal', v_original.id, 'active', v_reason, auth.uid()
  )
  returning * into v_reversal;

  insert into public.expense_events(
    salon_id, expense_id, event_type, amount, reason, actor_id, metadata
  )
  values (
    p_salon_id, v_original.id, 'reversed', v_original.amount, v_reason,
    auth.uid(), jsonb_build_object('reversal_id', v_reversal.id)
  );

  return v_reversal;
end;
$$;
revoke all on function public.reverse_expense(uuid, uuid, text) from public, anon;
grant execute on function public.reverse_expense(uuid, uuid, text) to authenticated;

create or replace function public.correct_expense(
  p_salon_id uuid,
  p_original_expense_id uuid,
  p_title text,
  p_category text,
  p_amount bigint,
  p_spent_on date,
  p_reason text,
  p_branch_id uuid default null,
  p_notes text default '',
  p_receipt_ref text default null,
  p_supplier_id uuid default null
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_original public.expenses;
  v_reversal public.expenses;
  v_replacement public.expenses;
begin
  if not private.has_salon_permission(p_salon_id, 'expenses.manage') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 3 and 500
    or p_title is null or char_length(btrim(p_title)) not between 1 and 120
    or p_category not in ('rent', 'electricity', 'water', 'salaries', 'products', 'maintenance', 'marketing', 'other')
    or p_amount is null or p_amount <= 0 or p_amount > 1000000000000
    or p_spent_on is null
    or char_length(coalesce(p_notes, '')) > 500
    or char_length(coalesce(p_receipt_ref, '')) > 120 then
    raise exception 'Invalid expense correction' using errcode = '22023';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches where id = p_branch_id and salon_id = p_salon_id
  ) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers where id = p_supplier_id and salon_id = p_salon_id
  ) then
    raise exception 'Invalid supplier' using errcode = '22023';
  end if;

  select * into v_original
    from public.expenses
    where id = p_original_expense_id and salon_id = p_salon_id
    for update;
  if not found then
    raise exception 'Expense not found' using errcode = '22023';
  end if;
  if v_original.entry_kind <> 'expense' or v_original.status <> 'active' then
    raise exception 'Expense already reversed or superseded' using errcode = '22023';
  end if;

  perform set_config('barbercuts.expense_rpc', '1', true);
  update public.expenses
     set status = 'superseded',
         reversed_at = now(),
         reversed_by = auth.uid(),
         reason = v_reason
   where id = v_original.id and salon_id = p_salon_id;
  perform set_config('barbercuts.expense_rpc', '0', true);

  insert into public.expenses(
    salon_id, branch_id, title, category, amount, currency, spent_on, notes, receipt_ref,
    supplier_id, entry_kind, original_expense_id, status, reason, created_by
  )
  values (
    p_salon_id, v_original.branch_id,
    left('Annulation correction : ' || v_original.title, 120),
    v_original.category, v_original.amount, v_original.currency,
    v_original.spent_on, v_original.notes, v_original.receipt_ref,
    v_original.supplier_id, 'expense_reversal', v_original.id, 'active', v_reason, auth.uid()
  )
  returning * into v_reversal;

  insert into public.expenses(
    salon_id, branch_id, title, category, amount, currency, spent_on, notes, receipt_ref,
    supplier_id, attachment_path, attachment_name, attachment_mime, attachment_size,
    entry_kind, original_expense_id, status, reason, created_by
  )
  values (
    p_salon_id, coalesce(p_branch_id, v_original.branch_id),
    btrim(p_title), p_category, p_amount, 'XOF', p_spent_on,
    btrim(coalesce(p_notes, '')), nullif(btrim(coalesce(p_receipt_ref, '')), ''),
    coalesce(p_supplier_id, v_original.supplier_id),
    v_original.attachment_path, v_original.attachment_name, v_original.attachment_mime, v_original.attachment_size,
    'expense', v_original.id, 'active', v_reason, auth.uid()
  )
  returning * into v_replacement;

  insert into public.expense_events(
    salon_id, expense_id, event_type, amount, reason, actor_id, metadata
  )
  values (
    p_salon_id, v_original.id, 'corrected', p_amount, v_reason,
    auth.uid(),
    jsonb_build_object(
      'old_amount', v_original.amount,
      'new_amount', p_amount,
      'reversal_id', v_reversal.id,
      'replacement_id', v_replacement.id
    )
  );

  return v_replacement;
end;
$$;
revoke all on function public.correct_expense(uuid, uuid, text, text, bigint, date, text, uuid, text, text, uuid) from public, anon;
grant execute on function public.correct_expense(uuid, uuid, text, text, bigint, date, text, uuid, text, text, uuid) to authenticated;

create or replace function public.list_expense_events(
  p_salon_id uuid,
  p_expense_id uuid default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.has_salon_permission(p_salon_id, 'expenses.read') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'Invalid limit' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(ev) order by ev.created_at desc, ev.id desc), '[]'::jsonb)
    into v_result
    from (
      select *
      from public.expense_events ee
      where ee.salon_id = p_salon_id
        and (p_expense_id is null or ee.expense_id = p_expense_id)
      order by ee.created_at desc, ee.id desc
      limit p_limit
    ) ev;

  return v_result;
end;
$$;
revoke all on function public.list_expense_events(uuid, uuid, integer) from public, anon;
grant execute on function public.list_expense_events(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Compartiments Supabase Storage & RLS (`salon-media`, `expense-attachments`)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      (
        'salon-media',
        'salon-media',
        true,
        5242880,
        array['image/jpeg', 'image/png', 'image/webp']
      ),
      (
        'expense-attachments',
        'expense-attachments',
        false,
        10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      )
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists salon_media_public_read on storage.objects;
    create policy salon_media_public_read on storage.objects
      for select to public
      using (bucket_id = 'salon-media');

    drop policy if exists salon_media_tenant_write on storage.objects;
    create policy salon_media_tenant_write on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'salon-media'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'salon.update')
          else false
        end
      );

    drop policy if exists salon_media_tenant_update on storage.objects;
    create policy salon_media_tenant_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'salon-media'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'salon.update')
          else false
        end
      )
      with check (
        bucket_id = 'salon-media'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'salon.update')
          else false
        end
      );

    drop policy if exists salon_media_tenant_delete on storage.objects;
    create policy salon_media_tenant_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'salon-media'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'salon.update')
          else false
        end
      );

    drop policy if exists expense_attachments_tenant_read on storage.objects;
    create policy expense_attachments_tenant_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'expense-attachments'
        and split_part(name, '/', 2) = 'expenses'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'expenses.read')
          else false
        end
      );

    drop policy if exists expense_attachments_tenant_insert on storage.objects;
    create policy expense_attachments_tenant_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'expense-attachments'
        and split_part(name, '/', 2) = 'expenses'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'expenses.manage')
          else false
        end
      );

    drop policy if exists expense_attachments_tenant_update on storage.objects;
    create policy expense_attachments_tenant_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'expense-attachments'
        and split_part(name, '/', 2) = 'expenses'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'expenses.manage')
          else false
        end
      )
      with check (
        bucket_id = 'expense-attachments'
        and split_part(name, '/', 2) = 'expenses'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'expenses.manage')
          else false
        end
      );

    drop policy if exists expense_attachments_tenant_delete on storage.objects;
    create policy expense_attachments_tenant_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'expense-attachments'
        and split_part(name, '/', 2) = 'expenses'
        and name !~ '(^|/)\.\.(/|$)'
        and case
          when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then private.has_salon_permission((split_part(name, '/', 1))::uuid, 'expenses.manage')
          else false
        end
      );
  end if;
end $$;
