-- Lot 6 — socle caisse : permissions canoniques, registres et sessions.
-- Les écritures financières passent par des RPC security definer ; les clients
-- ne reçoivent aucun droit INSERT/UPDATE/DELETE direct sur ces tables.

create or replace function private.has_salon_permission(p_salon_id uuid, p_permission text)
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
        -- Finances : lecture, enregistrement, corrections, caisse, rapports.
        when 'payments.read' then m.role in ('owner', 'manager', 'cashier', 'accountant')
        when 'payments.record' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.correct' then m.role in ('owner', 'manager')
        when 'cash.read' then m.role in ('owner', 'manager', 'cashier', 'accountant')
        when 'cash.open' then m.role in ('owner', 'manager', 'cashier')
        when 'cash.close' then m.role in ('owner', 'manager', 'cashier')
        when 'cash.reconcile' then m.role = 'owner'
        when 'reports.read' then m.role in ('owner', 'manager', 'accountant')
        when 'subscriptions.read' then m.role = 'owner'
        -- Alias historiques conservés pour les anciens écrans/contrats.
        when 'payments.write' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.create' then m.role in ('owner', 'manager', 'cashier')
        when 'payments.refund.read' then m.role in ('owner', 'manager')
        when 'payments.refund.write' then m.role in ('owner', 'manager')
        when 'cashier.read' then m.role in ('owner', 'manager', 'cashier', 'accountant')
        when 'cashier.write' then m.role in ('owner', 'manager', 'cashier')
        else false
      end
  )
$$;
revoke all on function private.has_salon_permission(uuid, text) from public, anon;
grant execute on function private.has_salon_permission(uuid, text) to authenticated;

create table public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  branch_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (salon_id, id),
  unique (branch_id),
  foreign key (salon_id, branch_id) references public.branches(salon_id, id) on delete restrict
);
create index cash_registers_salon_idx on public.cash_registers (salon_id, branch_id);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete restrict,
  branch_id uuid not null,
  register_id uuid not null,
  status text not null default 'open' check (status in ('open', 'closed', 'reconciled')),
  opening_balance bigint not null check (opening_balance >= 0 and opening_balance <= 1000000000000),
  expected_balance bigint check (expected_balance >= 0 and expected_balance <= 1000000000000),
  counted_balance bigint check (counted_balance >= 0 and counted_balance <= 1000000000000),
  difference bigint,
  opening_note text not null default '' check (char_length(opening_note) <= 500),
  closing_note text not null default '' check (char_length(closing_note) <= 500),
  reconciliation_note text not null default '' check (char_length(reconciliation_note) <= 500),
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  reconciled_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  reconciled_at timestamptz,
  unique (salon_id, id),
  foreign key (salon_id, branch_id) references public.branches(salon_id, id) on delete restrict,
  foreign key (salon_id, register_id) references public.cash_registers(salon_id, id) on delete restrict,
  check (
    (status = 'open'
      and expected_balance is null and counted_balance is null and difference is null
      and closed_by is null and closed_at is null and reconciled_by is null and reconciled_at is null
      and closing_note = '' and reconciliation_note = '')
    or (status in ('closed', 'reconciled')
      and expected_balance is not null and counted_balance is not null and difference is not null
      and difference = counted_balance - expected_balance
      and closed_by is not null and closed_at is not null and closed_at >= opened_at)
  ),
  check (
    status <> 'reconciled'
    or (reconciled_by is not null and reconciled_at is not null and reconciled_at >= closed_at)
  )
);
create unique index cash_sessions_one_open_per_register
  on public.cash_sessions (register_id) where status = 'open';
create index cash_sessions_salon_opened_idx on public.cash_sessions (salon_id, opened_at desc);
create index cash_sessions_branch_status_idx on public.cash_sessions (salon_id, branch_id, status);

alter table public.cash_registers enable row level security;
alter table public.cash_sessions enable row level security;

create policy cash_registers_read_finance on public.cash_registers for select to authenticated
  using (private.has_salon_permission(salon_id, 'cash.read'));
create policy cash_sessions_read_finance on public.cash_sessions for select to authenticated
  using (private.has_salon_permission(salon_id, 'cash.read'));

revoke all on public.cash_registers, public.cash_sessions from anon, authenticated;
grant select on public.cash_registers, public.cash_sessions to authenticated;

-- Une session ne peut pas être supprimée. Seules les transitions contrôlées
-- open -> closed -> reconciled sont possibles, sans réécrire le fond de caisse.
create function private.protect_cash_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Cash sessions are immutable' using errcode = '23514';
  end if;
  if old.status = 'open' and new.status = 'closed' then
    if (to_jsonb(old) - array['status', 'expected_balance', 'counted_balance', 'difference', 'closing_note', 'closed_by', 'closed_at'])
       = (to_jsonb(new) - array['status', 'expected_balance', 'counted_balance', 'difference', 'closing_note', 'closed_by', 'closed_at']) then
      return new;
    end if;
  elsif old.status = 'closed' and new.status = 'reconciled' then
    if (to_jsonb(old) - array['status', 'reconciliation_note', 'reconciled_by', 'reconciled_at'])
       = (to_jsonb(new) - array['status', 'reconciliation_note', 'reconciled_by', 'reconciled_at']) then
      return new;
    end if;
  end if;
  raise exception 'Cash session transition not allowed' using errcode = '23514';
end;
$$;
create trigger cash_sessions_protect
  before update or delete on public.cash_sessions
  for each row execute function private.protect_cash_session();

create function public.ensure_default_register(p_salon_id uuid, p_branch_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_register_id uuid;
begin
  if not private.has_salon_permission(p_salon_id, 'cash.open') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.branches b where b.salon_id = p_salon_id and b.id = p_branch_id) then
    raise exception 'Invalid branch' using errcode = '22023';
  end if;
  insert into public.cash_registers(salon_id, branch_id, name)
    values (p_salon_id, p_branch_id, 'Caisse principale')
    on conflict (branch_id) do nothing
    returning id into v_register_id;
  if v_register_id is null then
    select id into v_register_id from public.cash_registers
      where salon_id = p_salon_id and branch_id = p_branch_id;
  end if;
  return v_register_id;
end;
$$;
revoke all on function public.ensure_default_register(uuid, uuid) from public, anon;
grant execute on function public.ensure_default_register(uuid, uuid) to authenticated;

create function public.open_cash_session(
  p_salon_id uuid,
  p_branch_id uuid,
  p_opening_balance bigint,
  p_register_id uuid default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_register_id uuid := p_register_id;
  v_active boolean;
  v_session_id uuid;
begin
  if not private.has_salon_permission(p_salon_id, 'cash.open') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_opening_balance is null or p_opening_balance < 0 or p_opening_balance > 1000000000000 then
    raise exception 'Invalid opening balance' using errcode = '22023';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Invalid note' using errcode = '22023';
  end if;
  if v_register_id is null then
    v_register_id := public.ensure_default_register(p_salon_id, p_branch_id);
  end if;

  select r.is_active into v_active
    from public.cash_registers r
    where r.id = v_register_id and r.salon_id = p_salon_id and r.branch_id = p_branch_id
    for update;
  if not found or not v_active then
    raise exception 'Invalid or inactive cash register' using errcode = '22023';
  end if;
  if exists (select 1 from public.cash_sessions s where s.register_id = v_register_id and s.status = 'open') then
    raise exception 'A cash session is already open for this register' using errcode = '22023';
  end if;

  insert into public.cash_sessions(salon_id, branch_id, register_id, opening_balance, opening_note, opened_by)
    values (p_salon_id, p_branch_id, v_register_id, p_opening_balance, btrim(coalesce(p_note, '')), auth.uid())
    returning id into v_session_id;
  return v_session_id;
end;
$$;
revoke all on function public.open_cash_session(uuid, uuid, bigint, uuid, text) from public, anon;
grant execute on function public.open_cash_session(uuid, uuid, bigint, uuid, text) to authenticated;
